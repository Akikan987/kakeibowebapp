import type { Category, Expense, PaymentMethod } from '../types.ts'

export interface DraftSplit { memberId: string; amount: string }
export interface ExpenseDraft {
  cashAccountId?: string
  editingId: string | null
  type: string
  title: string
  amountYen: string
  category: string
  purchasedAtMillis: number
  source: string
  paymentMethodId: string
  splits: DraftSplit[]
}

const normalize = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ja-JP')

export function merchantSuggestions(draft: ExpenseDraft, expenses: Expense[], categories: Category[], methods: PaymentMethod[]) {
  const title = normalize(draft.title)
  if (!title || title === 'その他' || draft.editingId) return []
  const validCategories = new Set(categories.filter((row) => !row.deleted).map((row) => row.name))
  const methodNames = new Map(methods.filter((row) => !row.deleted).map((row) => [row.id, row.name]))
  const candidates = new Map<string, { category: string; paymentMethodId: string; paymentName: string; count: number; lastUsed: number }>()
  for (const row of expenses) {
    if (row.deleted || row.type !== draft.type || normalize(row.title) !== title || !validCategories.has(row.category)) continue
    if (row.type === 'expense' && !methodNames.has(row.paymentMethodId)) continue
    const paymentMethodId = row.type === 'expense' ? row.paymentMethodId : ''
    const key = JSON.stringify([row.category, paymentMethodId])
    const previous = candidates.get(key)
    candidates.set(key, {
      category: row.category, paymentMethodId, paymentName: methodNames.get(paymentMethodId) ?? '',
      count: (previous?.count ?? 0) + 1, lastUsed: Math.max(previous?.lastUsed ?? 0, row.purchasedAtMillis),
    })
  }
  return [...candidates.values()].sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed).slice(0, 3)
}

export function findDuplicateExpenses(draft: ExpenseDraft, expenses: Expense[]): Expense[] {
  const amount = Number(draft.amountYen)
  if (!draft.amountYen.trim() || !Number.isSafeInteger(amount) || !Number.isFinite(draft.purchasedAtMillis)) return []
  const date = new Date(draft.purchasedAtMillis)
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
  return expenses.filter((row) => !row.deleted && row.id !== draft.editingId && row.type === draft.type &&
    row.amountYen === amount && row.purchasedAtMillis >= start && row.purchasedAtMillis < end &&
    (draft.type !== 'expense' || row.paymentMethodId === draft.paymentMethodId))
}

export const hasDraftContent = (draft: ExpenseDraft) => !!(draft.title.trim() || draft.amountYen || draft.splits.length)

const draftPrefix = (owner: string) => `kakeibo:entry-draft:${encodeURIComponent(owner)}:`
export const draftStorageKey = (owner: string, editingId: string | null) => `${draftPrefix(owner)}${encodeURIComponent(editingId ?? 'new')}`

interface SavedDraft { version: 1; draft: ExpenseDraft; baseUpdatedAt: number | null }

/** Local-only and account-scoped. Never store a receipt image, API key, or token. */
export function writeDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, draft: ExpenseDraft, baseUpdatedAt: number | null): boolean {
  try {
    if (hasDraftContent(draft)) storage.setItem(key, JSON.stringify({ version: 1, draft, baseUpdatedAt } satisfies SavedDraft))
    else storage.removeItem(key)
    return true
  } catch { return false }
}

export function readDraft(storage: Pick<Storage, 'getItem'>, key: string, editingId: string | null, baseUpdatedAt: number | null): ExpenseDraft | null {
  try {
    const saved = JSON.parse(storage.getItem(key) ?? 'null') as SavedDraft | null
    if (saved?.version !== 1 || saved.baseUpdatedAt !== baseUpdatedAt) return null
    const draft = saved.draft
    if (!draft || draft.editingId !== editingId || !['', 'income', 'expense'].includes(draft.type)) return null
    if (draft.cashAccountId !== undefined && typeof draft.cashAccountId !== 'string') return null
    if (!['title', 'amountYen', 'category', 'source', 'paymentMethodId'].every((key) => typeof draft[key as keyof ExpenseDraft] === 'string')) return null
    if (!Number.isFinite(draft.purchasedAtMillis) || !Number.isFinite(new Date(draft.purchasedAtMillis).getTime())) return null
    if (!Array.isArray(draft.splits) || !draft.splits.every((row) => row && typeof row.memberId === 'string' && typeof row.amount === 'string')) return null
    return hasDraftContent(draft) ? draft : null
  } catch { return null }
}

export function clearDrafts(storage: Storage, owner: string) {
  try {
    const prefix = draftPrefix(owner)
    for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key)
  } catch { /* Storage may be unavailable; never block logout. */ }
}
