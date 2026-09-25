import { db, type KakeiboDB } from '../db.ts'
import { sameRecord } from '../sync/records.ts'
import type { Expense, ExpenseSplit, ExpenseRefund } from '../types.ts'

export interface ExpenseUndo {
  before?: Expense
  beforeSplits: ExpenseSplit[]
  saved: Expense
  savedSplits: ExpenseSplit[]
  refunds: ExpenseRefund[]
}

/** Save the expense and all of its split rows as a single unit. */
export async function writeExpense(expense: Expense, splits: ExpenseSplit[], database: KakeiboDB = db): Promise<ExpenseUndo> {
  return database.transaction('rw', [database.expenses, database.expenseSplits, database.expenseRefunds], async () => {
    const refunds = await database.expenseRefunds.where('expenseId').equals(expense.id).toArray()
    const refunded = refunds.reduce((sum, row) => sum + (row.deleted ? 0 : row.amountYen), 0)
    if (refunds.some((row) => !row.deleted && row.refundedAtMillis < expense.purchasedAtMillis)) throw new Error('返金日時より後へ元の支出日時を移せません')
    if (refunded && (expense.deleted || expense.type !== 'expense' || expense.amountYen - splits.reduce((sum, row) => sum + (row.deleted ? 0 : row.amountYen), 0) < refunded)) throw new Error('返金記録と矛盾する変更はできません')
    const before = await database.expenses.get(expense.id)
    const beforeSplits = await database.expenseSplits.where('expenseId').equals(expense.id).toArray()
    const updatedAt = beforeSplits.reduce((latest, row) => Math.max(latest, row.updatedAt + 1), Math.max(expense.updatedAt, (before?.updatedAt ?? 0) + 1))
    const saved = { ...expense, updatedAt }
    const savedSplits = [
      ...beforeSplits.map((row) => ({ ...row, deleted: true, updatedAt })),
      ...splits.map((row) => ({ ...row, updatedAt })),
    ]
    await database.expenses.put(saved)
    if (savedSplits.length) await database.expenseSplits.bulkPut(savedSplits)
    return { before, beforeSplits, saved, savedSplits, refunds }
  })
}

/** Refuse to overwrite subsequent edits (including those received by sync). */
export async function undoExpenseWrite(ticket: ExpenseUndo, database: KakeiboDB = db): Promise<boolean> {
  return database.transaction('rw', [database.expenses, database.expenseSplits, database.expenseRefunds], async () => {
    const refunds = await database.expenseRefunds.where('expenseId').equals(ticket.saved.id).toArray()
    if (refunds.length !== ticket.refunds.length || refunds.some((row) => !ticket.refunds.some((saved) => sameRecord(row, saved)))) return false
    const current = await database.expenses.get(ticket.saved.id)
    const currentSplits = await database.expenseSplits.where('expenseId').equals(ticket.saved.id).toArray()
    const expected = new Map(ticket.savedSplits.map((row) => [row.id, row]))
    if (!current || !sameRecord(current, ticket.saved) || currentSplits.length !== expected.size ||
      currentSplits.some((row) => !expected.has(row.id) || !sameRecord(row, expected.get(row.id)!))) return false
    const updatedAt = currentSplits.reduce((latest, row) => Math.max(latest, row.updatedAt + 1), Math.max(Date.now(), current.updatedAt + 1))
    await database.expenses.put(ticket.before ? { ...ticket.before, updatedAt } : { ...current, deleted: true, updatedAt })
    const originals = new Map(ticket.beforeSplits.map((row) => [row.id, row]))
    if (currentSplits.length) await database.expenseSplits.bulkPut(currentSplits.map((row) =>
      originals.has(row.id) ? { ...originals.get(row.id)!, updatedAt } : { ...row, deleted: true, updatedAt },
    ))
    return true
  })
}
