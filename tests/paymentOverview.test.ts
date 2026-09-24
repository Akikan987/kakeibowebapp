import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWithdrawalSchedule, paymentOverview, withdrawalItems, type ScheduledWithdrawal } from '../src/domain/paymentOverview.ts'
import { computeCardWithdrawals } from '../src/payments.ts'
import type { CardStatement, Expense, PaymentMethod, PrepaidCharge } from '../src/types.ts'

const date = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour).getTime()
const scheduled = (methodId: string, day: number, status: ScheduledWithdrawal['status'] = 'estimated', amountYen = 100): ScheduledWithdrawal => ({
  methodId, methodName: methodId, closingDay: 31, paymentDay: day, withdrawalAtMillis: date(9, day),
  amountYen, estimatedAmountYen: amountYen, expenseAmountYen: amountYen, chargeAmountYen: 0, itemCount: 1, status,
})
const statement = (overrides: Partial<CardStatement> = {}): CardStatement => ({
  id: 'statement', paymentMethodId: 'card', withdrawalAtMillis: date(9, 27), actualAmountYen: 150,
  status: 'confirmed', note: '', deleted: false, updatedAt: 1, ...overrides,
})
const method: PaymentMethod = { id: 'card', name: 'test', type: 'credit', closingDay: 31, paymentDay: 27, updatedAt: 1, deleted: false }

test('支払済みを除外し、当日を含む7日・30日の境界と確定/見込みを分ける', () => {
  const rows = [scheduled('past', 23), scheduled('today', 24, 'confirmed', 200), scheduled('same-day', 24),
    scheduled('paid', 25, 'paid', 10000), scheduled('day6', 30), scheduled('day7', 31),
    scheduled('day29', 53), scheduled('day30', 54)]
  const result = paymentOverview(rows, date(9, 24, 23))
  assert.equal(result.nextDate, date(9, 24))
  assert.deepEqual(result.next, { confirmed: 200, estimated: 100, total: 300 })
  assert.deepEqual(result.week, { confirmed: 200, estimated: 200, total: 400 })
  assert.equal(result.month.total, 600)
  assert.equal(result.past.length, 1)
  assert.equal(result.upcoming.some((row) => row.status === 'paid'), false)
})

test('年跨ぎでも暦日で範囲を判定する', () => {
  const row = { ...scheduled('a', 1), withdrawalAtMillis: new Date(2027, 0, 1, 12).getTime() }
  assert.equal(paymentOverview([row], date(12, 31)).week.total, 100)
  assert.equal(paymentOverview([], date(12, 31)).nextDate, undefined)
})

test('確定額で上書きし、履歴が消えても請求記録を保持する', () => {
  const schedule = buildWithdrawalSchedule([scheduled('card', 27)], [statement(), statement({ id: 'orphan', paymentMethodId: 'removed', actualAmountYen: 300 })], [method])
  assert.equal(schedule.length, 2)
  assert.equal(schedule.find((row) => row.methodId === 'card')?.amountYen, 150)
  assert.equal(schedule.find((row) => row.methodId === 'card')?.estimatedAmountYen, 100)
  assert.equal(schedule.find((row) => row.methodId === 'removed')?.methodName, '削除済みのカード')
  assert.equal(schedule.find((row) => row.methodId === 'removed')?.itemCount, 0)
})

test('同一請求は最新状態だけ反映し、削除済みの請求は除く', () => {
  const schedule = buildWithdrawalSchedule([scheduled('card', 27)], [
    statement({ updatedAt: 2, status: 'paid' }), statement({ updatedAt: 1 }),
    statement({ id: 'deleted', paymentMethodId: 'other', deleted: true }),
  ], [method])
  assert.equal(schedule.length, 1)
  assert.equal(schedule[0].status, 'paid')
  assert.equal(paymentOverview(schedule, date(9, 24)).month.total, 0)
})

test('内訳はカード利用とチャージの全額。プリペイド消費・収入は二重に含めない', () => {
  const expense: Expense = { id: 'e', title: 'store', amountYen: 500, paymentMethodId: 'card',
    category: '食費', type: 'expense', source: 'manual', purchasedAtMillis: date(8, 10), updatedAt: 1, deleted: false }
  const expenses = [expense, { ...expense, id: 'prepaid-use', paymentMethodId: 'prepaid' },
    { ...expense, id: 'income', type: 'income' }, { ...expense, id: 'different-month', purchasedAtMillis: date(9, 10) }]
  const charges: PrepaidCharge[] = [{ id: 'charge', prepaidMethodId: 'prepaid', fundingMethodId: 'card', amountYen: 1000, chargedAtMillis: date(8, 10), note: '', updatedAt: 1, deleted: false }]
  const [row] = computeCardWithdrawals([method], charges, expenses)
  const items = withdrawalItems(row, expenses, charges)
  assert.equal(items.length, 2)
  assert.equal(items.reduce((sum, item) => sum + item.amountYen, 0), row.amountYen)
  assert.equal(row.amountYen, 1500)
  assert.equal(withdrawalItems(row, [{ ...expense, deleted: true }], []).length, 0)
})
