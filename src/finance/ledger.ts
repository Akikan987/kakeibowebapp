import type { AccountTransfer, CardStatement, CashAccount, Expense, ExpenseRefund, PrepaidCharge } from '../types.ts'

export interface AccountEntry { id: string; date: number; label: string; amountYen: number }

/** Snapshot account IDs: reassigning a card never moves historical cash flows. */
export function accountLedger(account: CashAccount, expenses: Expense[], charges: PrepaidCharge[], statements: CardStatement[], transfers: AccountTransfer[], refunds: ExpenseRefund[], asOf = Date.now()) {
  const entries: AccountEntry[] = []
  const add = (id: string, date: number, label: string, amountYen: number) => {
    if (date >= account.openedAtMillis && date <= asOf) entries.push({ id, date, label, amountYen })
  }
  for (const row of expenses) if (!row.deleted && row.cashAccountId === account.id)
    add(`expense:${row.id}`, row.purchasedAtMillis, row.title, row.type === 'income' ? row.amountYen : -row.amountYen)
  for (const row of charges) if (!row.deleted && row.cashAccountId === account.id)
    add(`charge:${row.id}`, row.chargedAtMillis, 'プリペイドチャージ', -row.amountYen)
  for (const row of statements) if (!row.deleted && row.status === 'paid' && row.cashAccountId === account.id)
    add(`statement:${row.id}`, row.paidAtMillis || row.withdrawalAtMillis, 'カード引き落とし', -row.actualAmountYen)
  for (const row of transfers) if (!row.deleted) {
    if (row.fromAccountId === account.id) add(`transfer:${row.id}`, row.transferredAtMillis, `振替出金 ${row.note}`, -row.amountYen)
    if (row.toAccountId === account.id) add(`transfer:${row.id}`, row.transferredAtMillis, `振替入金 ${row.note}`, row.amountYen)
  }
  for (const row of refunds) if (!row.deleted && row.cashAccountId === account.id)
    add(`refund:${row.id}`, row.refundedAtMillis, `返金 ${row.note}`, row.amountYen)
  return { balance: account.openingBalanceYen + entries.reduce((sum, row) => sum + row.amountYen, 0), entries: entries.sort((a, b) => b.date - a.date || a.id.localeCompare(b.id)) }
}

export function refundTotal(refunds: ExpenseRefund[], expenseId: string, exceptId = '') {
  return refunds.reduce((sum, row) => sum + (!row.deleted && row.expenseId === expenseId && row.id !== exceptId ? row.amountYen : 0), 0)
}

/** Synthetic negative expenses exist only in aggregation, never in the synced expenses table. */
export function refundAdjustments(refunds: ExpenseRefund[]): Expense[] {
  return refunds.filter((row) => !row.deleted).map((row) => ({ id: `refund:${row.id}`, title: '返金', amountYen: -row.amountYen, category: row.category, purchasedAtMillis: row.refundedAtMillis, type: 'expense', source: 'refund', paymentMethodId: row.paymentMethodId, updatedAt: row.updatedAt, deleted: false }))
}
