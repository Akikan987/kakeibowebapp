import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CARD_PRESETS,
  findCardPresets,
  normalizeCardName,
} from '../src/cardPresets.ts'

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

test('追加した主要カードの表記ゆれから公式プリセットを見つける', () => {
  assert.deepEqual(
    [
      first('楽天PINKカード'),
      first('PAYPAY GOLD'),
      first('dカード GOLD'),
      first('イオンカードセレクト'),
      first('Orico Card THE POINT'),
      first('VIASOカード'),
    ].map((preset) => [preset?.id, preset?.closingDay, preset?.paymentDay]),
    [
      ['rakuten-card', 31, 27],
      ['paypay-card', 31, 27],
      ['d-card', 15, 10],
      ['aeon-card', 10, 2],
      ['orico-card', 31, 27],
      ['mufg-card', 15, 10],
    ],
  )
})

test('追加10カードの表記ゆれから公式プリセットを見つける', () => {
  assert.deepEqual(
    [
      first('Amazonプライムマスターカード'),
      first('DINERS CLUB'),
      first('ユーシーカード'),
      first('JACCS CARD'),
      first('セディナカード Jiyu!da!'),
      first('ユーシーエスカード'),
      first('7カードプラス'),
      first('セゾンカードデジタル'),
      findCardPresets('エポスカード').find(({ id }) => id === 'epos-card-27'),
      findCardPresets('エポスカード').find(({ id }) => id === 'epos-card-4'),
    ].map((preset) => [preset?.id, preset?.closingDay, preset?.paymentDay]),
    [
      ['amazon-mastercard', 31, 26],
      ['diners-club-card', 15, 10],
      ['uc-card', 10, 5],
      ['jaccs-card', 31, 27],
      ['cedyna-card', 31, 27],
      ['ucs-card', 15, 10],
      ['seven-card-plus', 15, 10],
      ['saison-card-digital', 10, 4],
      ['epos-card-27', 27, 27],
      ['epos-card-4', 4, 4],
    ],
  )
})

test('指定された追加4カードの表記ゆれからプリセットを見つける', () => {
  assert.deepEqual(
    [
      first('JCB ORIGINAL W'),
      first('青学カード'),
      first('Orico Pay Balance'),
      first('デビュープラス'),
    ].map((preset) => [preset?.id, preset?.closingDay, preset?.paymentDay]),
    [
      ['jcb-original-w', 15, 10],
      ['aoyama-gakuin-card', 15, 10],
      ['orico-pay-balance', 31, 27],
      ['smbc-debut-plus', 15, 10],
    ],
  )
})

test('既存カードは24件あり、IDが重複しない', () => {
  assert.equal(CARD_PRESETS.length, 24)
  assert.equal(new Set(CARD_PRESETS.map(({ id }) => id)).size, 24)
  assert.ok(CARD_PRESETS.every(({ officialUrl }) => officialUrl.startsWith('https://')))
})

test('短すぎる入力や未登録カードには候補を返さない', () => {
  assert.deepEqual(findCardPresets('J'), [])
  assert.deepEqual(findCardPresets('未登録カード'), [])
})
