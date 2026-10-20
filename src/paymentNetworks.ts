/** Payment routes are separate from card type, card name, and card digits. */
export const PAYMENT_NETWORKS = ['quicpay', 'id'] as const
export type PaymentNetwork = typeof PAYMENT_NETWORKS[number]
export const PAYMENT_NETWORK_LABELS: Record<PaymentNetwork, string> = { quicpay: 'QUICPay', id: 'iD' }

export function normalizePaymentNetworks(value: unknown): PaymentNetwork[] {
  return Array.isArray(value) ? PAYMENT_NETWORKS.filter((network) => value.includes(network)) : []
}

export function validPaymentNetworks(value: unknown): value is PaymentNetwork[] {
  return Array.isArray(value) && value.length <= PAYMENT_NETWORKS.length &&
    value.every((item) => PAYMENT_NETWORKS.includes(item as PaymentNetwork)) && new Set(value).size === value.length
}

/** Only an extracted actual tender label, never receipt advertising or body text. */
export function receiptPaymentNetwork(label: string): PaymentNetwork | null {
  const normalized = label.normalize('NFKC').toLowerCase().replace(/[\s・ー‐–—_-]/gu, '')
  if (/^(?:quicpay(?:\+|plus)?|クイックペイ(?:プラス)?)(?:支払(?:い)?|決済)?$/u.test(normalized)) return 'quicpay'
  if (/^id(?:支払(?:い)?|決済)?$/u.test(normalized)) return 'id'
  return null
}
