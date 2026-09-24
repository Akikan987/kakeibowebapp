import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { KakeiboDB } from '../src/db.ts'
import { undoExpenseWrite, writeExpense } from '../src/entries/persistence.ts'
import type { Expense, ExpenseSplit } from '../src/types.ts'

const expense: Expense = { id: 'e', title: 'store', amountYen: 1000, type: 'expense', paymentMethodId: 'card',
  category: '食費', source: 'manual', purchasedAtMillis: 1, updatedAt: 1, deleted: false }
const split = (id: string, amountYen: number): ExpenseSplit => ({ id, expenseId: 'e', memberId: 'friend', amountYen, updatedAt: 1, deleted: false })

test('新規保存と割り勘を一緒に取り消し、同期できる削除フラグを残す', async () => {
  const db = new KakeiboDB(`entry-test-${crypto.randomUUID()}`)
  try {
    const ticket = await writeExpense(expense, [split('s', 500)], db)
    assert.equal((await db.expenses.get('e'))?.deleted, false)
    assert.equal(await undoExpenseWrite(ticket, db), true)
    assert.equal((await db.expenses.get('e'))?.deleted, true)
    assert.equal((await db.expenseSplits.get('s'))?.deleted, true)
    assert.ok((await db.expenses.get('e'))!.updatedAt > ticket.saved.updatedAt)
    assert.equal(await undoExpenseWrite(ticket, db), false)
  } finally { await db.delete() }
})

test('編集の取り消しで元の金額・品目・割り勘を復元する', async () => {
  const db = new KakeiboDB(`entry-test-${crypto.randomUUID()}`)
  try {
    await writeExpense(expense, [split('old', 500)], db)
    const ticket = await writeExpense({ ...expense, amountYen: 2000, category: '娯楽' }, [split('new', 700)], db)
    assert.equal((await db.expenseSplits.get('old'))?.deleted, true)
    assert.equal(await undoExpenseWrite(ticket, db), true)
    assert.equal((await db.expenses.get('e'))?.amountYen, 1000)
    assert.equal((await db.expenses.get('e'))?.category, '食費')
    assert.equal((await db.expenseSplits.get('old'))?.deleted, false)
    assert.equal((await db.expenseSplits.get('new'))?.deleted, true)
  } finally { await db.delete() }
})

test('保存後の明細または割り勘の変更があれば取り消しで上書きしない', async () => {
  const db = new KakeiboDB(`entry-test-${crypto.randomUUID()}`)
  try {
    const ticket = await writeExpense(expense, [split('s', 500)], db)
    await db.expenses.update('e', { amountYen: 2000 })
    assert.equal(await undoExpenseWrite(ticket, db), false)
    assert.equal((await db.expenses.get('e'))?.amountYen, 2000)
    const next = await writeExpense(expense, [], db)
    await db.expenseSplits.add(split('another-device', 100))
    assert.equal(await undoExpenseWrite(next, db), false)
    assert.equal((await db.expenses.get('e'))?.deleted, false)
  } finally { await db.delete() }
})

test('割り勘保存失敗時は明細も元に戻し、部分保存を残さない', async () => {
  const db = new KakeiboDB(`entry-test-${crypto.randomUUID()}`)
  try {
    await db.expenses.put(expense)
    db.expenseSplits.hook('creating', () => { throw new Error('split failed') })
    await assert.rejects(writeExpense({ ...expense, amountYen: 2000 }, [split('s', 500)], db), /split failed/)
    assert.equal((await db.expenses.get('e'))?.amountYen, 1000)
    assert.equal(await db.expenseSplits.count(), 0)
  } finally { await db.delete() }
})
