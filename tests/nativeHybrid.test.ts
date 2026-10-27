import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeApiUrl, nativeRequestOptions } from '../src/native/http.ts'
import { base64url, completeNativeLogin, nativeAccount, nativeReturnId } from '../src/native/auth.ts'
import { widgetSnapshot } from '../src/native/widget.ts'
import type { CardStatement, CardWithdrawal, PaymentMethod } from '../src/types.ts'

const date = (month: number, day: number) => new Date(2026, month - 1, day).getTime()
const method: PaymentMethod = { id: 'card', name: 'card', type: 'credit', closingDay: 31, paymentDay: 27, updatedAt: 1, deleted: false }
const row = (month: number, day: number, amountYen: number, methodId = 'card'): CardWithdrawal => ({ methodId, methodName: methodId, closingDay: 31, paymentDay: day, withdrawalAtMillis: date(month, day), amountYen, expenseAmountYen: amountYen, chargeAmountYen: 0, itemCount: 1 })
const statement = (status: CardStatement['status'], actualAmountYen: number): CardStatement => ({ id: 's', paymentMethodId: 'card', withdrawalAtMillis: date(10, 27), actualAmountYen, status, note: '', deleted: false, updatedAt: 2 })

test('native API routes cannot redirect cookies to another origin or a normalized non-API path', () => {
  assert.equal(nativeApiUrl('/auth/login'), 'https://app.kakeibodata.com/auth/login')
  for (const value of ['https://evil.test/auth', '//evil.test/auth', '/auth/../pr', '/auth/%2e%2e/pr', '/auth\\evil', '/legal/privacy.html']) assert.throws(() => nativeApiUrl(value))
})
test('native JSON uses canonical Origin and JSON object body; multipart preserves file bytes without original filename', async () => {
  const json = await nativeRequestOptions('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'test', password: 'private' }) })
  assert.equal(json.headers?.origin, 'https://app.kakeibodata.com')
  assert.deepEqual(json.data, { identifier: 'test', password: 'private' })
  assert.equal(json.disableRedirects, true)
  const form = new FormData(); form.set('file', new File([new Uint8Array([0, 255, 42])], 'private-name.png', { type: 'image/png' })); form.set('mode', 'local')
  const multipart = await nativeRequestOptions('/ocr/receipt', { method: 'POST', body: form })
  assert.equal(multipart.dataType, 'formData')
  assert.deepEqual(multipart.data, [{ key: 'file', value: 'AP8q', type: 'base64File', fileName: 'receipt.png', contentType: 'image/png' }, { key: 'mode', value: 'local', type: 'string' }])
})
test('widget calendar month excludes paid statements and next month, preserves confirmed statement values', () => {
  const result = widgetSnapshot({ owner: 'u', calculated: [row(10, 1, 100), row(10, 27, 200), row(11, 1, 900)], statements: [statement('confirmed', 250)], methods: [method], lastSync: date(10, 20), syncError: false, online: true, timestamp: date(10, 25) })
  assert.equal(result.monthTotal, 350)
  assert.equal(result.nextDate, date(10, 27)); assert.equal(result.nextAmount, 250)
  assert.equal(result.monthKey, '2026-10')
  const paid = widgetSnapshot({ owner: 'u', calculated: [row(10, 27, 200)], statements: [statement('paid', 250)], methods: [method], lastSync: 1, syncError: true, online: false, timestamp: date(10, 25) })
  assert.equal(paid.monthTotal, 0); assert.equal(paid.nextDate, null); assert.equal(paid.state, 'error')
})
test('PKCE return URLs allow only the fixed authentication destination', () => {
  const id = 'a'.repeat(43)
  assert.equal(nativeReturnId(`kakeibo-native://auth?id=${id}`), id)
  for (const url of [`https://evil.test/auth?id=${id}`, `kakeibo-native://evil?id=${id}`, `kakeibo-native://auth/other?id=${id}`, 'kakeibo-native://auth?id=short']) assert.equal(nativeReturnId(url), null)
  assert.equal(base64url(new Uint8Array([255, 239, 0])), '_-8A')
})
test('native session conversion preserves profile fields and refuses raw bearer tokens', () => {
  assert.deepEqual(nativeAccount({ token: 'cookie', uid: 'u', nickname: 'N', email: 'e', phone: 'p', avatar_data_url: 'data:image/png;base64,x', email_verified: true }), { token: 'cookie', uid: 'u', nickname: 'N', email: 'e', phone: 'p', avatarDataUrl: 'data:image/png;base64,x', emailVerified: true })
  assert.throws(() => nativeAccount({ token: 'secret', uid: 'u', nickname: 'N', email: 'e', phone: 'p' }))
})
test('unapproved exchange stays pending; wrong return id never submits verifier; approved flow is consumed', async (t) => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key) } }
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
  t.after(() => { Reflect.deleteProperty(globalThis, 'sessionStorage') })
  const id = 'a'.repeat(43)
  values.set('kakeibo:native-pkce', JSON.stringify({ id, verifier: 'v'.repeat(43), expires: Date.now() + 60000 }))
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return calls === 1 ? Response.json({ status: 'pending' }, { status: 202 }) : Response.json({ token: 'cookie', uid: 'u', nickname: 'N', email: 'e', phone: 'p' }) })
  await assert.rejects(completeNativeLogin('other'))
  assert.equal(calls, 0)
  assert.equal(await completeNativeLogin(id), null)
  assert.equal(values.size, 1)
  assert.equal((await completeNativeLogin(id) as { uid: string }).uid, 'u')
  assert.equal(values.size, 0)
})
