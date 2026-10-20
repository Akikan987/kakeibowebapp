export const SELF_PARTICIPANT = 'self' as const

export type ReceiptSplitItem = {
  id: string
  name: string
  quantity: number | null
  amountYen: number | null
  participantIds: string[]
}

export type ReceiptSplitDraft = {
  version: 1
  items: ReceiptSplitItem[]
  participantIds: string[]
  differenceMode: 'unallocated' | 'proportional'
}

export type ReceiptSplitDifferenceMode = ReceiptSplitDraft['differenceMode']

export type ReceiptSplitAllocation = {
  participantId: string
  itemsAmountYen: number
  adjustmentYen: number
  amountYen: number
}

export type ReceiptSplitResult = {
  valid: boolean
  issues: string[]
  subtotalYen: number
  differenceYen: number
  unassignedCount: number
  allocations: ReceiptSplitAllocation[]
}

const MAX_ROWS = 100
const MAX_PARTICIPANTS = 100
const MAX_YEN = 2_000_000_000
const MAX_ID_LENGTH = 180
const MAX_ISSUES = 24

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_ID_LENGTH
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
}

function isParticipantId(value: unknown): value is string {
  return isSafeId(value)
    && (value === SELF_PARTICIPANT || (value.startsWith('member:') && value.length > 'member:'.length))
}

function isYen(value: unknown, allowNegative: boolean): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && (allowNegative ? Math.abs(value) <= MAX_YEN : value >= 0 && value <= MAX_YEN)
}

function addIssue(issues: string[], message: string): void {
  if (issues.length < MAX_ISSUES) issues.push(message)
}

function uniqueStrings(values: unknown[]): boolean {
  return new Set(values).size === values.length
}

function signedShares(amount: number, ids: string[], participantOrder: Map<string, number>): Map<string, bigint> {
  const ordered = [...ids].sort((a, b) => (participantOrder.get(a) ?? 0) - (participantOrder.get(b) ?? 0))
  const magnitude = BigInt(Math.abs(amount))
  const divisor = BigInt(ordered.length)
  const quotient = magnitude / divisor
  const remainder = Number(magnitude % divisor)
  const sign = amount < 0 ? -1n : 1n
  return new Map(ordered.map((id, index) => [id, sign * (quotient + (index < remainder ? 1n : 0n))]))
}

function proportionalAmounts(total: bigint, weights: bigint[], weightSum: bigint): bigint[] {
  const shares = weights.map((weight, index) => {
    const numerator = total * weight
    return { index, amount: numerator / weightSum, remainder: numerator % weightSum }
  })
  let remainder = total - shares.reduce((sum, share) => sum + share.amount, 0n)
  const byRemainder = [...shares].sort((a, b) => a.remainder === b.remainder
    ? a.index - b.index
    : a.remainder > b.remainder ? -1 : 1)
  for (const share of byRemainder) {
    if (remainder <= 0n) break
    shares[share.index]!.amount += 1n
    remainder -= 1n
  }
  return shares.map((share) => share.amount)
}

