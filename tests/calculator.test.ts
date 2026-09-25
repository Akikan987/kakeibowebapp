import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateYen } from '../src/domain/calculator.ts'

test('電卓は演算順序、括弧、符号、小数を正確に扱う', () => {
  assert.equal(calculateYen('1200 + 350 × 2').amount, '1900')
  assert.equal(calculateYen('(1200 + 350) ÷ 2').amount, '775')
  assert.equal(calculateYen('(0.1 + 0.2) * 10').amount, '3')
  assert.equal(calculateYen('10000 * 1.1').amount, '11000')
  assert.equal(calculateYen('-100 + 50').amount, '-50')
  assert.equal(calculateYen('2 * -3').amount, '-6')
  assert.equal(calculateYen('.5 * 2').exact, true)
})

test('円未満の端数処理は最後に行い、割り勘の端数を隠さない', () => {
  assert.equal(calculateYen('1000/3').exact, false)
  assert.equal(calculateYen('1000/3', 'floor').amount, '333')
  assert.equal(calculateYen('1000/3', 'ceil').amount, '334')
  assert.equal(calculateYen('1001/2').amount, '501')
  assert.equal(calculateYen('1000/3*3').amount, '1000')
  assert.equal(calculateYen('-1/2', 'floor').amount, '-1')
  assert.equal(calculateYen('-1/2', 'nearest').amount, '0')
})

test('ゼロ除算・不完全な式・JavaScript・過大金額を拒否する', () => {
  for (const expression of ['', '1/0', '0/0', '2+', '(1+2', '1..2', '1(2)', '2**3', 'alert(1)', '1e3', '2000000001', '9'.repeat(161)]) assert.throws(() => calculateYen(expression))
  assert.equal(calculateYen('2000000000').amount, '2000000000')
})
