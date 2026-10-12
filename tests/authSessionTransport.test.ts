import assert from 'node:assert/strict'
import test from 'node:test'
import { apiConfirmRegistration, apiLogin, apiReceiptConfig, apiUpgradeSession, apiLogout } from '../src/api.ts'

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
