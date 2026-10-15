import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createGmailCompletion, GMAIL_COMPLETION_KEY, GMAIL_CONNECTIONS_URL, gmailCandidates, gmailCompletionPending, gmailDisconnectOutcome, gmailOpenReason, gmailRequest, googleAuthorizationUrl, pushApplicationKey, pushDeviceId } from '../src/imports/gmail.ts'

const candidate = { kind: 'card_usage', provider: 'smbc_card', paymentType: 'debit', merchant: '<script>not executed</script>', amountYen: 980, purchasedAtMillis: 1790825696000, cardLastFour: '', warnings: [] }
test('Gmail candidates validate bounded transaction-only shapes and identifiers', () => {
  const item = { id: 'candidate-1', candidate, createdAt: 1 }
  assert.deepEqual(gmailCandidates({ items: [item] }), [item])
  assert.throws(() => gmailCandidates({ items: [{ ...item, id: '../another' }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, amountYen: -1 } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, purchasedAtMillis: Infinity } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, merchant: 'x'.repeat(301) } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, cardLastFour: '123456' } }] }))
  assert.throws(() => gmailCandidates({ items: Array.from({ length: 201 }, () => item) }))
})
test('Gmail callback only recognizes fixed local intents and Google OAuth destination', () => {
  assert.equal(gmailOpenReason('?gmail=connected'), 'connected')
  assert.equal(gmailOpenReason('?gmail=candidates'), 'candidates')
  assert.equal(gmailOpenReason('?gmail=error'), 'error')
  assert.equal(gmailOpenReason('?gmail=complete'), 'complete')
  assert.equal(gmailOpenReason('?gmail=https://evil.example'), null)
  assert.equal(googleAuthorizationUrl('https://accounts.google.com/o/oauth2/v2/auth?state=test'), 'https://accounts.google.com/o/oauth2/v2/auth?state=test')
  assert.throws(() => googleAuthorizationUrl('https://accounts.google.com.evil.example/o/oauth2/auth'))
  assert.throws(() => googleAuthorizationUrl('https://user@accounts.google.com/o/oauth2/auth'))
})
test('Gmail disconnect reports remote revocation only when explicitly confirmed', () => {
  const revoked = gmailDisconnectOutcome({ ok: true, revoked: true })
  assert.equal(revoked.disconnected, true)
  assert.equal(revoked.revoked, true)
  assert.match(revoked.message, /家計簿側/u)
  assert.match(revoked.message, /Google側/u)
  assert.match(revoked.message, /保存済み/u)

  for (const value of [{ ok: true, revoked: false }, { ok: true }, { ok: true, revoked: 'true' }]) {
    const outcome = gmailDisconnectOutcome(value)
    assert.equal(outcome.disconnected, true)
    assert.equal(outcome.revoked, false)
    assert.match(outcome.message, /取り消せたことを確認できません/u)
    assert.match(outcome.message, /家計簿側/u)
    assert.match(outcome.message, /保存済み/u)
  }
  for (const value of [{ ok: false, revoked: true }, { revoked: true }, null, []]) {
    const outcome = gmailDisconnectOutcome(value)
    assert.equal(outcome.disconnected, false)
    assert.equal(outcome.revoked, false)
    assert.match(outcome.message, /解除を確認できません/u)
    assert.doesNotMatch(outcome.message, /解除しました/u)
    assert.match(outcome.message, /保存済み/u)
  }
  assert.equal(GMAIL_CONNECTIONS_URL, 'https://myaccount.google.com/connections')
})
test('Staged Gmail completion is authenticated POST and StrictMode replay shares one attempt; errors remain retryable', async () => {
  const original = globalThis.fetch
  const calls: RequestInit[] = []
  globalThis.fetch = async (input, options) => {
    assert.equal(input, '/integrations/gmail/complete')
    calls.push(options!)
    return calls.length === 1 ? new Response(JSON.stringify({ detail: '本人確認をやり直してください' }), { status: 403 }) : new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  try {
    const complete = createGmailCompletion()
    const first = complete('owner-a', 'cookie')
    assert.equal(complete('owner-a', 'cookie'), first)
    await assert.rejects(first, /本人確認/u)
    assert.equal(calls.length, 1)
    await complete('owner-a', 'cookie', 1)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].body, '{}')
    assert.equal(calls[0].credentials, 'same-origin')
    await assert.rejects(complete('', ''), /ログイン/u)
    assert.equal(calls.length, 2)
  } finally { globalThis.fetch = original }
})
test('Nonsecret completion intent survives login redirect without storing Google code or token', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.equal(gmailCompletionPending('', storage), false)
  assert.equal(gmailCompletionPending('?gmail=complete', storage), true)
  assert.deepEqual([...values], [[GMAIL_COMPLETION_KEY, '1']])
  assert.equal(gmailCompletionPending('?social=complete', storage), true)
  assert.equal(gmailCompletionPending('?gmail=complete', { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }), true)
})
test('Push public key and device binding are validated without notification side effects', () => {
  const encoded = Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url')
  assert.equal(pushApplicationKey(encoded).length, 65)
  assert.throws(() => pushApplicationKey('bad-key'))
  let saved = ''
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
  assert.equal(pushDeviceId(storage), saved)
  assert.equal(pushDeviceId(storage), saved)
})
test('Integration API is uncached same-origin authenticated and exposes only bounded plain error detail', async () => {
  const original = globalThis.fetch
  let init: RequestInit | undefined
  globalThis.fetch = async (input, options) => {
    assert.equal(input, '/integrations/gmail/settings')
    init = options
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  try {
    await gmailRequest('cookie', 'gmail/settings', { enabled: false })
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.credentials, 'same-origin')
    assert.equal((init?.headers as Record<string, string>)['X-Kakeibo-Session'], 'cookie')
    assert.equal((init?.headers as Record<string, string>).Authorization, undefined)
    globalThis.fetch = async () => new Response('<h1>server error</h1>', { status: 500 })
    await assert.rejects(gmailRequest('cookie', 'gmail/status'), /Gmail連携の操作に失敗しました/u)
  } finally { globalThis.fetch = original }
})
test('Push ignores untrusted payload and fixed click opens candidate prompt without navigating existing draft', async () => {
  const listeners: Record<string, (event: Record<string, unknown>) => void> = {}
  let notification: { title: string; options: Record<string, unknown> } | undefined
  let message: unknown, opened = '', focused = false
  const client = { url: 'https://app.kakeibodata.com/', focus: async () => { focused = true }, postMessage: (value: unknown) => { message = value } }
  let windows: unknown[] = [client]
  vm.runInNewContext(await readFile(new URL('../public/push-events.js', import.meta.url), 'utf8'), {
    URL, self: {
      location: { origin: 'https://app.kakeibodata.com' },
      addEventListener: (name: string, callback: (event: Record<string, unknown>) => void) => { listeners[name] = callback },
      registration: { showNotification: async (title: string, options: Record<string, unknown>) => { notification = { title, options } } },
      clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened = url } },
    },
  })
  let pending: Promise<void> = Promise.resolve()
  const waitUntil = (value: Promise<void>) => { pending = value }
  listeners.push({ data: { json: () => ({ url: 'https://evil.example', amount: 100, merchant: 'PRIVATE' }) }, waitUntil })
  await pending
  assert.equal(notification?.title, '家計簿')
  assert.ok(!JSON.stringify(notification).includes('PRIVATE'))
  listeners.notificationclick({ notification: { close() {} }, waitUntil })
  await pending
  assert.equal(focused, true)
  assert.equal(JSON.stringify(message), JSON.stringify({ type: 'GMAIL_CANDIDATES' }))
  assert.equal(opened, '')
  windows = []
  listeners.notificationclick({ notification: { close() {} }, waitUntil })
  await pending
  assert.equal(opened, '/?gmail=candidates')
})
