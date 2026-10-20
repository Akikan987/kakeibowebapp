import assert from 'node:assert/strict'
import test from 'node:test'
import { File } from 'node:buffer'

import { apiReadReceipt } from '../src/api.ts'
import { readReceiptItems } from '../src/receiptItems.ts'
import { calculateReceiptSplit, SELF_PARTICIPANT, type ReceiptSplitDraft } from '../src/receiptSplit.ts'
import { draftStorageKey, hasDraftContent, readDraft, writeDraft, type ExpenseDraft } from '../src/entries/draft.ts'

const receiptFile = () => new File(['synthetic image bytes'], 'receipt.png', { type: 'image/png' })

async function callReceipt(responseBody: Record<string, unknown>, args: { mode?: 'ai' | 'local'; includeItems?: boolean } = {}) {
  const originalFetch = globalThis.fetch
  let request: RequestInit | undefined
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    request = init
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  try {
    const result = await apiReadReceipt('synthetic-token', receiptFile(), args.mode, ['食費'], args.includeItems)
    return { result, request }
  } finally {
    globalThis.fetch = originalFetch
  }
}

const baseDraft = (receiptSplit?: ReceiptSplitDraft): ExpenseDraft => ({
  editingId: null,
  type: 'expense',
  title: '',
  amountYen: '',
  category: 'その他',
  purchasedAtMillis: 1_800_000_000_000,
  source: 'manual',
  paymentMethodId: '',
  splits: [],
  ...(receiptSplit ? { receiptSplit } : {}),
})

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

test('receipt item parser accepts nullable quantities and amounts and preserves signed line totals', () => {
  assert.deepEqual(readReceiptItems([
    { name: ' コーヒー ', quantity: 2, line_total_yen: 480 },
    { name: '値引き', quantity: null, line_total_yen: -30 },
    { name: '金額確認中', quantity: 1, line_total_yen: null },
  ]), [
    { name: 'コーヒー', quantity: 2, lineTotalYen: 480 },
    { name: '値引き', quantity: null, lineTotalYen: -30 },
    { name: '金額確認中', quantity: 1, lineTotalYen: null },
  ])
  const parsed = readReceiptItems([{ name: 'コーヒー', quantity: 4, line_total_yen: 480 }])
  assert.notEqual(parsed, null)
  const split = calculateReceiptSplit([{ id: 'coffee', name: parsed![0]!.name, quantity: parsed![0]!.quantity, amountYen: parsed![0]!.lineTotalYen, participantIds: [SELF_PARTICIPANT] }], [SELF_PARTICIPANT], 480, 'unallocated')
  assert.equal(split.valid, true)
  assert.equal(split.subtotalYen, 480) // quantity remains descriptive; line total is not multiplied
})

test('invalid or mixed receipt item lists fail as a whole', () => {
  assert.equal(readReceiptItems(null), null)
  assert.equal(readReceiptItems([{ name: 'valid', quantity: 1, line_total_yen: 10 }, { name: 'bad\nname', quantity: 1, line_total_yen: 5 }]), null)
  assert.equal(readReceiptItems([{ name: 'valid', quantity: 1, line_total_yen: 10 }, { name: 'bad', quantity: 0, line_total_yen: 5 }]), null)
  assert.equal(readReceiptItems([{ name: 'valid', quantity: 1, line_total_yen: 10 }, { name: 'bad', quantity: 1, line_total_yen: 2_000_000_001 }]), null)
  assert.equal(readReceiptItems(Array.from({ length: 101 }, (_, index) => ({ name: `row ${index}`, quantity: 1, line_total_yen: 1 }))), null)
})

test('legacy receipt responses remain empty-item results and upload defaults do not request AI items', async () => {
  const { result, request } = await callReceipt({ title: '店', amount_yen: 500 })
  assert.deepEqual(result.items, [])
  assert.deepEqual(result.warnings, [])
  assert.equal(request?.method, 'POST')
  const form = request?.body as FormData
  assert.equal(form.get('mode'), 'local')
  assert.equal(form.get('ai_consent'), 'false')
  assert.equal(form.get('include_items'), 'false')

  const malformed = await callReceipt({ items: [{ name: 'valid', quantity: 1, line_total_yen: 1 }, { name: 'bad', quantity: 1000, line_total_yen: 1 }] })
  assert.deepEqual(malformed.result.items, [])
  assert.ok(malformed.result.warnings.some((warning) => warning.includes('商品明細')))
})

test('AI item upload is explicit, and local OCR cannot opt into AI item processing', async () => {
  const response = { items: [{ name: 'おにぎり', quantity: 2, line_total_yen: 360 }] }
  const optedIn = await callReceipt(response, { mode: 'ai', includeItems: true })
  const aiForm = optedIn.request?.body as FormData
  assert.equal(aiForm.get('mode'), 'ai')
  assert.equal(aiForm.get('ai_consent'), 'true')
  assert.equal(aiForm.get('include_items'), 'true')
  assert.deepEqual(optedIn.result.items, [{ name: 'おにぎり', quantity: 2, lineTotalYen: 360 }])

  const local = await callReceipt(response, { mode: 'local', includeItems: true })
  const localForm = local.request?.body as FormData
  assert.equal(localForm.get('mode'), 'local')
  assert.equal(localForm.get('ai_consent'), 'false')
  assert.equal(localForm.get('include_items'), 'false')
})

test('account-scoped local draft restores pending receipt assignments, blank names, and nullable amounts', () => {
  const store = memoryStorage()
  const key = draftStorageKey('account-a', null)
  const receiptSplit: ReceiptSplitDraft = {
    version: 1,
    participantIds: [SELF_PARTICIPANT, 'member:current'],
    differenceMode: 'proportional',
    items: [
      { id: 'blank-name', name: '', quantity: null, amountYen: null, participantIds: [] },
      { id: 'pending', name: '旧メンバーの品', quantity: 2, amountYen: -20, participantIds: ['member:removed'] },
    ],
  }
  const draft = baseDraft(receiptSplit)
  assert.equal(hasDraftContent(draft), true)
  assert.equal(writeDraft(store, key, draft, null), true)

  const recovered = readDraft(store, key, null, null)
  assert.notEqual(recovered, null)
  assert.deepEqual(recovered?.receiptSplit, receiptSplit)
  assert.equal(readDraft(store, draftStorageKey('account-b', null), null, null), null)
})

test('invalid receipt scratchpad is discarded while ordinary account draft fields survive', () => {
  const store = memoryStorage()
  const key = draftStorageKey('account-a', null)
  const ordinary = baseDraft()
  const invalid = {
    version: 1,
    participantIds: [SELF_PARTICIPANT],
    differenceMode: 'unallocated',
    items: [{ id: 'broken', name: '壊れた商品', quantity: true, amountYen: 100, participantIds: [] }],
  }
  const full = { ...ordinary, title: '下書きは維持', receiptSplit: invalid }
  assert.equal(writeDraft(store, key, full as unknown as ExpenseDraft, null), true)
  const recovered = readDraft(store, key, null, null)
  assert.equal(recovered?.title, '下書きは維持')
  assert.equal(recovered?.receiptSplit, undefined)
})
