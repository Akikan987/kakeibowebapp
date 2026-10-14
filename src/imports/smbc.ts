import type { PaymentMethod } from '../types.ts'

export interface FinancialMessageInput {
  text: string
  subject?: string
  sender?: string
  source?: 'email' | 'notification'
  packageName?: string
  receivedAt?: number
}

export interface FinancialMessageCandidate {
  kind: 'card_usage' | 'bank_notice' | 'card_bill' | 'unsupported'
  provider: 'smbc_card' | 'smbc_bank' | 'unknown'
  paymentType: 'debit' | 'credit' | 'unknown'
  merchant: string
  amountYen: number | null
  purchasedAtMillis: number | null
  cardLastFour: string
  warnings: string[]
}

const MAX_MESSAGE_LENGTH = 32_000
const ALLOWED_DEBIT_SENDERS = new Set(['smbc-debit@smbc-card.com'])
const ALLOWED_NOTIFICATION_PACKAGES = new Set(['jp.co.smbc.direct', 'com.smbc_card.vpass'])

const usageLabels = [
  { kind: 'date', regex: /(?:ご利用日時|利用日時|ご利用日|利用日)\s*[:：]/gu },
  { kind: 'merchant', regex: /(?:ご利用先|利用先)\s*[:：]/gu },
  { kind: 'amount', regex: /(?:ご利用金額|利用金額)\s*[:：]/gu },
  { kind: 'lastFour', regex: /(?:カード番号末尾|ご利用カード末尾|カード末尾|カード下4桁|下4桁)\s*[:：]/gu },
] as const

const boundaryRegex = /(?:ご利用日時|利用日時|ご利用日|利用日|ご利用先|利用先|ご利用金額|利用金額|カード番号末尾|ご利用カード末尾|カード末尾|カード下4桁|下4桁|承認番号|承認コード|取引番号|ご請求予定額|ご請求額|請求額|お支払予定額|お支払い予定額|お支払金額|お支払い金額|支払額|カード番号)\s*[:：]/gu

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    // Keep line breaks and tabs for field parsing. Strip invisible format and control characters.
    .replace(/[\p{Cf}\p{Cc}]/gu, (character) => /[\n\r\t]/u.test(character) ? character : '')
}

function emptyCandidate(warnings: string[], kind: FinancialMessageCandidate['kind'] = 'unsupported', provider: FinancialMessageCandidate['provider'] = 'unknown'): FinancialMessageCandidate {
  return { kind, provider, paymentType: 'unknown', merchant: '', amountYen: null, purchasedAtMillis: null, cardLastFour: '', warnings }
}

interface LabeledValue {
  kind: (typeof usageLabels)[number]['kind']
  value: string
}

function readUsageFields(value: string): LabeledValue[] {
  const matches: Array<{ kind: LabeledValue['kind']; index: number; end: number }> = []
  for (const label of usageLabels) {
    label.regex.lastIndex = 0
    for (const match of value.matchAll(label.regex)) {
      matches.push({ kind: label.kind, index: match.index!, end: match.index! + match[0].length })
    }
  }
  matches.sort((a, b) => a.index - b.index)

  return matches.map((match, index) => {
    const nextLabel = matches[index + 1]?.index ?? value.length
    const nextBoundary = boundaryRegex.exec(value.slice(match.end))
    boundaryRegex.lastIndex = 0
    const boundaryIndex = nextBoundary ? match.end + nextBoundary.index : value.length
    const nextSymbol = value.slice(match.end, nextLabel).search(/[◇◆\n\r]/u)
    const symbolEnd = nextSymbol >= 0 ? match.end + nextSymbol : value.length
    const end = Math.min(nextLabel, boundaryIndex, symbolEnd)
    const raw = value.slice(match.end, end).replace(/^\s*[:：=]?\s*/u, '').trim()
    return { kind: match.kind, value: raw }
  })
}

