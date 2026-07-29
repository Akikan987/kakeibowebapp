import Dexie, { type Table } from 'dexie'
import {
  type Category,
  type Expense,
  type ExpenseSplit,
  type Member,
  type Settlement,
  newId,
  now,
} from './types'

/**
 * ブラウザ内のローカルDB（IndexedDB）。
 * Androidアプリの Room と同じ役割で、オフラインでも使えるようにする。
 */
class KakeiboDB extends Dexie {
  expenses!: Table<Expense, string>
  members!: Table<Member, string>
  categories!: Table<Category, string>
  expenseSplits!: Table<ExpenseSplit, string>
  settlements!: Table<Settlement, string>

  constructor() {
    super('kakeibo')
    this.version(1).stores({
      expenses: 'id, purchasedAtMillis, type, deleted, updatedAt',
      members: 'id, deleted, updatedAt',
      categories: 'id, position, deleted, updatedAt',
      expenseSplits: 'id, expenseId, memberId, deleted, updatedAt',
      settlements: 'id, memberId, deleted, updatedAt',
    })
  }
}

export const db = new KakeiboDB()

const DEFAULT_CATEGORIES = ['食費', '日用品', '交通', '娯楽', 'その他']

/** 名前から決まる固定ID（端末をまたいでも既定品目が重複しない） */
async function stableCategoryId(name: string): Promise<string> {
  const data = new TextEncoder().encode(`kakeibo-category:${name}`)
  if (crypto?.subtle) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
    const hex = Array.from(hash.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }
  return newId()
}

/** 初回のみ既定の品目を投入 */
export async function seedCategoriesIfEmpty() {
  const count = await db.categories.count()
  if (count > 0) return
  const ts = now()
  const rows: Category[] = []
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const name = DEFAULT_CATEGORIES[i]
    rows.push({
      id: await stableCategoryId(name),
      name,
      position: i,
      updatedAt: ts,
      deleted: false,
    })
  }
  await db.categories.bulkPut(rows)
}

/** ローカルを全消去（別アカウントでログインした時など） */
export async function clearLocalData() {
  await db.transaction(
    'rw',
    db.expenses,
    db.members,
    db.categories,
    db.expenseSplits,
    db.settlements,
    async () => {
      await Promise.all([
        db.expenses.clear(),
        db.members.clear(),
        db.categories.clear(),
        db.expenseSplits.clear(),
        db.settlements.clear(),
      ])
    },
  )
  await seedCategoriesIfEmpty()
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
