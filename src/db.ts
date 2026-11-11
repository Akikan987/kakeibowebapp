import Dexie, { type Table } from 'dexie'
import {
  type Category,
  type CashAccount, type AccountTransfer, type ExpenseRefund,
  type Budget,
  type CardStatement,
  type Expense,
  type ExpenseSplit,
  type Member,
  type PaymentMethod,
  type PrepaidCharge,
  type RecurringTemplate,
  type Settlement,
  now,
} from './types.ts'
import { expandedExpenseCategories, starterCategories } from './domain/categories.ts'

/**
 * ブラウザ内のローカルDB（IndexedDB）。
 * Androidアプリの Room と同じ役割で、オフラインでも使えるようにする。
 */
export class KakeiboDB extends Dexie {
  cashAccounts!: Table<CashAccount, string>
  accountTransfers!: Table<AccountTransfer, string>
  expenseRefunds!: Table<ExpenseRefund, string>
  expenses!: Table<Expense, string>
  members!: Table<Member, string>
  categories!: Table<Category, string>
  expenseSplits!: Table<ExpenseSplit, string>
  settlements!: Table<Settlement, string>
  paymentMethods!: Table<PaymentMethod, string>
  prepaidCharges!: Table<PrepaidCharge, string>
  recurringTemplates!: Table<RecurringTemplate, string>
  budgets!: Table<Budget, string>
  cardStatements!: Table<CardStatement, string>

  constructor(name = 'kakeibo') {
    super(name)
    this.version(1).stores({
      expenses: 'id, purchasedAtMillis, type, deleted, updatedAt',
      members: 'id, deleted, updatedAt',
      categories: 'id, position, deleted, updatedAt',
      expenseSplits: 'id, expenseId, memberId, deleted, updatedAt',
      settlements: 'id, memberId, deleted, updatedAt',
    })
    this.version(2).stores({
      expenses:
        'id, purchasedAtMillis, type, paymentMethodId, deleted, updatedAt',
      members: 'id, deleted, updatedAt',
      categories: 'id, position, deleted, updatedAt',
      expenseSplits: 'id, expenseId, memberId, deleted, updatedAt',
      settlements: 'id, memberId, deleted, updatedAt',
      paymentMethods: 'id, type, deleted, updatedAt',
      prepaidCharges:
        'id, prepaidMethodId, fundingMethodId, chargedAtMillis, deleted, updatedAt',
    })
    this.version(3).stores({
      expenses:
        'id, purchasedAtMillis, type, paymentMethodId, deleted, updatedAt',
      members: 'id, deleted, updatedAt',
      categories: 'id, position, deleted, updatedAt',
      expenseSplits: 'id, expenseId, memberId, deleted, updatedAt',
      settlements: 'id, memberId, deleted, updatedAt',
      paymentMethods: 'id, type, deleted, updatedAt',
      prepaidCharges:
        'id, prepaidMethodId, fundingMethodId, chargedAtMillis, deleted, updatedAt',
      recurringTemplates: 'id, active, dayOfMonth, deleted, updatedAt',
      budgets: 'id, monthKey, category, deleted, updatedAt',
      cardStatements:
        'id, paymentMethodId, withdrawalAtMillis, status, deleted, updatedAt',
    })
    this.version(4).stores({
      cashAccounts: 'id, deleted, updatedAt',
      accountTransfers: 'id, fromAccountId, toAccountId, deleted, updatedAt',
      expenseRefunds: 'id, expenseId, deleted, updatedAt',
    })
  }
}

export const db = new KakeiboDB()

export const DEFAULT_CASH_METHOD_ID = 'e7147cce-f204-4d15-8880-000000000001'
export const DEFAULT_OTHER_METHOD_ID = 'e7147cce-f204-4d15-8880-000000000002'

/** 初回のみ既定の品目を投入 */
export async function seedCategoriesIfEmpty(expanded = false, database = db) {
  const defaults = expanded ? [...starterCategories, ...expandedExpenseCategories] : starterCategories
  return database.transaction('rw', database.categories, async () => {
    if (await database.categories.count() > 0) return false
    const updatedAt = now()
    await database.categories.bulkPut(defaults.map((category, position) => ({ ...category, position, updatedAt, deleted: false })))
    return true
  })
}

/** Explicit registration only: retain guest edits and tombstones while adding missing defaults. */
export async function seedNewAccountCategories(database = db) {
  await database.transaction('rw', database.categories, async () => {
    const categories = await database.categories.toArray()
    const ids = new Set(categories.map((row) => row.id))
    const names = new Set(categories.map((row) => row.name))
    let position = Math.max(-1, ...categories.map((row) => row.position)) + 1
    const updatedAt = now()
    const missing = [...starterCategories, ...expandedExpenseCategories]
      .filter((preset) => !ids.has(preset.id) && !names.has(preset.name))
      .map((preset) => ({ ...preset, position: position++, updatedAt, deleted: false }))
    await database.categories.bulkPut(missing)
  })
}

