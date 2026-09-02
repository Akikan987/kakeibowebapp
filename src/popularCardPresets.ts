import type { CardPreset } from './cardPresets.ts'

type CardName = readonly [id: string, name: string, aliases?: readonly string[]]

const VERIFIED_AT = '2026-09-02'

const issuerPresets = (
  issuer: string,
  closingDay: number,
  paymentDay: number,
  officialUrl: string,
  note: string,
  cards: readonly CardName[],
): CardPreset[] => cards.map(([id, name, aliases = []]) => ({
  id,
  name,
  issuer,
  aliases: [...aliases],
  closingDay,
  paymentDay,
  officialUrl,
  verifiedAt: VERIFIED_AT,
  note,
}))

const jcbCards = issuerPresets(
  'ジェーシービー',
  15,
  10,
  'https://j-faq.jcb.co.jp/faq/show/379?category_id=162&site_domain=default',
  '毎月15日締め・翌月10日払い',
  [
    ['jcb-card-s', 'JCB カード S', ['JCB S', 'JCB CARD S']],
    ['jcb-standard', 'JCB一般カード', ['JCB ORIGINAL SERIES 一般', 'JCB オリジナルシリーズ 一般']],
    ['jcb-gold', 'JCBゴールド', ['JCB GOLD', 'JCB ORIGINAL SERIES GOLD']],
    ['jcb-platinum', 'JCBプラチナ', ['JCB PLATINUM', 'JCB ORIGINAL SERIES PLATINUM']],
    ['jcb-gold-extage', 'JCB GOLD EXTAGE', ['JCB ゴールド エクステージ']],
    ['jcb-card-r', 'JCB CARD R', ['JCBカードR', 'JCB R']],
    ['jcb-linda', 'JCB LINDA', ['JCBリンダ', 'LINDAカード']],
    ['jcb-eit', 'JCB EIT', ['JCBエイト', 'EITカード']],
    ['jcb-biz-one', 'JCB Biz ONE 一般', ['JCB BIZ ONE', 'JCBビズワン一般']],
    ['jcb-biz-one-gold', 'JCB Biz ONE ゴールド', ['JCB BIZ ONE GOLD', 'JCBビズワンゴールド']],
  ],
)

const smbcCards = issuerPresets(
  '三井住友カード',
  15,
  10,
  'https://qa.smbc-card.com/mem/detail?id=39&important_list=true',
  '標準は毎月15日締め・翌月10日払い。26日払いを選択した契約は月末締め・翌月26日払い',
  [
    ['smbc-card-nl', '三井住友カード（NL）', ['三井住友NL', 'SMBC CARD NL']],
    ['smbc-gold-nl', '三井住友カード ゴールド（NL）', ['三井住友ゴールドNL', 'SMBC GOLD NL']],
    ['smbc-platinum-preferred', '三井住友カード プラチナプリファード', ['プラチナプリファード', 'SMBC PLATINUM PREFERRED']],
    ['smbc-visa-infinite', '三井住友カード Visa Infinite', ['三井住友VISA INFINITE', 'SMBC VISA INFINITE']],
    ['smbc-standard', '三井住友カード', ['三井住友VISAカード', 'SMBC CARD']],
    ['smbc-gold', '三井住友カード ゴールド', ['三井住友VISAゴールド', 'SMBC GOLD']],
    ['smbc-platinum', '三井住友カード プラチナ', ['三井住友VISAプラチナ', 'SMBC PLATINUM']],
    ['smbc-revostyle', '三井住友カード RevoStyle', ['リボスタイル', 'REVOSTYLE']],
    ['smbc-card-cl', '三井住友カード（CL）', ['三井住友CL', 'SMBC CARD CL']],
    ['smbc-student', '三井住友カード（学生）', ['三井住友学生カード', 'SMBC CARD STUDENT']],
    ['smbc-card-a', '三井住友カード A', ['三井住友VISA A', 'SMBC CARD A']],
    ['smbc-amitie', '三井住友カード アミティエ', ['三井住友アミティエ', 'AMITIE CARD']],
  ],
)

