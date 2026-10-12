import assert from 'node:assert/strict'
import test from 'node:test'
import { apiConfirmRegistration, apiLogin, apiReceiptConfig, apiUpgradeSession, apiLogout, apiReadProfile, apiRequestCurrentEmailVerification, apiConfirmCurrentEmailVerification } from '../src/api.ts'

test('cookie-mode login and registration confirmation use the session header without a bearer token', async (t) => {
  const calls: Array<{ url: string; options: RequestInit }> = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json({ token: 'cookie', uid: 'u1', nickname: 'N', email: 'n@example.com', phone: '090' })
  })

  const login = await apiLogin('n@example.com', 'password')
  const confirmed = await apiConfirmRegistration('v1', '123456')
  assert.equal(login.token, 'cookie')
  assert.equal(confirmed.token, 'cookie')
  assert.deepEqual(calls.map(({ url }) => url), ['/auth/login', '/auth/register/confirm'])
  for (const { options } of calls) {
    const headers = options.headers as Record<string, string>
    assert.equal(headers['X-Kakeibo-Session'], 'cookie')
    assert.equal(headers['X-Kakeibo-Registration'], 'email-v1')
    assert.equal(headers.Authorization, undefined)
    assert.equal(options.credentials, 'same-origin')
  }
})

test('legacy-session upgrade preserves the bearer token on the first upgrade request', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/auth/session')
    assert.equal(options.method, 'POST')
    const headers = options.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer legacy-token')
    assert.equal(headers['X-Kakeibo-Session'], 'cookie')
    assert.deepEqual(JSON.parse(options.body as string), { mode: 'cookie' })
    return Response.json({ token: 'cookie', uid: 'u1', nickname: 'N', email: 'n@example.com', phone: '090' })
  })
  assert.equal((await apiUpgradeSession('legacy-token')).token, 'cookie')
})

test('the cookie sentinel is never sent as Authorization by shared or direct-fetch helpers', async (t) => {
  const calls: Array<{ url: string; options: RequestInit }> = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url) === '/ocr/config') return Response.json({ ai_available: true })
    return Response.json({ ok: true })
  })

  await apiLogout('cookie')
  assert.equal(await apiReceiptConfig('cookie'), true)
  for (const { options } of calls) {
    const headers = options.headers as Record<string, string>
    assert.equal(headers.Authorization, undefined)
    assert.equal(headers['X-Kakeibo-Session'], 'cookie')
  }
})

test('verification state is normalized when present and stays unknown for older responses', async (t) => {
  const responses = [
    { token: 'cookie', uid: 'u1', nickname: 'N', email: 'n@example.com', phone: '090', email_verified: false },
    { token: 'cookie', uid: 'u2', nickname: 'Old', email: 'old@example.com', phone: '080' },
    { uid: 'u1', nickname: 'N', email: 'n@example.com', phone: '090', email_verified: true },
  ]
  const calls: Array<{ url: string; options: RequestInit }> = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json(responses.shift())
  })

  const unverified = await apiLogin('n@example.com', 'password')
  const legacy = await apiLogin('old@example.com', 'password')
  const profile = await apiReadProfile('cookie')
  assert.equal(unverified.emailVerified, false)
  assert.equal(Object.hasOwn(legacy, 'emailVerified'), false)
  assert.equal(profile.emailVerified, true)
  assert.equal(calls[2].url, '/auth/profile')
  assert.equal(calls[2].options.method ?? 'GET', 'GET')
  assert.equal((calls[2].options.headers as Record<string, string>)['X-Kakeibo-Session'], 'cookie')
})

test('existing-email verification uses authenticated cookie endpoints and the documented request bodies', async (t) => {
  const calls: Array<{ url: string; options: RequestInit }> = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/request')) {
      return Response.json({ status: 'verification_required', verification_id: 'v1', email: 'n@example.com', expires_at: 1_800_000_000 })
    }
    return Response.json({ uid: 'u1', nickname: 'N', email: 'n@example.com', phone: '090', email_verified: true })
  })

  const challenge = await apiRequestCurrentEmailVerification('cookie')
  const profile = await apiConfirmCurrentEmailVerification('cookie', challenge.verification_id, '123456')
  assert.deepEqual(calls.map(({ url }) => url), [
    '/auth/profile/email/verification/request',
    '/auth/profile/email/verification/confirm',
  ])
  assert.deepEqual(JSON.parse(calls[0].options.body as string), {})
  assert.deepEqual(JSON.parse(calls[1].options.body as string), { verification_id: 'v1', code: '123456' })
  for (const { options } of calls) {
    const headers = options.headers as Record<string, string>
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'same-origin')
    assert.equal(headers['X-Kakeibo-Session'], 'cookie')
    assert.equal(headers.Authorization, undefined)
  }
  assert.equal(profile.emailVerified, true)
})
