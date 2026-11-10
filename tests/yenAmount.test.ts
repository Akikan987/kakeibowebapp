import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_ENTRY_YEN, normalizeYenInput, parseYenAmount } from '../src/entries/amount.ts'

test('a signed amount cannot be silently converted into spending', () => {
  for (const input of ['-500', '－５００', '−500', 'ー500', '500-']) {
    assert.equal(parseYenAmount(normalizeYenInput(input)).error, 'negative')
  }
})

test('entry amounts must be positive whole yen within the existing limit', () => {
  for (const input of ['', ' ', '　']) assert.equal(parseYenAmount(input).error, 'empty')
  for (const input of ['0', '００']) assert.equal(parseYenAmount(input).error, 'zero')
  for (const input of ['1.5', '1e3', '1,20']) assert.equal(parseYenAmount(input).error, 'format')
  assert.equal(parseYenAmount('１，２３４').amount, 1234)
  assert.equal(parseYenAmount('1').amount, 1)
  assert.equal(parseYenAmount(String(MAX_ENTRY_YEN), MAX_ENTRY_YEN).amount, MAX_ENTRY_YEN)
  assert.equal(parseYenAmount(String(MAX_ENTRY_YEN + 1), MAX_ENTRY_YEN).error, 'limit')
  assert.equal(parseYenAmount('9007199254740993').error, 'limit')
})
