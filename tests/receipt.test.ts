import assert from 'node:assert/strict'
import test from 'node:test'
import { matchReceiptPayment, receiptDateMillis, type ReceiptPayment } from '../src/receipt.ts'
import type { PaymentMethod } from '../src/types.ts'

const method = (id: string, last = '0123'): PaymentMethod => ({ id, name: id, type: 'credit', cardLastFour: last, closingDay: 31, paymentDay: 27, updatedAt: 0, deleted: false })
const receipt = (changes: Partial<ReceiptPayment> = {}): ReceiptPayment => ({ paymentType: 'card', paymentLabel: 'VISA', cardLastFour: '0123', paymentConfidence: 'certain', ...changes })

test('末尾4桁は先頭ゼロを保持し、一意な場合だけ一致する', () => {
  assert.equal(matchReceiptPayment(receipt(), [method('card')]).id, 'card')
  assert.equal(matchReceiptPayment(receipt(), [method('card'), method('other')]).id, '')
  assert.equal(matchReceiptPayment(receipt(), [method('card', '1234')]).id, '')
  assert.equal(matchReceiptPayment(receipt(), [{ ...method('deleted'), deleted: true }]).id, '')
})

test('不明・併用・ブランド名だけではカードを自動選択しない', () => {
  const cards = [method('VISA')]
  for (const changes of [{ paymentConfidence: 'uncertain' }, { paymentType: 'mixed' }, { cardLastFour: '' }]) {
    assert.equal(matchReceiptPayment(receipt(changes), cards).id, '')
  }
})

test('現金は一意、電子マネーは名前が完全一致する場合だけ選択する', () => {
  const cash = { ...method('cash', ''), type: 'cash' as const }
  assert.equal(matchReceiptPayment(receipt({ paymentType: 'cash', cardLastFour: '' }), [cash]).id, 'cash')
  assert.equal(matchReceiptPayment(receipt({ paymentType: 'cash', cardLastFour: '' }), [cash, { ...cash, id: 'cash2' }]).id, '')
  const suica = { ...method('suica', ''), name: 'Suica', type: 'prepaid' as const }
  assert.equal(matchReceiptPayment(receipt({ paymentType: 'electronic', paymentLabel: 'Ｓｕｉｃａ', cardLastFour: '' }), [suica]).id, 'suica')
  assert.equal(matchReceiptPayment(receipt({ paymentType: 'electronic', paymentLabel: 'Suica', cardLastFour: '' }), [{ ...suica, name: 'Suica通学用' }]).id, '')
})

test('存在しない日付は自動入力しない', () => {
  assert.equal(receiptDateMillis('2026-02-30'), null)
  assert.equal(receiptDateMillis(''), null)
  assert.notEqual(receiptDateMillis('2024-02-29'), null)
})