const saisonCards = issuerPresets(
  'クレディセゾン',
  10,
  4,
  'https://www.saisoncard.co.jp/amex/content-about/closingdate/',
  'ショッピングは毎月10日締め・翌月4日払い',
  [
    ['saison-international', 'セゾンカードインターナショナル', ['SAISON CARD INTERNATIONAL']],
    ['saison-gold-premium', 'セゾンゴールドプレミアム', ['SAISON GOLD PREMIUM']],
    ['saison-gold-amex', 'セゾンゴールド・アメリカン・エキスプレス・カード', ['セゾンゴールドAMEX', 'SAISON GOLD AMEX']],
    ['saison-platinum-amex', 'セゾンプラチナ・アメリカン・エキスプレス・カード', ['セゾンプラチナAMEX', 'SAISON PLATINUM AMEX']],
    ['saison-rose-gold-amex', 'セゾンローズゴールド・アメリカン・エキスプレス・カード', ['セゾンローズゴールドAMEX']],
    ['muji-card', 'MUJI Card', ['無印良品カード', 'MUJIカード']],
    ['loft-card', 'ロフトカード', ['LOFT CARD', 'LOFTカード']],
    ['parco-card', 'PARCOカード', ['パルコカード', 'PARCO CARD']],
    ['mileage-plus-saison', 'MileagePlusセゾンカード', ['マイレージプラスセゾン', 'UNITED MILEAGEPLUS SAISON']],
    ['takashimaya-saison', 'タカシマヤセゾンカード', ['高島屋セゾンカード', 'TAKASHIMAYA SAISON']],
  ],
)

const oricoCards = issuerPresets(
  'オリエントコーポレーション',
  31,
  27,
  'https://www.orico.co.jp/creditcard/service/shopping/',
  '月末締め・翌月27日払い',
  [
    ['orico-point-premium-gold', 'Orico Card THE POINT PREMIUM GOLD', ['オリコザポイントプレミアムゴールド']],
    ['orico-platinum', 'Orico Card THE PLATINUM', ['オリコザプラチナ']],
    ['orico-gold-prime', 'Orico Card THE GOLD PRIME', ['オリコザゴールドプライム']],
    ['orico-point-upty', 'Orico Card THE POINT UPty', ['オリコザポイントアプティ']],
    ['costco-global-card', 'コストコグローバルカード', ['COSTCO GLOBAL CARD', 'コストコオリコカード']],
    ['orico-ex-gold-for-biz', 'EX Gold for Biz', ['オリコEX GOLD FOR BIZ', 'EXゴールドフォービズ']],
    ['orico-card-the-world', 'Orico Card THE WORLD', ['オリコザワールド']],
    ['orico-ib', 'Orico Card iB', ['オリコカードiB', 'ORICO IB']],
  ],
)

const rakutenCards = issuerPresets(
  '楽天カード',
  31,
  27,
  'https://www.rakuten-card.co.jp/support/start_guide/',
  '月末締め・翌月27日払い',
  [
    ['rakuten-gold', '楽天ゴールドカード', ['RAKUTEN GOLD CARD']],
    ['rakuten-premium', '楽天プレミアムカード', ['RAKUTEN PREMIUM CARD']],
    ['rakuten-pink', '楽天PINKカード', ['楽天ピンクカード', 'RAKUTEN PINK CARD']],
    ['rakuten-black', '楽天ブラックカード', ['RAKUTEN BLACK CARD']],
    ['rakuten-ana-mileage', '楽天ANAマイレージクラブカード', ['楽天ANAカード', 'RAKUTEN ANA MILEAGE CLUB CARD']],
  ],
)

const aeonCards = issuerPresets(
  'イオンフィナンシャルサービス',
  10,
  2,
  'https://www.aeon.co.jp/inquiry/seikyu_kakunin/',
  '毎月10日締め・翌月2日払い',
  [
    ['aeon-select', 'イオンカードセレクト', ['AEON CARD SELECT']],
    ['aeon-waon', 'イオンカード（WAON一体型）', ['イオンWAONカード', 'AEON WAON CARD']],
    ['aeon-gold', 'イオンゴールドカード', ['AEON GOLD CARD']],
    ['cosmo-the-card-opus', 'コスモ・ザ・カード・オーパス', ['コスモカードオーパス', 'COSMO THE CARD OPUS']],
    ['aeon-minions', 'イオンカード（ミニオンズ）', ['イオンミニオンズカード', 'AEON MINIONS']],
    ['aeon-suica', 'イオンSuicaカード', ['イオンスイカカード', 'AEON SUICA']],
    ['welcia-card', 'ウエルシアカード', ['WELCIA CARD', 'ウェルシアカード']],
    ['maruetsu-card', 'マルエツカード', ['MARUETSU CARD']],
  ],
)

const viewCards = issuerPresets(
  'ビューカード',
  5,
  4,
  'https://faq.viewcard.co.jp/faq/show/118?site_domain=default',
  '毎月5日締め・翌月4日払い',
  [
    ['view-card-standard', 'ビューカード スタンダード', ['VIEW CARD STANDARD', 'ビューカード一般']],
    ['jre-card', 'JRE CARD', ['JREカード']],
    ['bic-camera-suica', 'ビックカメラSuicaカード', ['ビックカメラスイカカード', 'BIC CAMERA SUICA']],
    ['lumine-card', 'ルミネカード', ['LUMINE CARD']],
    ['jal-card-suica', 'JALカードSuica', ['JAL SUICAカード', 'JAL CARD SUICA']],
    ['otonano-kyujitsu-middle', '大人の休日倶楽部ミドルカード', ['大人の休日ミドル', 'OTONA NO KYUJITSU MIDDLE']],
    ['otonano-kyujitsu-zipang', '大人の休日倶楽部ジパングカード', ['大人の休日ジパング', 'OTONA NO KYUJITSU ZIPANG']],
    ['view-gold-plus', 'ビューゴールドプラスカード', ['VIEW GOLD PLUS', 'ビューゴールド']],
  ],
)

