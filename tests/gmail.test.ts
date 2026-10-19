import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createGmailCompletion, GMAIL_COMPLETION_KEY, GMAIL_CONNECTIONS_URL, gmailAiStatusSummary, gmailCandidates, gmailDateToInput, gmailCompletionPending, gmailDisconnectOutcome, gmailOpenReason, gmailPaymentOptions, gmailPaymentTypeMismatch, gmailRequest, gmailReviewTimestamp, googleAuthorizationUrl, pushApplicationKey, pushDeviceId, reviewGmailCandidate, sendPushTest } from '../src/imports/gmail.ts'
import type { PaymentMethod } from '../src/types.ts'

test('Gmail review uses JST, preserves unchanged seconds, and rejects missing or impossible dates', () => {
  const original = Date.parse('2026-10-17T18:08:46+09:00')
  assert.equal(gmailDateToInput(original), '2026-10-17T18:08')
  assert.equal(gmailReviewTimestamp(original, '2026-10-17T18:08'), original)
  assert.equal(gmailReviewTimestamp(null, '2026-10-17T18:09'), Date.parse('2026-10-17T18:09:00+09:00'))
  assert.equal(gmailDateToInput(null), '')
  for (const input of ['', '2026-02-31T12:00', '2026-10-17T25:00', '2026-10-17T18:00Z']) {
    assert.ok(Number.isNaN(gmailReviewTimestamp(null, input)))
  }
})

