import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { KakeiboDB } from '../src/db.ts'
import { apiSync } from '../src/api.ts'
import { applySyncChanges, readSyncSnapshot } from '../src/sync/local.ts'
import { recordsToApply, reuseUnchangedRows, sameRecord } from '../src/sync/records.ts'
import { SYNC_TABLE_NAMES, type SyncTables } from '../src/sync/types.ts'
import type { Expense } from '../src/types.ts'

const expense = (id: string, updatedAt = 1, amountYen = 100): Expense => ({
  id, updatedAt, amountYen, deleted: false, title: 'test', category: '食費',
  source: 'manual', type: 'expense', paymentMethodId: '', purchasedAtMillis: 1, cashAccountId: '',
})
const changes = (partial: Partial<SyncTables> = {}): SyncTables => ({
  expenses: [], members: [], categories: [], expenseSplits: [], settlements: [],
  paymentMethods: [], prepaidCharges: [], recurringTemplates: [], budgets: [], cardStatements: [],
  cashAccounts: [], accountTransfers: [], expenseRefunds: [],
  ...partial,
})

test('同じ内容はキー順に関わらず再利用し、同時刻の異なる内容は区別する', () => {
  const row = expense('a')
  assert.ok(sameRecord(row, { ...row }))
  assert.ok(sameRecord({ a: 1, b: 2 }, { b: 2, a: 1 }))
  assert.equal(sameRecord({ a: undefined }, { b: undefined }), false)
  const previous = [row]
  assert.equal(reuseUnchangedRows(previous, [{ ...row }]), previous)
  assert.notEqual(reuseUnchangedRows(previous, [expense('a', 1, 200)]), previous)
  assert.notEqual(reuseUnchangedRows(previous, []), previous)
})

test('APIへ全件と省略フラグを送り、旧APIの全件応答と新APIの空応答を扱える', async (t) => {
  const row = expense('a')
  const local = changes({ expenses: [row] })
  let compact = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/sync')
    const body = JSON.parse(options.body)
    assert.equal(body.since, 0)
    assert.equal(body.omit_unchanged, true)
    assert.equal(body.changes.expenses.length, 1)
    assert.equal(body.changes.expenses[0].amount_yen, 100)
    assert.equal(Object.keys(body.changes).length, 13)
    return Response.json({
      server_time: 100,
      changes: compact ? {} : body.changes,
      debts: [{ owner_uid: 'owner', owner_nickname: 'test', charged: 100, settled: 20, remaining: 80 }],
    })
  })
  assert.deepEqual((await apiSync('test-token', 0, local)).changes, local)
  compact = true
  const response = await apiSync('test-token', 0, local)
  assert.deepEqual(response.changes, changes())
  assert.equal(response.debts[0].remaining, 80)
  assert.equal(response.serverTime, 100)
})

test('新しいローカル編集を保持し、同時刻の変更・削除・新規だけを適用する', () => {
  const current = [expense('same'), expense('local-newer', 3), expense('equal'), expense('delete')]
  const incoming = [expense('same'), expense('local-newer', 2), expense('equal', 1, 200),
    { ...expense('delete', 2), deleted: true }, expense('new')]
  assert.deepEqual(recordsToApply(current, incoming).map((row) => row.id), ['equal', 'delete', 'new'])
  assert.deepEqual(recordsToApply([], [expense('a', 3), expense('a', 1)]), [expense('a', 3)])
})

test('IndexedDBの全テーブルを読み、同一応答の書き込みをゼロにする', async () => {
  const db = new KakeiboDB(`sync-test-${crypto.randomUUID()}`)
  try {
    const row = expense('a')
    const deleted = { ...expense('b'), deleted: true }
    await db.expenses.bulkPut([row, deleted])
    const snapshot = await readSyncSnapshot(db)
    assert.deepEqual(Object.keys(snapshot), [...SYNC_TABLE_NAMES])
    assert.deepEqual(snapshot.expenses, [row, deleted])
    let updates = 0
    db.expenses.hook('updating', () => { updates += 1 })
    assert.equal(await applySyncChanges(snapshot, db), 0)
    assert.equal(updates, 0)
    await db.expenses.put(expense('a', 5, 300)) // edited while the request was in flight
    assert.equal(await applySyncChanges(changes({ expenses: [expense('a', 4)] }), db), 0)
    assert.equal((await db.expenses.get('a'))?.amountYen, 300)
    assert.equal(await applySyncChanges(changes({ expenses: [expense('a', 5, 400)] }), db), 1)
    assert.equal((await db.expenses.get('a'))?.amountYen, 400)
    assert.equal(await applySyncChanges(changes(), db), 0)
  } finally { await db.delete() }
})

test('同期途中の別テーブル書き込み失敗で全変更をロールバックする', async () => {
  const db = new KakeiboDB(`sync-test-${crypto.randomUUID()}`)
  try {
    await db.expenses.put(expense('a'))
    db.members.hook('creating', () => { throw new Error('simulated failure') })
    await assert.rejects(applySyncChanges(changes({
      expenses: [expense('a', 2, 999)],
      members: [{ id: 'm', name: 'test', linkedUid: '', updatedAt: 2, deleted: false }],
    }), db), /simulated failure/)
    assert.equal((await db.expenses.get('a'))?.amountYen, 100)
    assert.equal(await db.members.count(), 0)
  } finally { await db.delete() }
})
