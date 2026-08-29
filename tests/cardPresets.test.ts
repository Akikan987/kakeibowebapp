import assert from 'node:assert/strict'
import test from 'node:test'

import { findCardPresets, normalizeCardName } from '../src/cardPresets.ts'

const first = (query: string) => findCardPresets(query)[0]

test('空白・大文字小文字・記号を無視してカード名を照合する', () => {
  assert.equal(normalizeCardName(' 三井住友 Olive（NL） '), '三井住友olivenl')
})

test('指定4カードの表記ゆれから公式プリセットを見つける', () => {
  assert.deepEqual(
    [
      first('JCBW NL'),
      first('AMEX SEISON PEARL'),
      first('ANA学生カード（VISA）'),
      first('三井住友OLIVE NL'),
    ].map((preset) => [preset?.id, preset?.closingDay, preset?.paymentDay]),
    [
      ['jcb-card-w-nl', 15, 10],
      ['saison-pearl-amex', 10, 4],
      ['ana-visa-student', 15, 10],
      ['olive-flexible-pay-nl', 31, 26],
    ],
  )
})

test('短すぎる入力や未登録カードには候補を返さない', () => {
  assert.deepEqual(findCardPresets('J'), [])
  assert.deepEqual(findCardPresets('未登録カード'), [])
})