function oneField(fields: LabeledValue[], kind: LabeledValue['kind']): string | null | 'multiple' {
  const values = fields.filter((field) => field.kind === kind)
  if (values.length > 1) return 'multiple'
  return values[0]?.value ?? null
}

function parseAmount(value: string | null | 'multiple'): number | null | 'invalid' {
  if (value === null) return null
  if (value === 'multiple') return 'invalid'
  const match = value.match(/^((?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+))\s*円?\s*$/u)
  if (!match) return 'invalid'
  const amount = Number(match[1].replace(/,/gu, ''))
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2_000_000_000 ? amount : 'invalid'
}

function parseJstDate(value: string | null | 'multiple'): number | null | 'invalid' {
  if (value === null) return null
  if (value === 'multiple') return 'invalid'
  const match = value.match(/^(\d{4})(?:\/|-|年)(\d{1,2})(?:\/|-|月)(\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/u)
  if (!match) return 'invalid'
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? '0')
  const utc = Date.UTC(year, month - 1, day, hour - 9, minute, second)
  // Validate the submitted wall-clock date before applying the JST offset; date constructors normalize bad dates.
  const localCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (
    localCheck.getUTCFullYear() !== year || localCheck.getUTCMonth() !== month - 1 || localCheck.getUTCDate() !== day ||
    localCheck.getUTCHours() !== hour || localCheck.getUTCMinutes() !== minute || localCheck.getUTCSeconds() !== second ||
    hour > 23 || minute > 59 || second > 59
  ) return 'invalid'
  return Number.isFinite(utc) ? utc : 'invalid'
}

function parseLastFour(value: string | null | 'multiple'): string | null | 'invalid' {
  if (value === null) return null
  if (value === 'multiple' || !/^\d{4}$/u.test(value)) return 'invalid'
  return value
}

function hasAny(value: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0
  return pattern.test(value)
}

