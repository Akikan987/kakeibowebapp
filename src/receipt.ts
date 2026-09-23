import type { PaymentMethod } from './types.ts'

export interface ReceiptPayment {
  paymentType: string
  paymentLabel: string
  cardLastFour: string
  paymentConfidence: string
}

/** AIは手がかりだけを返す。登録済みの決済方法の選択は一意の根拠で行う。 */
export function matchReceiptPayment(receipt: ReceiptPayment, methods: PaymentMethod[]): { id: string; message: string } {
  const active = methods.filter((method) => !method.deleted)
  if (receipt.paymentConfidence !== 'certain' || ['mixed', 'unknown'].includes(receipt.paymentType)) {
    return { id: '', message: '支払方法が不明、または併用のため手動で選択してください。' }
  }
  if (receipt.cardLastFour && receipt.paymentType !== 'cash') {
    const matches = active.filter((method) => method.type !== 'cash' && method.cardLastFour === receipt.cardLastFour)
    if (matches.length === 1) return { id: matches[0].id, message: `末尾 ${receipt.cardLastFour} が一致しました。保存前に確認してください。` }
    return { id: '', message: matches.length > 1 ? `末尾 ${receipt.cardLastFour} のカードが複数あります。手動で選択してください。` : `末尾 ${receipt.cardLastFour} に一致する決済方法がありません。モバイル決済では券面と番号が異なる場合があります。` }
  }
  if (receipt.paymentType === 'cash' && !receipt.cardLastFour) {
    const cash = active.filter((method) => method.type === 'cash')
    if (cash.length === 1) return { id: cash[0].id, message: 'レシートの現金表示から選択しました。' }
  }
  if (receipt.paymentType === 'electronic' && receipt.paymentLabel.trim()) {
    const normalize = (value: string) => value.normalize('NFKC').replace(/\s/g, '').toLowerCase()
    const matches = active.filter((method) => method.type !== 'cash' && normalize(method.name) === normalize(receipt.paymentLabel))
    if (matches.length === 1) return { id: matches[0].id, message: '決済サービス名が一致しました。保存前に確認してください。' }
  }
  return { id: '', message: '決済方法を特定できません。手動で選択してください。' }
}

/** YYYY-MM-DDだけを受け付け、日付繰り上がり（2/30など）を許さない。 */
export function receiptDateMillis(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day, 12)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed.getTime() : null
}
