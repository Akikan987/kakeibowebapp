import assert from 'node:assert/strict'
import test from 'node:test'
import { clearDrafts, draftStorageKey, findDuplicateExpenses, merchantSuggestions, readDraft, writeDraft, type ExpenseDraft } from '../src/entries/draft.ts'
import type { Expense } from '../src/types.ts'

const time = new Date(2026, 8, 24, 12).getTime()
const draft: ExpenseDraft = { editingId: null, type: 'expense', title: 'カフェ A', amountYen: '500', category: 'その他',
  paymentMethodId: 'card', purchasedAtMillis: time, source: 'manual', splits: [] }
const expense = (id: string, overrides: Partial<Expense> = {}): Expense => ({
  id, type: 'expense', title: 'カフェ A', amountYen: 500, category: '食費', paymentMethodId: 'card',
  source: 'manual', purchasedAtMillis: time, updatedAt: 1, deleted: false, ...overrides,
})
const storage = () => {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

test('重複候補は同日・同額・同決済だけ。編集自身・削除済み・収入は除外', () => {
  const rows = [expense('same'), expense('self'), expense('other-method', { paymentMethodId: 'other' }),
    expense('income', { type: 'income' }), expense('deleted', { deleted: true }),
    expense('previous', { purchasedAtMillis: new Date(2026, 8, 23, 23, 59).getTime() }), expense('different-price', { amountYen: 501 })]
  assert.deepEqual(findDuplicateExpenses({ ...draft, editingId: 'self' }, rows).map((row) => row.id), ['same'])
  assert.equal(findDuplicateExpenses({ ...draft, amountYen: '' }, rows).length, 0)
  assert.equal(findDuplicateExpenses({ ...draft, purchasedAtMillis: NaN }, rows).length, 0)
  assert.equal(findDuplicateExpenses({ ...draft, type: 'income' }, rows).length, 1)
})

test('入力候補は同じタイトルの履歴から頻度順。削除された品目/方法は反映しない', () => {
  const categories = ['食費', '娯楽'].map((name) => ({ id: name, name, position: 0, updatedAt: 1, deleted: false }))
  const methods = [{ id: 'card', name: 'カード', type: 'credit' as const, closingDay: 31, paymentDay: 27, updatedAt: 1, deleted: false }]
  const rows = [expense('1', { title: ' カフェ　Ａ ' }), expense('2'), expense('3', { category: '娯楽' }),
    expense('missing-category', { category: '削除済' }), expense('missing-method', { paymentMethodId: 'gone' }),
    expense('deleted', { deleted: true }), expense('other-title', { title: 'カフェ B' })]
  const suggestions = merchantSuggestions(draft, rows, categories, methods)
  assert.deepEqual(suggestions.map((row) => [row.category, row.count]), [['食費', 2], ['娯楽', 1]])
  assert.equal(draft.category, 'その他') // suggestions never mutate input
  assert.equal(merchantSuggestions({ ...draft, editingId: '1' }, rows, categories, methods).length, 0)
})

test('下書きをアカウントと編集対象で分離し、変更済み明細の古い下書きは復元しない', () => {
  const store = storage()
  const key = draftStorageKey('user-a', null)
  assert.ok(writeDraft(store, key, draft, null))
  assert.deepEqual(readDraft(store, key, null, null), draft)
  assert.equal(readDraft(store, draftStorageKey('user-b', null), null, null), null)
  assert.notEqual(key, draftStorageKey('user-a', 'entry'))
  const editing = { ...draft, editingId: 'entry' }
  writeDraft(store, 'edit', editing, 10)
  assert.deepEqual(readDraft(store, 'edit', 'entry', 10), editing)
  assert.equal(readDraft(store, 'edit', 'entry', 11), null)
})

test('下書きの空入力・破損・不正フィールド・保存不可を安全に扱う', () => {
  const store = storage()
  store.setItem('bad', '{invalid')
  assert.equal(readDraft(store, 'bad', null, null), null)
  store.setItem('bad', JSON.stringify({ version: 1, baseUpdatedAt: null, draft: { ...draft, splits: [null] } }))
  assert.equal(readDraft(store, 'bad', null, null), null)
  writeDraft(store, 'new', draft, null)
  writeDraft(store, 'new', { ...draft, title: '', amountYen: '', splits: [] }, null)
  assert.equal(store.getItem('new'), null)
  assert.equal(writeDraft({ ...store, setItem() { throw new Error('quota') } }, 'new', draft, null), false)
})

test('ログアウト時は対象アカウントの下書きだけを削除する', () => {
  const store = {
    [draftStorageKey('user-a', null)]: 'new',
    [draftStorageKey('user-a', 'editing')]: 'edit',
    [draftStorageKey('user-ab', null)]: 'other-account',
    [draftStorageKey('offline', null)]: 'offline',
    unrelated: 'keep',
    removeItem(key: string) { delete this[key as keyof typeof this] },
  }
  clearDrafts(store as unknown as Storage, 'user-a')
  assert.equal(store[draftStorageKey('user-a', null)], undefined)
  assert.equal(store[draftStorageKey('user-a', 'editing')], undefined)
  assert.equal(store[draftStorageKey('user-ab', null)], 'other-account')
  assert.equal(store[draftStorageKey('offline', null)], 'offline')
  assert.equal(store.unrelated, 'keep')
})
