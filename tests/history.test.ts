import assert from 'node:assert/strict'
import test from 'node:test'
import { groupHistoryDays } from '../src/entries/history.ts'
import type { Expense } from '../src/types.ts'

const entry = (id: string, day: number, hour: number, amountYen: number, type = 'expense'): Expense => ({
  id, type, amountYen, title: id, purchasedAtMillis: new Date(2026, 10, day, hour).getTime(),
  category: 'その他', source: 'manual', paymentMethodId: '', updatedAt: 1, deleted: false,
})

test('日付と時刻の新しい順に表示し、ページで分かれた日も合計を省略しない', () => {
  const older = entry('older', 9, 23, 400)
  const morning = entry('morning', 10, 0, 500)
  const evening = entry('evening', 10, 18, 800)
  const income = entry('income', 10, 12, 2500, 'income')
  const rows = [older, morning, evening, income]
  const netAmount = (expense: Expense) => expense.amountYen - (expense.id === 'evening' ? 300 : 0)
  const firstPage = groupHistoryDays(rows, netAmount, 2)
  assert.deepEqual(firstPage.map((day) => day.expenses.map((expense) => expense.id)), [['evening', 'income']])
  assert.equal(firstPage[0].dateMillis, new Date(2026, 10, 10).getTime())
  assert.equal(firstPage[0].expenseTotal, 1000)
  assert.equal(firstPage[0].incomeTotal, 2500)
  const all = groupHistoryDays(rows, netAmount, 10)
  assert.deepEqual(all.map((day) => day.expenses.map((expense) => expense.id)), [['evening', 'income', 'morning'], ['older']])
  assert.equal(all[1].expenseTotal, 400)
})
