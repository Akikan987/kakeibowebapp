import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateReceiptSplit,
  readReceiptSplitDraft,
  splitReceiptItem,
  type ReceiptSplitItem,
} from '../src/receiptSplit.ts'

const people = ['self', 'member:a', 'member:b']

function item(id: string, amountYen: number | null, participantIds = ['self']): ReceiptSplitItem {
  return { id, name: `品目 ${id}`, quantity: 1, amountYen, participantIds }
}

test('shared item rows split evenly and put integer remainder in participant order', () => {
  const result = calculateReceiptSplit([item('x', 10, ['member:b', 'self', 'member:a'])], people, 10, 'unallocated')
  assert.equal(result.valid, true)
  assert.deepEqual(result.allocations.map(({ participantId, amountYen }) => [participantId, amountYen]), [
    ['self', 4], ['member:a', 3], ['member:b', 3],
  ])
})

test('unequal assignment and unallocated difference report exact per-person amounts', () => {
  const result = calculateReceiptSplit([item('a', 120, ['self']), item('b', 80, ['member:a'])], people, 200, 'unallocated')
  assert.equal(result.valid, true)
  assert.deepEqual(result.allocations.map((row) => row.amountYen), [120, 80, 0])
  assert.deepEqual(result.allocations.map((row) => row.adjustmentYen), [0, 0, 0])
})

test('unallocated mode rejects tax or discount difference until explicit proportional mode is selected', () => {
  const rows = [item('main', 101, ['self', 'member:a'])]
  const rejected = calculateReceiptSplit(rows, people, 103, 'unallocated')
  assert.equal(rejected.valid, false)
  assert.equal(rejected.differenceYen, 2)
  const reconciled = calculateReceiptSplit(rows, people, 103, 'proportional')
  assert.equal(reconciled.valid, true)
  assert.deepEqual(reconciled.allocations.map((row) => [row.itemsAmountYen, row.adjustmentYen, row.amountYen]), [
    [51, 1, 52], [50, 1, 51], [0, 0, 0],
  ])

  const discount = calculateReceiptSplit([item('main', 100), item('discount', -7)], ['self'], 93, 'unallocated')
  assert.equal(discount.valid, true)
  assert.equal(discount.allocations[0]?.amountYen, 93)
})

test('proportional arithmetic uses exact integers for products above double precision', () => {
  const result = calculateReceiptSplit([item('large', 2_000_000_000, ['self', 'member:a'])], ['self', 'member:a'], 1_999_999_999, 'proportional')
  assert.equal(result.valid, true)
  assert.deepEqual(result.allocations.map((row) => row.amountYen), [1_000_000_000, 999_999_999])
  assert.equal(result.allocations.reduce((sum, row) => sum + row.amountYen, 0), 1_999_999_999)
})

test('quantity is descriptive and does not multiply the line total', () => {
  const result = calculateReceiptSplit([{ ...item('pack', 100), quantity: 4 }], ['self'], 100, 'unallocated')
  assert.equal(result.valid, true)
  assert.equal(result.subtotalYen, 100)
  assert.equal(result.allocations[0]?.amountYen, 100)
})

test('unassigned, unknown, duplicate, and invalid assignment identifiers are rejected', () => {
  const unassigned = calculateReceiptSplit([item('x', 4, [])], ['self'], 4, 'unallocated')
  assert.equal(unassigned.valid, false)
  assert.equal(unassigned.unassignedCount, 1)
  assert.equal(unassigned.allocations[0]?.amountYen, 0)

  for (const assignment of [['member:missing'], ['self', 'self'], ['bad\nparticipant']]) {
    assert.equal(calculateReceiptSplit([item('x', 4, assignment)], ['self'], 4, 'unallocated').valid, false)
  }
  assert.equal(calculateReceiptSplit([item('x', 4)], ['self', 'self'], 4, 'unallocated').valid, false)
  assert.equal(calculateReceiptSplit([item('x', 4), item('x', 1)], ['self'], 5, 'unallocated').valid, false)
})

test('rejects unsafe, fractional, boolean, NaN, and out-of-range monetary inputs', () => {
  const invalidAmounts = [Number.NaN, Number.MAX_SAFE_INTEGER + 1, 1.25, true, -2_000_000_001, 2_000_000_001]
  for (const amount of invalidAmounts) {
    const row = { ...item('x', 1), amountYen: amount } as unknown as ReceiptSplitItem
    assert.equal(calculateReceiptSplit([row], ['self'], 1, 'unallocated').valid, false)
  }
  for (const total of [Number.NaN, Number.MAX_SAFE_INTEGER + 1, 1.5, -1, 2_000_000_001, true]) {
    assert.equal(calculateReceiptSplit([item('x', 1)], ['self'], total as number, 'unallocated').valid, false)
  }
  assert.equal(calculateReceiptSplit([item('x', null)], ['self'], 0, 'unallocated').valid, false)
})

