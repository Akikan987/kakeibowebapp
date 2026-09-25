import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { KakeiboDB } from '../src/db.ts'
import { accountLedger, refundAdjustments } from '../src/finance/ledger.ts'
import { validateFinance } from '../src/finance/validation.ts'
import { saveCashAccount, saveRefund, saveTransfer } from '../src/finance/persistence.ts'
import { readSyncSnapshot, applySyncChanges } from '../src/sync/local.ts'
import { apiSync } from '../src/api.ts'
import { monthlySummary } from '../src/domain/ledger.ts'
import { computeCardWithdrawals, computePrepaidBalances, expectedWithdrawalDate } from '../src/payments.ts'
import { undoExpenseWrite, writeExpense } from '../src/entries/persistence.ts'
import type { CashAccount, Expense, ExpenseRefund, PaymentMethod, AccountTransfer, CardStatement } from '../src/types.ts'

const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).getTime()
const base = { updatedAt: 1, deleted: false }
const bank: CashAccount = { ...base, id: 'bank', name: 'bank', kind: 'bank', openingBalanceYen: 10000, openedAtMillis: at(9, 1) }
const wallet: CashAccount = { ...bank, id: 'wallet', kind: 'wallet', name: 'wallet', openingBalanceYen: 0 }
const cash: PaymentMethod = { ...base, id: 'cash', name: 'cash', type: 'cash', closingDay: 0, paymentDay: 0, cashAccountId: 'wallet' }
const card: PaymentMethod = { ...cash, id: 'card', name: 'card', type: 'credit', closingDay: 31, paymentDay: 27, cashAccountId: 'bank' }
const expense: Expense = { ...base, id: 'expense', title: 'test', category: '食品', source: 'manual', amountYen: 1000, type: 'expense', paymentMethodId: 'cash', cashAccountId: 'wallet', purchasedAtMillis: at(9, 2) }
const refund: ExpenseRefund = { ...base, id: 'refund', expenseId: expense.id, amountYen: 300, refundedAtMillis: at(9, 3), category: '食品', paymentMethodId: 'cash', cashAccountId: 'wallet', cardWithdrawalAtMillis: 0, note: '' }
const transfer: AccountTransfer = { ...base, id: 'transfer', fromAccountId: 'bank', toAccountId: 'wallet', amountYen: 3000, transferredAtMillis: at(9, 2), note: '' }

test('振替は二口座間で保存され、合計資産や収支を増やさない', () => {
  const a = accountLedger(bank, [], [], [], [transfer], [], at(9, 30))
  const b = accountLedger(wallet, [expense], [], [], [transfer], [refund], at(9, 30))
  assert.equal(a.balance, 7000)
  assert.equal(b.balance, 2300)
  assert.equal(a.balance + b.balance, 9300)
  const summary = monthlySummary([expense, ...refundAdjustments([refund])], new Map(), 2026, 9)
  assert.equal(summary.incomeTotal, 0)
  assert.equal(summary.expenseTotal, 700)
})

test('開始日以前・未来・削除済みは残高から除外。口座変更でも過去のIDを維持', () => {
  const rows = [expense, { ...expense, id: 'old', purchasedAtMillis: at(8, 31) }, { ...expense, id: 'future', purchasedAtMillis: at(10, 1) }, { ...expense, id: 'deleted', deleted: true }]
  assert.equal(accountLedger(wallet, rows, [], [], [], [], at(9, 30)).balance, -1000)
  assert.equal(accountLedger(bank, rows, [], [], [], [], at(9, 30)).balance, 10000)
})

test('カード利用とチャージを銀行残高から二重に引かず、支払済みだけを反映', () => {
  const creditExpense = { ...expense, paymentMethodId: 'card', cashAccountId: '' }
  const charge = { ...base, id: 'charge', prepaidMethodId: 'prepaid', fundingMethodId: 'card', cashAccountId: '', amountYen: 500, chargedAtMillis: at(9, 2), note: '' }
  const statement: CardStatement = { ...base, id: 'statement', paymentMethodId: 'card', withdrawalAtMillis: at(10, 27), actualAmountYen: 1500, status: 'confirmed', cashAccountId: 'bank', paidAtMillis: at(9, 4), note: '' }
  assert.equal(accountLedger(bank, [creditExpense], [charge], [statement], [], [], at(9, 30)).balance, 10000)
  assert.equal(accountLedger(bank, [creditExpense], [charge], [{ ...statement, status: 'paid' }], [], [], at(9, 30)).balance, 8500)
})

test('返金は返金月の支出減。カード請求日の指定・超過のゼロ止め・プリペイド返金', () => {
  const creditExpense = { ...expense, purchasedAtMillis: at(8, 2), paymentMethodId: 'card', cashAccountId: '' }
  const creditRefund = { ...refund, paymentMethodId: 'card', cashAccountId: '', cardWithdrawalAtMillis: expectedWithdrawalDate(at(8, 2), 31, 27) }
  assert.equal(computeCardWithdrawals([card], [], [creditExpense], [creditRefund])[0].amountYen, 700)
  assert.equal(computeCardWithdrawals([card], [], [], [creditRefund])[0].amountYen, 0)
  assert.equal(monthlySummary([creditExpense, ...refundAdjustments([refund])], new Map(), 2026, 8).expenseTotal, 1000)
  assert.equal(monthlySummary([creditExpense, ...refundAdjustments([refund])], new Map(), 2026, 9).expenseTotal, -300)
  const prepaid = { ...cash, id: 'prepaid', type: 'prepaid' as const }
  const spent = { ...expense, paymentMethodId: 'prepaid' }
  const prepaidRefund = { ...refund, paymentMethodId: 'prepaid', cashAccountId: '' }
  assert.equal(computePrepaidBalances([prepaid], [], [spent, ...refundAdjustments([prepaidRefund])])[0].balance, -700)
})

