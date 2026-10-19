import assert from 'node:assert/strict'
import test from 'node:test'
import { matchSmbcPayment, type FinancialMessageCandidate } from '../src/imports/smbc.ts'
import type { PaymentMethod } from '../src/types.ts'

const method = (id: string, type: PaymentMethod['type'], lastFour: string, name: string, deleted = false): PaymentMethod => ({
  id, name, type, cardLastFour: lastFour,
  closingDay: type === 'credit' ? 31 : 0,
  paymentDay: type === 'credit' ? 27 : 0,
  updatedAt: 0, deleted,
})

const candidate = (overrides: Partial<FinancialMessageCandidate> = {}): FinancialMessageCandidate => ({
  kind: 'card_usage', provider: 'smbc_card', paymentType: 'credit',
  merchant: 'Sample Market', amountYen: 1280, purchasedAtMillis: Date.UTC(2026, 3, 12),
  cardLastFour: '', warnings: [],
  ...overrides,
})

test('a subject mentioning a longer different Latin product does not match a name prefix', () => {
  assert.equal(matchSmbcPayment(candidate({ paymentType: 'prepaid', subjectHint: 'ANA PAYPLUS ご利用のお知らせ' }), [
    method('ana', 'prepaid', '4321', 'ANA PAY'),
  ]).id, '')
  assert.equal(matchSmbcPayment(candidate({ paymentType: 'prepaid', subjectHint: 'ANA PAY ご利用のお知らせ' }), [
    method('ana', 'prepaid', '4321', 'ANA PAY'),
  ]).id, 'ana')
})

test('a known card-name hint that contradicts the exact last-four prevents automatic selection', () => {
  const result = matchSmbcPayment(candidate({ cardLastFour: '1234', cardNameHint: 'Travel Card' }), [
    method('number', 'credit', '1234', 'Primary Card'),
    method('name', 'credit', '9999', 'Travel Card'),
  ])
  assert.equal(result.id, '')
})

test('without a last-four, a normalized full registered name in the card name hint can match', () => {
  const result = matchSmbcPayment(candidate({ cardNameHint: 'ＡＢＣ・ゴールド　カード' }), [
    method('abc', 'credit', '4321', 'abc ゴールドカード'),
    method('other', 'credit', '9999', 'Other Card'),
  ])
  assert.equal(result.id, 'abc')
})

test('without a last-four, a normalized full registered name in the subject hint can match', () => {
  const result = matchSmbcPayment(candidate({ subjectHint: 'ご利用のお知らせ（メインカード）' }), [
    method('main', 'credit', '4321', 'メインカード'),
    method('other', 'credit', '9999', 'Other Card'),
  ])
  assert.equal(result.id, 'main')
})

test('duplicate last-four candidates can be disambiguated by a full registered name hint', () => {
  const result = matchSmbcPayment(candidate({ cardLastFour: '1234', cardNameHint: '旅行カード' }), [
    method('daily', 'credit', '1234', '日常カード'),
    method('travel', 'credit', '1234', '旅行カード'),
  ])
  assert.equal(result.id, 'travel')
})

test('issuer and generic brand wording alone do not select a payment method', () => {
  for (const hint of ['三井住友カード', 'Olive', 'Visa', 'クレジットカード']) {
    const result = matchSmbcPayment(candidate({ subjectHint: hint }), [
      method('one', 'credit', '1111', 'メインカード'),
    ])
    assert.equal(result.id, '', hint)
  }
})

test('a card-name hint that only contains a registered name as a substring does not match', () => {
  const result = matchSmbcPayment(candidate({ cardNameHint: 'Main Card Gold' }), [
    method('main', 'credit', '1234', 'Main Card'),
  ])
  assert.equal(result.id, '')
})

test('an explicit unmatched last-four does not fall back to a matching name', () => {
  const result = matchSmbcPayment(candidate({ cardLastFour: '0000', cardNameHint: 'Main Card' }), [
    method('main', 'credit', '1234', 'Main Card'),
  ])
  assert.equal(result.id, '')
})

test('an unrecognized card-name nickname does not override an exact last-four match', () => {
  const result = matchSmbcPayment(candidate({ cardLastFour: '1234', cardNameHint: 'Travel Card' }), [
    method('daily', 'credit', '1234', 'Daily Card'),
  ])
  assert.equal(result.id, 'daily')
})

test('unknown payment type can use a name hint only when one active supported method matches', () => {
  const unknown = candidate({ paymentType: 'unknown', subjectHint: 'Prepaid Card' })
  const unique = matchSmbcPayment(unknown, [method('prepaid', 'prepaid', '4321', 'Prepaid Card')])
  assert.equal(unique.id, 'prepaid')

  const ambiguous = matchSmbcPayment(unknown, [
    method('prepaid', 'prepaid', '4321', 'Prepaid Card'),
    method('credit', 'credit', '8765', 'Prepaid Card'),
  ])
  assert.equal(ambiguous.id, '')
})

test('name-hint matching ignores deleted methods and supports credit, debit, and prepaid', () => {
  for (const type of ['credit', 'debit', 'prepaid'] as const) {
    const result = matchSmbcPayment(candidate({ paymentType: type, cardNameHint: 'Named Card' }), [
      method('deleted', type, '1234', 'Named Card', true),
      method(type, type, '5678', 'Named Card'),
    ])
    assert.equal(result.id, type)
  }
})
