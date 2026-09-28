import assert from 'node:assert/strict'
import test from 'node:test'
import { apiSocialStart, apiSocialComplete, apiSocialRegister, apiSocialUnlink, apiSocialCancel, ApiError } from '../src/api.ts'

test('外部認証は同一オリジンのPOSTから開始し、ログイントークンをURLへ入れない', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/auth/social/google/start')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.deepEqual(JSON.parse(options.body), { link: true, current_password: 'test-password' })
    return Response.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' })
  })
  assert.ok((await apiSocialStart('google', 'test-token', 'test-password')).url.startsWith('https://'))
})

test('外部認証完了は既存のAccount形式へ変換する', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/auth/social/complete')
    assert.equal(options.method, 'POST')
    return Response.json({ status: 'authenticated', account: { token: 'test', uid: 'uid', nickname: 'test', email: 'test@example.com', phone: 'test', avatar_data_url: '' } })
  })
  const response = await apiSocialComplete()
  assert.equal(response.status, 'authenticated')
  if (response.status === 'authenticated') assert.equal(response.account.avatarDataUrl, '')
})

test('初回登録と連携完了をログイン結果と混同しない', async (t) => {
  let response: unknown = { status: 'signup', provider: 'line' }
  t.mock.method(globalThis, 'fetch', async () => Response.json(response))
  assert.deepEqual(await apiSocialComplete(), response)
  response = { status: 'linked' }
  assert.deepEqual(await apiSocialComplete('test'), response)
})

test('外部認証の初回登録は専用のエンドポイントを使う', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/auth/social/register')
    assert.equal(options.method, 'POST')
    assert.equal(JSON.parse(options.body).password, 'test-password')
    return Response.json({ token: 'test', uid: 'uid', nickname: 'test', email: 'test@example.com', phone: 'test' })
  })
  assert.equal((await apiSocialRegister('test', 'test@example.com', 'test', 'test-password')).uid, 'uid')
})

test('解除にはBearer認証と現在のパスワード、取消にはPOSTを使う', async (t) => {
  const calls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(String(url))
    if (String(url).endsWith('/connection')) {
      assert.equal(options.method, 'DELETE')
      assert.equal(options.headers.Authorization, 'Bearer test')
      assert.deepEqual(JSON.parse(options.body), { current_password: 'test-password' })
    } else assert.equal(options.method, 'POST')
    return Response.json({ ok: true })
  })
  await apiSocialUnlink('x', 'test', 'test-password')
  await apiSocialCancel()
  assert.deepEqual(calls, ['/auth/social/x/connection', '/auth/social/cancel'])
})

test('認証失敗を成功や新規登録として扱わない', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: '認証の有効期限が切れました' }, { status: 400 }))
  await assert.rejects(apiSocialComplete(), (error: unknown) => error instanceof ApiError && error.status === 400)
})
