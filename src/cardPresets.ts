export interface CardPreset {
  id: string
  name: string
  issuer: string
  aliases: string[]
  closingDay: number
  paymentDay: number
  officialUrl: string
  verifiedAt: string
  note: string
}

/**
 * 公式サイトで締め日・引き落とし日を確認したカード候補。
 * 31は月末。候補は補助入力専用で、保存前にユーザーが変更できる。
 */
export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'jcb-card-w-nl',
    name: 'JCB カード W（NL）',
    issuer: 'ジェーシービー',
    aliases: [
      'JCB W',
      'JCBW',
      'JCB W NL',
      'JCBW NL',
      'JCB カード W',
      'JCB カード W ナンバーレス',
      'JCB W plus L',
      'JCB W plus L NL',
      'JCBW PLUSL',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.jcb.co.jp/promotion/tstosab/w.html',
    verifiedAt: '2026-08-29',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'saison-pearl-amex',
    name: 'セゾンパール・アメリカン・エキスプレス・カード',
    issuer: 'クレディセゾン',
    aliases: [
      'セゾンパール',
      'セゾンパールAMEX',
      'セゾンパールアメックス',
      'SAISON PEARL AMEX',
      'AMEX SAISON PEARL',
      'AMEX SEISON PEARL',
      'SEISON PEARL AMEX',
      'PEARL AMEX',
    ],
    closingDay: 10,
    paymentDay: 4,
    officialUrl: 'https://www.saisoncard.co.jp/amex/content-about/closingdate/',
    verifiedAt: '2026-08-29',
    note: 'ショッピングは毎月10日締め・翌月4日払い',
  },
  {
    id: 'ana-visa-student',
    name: 'ANAカード（学生用）VISA',
    issuer: '三井住友カード',
    aliases: [
      'ANA学生カード',
      'ANA学生カード VISA',
      'ANA 学生 VISA',
      'ANA VISA 学生',
      'ANA VISAカード 学生用',
      'ANAカード 学生用 VISA',
      'ANA CARD STUDENT VISA',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.smbc-card.com/nyukai/affiliate/ana/index.jsp',
    verifiedAt: '2026-08-29',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'olive-flexible-pay-nl',
    name: 'Oliveフレキシブルペイ（NL・クレジットモード）',
    issuer: '三井住友カード',
    aliases: [
      'OLIVE',
      'OLIVE NL',
      '三井住友 OLIVE',
      '三井住友 OLIVE NL',
      '三井住友OLIVE NL',
      'OLIVE フレキシブルペイ',
      'OLIVE クレジットモード',
    ],
    closingDay: 31,
    paymentDay: 26,
    officialUrl: 'https://www.smbc-card.com/olive_flexible_pay/card/payment_mode.jsp',
    verifiedAt: '2026-08-29',
    note: 'クレジットモードは月末締め・翌月26日払い',
  },
  {
    id: 'rakuten-card',
    name: '楽天カード',
    issuer: '楽天カード',
    aliases: [
      '楽天',
      'RAKUTEN CARD',
      '楽天PINKカード',
      '楽天ゴールドカード',
      '楽天プレミアムカード',
    ],
    closingDay: 31,
    paymentDay: 27,
    officialUrl: 'https://www.rakuten-card.co.jp/support/start_guide/',
    verifiedAt: '2026-08-30',
    note: '月末締め・翌月27日払い',
  },
  {
    id: 'paypay-card',
    name: 'PayPayカード',
    issuer: 'PayPayカード',
    aliases: ['PayPay', 'PAYPAY CARD', 'PayPayカード ゴールド', 'PAYPAY GOLD'],
    closingDay: 31,
    paymentDay: 27,
    officialUrl: 'https://www.paypay-card.co.jp/service/000173.html',
    verifiedAt: '2026-08-30',
    note: '月末締め・翌月27日払い',
  },
  {
    id: 'd-card',
    name: 'dカード',
    issuer: 'NTTドコモ・フィナンシャルグループ',
    aliases: [
      'DOCOMO d CARD',
      'dカード GOLD',
      'dカード GOLD U',
      'dカード PLATINUM',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://dcard.docomo.ne.jp/st/attention/shiharai/index.html',
    verifiedAt: '2026-08-30',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'aeon-card',
    name: 'イオンカード',
    issuer: 'イオンフィナンシャルサービス',
    aliases: [
      'AEON CARD',
      'イオンカード WAON一体型',
      'イオンカードセレクト',
    ],
    closingDay: 10,
    paymentDay: 2,
    officialUrl: 'https://www.aeon.co.jp/inquiry/seikyu_kakunin/',
    verifiedAt: '2026-08-30',
    note: '毎月10日締め・翌月2日払い',
  },
  {
    id: 'orico-card',
    name: 'オリコカード',
    issuer: 'オリエントコーポレーション',
    aliases: [
      'ORICO CARD',
      'オリコ',
      'オリコカード ザ ポイント',
      'Orico Card THE POINT',
    ],
    closingDay: 31,
    paymentDay: 27,
    officialUrl: 'https://www.orico.co.jp/creditcard/service/shopping/',
    verifiedAt: '2026-08-30',
    note: '月末締め・翌月27日払い',
  },
  {
    id: 'mufg-card',
    name: '三菱UFJカード',
    issuer: '三菱UFJニコス',
    aliases: [
      'MUFG CARD',
      'MUFGカード',
      '三菱UFJ',
      '三菱UFJカード VIASO',
      'VIASOカード',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl:
      'https://faq.cr.mufg.jp/mufgcard/detail?category=142&id=331&site=NIX1EXYK',
    verifiedAt: '2026-08-30',
    note: '通常のショッピングは毎月15日締め・翌月10日払い（ETCは別日程）',
  },
]

export const normalizeCardName = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/[\s・･/／()（）\[\]［］._\-ー]+/g, '')

const searchableNames = (preset: CardPreset) => [
  preset.name,
  preset.issuer,
  ...preset.aliases,
]

export function findCardPresets(query: string, limit = 10): CardPreset[] {
  const normalizedQuery = normalizeCardName(query)
  if (normalizedQuery.length < 2) return []

  return CARD_PRESETS.map((preset, position) => {
    const names = searchableNames(preset).map(normalizeCardName)
    const exact = names.some((name) => name === normalizedQuery)
    const startsWith = names.some(
      (name) =>
        name.startsWith(normalizedQuery) || normalizedQuery.startsWith(name),
    )
    const contains = names.some(
      (name) => name.includes(normalizedQuery) || normalizedQuery.includes(name),
    )
    return {
      preset,
      position,
      score: exact ? 3 : startsWith ? 2 : contains ? 1 : 0,
    }
  })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map((result) => result.preset)
}
