import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { KakeiboDB, removeUnusedGuestPresets, seedCategoriesIfEmpty, seedNewAccountCategories } from '../src/db.ts'
import { expandedExpenseCategories, listCategoryNames, starterCategories } from '../src/domain/categories.ts'
import { TYPE_EXPENSE, TYPE_INCOME } from '../src/types.ts'

async function withDatabase(run: (db: KakeiboDB) => Promise<void>) {
  const database = new KakeiboDB(`categories-${crypto.randomUUID()}`)
  try { await run(database) } finally { await database.delete() }
}

test('新しいゲストには支出11品目を用意し、再起動で増やさない', async () => {
  await withDatabase(async (db) => {
    assert.equal(await seedCategoriesIfEmpty(true, db), true)
    const first = await db.categories.orderBy('position').toArray()
    assert.deepEqual(first.map((row) => row.name), [...starterCategories, ...expandedExpenseCategories].map((row) => row.name))
    assert.equal(await seedCategoriesIfEmpty(true, db), false)
    assert.deepEqual(await db.categories.orderBy('position').toArray(), first)
  })
})

test('既存の5品目と削除済みだけのDBを変更しない', async () => {
  await withDatabase(async (db) => {
    await seedCategoriesIfEmpty(false, db)
    const legacy = await db.categories.toArray()
    await seedCategoriesIfEmpty(true, db)
    assert.deepEqual(await db.categories.toArray(), legacy)
    await db.categories.clear()
    const tombstone = { ...legacy[0], deleted: true }
    await db.categories.put(tombstone)
    await seedCategoriesIfEmpty(true, db)
    assert.deepEqual(await db.categories.toArray(), [tombstone])
  })
})

test('明示的な新規登録ではゲストの改名・削除を守って不足分だけ追加する', async () => {
  await withDatabase(async (db) => {
    await seedCategoriesIfEmpty(false, db)
    await db.categories.update(starterCategories[0].id, { name: '食料品', updatedAt: 1 })
    await db.categories.update(starterCategories[1].id, { deleted: true, updatedAt: 1 })
    await seedNewAccountCategories(db)
    const rows = await db.categories.toArray()
    assert.equal(rows.length, 11)
    assert.equal(rows.find((row) => row.id === starterCategories[0].id)?.name, '食料品')
    assert.equal(rows.find((row) => row.id === starterCategories[1].id)?.deleted, true)
  })
})

test('既存アカウントへの同期に未使用のゲスト初期値を持ち込まない', async () => {
  await withDatabase(async (db) => {
    await seedCategoriesIfEmpty(true, db)
    await removeUnusedGuestPresets(db)
    assert.deepEqual(await db.categories.toArray(), [])
  })
})

test('ゲストの明細・定期項目・予算で使用した品目とカスタム品目を維持する', async () => {
  await withDatabase(async (db) => {
    await seedCategoriesIfEmpty(true, db)
    const initial = await db.categories.get(starterCategories[0].id)
    await db.categories.put({ id: 'custom', name: '推し活', position: 20, updatedAt: 1, deleted: false })
    await db.categories.update(expandedExpenseCategories[3].id, { name: '通院', updatedAt: 1 })
    await db.categories.update(expandedExpenseCategories[4].id, { deleted: true, updatedAt: 1 })
    await db.expenses.put({ id: 'expense', title: '食料', amountYen: 100, category: '食費', type: TYPE_EXPENSE, paymentMethodId: '', cashAccountId: '', purchasedAtMillis: 1, source: 'manual', updatedAt: 1, deleted: false })
    await db.budgets.put({ id: 'budget', monthKey: '2026-11', category: '住居', amountYen: 50000, updatedAt: 1, deleted: false })
    await db.recurringTemplates.put({ id: 'template', title: '光熱費', category: '水道光熱', amountYen: 5000, type: TYPE_EXPENSE, dayOfMonth: 1, paymentMethodId: '', active: true, updatedAt: 1, deleted: false })
    await removeUnusedGuestPresets(db)
    const names = (await db.categories.toArray()).map((row) => row.name).sort()
    assert.deepEqual(names, ['食費', '住居', '水道光熱', '推し活', '通院', 'サブスク'].sort())
    assert.deepEqual(await db.categories.get(starterCategories[0].id), initial)
    assert.equal(await db.expenses.count(), 1)
    assert.equal(await db.budgets.count(), 1)
    assert.equal(await db.recurringTemplates.count(), 1)
  })
})

test('収入は専用品目とカスタム品目を使い、古い選択済み品目を編集で失わない', () => {
  const categories = [...starterCategories, ...expandedExpenseCategories].map((row, position) => ({ ...row, position, updatedAt: 1, deleted: false }))
  categories.push({ id: 'custom', name: '立替精算', position: 20, updatedAt: 1, deleted: false })
  assert.deepEqual(listCategoryNames(categories, TYPE_INCOME), ['給与', '賞与', '副収入', 'その他', '立替精算'])
  assert.deepEqual(listCategoryNames(categories, TYPE_INCOME, '食費'), ['給与', '賞与', '副収入', 'その他', '立替精算', '食費'])
  assert.equal(listCategoryNames(categories, TYPE_EXPENSE).length, 12)
})

test('初期投入時刻を使い、基本品目がすべて改名されても未使用の追加品目を除去する', async () => {
  await withDatabase(async (db) => {
    await seedCategoriesIfEmpty(true, db)
    const seededAt = (await db.categories.get(starterCategories[0].id))!.updatedAt
    for (const preset of starterCategories) {
      await db.categories.update(preset.id, { name: `${preset.name}（変更）`, updatedAt: seededAt + 1 })
    }
    await removeUnusedGuestPresets(db, seededAt)
    assert.equal(await db.categories.count(), 5)
    assert.ok((await db.categories.toArray()).every((row) => row.name.endsWith('（変更）')))
  })
})
