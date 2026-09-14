import assert from 'node:assert/strict'
import test from 'node:test'

import { equalSplitAmounts } from '../src/splits.ts'

test('本人を含む人数で他の人の負担額を均等入力する', () => {
  assert.deepEqual(equalSplitAmounts(1200, 2), [400, 400])
})

test('割り切れない端数は本人の負担に残す', () => {
  const otherAmounts = equalSplitAmounts(1000, 2)
  assert.deepEqual(otherAmounts, [333, 333])
  assert.equal(1000 - otherAmounts.reduce((sum, amount) => sum + amount, 0), 334)
})

test('金額または追加人数が不正な場合は自動入力しない', () => {
  assert.deepEqual(equalSplitAmounts(0, 2), [])
  assert.deepEqual(equalSplitAmounts(1000, 0), [])
  assert.deepEqual(equalSplitAmounts(1, 2), [])
})
