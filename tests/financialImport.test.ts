import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { KakeiboDB } from '../src/db.ts'
import { financialMessageSource } from '../src/imports/source.ts'
import { parseSmbcMessage } from '../src/imports/smbc.ts'
import { notificationEvents, notificationStatus } from '../src/native/notifications.ts'
import { DuplicateFinancialMessageError, writeExpense } from '../src/entries/persistence.ts'
import type { Expense } from '../src/types.ts'

const candidate = parseSmbcMessage({
  subject: 'ご利用のお知らせ【三井住友カード】',
  text: 'Oliveフレキシブルペイ（デビットモード）\n◇利用日：2026/10/01 12:34:56\n◇利用先：TEST STORE\n◇利用金額：980円\n◇承認番号：123456',
})

test('store only a stable bounded digest of reviewed transaction metadata', async () => {
  assert.equal(candidate.kind, 'card_usage')
  const source = await financialMessageSource(candidate)
  assert.match(source, /^financial-message:v1:[a-f0-9]{64}$/)
  assert.ok(source.length <= 128)
  assert.equal(await financialMessageSource({ ...candidate, merchant: ' test   store ' }), source)
  assert.notEqual(await financialMessageSource({ ...candidate, amountYen: 981 }), source)
})

test('same message cannot be recorded twice in one local transaction; edit and undo/reimport remain possible', async () => {
  const db = new KakeiboDB(`message-import-${crypto.randomUUID()}`)
  const expense: Expense = {
    id: 'first', type: 'expense', title: 'TEST STORE', amountYen: 980, purchasedAtMillis: candidate.purchasedAtMillis!,
    source: await financialMessageSource(candidate), category: 'その他', paymentMethodId: 'debit', updatedAt: 1, deleted: false,
  }
  try {
    await writeExpense(expense, [], db)
    await assert.rejects(writeExpense({ ...expense, id: 'second' }, [], db), DuplicateFinancialMessageError)
    assert.equal(await db.expenses.count(), 1)
    await writeExpense({ ...expense, amountYen: 990 }, [], db)
    await db.expenses.update(expense.id, { deleted: true })
    await writeExpense({ ...expense, id: 'second' }, [], db)
    assert.equal((await db.expenses.get('second'))?.deleted, false)
  } finally { await db.delete() }
})

test('native messages are bounded, package scoped, data only and never HTML executed', () => {
  const event = { id: 'abc-123', title: '<img src=x onerror=alert(1)>', text: '利用金額：980円', packageName: 'com.smbc_card.vpass', postedAt: 1 }
  assert.deepEqual(notificationEvents([event]), [event])
  assert.throws(() => notificationEvents([{ ...event, packageName: 'com.google.android.gm' }]))
  assert.throws(() => notificationEvents([{ ...event, text: 'x'.repeat(2001) }]))
  assert.throws(() => notificationEvents([{ ...event, id: '../other' }]))
  assert.throws(() => notificationEvents(Array.from({ length: 51 }, () => event)))
  assert.deepEqual(notificationStatus({ available: true, enabled: false, permissionGranted: false, pendingCount: 0 }), {
    available: true, enabled: false, permissionGranted: false, pendingCount: 0,
  })
  assert.throws(() => notificationStatus({ available: true, enabled: true, permissionGranted: true, pendingCount: 51 }))
})