/** Don't add untouched guest presets to an existing account during the first sync. */
export async function removeUnusedGuestPresets(database = db, seededAt?: number) {
  await database.transaction('rw', [
    database.categories, database.expenses, database.recurringTemplates, database.budgets, database.expenseRefunds,
  ], async () => {
    const categories = await database.categories.toArray()
    const seedTimes = seededAt !== undefined ? new Set([seededAt]) : new Set(starterCategories.flatMap((preset, position) => categories
      .filter((row) => row.id === preset.id && row.name === preset.name && row.position === position && !row.deleted)
      .map((row) => row.updatedAt)))
    const unusedCandidates = [...starterCategories, ...expandedExpenseCategories].flatMap((preset, position) => categories.filter((row) =>
      row.id === preset.id && row.name === preset.name && row.position === position && seedTimes.has(row.updatedAt) && !row.deleted,
    ))
    if (unusedCandidates.length === 0) return
    const ledger = await Promise.all([
      database.expenses.toArray(), database.recurringTemplates.toArray(), database.budgets.toArray(), database.expenseRefunds.toArray(),
    ])
    const used = new Set(ledger.flatMap((table) => table.filter((row) => !row.deleted).map((row) => row.category)))
    await database.categories.bulkDelete(unusedCandidates.filter((category) => !used.has(category.name)).map((category) => category.id))
  })
}

/** 汎用の現金・その他だけを初期投入。カード類は名前と締め日を利用者が登録する。 */
export async function seedPaymentMethodsIfEmpty() {
  const count = await db.paymentMethods.filter((method) => !method.deleted).count()
  if (count > 0) return
  const ts = now()
  await db.paymentMethods.bulkPut([
    {
      id: DEFAULT_CASH_METHOD_ID,
      name: '現金',
      type: 'cash',
      closingDay: 0,
      paymentDay: 0,
      updatedAt: ts,
      deleted: false,
    },
    {
      id: DEFAULT_OTHER_METHOD_ID,
      name: 'その他',
      type: 'other',
      closingDay: 0,
      paymentDay: 0,
      updatedAt: ts,
      deleted: false,
    },
  ])
}

/**
 * 同じ名前の品目が複数あるときに1つだけ残し、残りを論理削除する。
 * 端末ごとに既定品目のIDが違っても重複が増えないようにするための後始末。
 * 残す1つは「IDが最小のもの」＝どの端末でも同じ結果になる。
 */
export async function dedupeCategories(): Promise<boolean> {
  const all = await db.categories.filter((c) => !c.deleted).toArray()
  const byName = new Map<string, Category[]>()
  for (const c of all) {
    const list = byName.get(c.name) ?? []
    list.push(c)
    byName.set(c.name, list)
  }
  const losers: Category[] = []
  for (const list of byName.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    losers.push(...list.slice(1))
  }
  if (losers.length === 0) return false
  const ts = now()
  await db.categories.bulkPut(
    losers.map((c) => ({ ...c, deleted: true, updatedAt: ts })),
  )
  return true
}

/** ローカルを全消去（別アカウントでログインした時など） */
export async function clearLocalData(expandedCategories: boolean | null = false) {
  await db.transaction(
    'rw',
    [
      db.expenses,
      db.members,
      db.categories,
      db.expenseSplits,
      db.settlements,
      db.paymentMethods,
      db.prepaidCharges,
      db.recurringTemplates,
      db.budgets,
      db.cardStatements,
      db.cashAccounts, db.accountTransfers, db.expenseRefunds,
    ],
    async () => {
      await Promise.all([
        db.expenses.clear(),
        db.members.clear(),
        db.categories.clear(),
        db.expenseSplits.clear(),
        db.settlements.clear(),
        db.paymentMethods.clear(),
        db.prepaidCharges.clear(),
        db.recurringTemplates.clear(),
        db.budgets.clear(),
        db.cardStatements.clear(),
        db.cashAccounts.clear(), db.accountTransfers.clear(), db.expenseRefunds.clear(),
      ])
    },
  )
  if (expandedCategories !== null) await seedCategoriesIfEmpty(expandedCategories)
  await seedPaymentMethodsIfEmpty()
}

// ---- 読み出しヘルパー（deleted は除外） ----
export const activeExpenses = () =>
  db.expenses.filter((e) => !e.deleted).toArray()
export const activeMembers = () => db.members.filter((m) => !m.deleted).toArray()
export const activeCategories = async () =>
  (await db.categories.filter((c) => !c.deleted).toArray()).sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  )
export const activeSplits = () =>
  db.expenseSplits.filter((s) => !s.deleted).toArray()
export const activeSettlements = async () =>
  (await db.settlements.filter((s) => !s.deleted).toArray()).sort(
    (a, b) => b.dateMillis - a.dateMillis,
  )
export const activePaymentMethods = async () =>
  (await db.paymentMethods.filter((m) => !m.deleted).toArray()).sort(
    (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
  )
export const activePrepaidCharges = async () =>
  (await db.prepaidCharges.filter((c) => !c.deleted).toArray()).sort(
    (a, b) => b.chargedAtMillis - a.chargedAtMillis,
  )
export const activeRecurringTemplates = async () =>
  (await db.recurringTemplates.filter((r) => !r.deleted).toArray()).sort(
    (a, b) => a.dayOfMonth - b.dayOfMonth || a.title.localeCompare(b.title),
  )
export const activeBudgets = () => db.budgets.filter((b) => !b.deleted).toArray()
export const activeCardStatements = () =>
  db.cardStatements.filter((s) => !s.deleted).toArray()