/** Calculate receipt item shares and optionally reconcile a receipt total. */
export function calculateReceiptSplit(
  items: ReceiptSplitItem[],
  participantIds: string[],
  totalAmountYen: number,
  differenceMode: ReceiptSplitDifferenceMode,
): ReceiptSplitResult {
  const issues: string[] = []
  const add = (message: string) => addIssue(issues, message)

  const rowsAreArray = Array.isArray(items)
  const peopleAreArray = Array.isArray(participantIds)
  if (!rowsAreArray) add('品目一覧の形式が正しくありません。')
  if (!peopleAreArray) add('参加者一覧の形式が正しくありません。')
  const rows = rowsAreArray ? items : []
  const people = peopleAreArray ? participantIds.slice(0, MAX_PARTICIPANTS) : []

  if (rows.length > MAX_ROWS) add(`品目は${MAX_ROWS}件以内にしてください。`)
  if (rows.length === 0) add('品目を1件以上入力してください。')
  if (people.length === 0 || (peopleAreArray && participantIds.length > MAX_PARTICIPANTS)) add(`参加者は1〜${MAX_PARTICIPANTS}人にしてください。`)
  if (!people.every(isParticipantId)) add('参加者IDが正しくありません。')
  if (!uniqueStrings(people)) add('参加者IDが重複しています。')
  if (!isYen(totalAmountYen, false)) add('レシート合計は0〜2,000,000,000円の整数で入力してください。')
  if (differenceMode !== 'unallocated' && differenceMode !== 'proportional') add('差額の配分方法が正しくありません。')

  const usablePeople = people.filter(isParticipantId)
  const peopleSet = new Set(usablePeople)
  const participantOrder = new Map(usablePeople.map((id, index) => [id, index]))
  const itemIds = new Set<string>()
  const personItems = new Map(usablePeople.map((id) => [id, 0n]))
  let subtotal = 0n
  let unassignedCount = 0

  if (rows.length <= MAX_ROWS) {
    rows.forEach((item, index) => {
      const label = `品目${index + 1}`
      if (!isRecord(item)) {
        add(`${label}の形式が正しくありません。`)
        return
      }
      if (!isSafeId(item.id)) add(`${label}のIDが正しくありません。`)
      else if (itemIds.has(item.id)) add(`${label}のIDが重複しています。`)
      else itemIds.add(item.id)
      if (typeof item.name !== 'string' || item.name.trim().length === 0 || item.name.length > 160) add(`${label}の名前は1〜160文字で入力してください。`)
      if (item.quantity !== null && (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999)) add(`${label}の数量は1〜999の整数か未入力にしてください。`)
      if (!isYen(item.amountYen, true)) {
        add(`${label}の金額は-2,000,000,000〜2,000,000,000円の整数で入力してください。`)
      } else {
        subtotal += BigInt(item.amountYen)
      }

      if (!Array.isArray(item.participantIds)) {
        add(`${label}の担当者一覧の形式が正しくありません。`)
        unassignedCount += 1
        return
      }
      if (item.participantIds.length > MAX_PARTICIPANTS) {
        add(`${label}の担当者は${MAX_PARTICIPANTS}人以内にしてください。`)
        return
      }
      if (item.participantIds.length === 0) {
        unassignedCount += 1
        add(`${label}の担当者を選択してください。`)
        return
      }
      if (!uniqueStrings(item.participantIds)) add(`${label}の担当者が重複しています。`)
      if (!item.participantIds.every(isParticipantId)) add(`${label}の担当者IDが正しくありません。`)
      if (item.participantIds.some((id) => !peopleSet.has(id))) add(`${label}に参加者一覧にない担当者がいます。`)
      if (!isYen(item.amountYen, true) || item.participantIds.some((id) => !peopleSet.has(id)) || !item.participantIds.every(isParticipantId) || !uniqueStrings(item.participantIds)) return
      for (const [id, amount] of signedShares(item.amountYen, item.participantIds, participantOrder)) {
        personItems.set(id, (personItems.get(id) ?? 0n) + amount)
      }
    })
  }

  const safeSubtotal = Number(subtotal)
  const difference = isYen(totalAmountYen, false) ? BigInt(totalAmountYen) - subtotal : 0n
  if (subtotal > BigInt(Number.MAX_SAFE_INTEGER) || subtotal < BigInt(Number.MIN_SAFE_INTEGER)) add('品目金額の合計が安全に計算できる範囲を超えています。')
  if (differenceMode === 'unallocated' && difference !== 0n) add('品目金額とレシート合計に差額があります。')
  if (differenceMode === 'proportional' && difference !== 0n && subtotal <= 0n) add('差額を比例配分するには品目合計が0円より大きい必要があります。')
  if (usablePeople.some((id) => (personItems.get(id) ?? 0n) < 0n)) add('割り当て後の負担額は0円以上にしてください。')

  const itemAmounts = usablePeople.map((id) => personItems.get(id) ?? 0n)
  const weightSum = itemAmounts.reduce((sum, amount) => sum + amount, 0n)
  const shouldReconcile = issues.length === 0
    && differenceMode === 'proportional'
    && isYen(totalAmountYen, false)
    && subtotal > 0n
    && weightSum > 0n
    && itemAmounts.every((amount) => amount >= 0n)
  const finalAmounts = shouldReconcile
    ? proportionalAmounts(BigInt(totalAmountYen), itemAmounts, weightSum)
    : itemAmounts
  const allocations = usablePeople.map((participantId, index) => {
    const itemsAmountYen = itemAmounts[index] ?? 0n
    const amountYen = finalAmounts[index] ?? itemsAmountYen
    return {
      participantId,
      itemsAmountYen: Number(itemsAmountYen),
      adjustmentYen: Number(amountYen - itemsAmountYen),
      amountYen: Number(amountYen),
    }
  })

  if (differenceMode === 'proportional' && subtotal <= 0n && isYen(totalAmountYen, false) && totalAmountYen !== 0) add('差額を比例配分するには品目合計が0円より大きい必要があります。')
  if (allocations.some(({ amountYen }) => !Number.isSafeInteger(amountYen) || amountYen < 0 || amountYen > MAX_YEN)) add('配分後の負担額が許容範囲を超えています。')

  if (isYen(totalAmountYen, false) && allocations.length > 0 && issues.length === 0) {
    const allocationTotal = allocations.reduce((sum, row) => sum + BigInt(row.amountYen), 0n)
    if (allocationTotal !== BigInt(totalAmountYen)) add('配分額の合計がレシート合計と一致しません。')
  }

  return {
    valid: issues.length === 0,
    issues,
    subtotalYen: safeSubtotal,
    differenceYen: Number(difference),
    unassignedCount,
    allocations,
  }
}