async function fixture(action: (db: KakeiboDB) => Promise<void>) {
  const db = new KakeiboDB(`finance-test-${crypto.randomUUID()}`)
  try { await db.cashAccounts.bulkPut([bank, wallet]); await db.paymentMethods.put(cash); await db.expenses.put(expense); await action(db) }
  finally { await db.delete() }
}

test('返金の累積上限・割り勘控除・口座参照・削除・二重反映を検証する', async () => fixture(async (db) => {
  await db.expenseSplits.put({ ...base, id: 'split', expenseId: expense.id, memberId: 'member', amountYen: 400 })
  await saveRefund(refund, db)
  await assert.rejects(saveRefund({ ...refund, id: 'too-large', amountYen: 301 }, db), /本人負担/)
  await assert.rejects(saveRefund({ ...refund, id: 'bad-account', cashAccountId: 'missing' }, db), /返金先口座/)
  await saveRefund({ ...refund, amountYen: 600 }, db) // Edit excludes itself from the limit.
  assert.equal((await db.expenseRefunds.get('refund'))?.amountYen, 600)
  await saveRefund({ ...refund, amountYen: 600, deleted: true }, db)
  await saveRefund({ ...refund, id: 'replacement', amountYen: 600 }, db)
  await assert.rejects(saveCashAccount({ ...wallet, deleted: true }, db), /使用中/)
}))

test('同一口座・存在しない口座・非整数の振替は保存しない', async () => fixture(async (db) => {
  await assert.rejects(saveTransfer({ ...transfer, toAccountId: 'bank' }, db))
  await assert.rejects(saveTransfer({ ...transfer, toAccountId: 'missing' }, db))
  await assert.rejects(saveTransfer({ ...transfer, amountYen: 1.5 }, db))
  assert.equal(await db.accountTransfers.count(), 0)
  await saveTransfer(transfer, db)
  assert.equal(await db.accountTransfers.count(), 1)
}))

test('返金後の保存取り消し・支出の縮小で履歴の整合性を壊さない', async () => fixture(async (db) => {
  const ticket = await writeExpense({ ...expense, amountYen: 2000 }, [], db)
  await saveRefund(refund, db)
  assert.equal(await undoExpenseWrite(ticket, db), false)
  await assert.rejects(writeExpense({ ...expense, amountYen: 100 }, [], db), /返金記録/)
  await assert.rejects(writeExpense({ ...expense, deleted: true }, [], db), /返金記録/)
  await assert.rejects(writeExpense({ ...expense, purchasedAtMillis: at(9, 4) }, [], db), /返金日時/)
  assert.equal((await db.expenses.get(expense.id))?.deleted, false)
}))

test('プリペイド間のチャージは出金元の残高も減り、総額を増やさない', () => {
  const methods = ['a', 'b'].map((id) => ({ ...cash, id, type: 'prepaid' as const }))
  const charges = [{ ...base, id: 'c1', prepaidMethodId: 'a', fundingMethodId: 'cash', amountYen: 1000, chargedAtMillis: at(9, 2), note: '' }, { ...base, id: 'c2', prepaidMethodId: 'b', fundingMethodId: 'a', amountYen: 300, chargedAtMillis: at(9, 3), note: '' }]
  const rows = computePrepaidBalances(methods, charges, [])
  assert.equal(rows.find((row) => row.methodId === 'a')?.balance, 700)
  assert.equal(rows.find((row) => row.methodId === 'b')?.balance, 300)
})

test('口座機能のない旧サーバーを同期成功と扱わず、端末のデータを保持する', async (t) => fixture(async (db) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ changes: {}, debts: [] }))
  await assert.rejects(apiSync('test-token', 0, await readSyncSnapshot(db)), /サーバーへの更新/)
  assert.equal(await db.cashAccounts.count(), 2)
}))

test('バックアップ復元の全表トランザクション内で検証し、不正な参照は全体を戻す', async () => fixture(async (db) => {
  await assert.rejects(db.transaction('rw', db.tables, async () => {
    await db.expenseRefunds.put({ ...refund, cashAccountId: 'missing' })
    validateFinance(await readSyncSnapshot(db))
  }))
  assert.equal(await db.expenseRefunds.count(), 0)
  assert.equal(await db.cashAccounts.count(), 2)
}))

test('口座・振替・返金・口座スナップショットを同期で往復し、復元時に参照を検証', async (t) => fixture(async (db) => {
  await saveTransfer(transfer, db)
  await saveRefund(refund, db)
  const local = await readSyncSnapshot(db)
  validateFinance(local)
  t.mock.method(globalThis, 'fetch', async (_url, options) => Response.json({ server_time: 100, changes: JSON.parse(options.body).changes, debts: [], invitations: [] }))
  const result = await apiSync('test-token', 0, local)
  assert.deepEqual(result.changes.cashAccounts, local.cashAccounts)
  assert.deepEqual(result.changes.accountTransfers, local.accountTransfers)
  assert.deepEqual(result.changes.expenseRefunds, local.expenseRefunds)
  assert.equal(result.changes.expenses[0].cashAccountId, 'wallet')
  assert.equal(await applySyncChanges(result.changes, db), 1) // legacy optional cardLastFour normalized on cash method
  assert.throws(() => validateFinance({ ...local, cashAccounts: [] }))
  assert.throws(() => validateFinance({ ...local, expenseRefunds: [{ ...refund, amountYen: 2000 }] }))
  assert.throws(() => validateFinance({ ...local, paymentMethods: [{ ...cash, type: 'credit' }] }))
}))
