/** Payment routes are separate from card type, card name, and card digits. */
export const PAYMENT_NETWORKS = ['quicpay', 'id', 'Suica', 'PASMO', 'PayPay', '楽天Edy', 'WAON', 'nanaco'] as const
export type PaymentNetwork = string
export const MAX_PAYMENT_NETWORKS = 10
export const MAX_PAYMENT_NETWORK_LENGTH = 40
export const PAYMENT_NETWORK_LABELS: Record<string, string> = { quicpay: 'QUICPay', id: 'iD' }

export function paymentNetworkKey(value: string): string {
  const key = value.normalize('NFKC').toLowerCase().replace(/\s/gu, '')
  return ['quicpay', 'quicpay+', 'quicpayplus', 'クイックペイ', 'クイックペイプラス'].includes(key) ? 'quicpay' : key
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) return ''
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
  if (!name || [...name].length > MAX_PAYMENT_NETWORK_LENGTH) return ''
  const key = paymentNetworkKey(name)
  if (key === 'quicpay') return 'quicpay'
  return key === 'id' ? 'id' : name
}

export function paymentNetworkLabel(value: string): string {
  const name = normalizeName(value)
  return Object.prototype.hasOwnProperty.call(PAYMENT_NETWORK_LABELS, name) ? PAYMENT_NETWORK_LABELS[name] : name
}

export function normalizePaymentNetworks(value: unknown): PaymentNetwork[] {
  if (!Array.isArray(value)) return []
  const names = new Map<string, string>()
  for (const item of value) {
    const name = normalizeName(item)
    if (name && !names.has(paymentNetworkKey(name))) names.set(paymentNetworkKey(name), name)
  }
  return [...names.values()].sort((a, b) => {
    const priority = (name: string) => name === 'quicpay' ? 0 : name === 'id' ? 1 : 2
    return priority(a) - priority(b) || (paymentNetworkKey(a) < paymentNetworkKey(b) ? -1 : paymentNetworkKey(a) > paymentNetworkKey(b) ? 1 : 0)
  }).slice(0, MAX_PAYMENT_NETWORKS)
}

export function validPaymentNetworks(value: unknown): value is PaymentNetwork[] {
  return Array.isArray(value) && value.length <= MAX_PAYMENT_NETWORKS && value.every((item) => !!normalizeName(item)) &&
    new Set(value.map((item) => paymentNetworkKey(normalizeName(item)))).size === value.length
}

/** Only an extracted actual tender label, never receipt advertising or body text. */
export function receiptPaymentNetwork(label: string, registeredNames: readonly string[] = []): PaymentNetwork | null {
  const normalized = label.normalize('NFKC').toLowerCase().replace(/[\s・ー‐–—_-]/gu, '')
  if (/^(?:quicpay(?:\+|plus)?|クイックペイ(?:プラス)?)(?:支払(?:い)?|決済)?$/u.test(normalized)) return 'quicpay'
  if (/^id(?:支払(?:い)?|決済)?$/u.test(normalized)) return 'id'
  // Custom labels must match the extracted tender as a whole, not a substring.
  const labelKey = paymentNetworkKey(label)
  const keys = new Set([labelKey, labelKey.replace(/(?:支払い?|決済)$/u, '')])
  // The per-card bound must not limit a search across all registered cards.
  const matches = new Map<string, string>()
  for (const raw of registeredNames) {
    const name = normalizeName(raw)
    if (name && keys.has(paymentNetworkKey(name))) matches.set(paymentNetworkKey(name), name)
  }
  if (matches.size === 1) return [...matches.values()][0]
  return null
}
