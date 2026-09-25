import { db, type KakeiboDB } from '../db.ts'
import type { AccountTransfer, CashAccount, ExpenseRefund } from '../types.ts'
import { refundTotal } from './ledger.ts'

const validDate = (value: number) => Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
const validAmount = (value: number) => Number.isSafeInteger(value) && value > 0 && value <= 2_000_000_000
const fail = (message: string): never => { throw new Error(message) }

export async function saveCashAccount(row: CashAccount, database: KakeiboDB = db) {
  if (!row.name.trim() || row.name.length > 100 || !['bank', 'wallet', 'other'].includes(row.kind) || !Number.isSafeInteger(row.openingBalanceYen) || Math.abs(row.openingBalanceYen) > 2_000_000_000 || !validDate(row.openedAtMillis)) fail('口座名・開始残高・開始日時を確認してください')
  return database.transaction('rw', database.tables, async () => {
    if (row.deleted) {
      const associated = [database.expenses, database.paymentMethods, database.prepaidCharges, database.cardStatements, database.expenseRefunds]
      for (const table of associated) if (await table.filter((item) => !item.deleted && item.cashAccountId === row.id).count()) fail('記録に使用中の口座は削除できません')
      if (await database.accountTransfers.filter((item) => !item.deleted && (item.fromAccountId === row.id || item.toAccountId === row.id)).count()) fail('振替に使用中の口座は削除できません')
    }
    const old = await database.cashAccounts.get(row.id)
    await database.cashAccounts.put({ ...row, name: row.name.trim(), updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1) })
  })
}

export async function saveTransfer(row: AccountTransfer, database: KakeiboDB = db) {
  if (!validAmount(row.amountYen) || !validDate(row.transferredAtMillis) || row.note.length > 300) fail('振替金額・日時・メモを確認してください')
  if (!row.fromAccountId || row.fromAccountId === row.toAccountId) fail('振替元と振替先に異なる口座を選んでください')
  return database.transaction('rw', database.cashAccounts, database.accountTransfers, async () => {
    const accounts = await database.cashAccounts.bulkGet([row.fromAccountId, row.toAccountId])
    if (accounts.some((account) => !account || account.deleted)) fail('有効な振替元・振替先を選んでください')
    const old = await database.accountTransfers.get(row.id)
    await database.accountTransfers.put({ ...row, updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1) })
  })
}

export async function saveRefund(row: ExpenseRefund, database: KakeiboDB = db) {
  if (!validAmount(row.amountYen) || !validDate(row.refundedAtMillis) || row.note.length > 300) fail('返金額・日時・メモを確認してください')
  return database.transaction('rw', [database.expenses, database.expenseSplits, database.expenseRefunds, database.paymentMethods, database.cashAccounts], async () => {
    const expense = await database.expenses.get(row.expenseId)
    if (!expense || expense.deleted || expense.type !== 'expense') fail('返金元の支出が見つかりません')
    const splits = await database.expenseSplits.where('expenseId').equals(row.expenseId).filter((item) => !item.deleted).toArray()
    const refunds = await database.expenseRefunds.where('expenseId').equals(row.expenseId).toArray()
    const remaining = expense!.amountYen - splits.reduce((sum, item) => sum + item.amountYen, 0) - refundTotal(refunds, row.expenseId, row.id)
    if (!row.deleted && row.amountYen > remaining) fail('本人負担分の未返金額を超えています。割り勘相手の負担は自動変更しません')
    if (row.refundedAtMillis < expense!.purchasedAtMillis) fail('返金日時は元の利用日時以降にしてください')
    const method = await database.paymentMethods.get(row.paymentMethodId)
    if (!method || method.deleted) fail('返金先の決済方法を選んでください')
    if (method!.type === 'credit' && (!row.cardWithdrawalAtMillis || !validDate(row.cardWithdrawalAtMillis))) fail('返金が反映されるカード請求日を選んでください')
    const cashAccountId = ['credit', 'prepaid'].includes(method!.type) ? '' : row.cashAccountId
    const account = cashAccountId ? await database.cashAccounts.get(cashAccountId) : null
    if (cashAccountId && (!account || account.deleted)) fail('返金先口座を確認してください')
    const old = await database.expenseRefunds.get(row.id)
    await database.expenseRefunds.put({ ...row, cashAccountId, category: expense!.category, cardWithdrawalAtMillis: method!.type === 'credit' ? row.cardWithdrawalAtMillis : 0, updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1) })
  })
}
