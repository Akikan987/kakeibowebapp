import assert from 'node:assert/strict'
import test from 'node:test'
import { indexSplits, memberBalances, monthlySummary } from '../src/domain/ledger.ts'
import type { Expense, ExpenseSplit } from '../src/types.ts'

const expense = (id: string, amountYen: number, purchasedAtMillis: number, type = 'expense', category = '食費'): Expense => ({
  id, amountYen, purchasedAtMillis, type, category, title: 'test',
  paymentMethodId: '', source: 'manual', updatedAt: 1, deleted: false,
})
const split = (id: string, expenseId: string, amountYen: number, memberId = 'm'): ExpenseSplit => ({
  id, expenseId, amountYen, memberId, updatedAt: 1, deleted: false,
})

test('月境界・年跨ぎを守り、割り勘は支出だけから控除する', () => {
  const start = new Date(2026, 11, 1).getTime()
  const end = new Date(2027, 0, 1).getTime()
  const expenses = [expense('before', 999, start - 1), expense('a', 1000, start),
    expense('b', 300, end - 1, 'expense', '交通'), expense('income', 2000, start, 'income'),
    expense('after', 999, end)]
  const { totals, byExpense } = indexSplits(expenses, [split('s1', 'a', 200), split('s2', 'a', 100),
    split('s3', 'income', 500), split('orphan', 'missing', 999)])
  assert.equal(byExpense.get('a')?.length, 2)
  assert.equal(totals.has('missing'), false)
  const result = monthlySummary(expenses, totals, 2026, 12)
  assert.equal(result.incomeTotal, 2000)
  assert.equal(result.expenseTotal, 1000)
  assert.equal(result.balance, 1000)
  assert.deepEqual(result.categoryTotals, [{ name: '食費', total: 700 }, { name: '交通', total: 300 }])
  assert.deepEqual([...result.dailyTotals], [[1, 700], [31, 300]])
})

test('全額割り勘の品目は凡例から除き、空月もゼロで返す', () => {
  const row = expense('a', 100, new Date(2026, 8, 1).getTime())
  const totals = new Map([['a', 100]])
  const result = monthlySummary([row], totals, 2026, 9)
  assert.equal(result.expenseTotal, 0)
  assert.deepEqual(result.categoryTotals, [])
  assert.equal(result.dailyTotals.get(1), 0)
  assert.equal(monthlySummary([row], totals, 2026, 10).dailyTotals.size, 0)
})

test('メンバー別の立替と清算を合計し、過払いの負数も保持する', () => {
  const result = memberBalances([
    { id: 'm', name: 'friend', linkedUid: 'uid', updatedAt: 1, deleted: false },
    { id: 'none', name: 'none', linkedUid: '', updatedAt: 1, deleted: false },
  ], [split('a', 'e', 100), split('b', 'e', 200)], [
    { id: 'st', memberId: 'm', amountYen: 400, dateMillis: 1, updatedAt: 1, deleted: false },
  ])
  assert.deepEqual(result[0], { memberId: 'm', name: 'friend', linkedUid: 'uid', charged: 300, settled: 400, remaining: -100 })
  assert.equal(result[1].remaining, 0)
})