const mufgCards = issuerPresets(
  '三菱UFJニコス',
  15,
  10,
  'https://faq.cr.mufg.jp/mufgcard/detail?category=142&id=331&site=NIX1EXYK',
  '通常のショッピングは毎月15日締め・翌月10日払い',
  [
    ['mufg-gold-prestige', '三菱UFJカード ゴールドプレステージ', ['MUFG GOLD PRESTIGE']],
    ['mufg-viaso', '三菱UFJカード VIASOカード', ['MUFG VIASO', 'VIASO CARD']],
    ['recruit-card-mufg', 'リクルートカード（三菱UFJニコス）', ['RECRUIT CARD MUFG', 'リクルートMUFGカード']],
    ['jal-card-mufg', 'JALカード（三菱UFJニコス）', ['JAL MUFGカード', 'JAL CARD MUFG']],
    ['dc-card-jizile', 'DCカード Jizile', ['DC CARD JIZILE', 'DCカードジザイル']],
  ],
)

const auPayCards: CardPreset[] = [
  ...issuerPresets(
    'auフィナンシャルサービス', 15, 10,
    'https://qa.kddi-fs.com/faq/show/295?category_id=55&site_domain=1',
    '管理番号の1桁目が9の場合、毎月15日締め・翌月10日払い',
    [['au-pay-card-10', 'au PAY カード（10日払い）', ['AU PAY CARD 10', 'au PAY ゴールドカード 10日払い']]],
  ),
  ...issuerPresets(
    'auフィナンシャルサービス', 10, 4,
    'https://qa.kddi-fs.com/faq/show/295?category_id=55&site_domain=1',
    '管理番号の1桁目が5の場合、ショッピングは毎月10日締め・翌月4日払い',
    [['au-pay-card-4', 'au PAY カード（4日払い）', ['AU PAY CARD 4', 'au PAY ゴールドカード 4日払い']]],
  ),
]

const dCards = issuerPresets(
  'NTTドコモ・フィナンシャルグループ',
  15,
  10,
  'https://dcard.docomo.ne.jp/st/attention/shiharai/index.html',
  '毎月15日締め・翌月10日払い',
  [
    ['d-card-gold', 'dカード GOLD', ['DCARD GOLD', 'ドコモdカードゴールド']],
    ['d-card-gold-u', 'dカード GOLD U', ['DCARD GOLD U', 'ドコモdカードゴールドU']],
    ['d-card-platinum', 'dカード PLATINUM', ['DCARD PLATINUM', 'ドコモdカードプラチナ']],
    ['d-card-poinco', 'dカード（ポインコデザイン）', ['dカードポインコ', 'DCARD POINCO']],
  ],
)

const otherCards: CardPreset[] = [
  ...issuerPresets(
    'PayPayカード', 31, 27,
    'https://www.paypay-card.co.jp/service/000173.html',
    '月末締め・翌月27日払い',
    [['paypay-card-gold', 'PayPayカード ゴールド', ['PAYPAY GOLD CARD', 'PayPayゴールド']]],
  ),
  ...issuerPresets(
    'セブン・カードサービス', 15, 10,
    'https://www.7card.co.jp/7card/service/payment/',
    '毎月15日締め・翌月10日払い',
    [['seven-card-plus-nanaco', 'セブンカード・プラス（nanaco一体型）', ['7カードプラスnanaco', 'SEVEN CARD PLUS NANACO']]],
  ),
  ...issuerPresets(
    'クレディセゾン', 10, 5,
    'https://www2.uccard.co.jp/uc/services/oshiharai/',
    '毎月10日締め・翌月5日払い',
    [
      ['uc-card-gold', 'UCカード ゴールド', ['UC GOLD CARD', 'UCゴールド']],
      ['uc-card-platinum', 'UCプラチナカード', ['UC PLATINUM CARD', 'UCプラチナ']],
    ],
  ),
]

export const POPULAR_CARD_PRESETS: CardPreset[] = [
  ...jcbCards,
  ...smbcCards,
  ...saisonCards,
  ...oricoCards,
  ...rakutenCards,
  ...aeonCards,
  ...viewCards,
  ...mufgCards,
  ...auPayCards,
  ...dCards,
  ...otherCards,
]
