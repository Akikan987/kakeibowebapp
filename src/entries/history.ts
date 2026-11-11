import { TYPE_EXPENSE, TYPE_INCOME, type Expense } from '../types.ts'

export interface HistoryDay {
  dateMillis: number
  expenses: Expense[]
  expenseTotal: number
  incomeTotal: number
  hasExpense: boolean
}

/** Totals cover all matching records even when a day is only partly displayed. */
export function groupHistoryDays(expenses: Expense[], netAmount: (expense: Expense) => number, limit: number): HistoryDay[] {
  const days = new Map<number, HistoryDay>()
  const sorted = [...expenses].sort((left, right) => right.purchasedAtMillis - left.purchasedAtMillis)
  sorted.forEach((expense, index) => {
    const date = new Date(expense.purchasedAtMillis)
    const dateMillis = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    let day = days.get(dateMillis)
    if (!day) {
      day = { dateMillis, expenses: [], expenseTotal: 0, incomeTotal: 0, hasExpense: false }
      days.set(dateMillis, day)
    }
    if (expense.type === TYPE_EXPENSE) {
      day.hasExpense = true
      day.expenseTotal += netAmount(expense)
    }
    if (expense.type === TYPE_INCOME) day.incomeTotal += expense.amountYen
    if (index < limit) day.expenses.push(expense)
  })
  return [...days.values()].filter((day) => day.expenses.length > 0)
}
