import type { SyncTables } from '../sync/types.ts'

/** Validate an entire candidate snapshot before committing an import. */
export function validateFinance(snapshot: SyncTables) {
  const active = <T extends { deleted: boolean }>(rows: T[]) => rows.filter((row) => !row.deleted)
  const accounts = new Set(active(snapshot.cashAccounts).map((row) => row.id))
  const methods = new Map(active(snapshot.paymentMethods).map((row) => [row.id, row]))
  const expenses = new Map(active(snapshot.expenses).map((row) => [row.id, row]))
  const amount = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 2_000_000_000
  const date = (n: number) => Number.isFinite(n) && n >= 0 && Number.isFinite(new Date(n).getTime())
  const fail = (): never => { throw new Error('口座・振替・返金の参照先、金額、日時が不正です。バックアップを確認してください') }
  for (const row of active(snapshot.cashAccounts)) if (!row.name.trim() || !Number.isSafeInteger(row.openingBalanceYen) || Math.abs(row.openingBalanceYen) > 2_000_000_000 || !date(row.openedAtMillis)) fail()
  for (const rows of [snapshot.expenses, snapshot.paymentMethods, snapshot.prepaidCharges, snapshot.cardStatements, snapshot.expenseRefunds])
    for (const row of rows) if (!row.deleted && row.cashAccountId && !accounts.has(row.cashAccountId)) fail()
  for (const row of active(snapshot.expenses)) if (row.type === 'expense' && row.cashAccountId && ['credit', 'prepaid'].includes(methods.get(row.paymentMethodId)?.type ?? '')) fail()
  for (const row of active(snapshot.prepaidCharges)) if (row.cashAccountId && ['credit', 'prepaid'].includes(methods.get(row.fundingMethodId)?.type ?? '')) fail()
  for (const row of active(snapshot.cardStatements)) if (row.cashAccountId && row.status === 'paid' && !date(row.paidAtMillis || row.withdrawalAtMillis)) fail()
  for (const row of active(snapshot.accountTransfers)) if (!accounts.has(row.fromAccountId) || !accounts.has(row.toAccountId) || row.fromAccountId === row.toAccountId || !amount(row.amountYen) || !date(row.transferredAtMillis)) fail()
  const splitTotals = new Map<string, number>()
  for (const row of active(snapshot.expenseSplits)) splitTotals.set(row.expenseId, (splitTotals.get(row.expenseId) ?? 0) + row.amountYen)
  const refundTotals = new Map<string, number>()
  for (const row of active(snapshot.expenseRefunds)) {
    const expense = expenses.get(row.expenseId)
    const method = methods.get(row.paymentMethodId)
    if (!expense || expense.type !== 'expense' || !method || !amount(row.amountYen) || !date(row.refundedAtMillis) || row.refundedAtMillis < expense.purchasedAtMillis) fail()
    if (method?.type === 'credit' && (!row.cardWithdrawalAtMillis || !date(row.cardWithdrawalAtMillis))) fail()
    if (['credit', 'prepaid'].includes(method!.type) && row.cashAccountId) fail()
    const total = (refundTotals.get(row.expenseId) ?? 0) + row.amountYen
    if (total > expense!.amountYen - (splitTotals.get(row.expenseId) ?? 0)) fail()
    refundTotals.set(row.expenseId, total)
  }
}