/** Parse one clearly labeled SMBC card-use notice. Uncertain messages remain manual-review candidates. */
export function parseSmbcMessage(input: FinancialMessageInput): FinancialMessageCandidate {
  const raw = `${input.subject ?? ''}\n${input.text ?? ''}`
  if (raw.length > MAX_MESSAGE_LENGTH) return emptyCandidate(['本文が長すぎるため解析しませんでした。'])
  const text = normalize(raw)
  const warnings: string[] = []
  const isNotification = input.source === 'notification'

  if (isNotification) {
    if (!input.packageName || !ALLOWED_NOTIFICATION_PACKAGES.has(input.packageName)) {
      return emptyCandidate(['通知元アプリを確認できません。'])
    }
  } else if (input.sender) {
    if (!ALLOWED_DEBIT_SENDERS.has(input.sender.trim().toLowerCase())) {
      return emptyCandidate(['送信元アドレスが確認済みのSMBCカード通知と一致しません。'])
    }
  } else {
    warnings.push('送信元を確認できないため、内容を手動で確認してください。')
  }

  const hasCardMarker = hasAny(text, /三井住友カード|Vpass|Oliveフレキシブルペイ/iu)
  if (!hasCardMarker) {
    if (hasAny(text, /三井住友銀行|SMBC銀行/iu) && hasAny(text, /入金|出金|振込|ATM|預金|残高/iu)) {
      return emptyCandidate(['銀行の入出金通知は支出と二重計上される可能性があるため、明細から確認してください。'], 'bank_notice', 'smbc_bank')
    }
    return emptyCandidate(['SMBCカードのブランド表示を確認できません。'])
  }

  if (hasAny(text, /ご請求予定額|ご請求額|請求額|お支払予定額|お支払い予定額|お支払金額|お支払い金額|支払額/iu)) {
    return emptyCandidate(['請求・支払額のお知らせは利用明細ではありません。'], 'card_bill', 'smbc_card')
  }
  if (hasAny(text, /ワンタイムパスワード|認証コード|本人認証|ご利用いただけません|ご利用できません|承認できません|承認されません|不正利用/iu)) {
    return emptyCandidate(['認証・利用不可に関する通知は支出として取り込みません。'], 'unsupported', 'smbc_card')
  }
  if (hasAny(text, /利用取消のお知らせ|ご利用分の取消|ご利用を取消|キャンセルされました|取消されました|返金のお知らせ|ご返金/iu)) {
    return emptyCandidate(['取消・返金通知は通常の支出として取り込みません。'], 'unsupported', 'smbc_card')
  }

  const fields = readUsageFields(text)
  const dateText = oneField(fields, 'date')
  const merchantText = oneField(fields, 'merchant')
  const amountText = oneField(fields, 'amount')
  const lastFourText = oneField(fields, 'lastFour')
  if (dateText === null || merchantText === null || amountText === null) {
    return emptyCandidate(['利用日・利用先・利用金額のラベルをすべて確認できません。'], 'unsupported', 'smbc_card')
  }

  const amount = parseAmount(amountText)
  const purchasedAt = parseJstDate(dateText)
  const lastFour = parseLastFour(lastFourText)
  if (amount === 'invalid' || purchasedAt === 'invalid' || lastFour === 'invalid' || merchantText === 'multiple' || !merchantText || merchantText.length > 160) {
    return emptyCandidate(['複数または読み取れない取引項目があるため、自動入力しませんでした。'], 'unsupported', 'smbc_card')
  }

  const firstUsageField = /(?:ご利用日時|利用日時|ご利用日|利用日|ご利用先|利用先|ご利用金額|利用金額|カード番号末尾|ご利用カード末尾|カード末尾|カード下4桁|下4桁)\s*[:：]/u.exec(text)
  const transactionHeader = firstUsageField ? text.slice(0, firstUsageField.index) : text
  const isDebit = hasAny(transactionHeader, /デビットモード|デビットカード/iu)
  const isCredit = hasAny(transactionHeader, /クレジットモード|クレジットカード/iu)
  if (isDebit && isCredit) {
    warnings.push('デビットとクレジットの両方が記載されています。')
    return emptyCandidate(warnings, 'unsupported', 'smbc_card')
  }
  const paymentType = isDebit ? 'debit' : isCredit ? 'credit' : 'unknown'
  if (paymentType === 'unknown') warnings.push('支払モードを確認できないため、決済方法は手動で選択してください。')
  if (!lastFour) warnings.push('カード末尾4桁がないため、決済方法は手動で選択してください。')
  if (paymentType === 'unknown') warnings.push('Oliveの名称だけではデビット／クレジットを判定しません。')
  warnings.push('カード利用通知は速報です。後日の取消・変更は明細で確認してください。')

  return {
    kind: 'card_usage',
    provider: 'smbc_card',
    paymentType,
    merchant: merchantText,
    amountYen: amount,
    purchasedAtMillis: purchasedAt,
    cardLastFour: lastFour ?? '',
    warnings,
  }
}

/** Select only from a unique exact last-four and payment-type match. */
export function matchSmbcPayment(candidate: FinancialMessageCandidate, methods: PaymentMethod[]): { id: string; message: string } {
  if (candidate.kind !== 'card_usage' || candidate.paymentType === 'unknown' || !/^\d{4}$/u.test(candidate.cardLastFour)) {
    return { id: '', message: '決済方法を特定できません。手動で選択してください。' }
  }
  const matches = methods.filter((method) =>
    !method.deleted && method.type === candidate.paymentType && method.cardLastFour === candidate.cardLastFour,
  )
  if (matches.length === 1) {
    return { id: matches[0].id, message: `末尾 ${candidate.cardLastFour} と支払モードが一致しました。保存前に確認してください。` }
  }
  return {
    id: '',
    message: matches.length > 1 ? '一致するカードが複数あります。手動で選択してください。' : '一致するカードがありません。手動で選択してください。',
  }
}