test('negative per-person net share and zero-base nonzero reconciliation are invalid', () => {
  const negative = calculateReceiptSplit([item('discount', -3)], ['self'], 0, 'unallocated')
  assert.equal(negative.valid, false)
  assert.equal(negative.allocations[0]?.amountYen, -3)

  const noBase = calculateReceiptSplit([], ['self', 'member:a'], 12, 'proportional')
  assert.equal(noBase.valid, false)
  assert.equal(noBase.allocations.reduce((sum, row) => sum + row.amountYen, 0), 0)

  const emptyZero = calculateReceiptSplit([], ['self'], 0, 'unallocated')
  assert.equal(emptyZero.valid, false)
})

test('split units preserve positive and negative totals with stable remainders and no mutation', () => {
  const original = item('share', -10, ['self', 'member:a'])
  original.quantity = 3
  const units = splitReceiptItem(original)
  assert.deepEqual(units.map((row) => row.amountYen), [-4, -3, -3])
  assert.deepEqual(units.map((row) => row.quantity), [1, 1, 1])
  assert.deepEqual(units.map((row) => row.id), ['share:unit:1', 'share:unit:2', 'share:unit:3'])
  assert.equal(units.reduce((sum, row) => sum + (row.amountYen ?? 0), 0), -10)
  assert.equal(original.quantity, 3)
  units[0]!.participantIds.push('member:b')
  assert.deepEqual(original.participantIds, ['self', 'member:a'])
  assert.deepEqual(splitReceiptItem({ ...item('positive', 10), quantity: 3 }).map((row) => row.amountYen), [4, 3, 3])
  assert.throws(() => splitReceiptItem({ ...item('bad', null), quantity: 2 }), Error)
  assert.throws(() => splitReceiptItem({ ...item('bad', 10), quantity: 1 }), Error)
})

test('draft reader accepts incomplete editable assignments but rejects malformed or unbounded data', () => {
  const draft = {
    version: 1,
    items: [item('resume', null, []), { ...item('unknown', 5, ['member:gone']), quantity: null }],
    participantIds: ['self'],
    differenceMode: 'proportional',
  }
  const parsed = readReceiptSplitDraft(draft)
  assert.notEqual(parsed, null)
  assert.deepEqual(parsed?.items[0]?.participantIds, [])
  assert.deepEqual(parsed?.items[1]?.participantIds, ['member:gone'])
  assert.equal(readReceiptSplitDraft({ ...draft, items: Array.from({ length: 101 }, (_, i) => item(`${i}`, 1)) }), null)
  assert.equal(readReceiptSplitDraft({ ...draft, participantIds: ['self', 'self'] }), null)
  assert.equal(readReceiptSplitDraft({ ...draft, participantIds: ['member:a'] }), null)
  assert.equal(readReceiptSplitDraft({ ...draft, items: [{ ...item('bad', 1), amountYen: Number.NaN }] }), null)
  assert.equal(readReceiptSplitDraft({ ...draft, items: [{ ...item('bad', 1), quantity: true }] }), null)
  assert.equal(readReceiptSplitDraft({ ...draft, differenceMode: 'automatic' }), null)
  const blankName = readReceiptSplitDraft({ ...draft, items: [{ ...item('blank', 5), name: '' }] })
  assert.equal(blankName?.items[0]?.name, '')
})

test('proportional mode never divides by zero or prorates malformed assignments', () => {
  const cases: ReceiptSplitItem[][] = [
    [item('unassigned', 100, [])],
    [item('unknown', 100, ['member:missing'])],
    [item('negative-a', 150, ['self']), item('negative-b', -50, ['member:a'])],
    [item('cancel-a', 100, ['self']), item('cancel-b', -100, ['member:a'])],
  ]
  for (const rows of cases) {
    assert.doesNotThrow(() => {
      const result = calculateReceiptSplit(rows, ['self', 'member:a'], 120, 'proportional')
      assert.equal(result.valid, false)
    })
  }
  const duplicatePeople = calculateReceiptSplit([item('duplicate', 100, ['self'])], ['self', 'self'], 120, 'proportional')
  assert.equal(duplicatePeople.valid, false)
  assert.deepEqual(duplicatePeople.allocations.map((row) => row.amountYen), [100, 100])
})

test('randomized valid proportional splits conserve the requested total without mutating inputs', () => {
  let seed = 0x51f15e
  const next = (max: number) => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    return seed % max
  }

  for (let run = 0; run < 250; run += 1) {
    const participantIds = ['self', 'member:a', 'member:b', 'member:c'].slice(0, 1 + next(4))
    const items = Array.from({ length: 1 + next(12) }, (_, index) => {
      const assignees = participantIds.filter(() => next(2) === 1)
      if (assignees.length === 0) assignees.push(participantIds[next(participantIds.length)]!)
      return item(`run-${run}-${index}`, 1 + next(1_000_000), assignees)
    })
    const totalAmountYen = next(2_000_000_001)
    const inputSnapshot = structuredClone(items)
    const result = calculateReceiptSplit(items, participantIds, totalAmountYen, 'proportional')

    assert.equal(result.valid, true)
    assert.equal(result.allocations.reduce((sum, row) => sum + row.amountYen, 0), totalAmountYen)
    assert.ok(result.allocations.every((row) => Number.isInteger(row.amountYen) && row.amountYen >= 0 && row.amountYen <= totalAmountYen))
    assert.deepEqual(items, inputSnapshot)
  }
})