const candidate = { kind: 'card_usage', provider: 'smbc_card', paymentType: 'debit', merchant: '<script>not executed</script>', amountYen: 980, purchasedAtMillis: 1790825696000, cardLastFour: '', warnings: [] }
const paymentMethod = (id: string, type: PaymentMethod['type'], deleted = false): PaymentMethod => ({ id, type, deleted, updatedAt: 1, name: id, closingDay: 0, paymentDay: 0 })
test('Gmail payment options include each active card type and exclude cash, other, and deleted methods', () => {
  const methods = [paymentMethod('credit', 'credit'), paymentMethod('debit', 'debit'), paymentMethod('prepaid', 'prepaid'), paymentMethod('cash', 'cash'), paymentMethod('other', 'other'), paymentMethod('deleted-credit', 'credit', true)]
  assert.deepEqual(gmailPaymentOptions(methods).map(({ id }) => id), ['credit', 'debit', 'prepaid'])
})
test('Gmail payment mismatch flags credit candidate assigned to debit method', () => {
  assert.equal(gmailPaymentTypeMismatch({ ...candidate, paymentType: 'credit' }, paymentMethod('debit', 'debit')), true)
})
test('Gmail payment mismatch accepts matching card method types', () => {
  assert.equal(gmailPaymentTypeMismatch(candidate, paymentMethod('debit', 'debit')), false)
})
test('Gmail payment mismatch ignores missing methods and unknown candidate type', () => {
  assert.equal(gmailPaymentTypeMismatch(candidate, undefined), false)
  assert.equal(gmailPaymentTypeMismatch({ ...candidate, paymentType: 'unknown' }, paymentMethod('credit', 'credit')), false)
})
test('Gmail payment mismatch applies only to card usage candidates', () => {
  assert.equal(gmailPaymentTypeMismatch({ ...candidate, kind: 'prepaid_charge', paymentType: 'credit' }, paymentMethod('debit', 'debit')), false)
})
test('Gmail candidates validate bounded transaction-only shapes and identifiers', () => {
  const item = { id: 'candidate-1', candidate, createdAt: 1 }
  assert.deepEqual(gmailCandidates({ items: [item] }), [item])
  assert.throws(() => gmailCandidates({ items: [{ ...item, id: '../another' }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, amountYen: -1 } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, purchasedAtMillis: Infinity } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, merchant: 'x'.repeat(301) } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, cardLastFour: '123456' } }] }))
  const hinted = { ...item, candidate: { ...candidate, cardNameHint: 'ANA PAY', subjectHint: 'ANA PAY ご利用' } }
  assert.deepEqual(gmailCandidates({ items: [hinted] }), [hinted])
  for (const hint of [{ cardNameHint: 42 }, { subjectHint: null }, { cardNameHint: 'a'.repeat(101) }, { subjectHint: 'a'.repeat(301) }]) {
    assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, ...hint } }] }))
  }
  assert.throws(() => gmailCandidates({ items: Array.from({ length: 201 }, () => item) }))
  const reviewOnly = ['bank_notice', 'card_bill', 'prepaid_charge', 'refund', 'unsupported'].map((kind) => ({
    id: `review-${kind}`, createdAt: 1,
    candidate: { ...candidate, kind, provider: 'unknown', paymentType: 'prepaid', merchant: '', amountYen: null, purchasedAtMillis: null },
  }))
  assert.equal(gmailCandidates({ items: reviewOnly }).length, 5)
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, kind: 'cash_withdrawal' } }] }))
  assert.throws(() => gmailCandidates({ items: [{ ...item, candidate: { ...candidate, paymentType: 'cash' } }] }))
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
test('Gmail AI status separates connection, discovery setup, new consent, and active states', () => {
  const base = { configured: true, connected: true, email: 'mail@example.com', enabled: false, aiEnabled: false, pendingCount: 0, lastCheckedAt: null, lastError: '', intervalSeconds: 300 }
  const disconnected = gmailAiStatusSummary({ ...base, connected: false })
  assert.equal(disconnected.kind, 'not-connected')
  assert.equal(disconnected.label, 'Gmail未接続')

  for (const discoveryAvailable of [false, undefined]) {
    const serverSetup = gmailAiStatusSummary({ ...base, discoveryAvailable })
    assert.equal(serverSetup.kind, 'server-setup')
    assert.equal(serverSetup.label, 'AI明細検出の設定待ち')
  }

  const consent = gmailAiStatusSummary({ ...base, discoveryAvailable: true })
  assert.equal(consent.kind, 'consent-required')
  assert.match(consent.label, /同意待ち/u)
  assert.match(consent.description, /自動確認待機中/u)

  const legacyEnabled = gmailAiStatusSummary({ ...base, discoveryAvailable: true, aiEnabled: true })
  assert.equal(legacyEnabled.kind, 'consent-required')
  assert.match(legacyEnabled.description, /以前のAI設定がONでも/u)

  const discovery = gmailAiStatusSummary({ ...base, discoveryAvailable: true, aiAvailable: false, aiEnabled: true, discoveryEnabled: true })
  assert.equal(discovery.kind, 'discovery-enabled')
  assert.match(discovery.description, /OpenAI/u)
  assert.match(discovery.description, /過去メールの一括解析/u)
  assert.match(discovery.label, /AI明細検出ON/u)
  assert.match(discovery.description, /三井住友を含む/u)
  assert.equal(gmailAiStatusSummary({ ...base, aiEnabled: true, discoveryEnabled: true, discoveryAvailable: false }).kind, 'server-setup')
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
test('Gmail candidate review posts an explicit date and validates the returned candidate and source', async () => {
  const original = globalThis.fetch
  const expectedSource = `financial-message:v1:${'c'.repeat(64)}`
  let input = '', init: RequestInit | undefined
  try {
    globalThis.fetch = async (url, options) => {
      input = String(url); init = options
      return new Response(JSON.stringify({ id: 'candidate-1', createdAt: 12, candidate: { ...candidate, purchasedAtMillis: 1790825696000 }, source: `financial-message:v1:${'a'.repeat(64)}` }), { status: 200 })
    }
    const reviewed = await reviewGmailCandidate('session', 'candidate-1', 1790825696000, expectedSource)
    assert.equal(input, '/integrations/gmail/candidates/candidate-1/review')
    assert.deepEqual(JSON.parse(String(init?.body)), { purchasedAtMillis: 1790825696000, expectedSource })
    assert.equal(reviewed.candidate.purchasedAtMillis, 1790825696000)
    assert.equal(reviewed.source, `financial-message:v1:${'a'.repeat(64)}`)
    await assert.rejects(reviewGmailCandidate('session', 'candidate-1', NaN, expectedSource), /日時/u)
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 'candidate-1', createdAt: 12, candidate, source: 'not-a-source' }), { status: 200 })
    await assert.rejects(reviewGmailCandidate('session', 'candidate-1', 1790825696000, expectedSource), /更新後/u)
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 'candidate-1', createdAt: 12, candidate: { ...candidate, purchasedAtMillis: 1790825695000 }, source: `financial-message:v1:${'a'.repeat(64)}` }), { status: 200 })
    await assert.rejects(reviewGmailCandidate('session', 'candidate-1', 1790825696000, expectedSource), /更新後/u)
    globalThis.fetch = async () => new Response('{}', { status: 409 })
    await assert.rejects(reviewGmailCandidate('session', 'candidate-1', 1790825696000, expectedSource), /候補一覧を更新/u)
  } finally { globalThis.fetch = original }
})
test('Push test API requires exact accepted response and maps stale subscription to re-registration guidance', async () => {
  const original = globalThis.fetch
  let init: RequestInit | undefined
  try {
    globalThis.fetch = async (input, options) => {
      assert.equal(input, '/integrations/push/test')
      init = options
      return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200 })
    }
    await sendPushTest('session', 'https://push.example/subscription', 'device-id')
    assert.deepEqual(JSON.parse(String(init?.body)), { endpoint: 'https://push.example/subscription', deviceId: 'device-id' })
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, accepted: false }), { status: 200 })
    await assert.rejects(sendPushTest('session', 'https://push.example/subscription', 'device-id'), /受付を確認/u)
    globalThis.fetch = async () => new Response('{}', { status: 409 })
    await assert.rejects(sendPushTest('session', 'https://push.example/subscription', 'device-id'), /登録・再登録/u)
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
  listeners.push({ data: { json: () => ({ type: 'push-test', body: 'PRIVATE', url: 'https://evil.example' }) }, waitUntil })
  await pending
  assert.equal(notification?.title, '家計簿 テスト通知')
  assert.equal(notification?.options.body, 'テスト通知です。家計簿から送信できました。')
  assert.equal(notification?.options.tag, 'kakeibo-push-test')
  assert.ok(!JSON.stringify(notification).includes('PRIVATE'))
  listeners.push({ data: { json: () => { throw new SyntaxError('bad json') } }, waitUntil })
  await pending
  assert.equal(notification?.title, '家計簿')
  assert.equal(notification?.options.body, '確認できる明細候補があります。アプリを開いて確認してください。')
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
