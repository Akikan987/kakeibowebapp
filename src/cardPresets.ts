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
  {
    id: 'amazon-mastercard',
    name: 'Amazon Mastercard',
    issuer: '三井住友カード',
    aliases: [
      'AMAZON CARD',
      'Amazonカード',
      'Amazon Prime Mastercard',
      'Amazonプライムマスターカード',
    ],
    closingDay: 31,
    paymentDay: 26,
    officialUrl: 'https://www.smbc-card.com/nyukai/affiliate/amazon/index.jsp',
    verifiedAt: '2026-08-30',
    note: '月末締め・翌月26日払い',
  },
  {
    id: 'diners-club-card',
    name: 'ダイナースクラブカード',
    issuer: '三井住友トラストクラブ',
    aliases: [
      'DINERS CLUB',
      'DINERS CLUB CARD',
      'ダイナース',
      'ダイナースクラブ',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.diners.co.jp/ja/payment.html',
    verifiedAt: '2026-08-30',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'uc-card',
    name: 'UCカード',
    issuer: 'クレディセゾン',
    aliases: ['UC CARD', 'ユーシーカード', 'UCカード ゴールド', 'UCゴールドカード'],
    closingDay: 10,
    paymentDay: 5,
    officialUrl: 'https://www2.uccard.co.jp/uc/services/oshiharai/',
    verifiedAt: '2026-08-30',
    note: '毎月10日締め・翌月5日払い',
  },
  {
    id: 'jaccs-card',
    name: 'ジャックスカード',
    issuer: 'ジャックス',
    aliases: [
      'JACCS',
      'JACCS CARD',
      'ジャックス',
      'ジャックスカードプラチナ',
      'ジャックスカードゴールド',
    ],
    closingDay: 31,
    paymentDay: 27,
    officialUrl: 'https://www.jaccs.co.jp/service/cardservice/oshiharai/',
    verifiedAt: '2026-08-30',
    note: '月末締め・翌月27日払い',
  },
  {
    id: 'cedyna-card',
    name: 'セディナカード',
    issuer: '三井住友カード',
    aliases: [
      'CEDYNA',
      'CEDYNA CARD',
      'セディナ',
      'セディナカード Jiyu!da!',
      'セディナカードJiyuda',
    ],
    closingDay: 31,
    paymentDay: 27,
    officialUrl: 'https://www.smbc-card.com/memfs/oshiharai/index.jsp',
    verifiedAt: '2026-08-30',
    note: '月末締め・翌月27日払い',
  },
  {
    id: 'ucs-card',
    name: 'UCSカード',
    issuer: 'UCS',
    aliases: ['UCS CARD', 'ユーシーエスカード', 'UCSゴールドカード'],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.ucscard.co.jp/faq_guide/guide-card/payday/',
    verifiedAt: '2026-08-30',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'seven-card-plus',
    name: 'セブンカード・プラス',
    issuer: 'セブン・カードサービス',
    aliases: [
      '7カードプラス',
      'SEVEN CARD PLUS',
      'セブンカードプラス',
      'セブンカード プラス',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.7card.co.jp/7card/service/payment/',
    verifiedAt: '2026-08-30',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'saison-card-digital',
    name: 'SAISON CARD Digital',
    issuer: 'クレディセゾン',
    aliases: [
      'SAISON DIGITAL',
      'セゾンカードデジタル',
      'セゾンデジタル',
      'SAISON CARD DIGITAL NL',
    ],
    closingDay: 10,
    paymentDay: 4,
    officialUrl:
      'https://www.saisoncard.co.jp/amextop/cp-af-cat/international_v1.html',
    verifiedAt: '2026-08-30',
    note: '毎月10日締め・翌月4日払い',
  },
  {
    id: 'epos-card-27',
    name: 'エポスカード（27日払い）',
    issuer: 'エポスカード',
    aliases: [
      'EPOS CARD',
      'エポスカード',
      'エポスゴールドカード',
      'エポスプラチナカード',
      'エポス 27日払い',
    ],
    closingDay: 27,
    paymentDay: 27,
    officialUrl:
      'https://faq.eposcard.co.jp/faq/show/202?category_id=44&site_domain=default',
    verifiedAt: '2026-08-30',
    note: '毎月27日締め・翌月27日払い（27日払いを選択した契約）',
  },
  {
    id: 'epos-card-4',
    name: 'エポスカード（4日払い）',
    issuer: 'エポスカード',
    aliases: [
      'EPOS CARD',
      'エポスカード',
      'エポスゴールドカード',
      'エポスプラチナカード',
      'エポス 4日払い',
    ],
    closingDay: 4,
    paymentDay: 4,
    officialUrl:
      'https://faq.eposcard.co.jp/faq/show/202?category_id=44&site_domain=default',
    verifiedAt: '2026-08-30',
    note: '毎月4日締め・翌月4日払い（4日払いを選択した契約）',
  },
  {
    id: 'jcb-original-w',
    name: 'JCB ORIGINAL W',
    issuer: 'ジェーシービー',
    aliases: [
      'JCB ORIGINAL SERIES W',
      'JCB オリジナル W',
      'JCB オリジナルシリーズ W',
      'JCB ORIGINALS W',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.jcb.co.jp/promotion/tstosab/w.html',
    verifiedAt: '2026-09-02',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'aoyama-gakuin-card',
    name: 'AOYAMA GAKUIN CARD',
    issuer: '三井住友カード',
    aliases: [
      '青学カード',
      '青山学院カード',
      '青山学院大学カード',
      'AOYAMA GAKUIN VISA CARD',
      'AGU CARD',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://www.smbc-card.com/nyukai/affiliate/agu/index.jsp',
    verifiedAt: '2026-09-02',
    note: '毎月15日締め・翌月10日払い',
  },
  {
    id: 'orico-pay-balance',
    name: 'Orico Pay Balance',
    issuer: 'オリエントコーポレーション',
    aliases: [
      'ORICO PAY BALANCE',
      'オリコペイバランス',
      'オリコ Pay Balance',
      'OricoPayBalance',
    ],
    closingDay: 31,
    paymentDay: 27,
    officialUrl: 'https://www.orico.co.jp/service/knowledge/system/',
    verifiedAt: '2026-09-02',
    note: '月末締め・翌月27日払い',
  },
  {
    id: 'smbc-debut-plus',
    name: '三井住友カード デビュープラス',
    issuer: '三井住友カード',
    aliases: [
      'デビュープラス',
      '三井住友デビュープラス',
      '三井住友VISAデビュープラス',
      'SMBC DEBUT PLUS',
      'DEBUT PLUS VISA',
    ],
    closingDay: 15,
    paymentDay: 10,
    officialUrl: 'https://qa.smbc-card.com/mem/detail?id=39&important_list=true',
    verifiedAt: '2026-09-02',
    note: '標準は毎月15日締め・翌月10日払い。26日払いへ変更済みの場合は月末締め・翌月26日払い',
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

export function findCardPresets(
  query: string,
  limit = CARD_PRESETS.length,
): CardPreset[] {
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
