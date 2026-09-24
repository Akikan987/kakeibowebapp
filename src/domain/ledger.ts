import {
  TYPE_EXPENSE, TYPE_INCOME,
  type Expense, type ExpenseSplit, type Member, type MemberBalance,
  type MonthlySummary, type Settlement,
} from '../types.ts'

/** Inputs are active rows from the store (tombstones are excluded by db.ts). */
export function indexSplits(expenses: Expense[], splits: ExpenseSplit[]) {
  const activeIds = new Set(expenses.map((expense) => expense.id))
  const byExpense = new Map<string, ExpenseSplit[]>()
  const totals = new Map<string, number>()
  for (const split of splits) {
    const group = byExpense.get(split.expenseId)
    if (group) group.push(split)
    else byExpense.set(split.expenseId, [split])
    if (activeIds.has(split.expenseId)) {
      totals.set(split.expenseId, (totals.get(split.expenseId) ?? 0) + split.amountYen)
    }
  }
  return { byExpense, totals }
}

/** One pass, without allocating separate month / expense / income arrays. */
export function monthlySummary(
  expenses: Expense[], splitTotals: ReadonlyMap<string, number>, year: number, month: number,
): MonthlySummary {
  const start = new Date(year, month - 1, 1).getTime()
  const end = new Date(year, month, 1).getTime()
  let incomeTotal = 0
  let expenseTotal = 0
  const categories = new Map<string, number>()
  const dailyTotals = new Map<number, number>()
  for (const expense of expenses) {
    if (!(expense.purchasedAtMillis >= start && expense.purchasedAtMillis < end)) continue
    if (expense.type === TYPE_INCOME) incomeTotal += expense.amountYen
    if (expense.type !== TYPE_EXPENSE) continue
    const net = expense.amountYen - (splitTotals.get(expense.id) ?? 0)
    expenseTotal += net
    categories.set(expense.category, (categories.get(expense.category) ?? 0) + net)
    const day = new Date(expense.purchasedAtMillis).getDate()
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + net)
  }
  return {
    incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal,
    categoryTotals: [...categories].map(([name, total]) => ({ name, total }))
      .filter((category) => category.total !== 0).sort((a, b) => b.total - a.total),
    dailyTotals,
  }
}

export function memberBalances(
  members: Member[], splits: ExpenseSplit[], settlements: Settlement[],
): MemberBalance[] {
  const charged = new Map<string, number>()
  for (const split of splits)
    charged.set(split.memberId, (charged.get(split.memberId) ?? 0) + split.amountYen)
  const settled = new Map<string, number>()
  for (const settlement of settlements)
    settled.set(settlement.memberId, (settled.get(settlement.memberId) ?? 0) + settlement.amountYen)
  return members.map((member) => {
    const amount = charged.get(member.id) ?? 0
    const paid = settled.get(member.id) ?? 0
    return {
      memberId: member.id, name: member.name, linkedUid: member.linkedUid,
      charged: amount, settled: paid, remaining: amount - paid,
    }
  })
}
