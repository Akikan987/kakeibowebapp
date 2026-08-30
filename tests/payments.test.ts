import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cardWithdrawalsByDay,
  computeCardWithdrawals,
  computePrepaidBalances,
  expectedWithdrawalDate,
} from '../src/payments.ts'
import { TYPE_EXPENSE, type Expense, type PaymentMethod, type PrepaidCharge } from '../src/types.ts'

const atNoon = (year: number, monthIndex: number, day: number) =>
  new Date(year, monthIndex, day, 12).getTime()

const method = (partial: Partial<PaymentMethod> & Pick<PaymentMethod, 'id' | 'name' | 'type'>): PaymentMethod => ({
  closingDay: 0,
  paymentDay: 0,
  updatedAt: 1,
  deleted: false,
  ...partial,
})

const expense = (partial: Partial<Expense> & Pick<Expense, 'id' | 'amountYen' | 'paymentMethodId'>): Expense => ({
  title: 'テスト',
  purchasedAtMillis: atNoon(2026, 7, 15),
  category: 'その他',
  source: 'manual',
  type: TYPE_EXPENSE,
  updatedAt: 1,
  deleted: false,
  ...partial,
})

const charge = (partial: Partial<PrepaidCharge> & Pick<PrepaidCharge, 'id' | 'amountYen' | 'prepaidMethodId'>): PrepaidCharge => ({
  fundingMethodId: '',
  chargedAtMillis: atNoon(2026, 7, 15),
  note: '',
  updatedAt: 1,
  deleted: false,
  ...partial,
})

test('締め日以前の利用は翌月、締め日後は翌々月の引き落としになる', () => {
  assert.equal(
    expectedWithdrawalDate(atNoon(2026, 7, 15), 15, 27),
    atNoon(2026, 8, 27),
  )
  assert.equal(
    expectedWithdrawalDate(atNoon(2026, 7, 16), 15, 27),
    atNoon(2026, 9, 27),
  )
})

test('31日は月末として扱い、存在しない引き落とし日は月末に丸める', () => {
  assert.equal(
    expectedWithdrawalDate(atNoon(2026, 0, 31), 31, 31),
    atNoon(2026, 1, 28),
  )
})

test('カード利用と、そのカードで行ったプリペイドチャージを同じ引落予定に合算する', () => {
  const card = method({
    id: 'card',
    name: 'テストカード',
    type: 'credit',
    closingDay: 15,
    paymentDay: 27,
  })
  const prepaid = method({ id: 'prepaid', name: '電子マネー', type: 'prepaid' })
  const withdrawals = computeCardWithdrawals(
    [card, prepaid],
    [charge({ id: 'charge', prepaidMethodId: prepaid.id, fundingMethodId: card.id, amountYen: 5_000 })],
    [expense({ id: 'expense', paymentMethodId: card.id, amountYen: 1_200 })],
  )

  assert.equal(withdrawals.length, 1)
  assert.deepEqual(
    {
      amountYen: withdrawals[0].amountYen,
      expenseAmountYen: withdrawals[0].expenseAmountYen,
      chargeAmountYen: withdrawals[0].chargeAmountYen,
      itemCount: withdrawals[0].itemCount,
    },
    { amountYen: 6_200, expenseAmountYen: 1_200, chargeAmountYen: 5_000, itemCount: 2 },
  )
})

test('プリペイド残高はチャージ額から実際の利用額だけを差し引く', () => {
  const prepaid = method({ id: 'prepaid', name: '電子マネー', type: 'prepaid' })
  const balances = computePrepaidBalances(
    [prepaid],
    [charge({ id: 'charge', prepaidMethodId: prepaid.id, amountYen: 10_000 })],
    [expense({ id: 'expense', paymentMethodId: prepaid.id, amountYen: 2_500 })],
  )

  assert.deepEqual(balances[0], {
    methodId: prepaid.id,
    name: prepaid.name,
    charged: 10_000,
    spent: 2_500,
    balance: 7_500,
  })
})

test('カード引き落としをカレンダーの日付ごとにまとめる', () => {
  const card = method({ id: 'card', name: 'カード', type: 'credit', closingDay: 31, paymentDay: 27 })
  const another = method({ id: 'another', name: '別カード', type: 'credit', closingDay: 31, paymentDay: 27 })
  const withdrawals = computeCardWithdrawals(
    [card, another],
    [],
    [
      expense({ id: 'one', paymentMethodId: card.id, amountYen: 1_200 }),
      expense({ id: 'two', paymentMethodId: another.id, amountYen: 3_400 }),
    ],
  )
  const date = new Date(withdrawals[0].withdrawalAtMillis)
  const grouped = cardWithdrawalsByDay(withdrawals, date.getFullYear(), date.getMonth())
  assert.equal(grouped.get(date.getDate())?.length, 2)
  assert.equal(
    grouped.get(date.getDate())?.reduce((sum, item) => sum + item.amountYen, 0),
    4_600,
  )
})
