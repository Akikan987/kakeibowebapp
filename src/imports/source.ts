import type { FinancialMessageCandidate } from './smbc.ts'

/** Store only a fingerprint with the reviewed expense, not the email body/approval number. */
export async function financialMessageSource(candidate: FinancialMessageCandidate) {
  const data = JSON.stringify([
    candidate.provider, candidate.paymentType, candidate.purchasedAtMillis, candidate.amountYen,
    candidate.merchant.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase(), candidate.cardLastFour,
  ])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return `financial-message:v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