/** Split a known quantity into unit rows, preserving the exact signed total. */
export function splitReceiptItem(item: ReceiptSplitItem): ReceiptSplitItem[] {
  if (!isRecord(item) || !isSafeId(item.id)) throw new Error('品目IDが正しくありません。')
  if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 2 || item.quantity > 20) throw new Error('分割する数量は2〜20の整数で入力してください。')
  if (!isYen(item.amountYen, true)) throw new Error('分割するには有効な整数の品目金額が必要です。')
  if (!Array.isArray(item.participantIds) || item.participantIds.length > MAX_PARTICIPANTS || !item.participantIds.every(isParticipantId)) throw new Error('担当者一覧が正しくありません。')
  const quantity = item.quantity
  const magnitude = Math.abs(item.amountYen)
  const quotient = Math.floor(magnitude / quantity)
  const remainder = magnitude % quantity
  const sign = item.amountYen < 0 ? -1 : 1
  return Array.from({ length: quantity }, (_, index) => ({
    ...item,
    id: `${item.id}:unit:${index + 1}`,
    quantity: 1,
    amountYen: sign * (quotient + (index < remainder ? 1 : 0)),
    participantIds: [...item.participantIds],
  }))
}

/** Read a bounded local draft while preserving valid but incomplete assignments. */
export function readReceiptSplitDraft(value: unknown): ReceiptSplitDraft | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items) || value.items.length > MAX_ROWS
    || !Array.isArray(value.participantIds) || value.participantIds.length === 0 || value.participantIds.length > MAX_PARTICIPANTS
    || !value.participantIds.every(isParticipantId) || !uniqueStrings(value.participantIds)
    || !value.participantIds.includes(SELF_PARTICIPANT)
    || (value.differenceMode !== 'unallocated' && value.differenceMode !== 'proportional')) return null

  const seenIds = new Set<string>()
  const items: ReceiptSplitItem[] = []
  for (const candidate of value.items) {
    if (!isRecord(candidate) || !isSafeId(candidate.id) || seenIds.has(candidate.id)
      || typeof candidate.name !== 'string' || candidate.name.length > 160 || /[\u0000-\u001f\u007f-\u009f]/u.test(candidate.name)
      || (candidate.quantity !== null && (typeof candidate.quantity !== 'number' || !Number.isInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > 999))
      || (candidate.amountYen !== null && !isYen(candidate.amountYen, true))
      || !Array.isArray(candidate.participantIds) || candidate.participantIds.length > MAX_PARTICIPANTS
      || !candidate.participantIds.every(isParticipantId)) return null
    seenIds.add(candidate.id)
    items.push({
      id: candidate.id,
      name: candidate.name,
      quantity: candidate.quantity,
      amountYen: candidate.amountYen,
      participantIds: [...candidate.participantIds],
    })
  }
  return {
    version: 1,
    items,
    participantIds: [...value.participantIds],
    differenceMode: value.differenceMode,
  }
}
