import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import test from 'node:test'
import { normalizePaymentNetworks, validPaymentNetworks, receiptPaymentNetwork } from '../src/paymentNetworks.ts'
import { matchReceiptPayment, type ReceiptPayment } from '../src/receipt.ts'
import type { PaymentMethod } from '../src/types.ts'
import { apiSync } from '../src/api.ts'
import { sameRecord } from '../src/sync/records.ts'
import type { SyncTables } from '../src/sync/types.ts'
import { KakeiboDB } from '../src/db.ts'
import { applySyncChanges, readSyncSnapshot } from '../src/sync/local.ts'

const method = (id: string, networks: PaymentMethod['paymentNetworks'] = [], suffix = '0123'): PaymentMethod => ({
  id, name: id, type: 'credit', cardLastFour: suffix, paymentNetworks: networks,
  closingDay: 31, paymentDay: 27, updatedAt: 1, deleted: false,
})
const receipt = (changes: Partial<ReceiptPayment> = {}): ReceiptPayment => ({
  paymentType: 'electronic', paymentLabel: 'QUICPay', cardLastFour: '', paymentConfidence: 'certain', ...changes,
})
const changes = (methods: PaymentMethod[]): SyncTables => ({
  expenses: [], members: [], categories: [], expenseSplits: [], settlements: [], paymentMethods: methods,
  prepaidCharges: [], recurringTemplates: [], budgets: [], cardStatements: [], cashAccounts: [], accountTransfers: [], expenseRefunds: [],
})

test('支払方式は対応値だけを重複なく一定順序で保持する', () => {
  assert.deepEqual(normalizePaymentNetworks(['id', 'quicpay', 'id', 'visa']), ['quicpay', 'id'])
  assert.deepEqual(normalizePaymentNetworks(undefined), [])
  assert.deepEqual(normalizePaymentNetworks('id'), [])
  assert.equal(validPaymentNetworks(['id', 'quicpay']), true)
  assert.equal(validPaymentNetworks(['id', 'id']), false)
  assert.equal(validPaymentNetworks(['visa']), false)
})

test('QUICPay・クイックペイ・iDの支払表示を正規化するが対応案内や複数方式を採用しない', () => {
  for (const label of ['QUICPay', 'QUICPay+', 'ＱＵＩＣＰａｙ', 'クイックペイ', 'QUICPay支払']) assert.equal(receiptPaymentNetwork(label), 'quicpay', label)
  for (const label of ['iD', 'ｉＤ', 'iD決済']) assert.equal(receiptPaymentNetwork(label), 'id', label)
  for (const label of ['VISA', 'QUICPay / iD', 'QUICPay対応', 'ポイントID', 'unknown']) assert.equal(receiptPaymentNetwork(label), null, label)
})

test('方式が明示され、紐づくカードが1件のときだけ選択する', () => {
  for (const type of ['credit', 'debit', 'prepaid'] as const) {
    assert.equal(matchReceiptPayment(receipt(), [{ ...method('one', ['quicpay']), type }, method('other')]).id, 'one')
  }
  assert.equal(matchReceiptPayment(receipt({ paymentLabel: 'iD' }), [method('one', ['id'])]).id, 'one')
  assert.equal(matchReceiptPayment(receipt(), [method('one', ['quicpay']), method('two', ['quicpay'])]).id, '')
  assert.equal(matchReceiptPayment(receipt(), [method('one')]).id, '')
  assert.equal(matchReceiptPayment(receipt(), [{ ...method('one', ['quicpay']), deleted: true }]).id, '')
  for (const type of ['cash', 'other'] as const) assert.equal(matchReceiptPayment(receipt(), [{ ...method('one', ['quicpay']), type }]).id, '')
})

test('番号との矛盾・不明・併用を方式だけで上書きしない', () => {
  const cards = [method('one', ['quicpay'], '0123'), method('two', ['id'], '4567')]
  assert.equal(matchReceiptPayment(receipt({ cardLastFour: '4567' }), cards).id, '')
  assert.equal(matchReceiptPayment(receipt({ cardLastFour: '9999' }), cards).id, '')
  for (const override of [{ paymentConfidence: 'uncertain' }, { paymentType: 'mixed' }, { paymentType: 'unknown' }]) {
    assert.equal(matchReceiptPayment(receipt(override), cards).id, '')
  }
  assert.equal(matchReceiptPayment(receipt({ paymentType: 'cash' }), [{ ...method('cash'), type: 'cash' }]).id, '')
  assert.equal(matchReceiptPayment(receipt({ cardLastFour: '0123' }), cards).id, 'one')
  assert.equal(matchReceiptPayment(receipt({ cardLastFour: '0123' }), [method('one', ['quicpay']), method('two', ['id'])]).id, 'one')
})

test('配列を含む同期レコードも同値なら再書き込みしない', () => {
  assert.equal(sameRecord(method('one', ['quicpay']), method('one', ['quicpay'])), true)
  assert.equal(sameRecord(method('one', ['quicpay']), method('one', ['id'])), false)
  assert.equal(sameRecord(method('one', ['quicpay']), method('one', [])), false)
})

test('方式属性の端末内保存と同期の再適用でも同値なら書き込みゼロ', async () => {
  const database = new KakeiboDB(`network-test-${crypto.randomUUID()}`)
  try {
    const row = method('network-card', ['quicpay', 'id'])
    await database.paymentMethods.put(row)
    assert.deepEqual((await readSyncSnapshot(database)).paymentMethods[0].paymentNetworks, ['quicpay', 'id'])
    assert.equal(await applySyncChanges(changes([method('network-card', ['quicpay', 'id'])]), database), 0)
    assert.equal(await applySyncChanges(changes([method('network-card', [])]), database), 1)
    assert.deepEqual((await database.paymentMethods.get('network-card'))?.paymentNetworks, [])
  } finally { await database.delete() }
})

test('支払方式はAPI同期往復を保持し、旧レコードの省略と明示解除を区別する', async (t) => {
  const legacy = method('legacy'); delete legacy.paymentNetworks
  const rows = [method('one', ['quicpay', 'id']), method('cleared', []), legacy]
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    assert.deepEqual(body.changes.payment_methods[0].payment_networks, ['quicpay', 'id'])
    assert.deepEqual(body.changes.payment_methods[1].payment_networks, [])
    assert.equal(Object.hasOwn(body.changes.payment_methods[2], 'payment_networks'), false)
    return Response.json({ server_time: 1, changes: body.changes, debts: [] })
  })
  const result = await apiSync('fixture', 0, changes(rows))
  assert.deepEqual(result.changes.paymentMethods.map((row) => row.paymentNetworks), [['quicpay', 'id'], [], []])
})
