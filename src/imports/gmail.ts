import type { FinancialMessageCandidate } from './smbc.ts'

export interface GmailStatus {
  configured: boolean; connected: boolean; email: string; enabled: boolean; aiEnabled: boolean
  pendingCount: number; lastCheckedAt: number | null; lastError: string; intervalSeconds: number; aiAvailable?: boolean
}
export type GmailAiStatusKind = 'not-connected' | 'server-setup' | 'consent-required' | 'enabled'
export interface GmailAiStatusSummary {
  kind: GmailAiStatusKind
  label: string
  description: string
  severity: 'info' | 'warning' | 'success'
}
export function gmailAiStatusSummary(status: GmailStatus | null): GmailAiStatusSummary {
  if (!status?.connected) return {
    kind: 'not-connected', label: 'Gmail未接続', severity: 'info',
    description: 'Gmailを接続すると利用通知から候補を作ります。AI補助を使わなくても定型解析で明細を判定できます。',
  }
  if (status.aiAvailable !== true) return {
    kind: 'server-setup', label: 'AIサーバー設定待ち', severity: 'warning',
    description: 'Gmailは接続済みです。AI補助のサーバー設定待ちですが、定型解析は使えます。AIは決済モードが不明な候補だけを補助します。',
  }
  if (status.aiEnabled) return {
    kind: 'enabled', label: 'AI補助ON', severity: 'success',
    description: '定型解析で決済モードが判定できない候補だけAI補助を使います。通常の定型解析を先に行います。',
  }
  return {
    kind: 'consent-required', label: '本人のAI同意待ち', severity: 'info',
    description: 'AI補助はまだ有効ではありません。定型解析は引き続き使えます。利用する場合は内容を確認し、同意してください。',
  }
}
export interface GmailCandidate { id: string; candidate: FinancialMessageCandidate; createdAt: number }
export const GMAIL_CONNECTIONS_URL = 'https://myaccount.google.com/connections'
export interface GmailDisconnectOutcome { disconnected: boolean; revoked: boolean; message: string }
export function gmailDisconnectOutcome(value: unknown): GmailDisconnectOutcome {
  const response = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const disconnected = response?.ok === true
  const revoked = disconnected && response?.revoked === true
  if (!disconnected) {
    return { disconnected: false, revoked: false, message: '家計簿側のGmail連携解除を確認できませんでした。保存済みの家計簿データは残っています。' }
  }
  return revoked
    ? { disconnected: true, revoked: true, message: '家計簿側のGmail連携とGoogle側のアクセスを解除しました。保存済みの家計簿データは残っています。' }
    : { disconnected: true, revoked: false, message: '家計簿側のGmail連携は解除しましたが、Google側のアクセスを取り消せたことを確認できませんでした。保存済みの家計簿データは残っています。' }
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Gmailの応答を確認できませんでした')
  return value as Record<string, unknown>
}
export function gmailCandidates(value: unknown): GmailCandidate[] {
  const items = record(value).items
  if (!Array.isArray(items) || items.length > 200) throw new Error('Gmailの候補一覧を確認できませんでした')
  return items.map((item) => {
    const row = record(item), candidate = record(row.candidate)
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) ||
        !['card_usage', 'bank_notice', 'card_bill', 'unsupported'].includes(String(candidate.kind)) ||
        !['smbc_card', 'smbc_bank', 'unknown'].includes(String(candidate.provider)) ||
        !['debit', 'credit', 'unknown'].includes(String(candidate.paymentType)) ||
        typeof candidate.merchant !== 'string' || candidate.merchant.length > 300 ||
        (candidate.amountYen !== null && (!Number.isSafeInteger(candidate.amountYen) || Number(candidate.amountYen) < 1 || Number(candidate.amountYen) > 2_000_000_000)) ||
        (candidate.purchasedAtMillis !== null && (typeof candidate.purchasedAtMillis !== 'number' || !Number.isFinite(candidate.purchasedAtMillis) || candidate.purchasedAtMillis <= 0 || !Number.isFinite(new Date(candidate.purchasedAtMillis).getTime()))) ||
        typeof candidate.cardLastFour !== 'string' || !/^(?:[0-9]{4})?$/.test(candidate.cardLastFour) ||
        !Array.isArray(candidate.warnings) || candidate.warnings.length > 20 || !candidate.warnings.every((warning) => typeof warning === 'string' && warning.length <= 500) ||
        typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt)) throw new Error('Gmailの入力候補を確認できませんでした')
    return { id: row.id, createdAt: row.createdAt, candidate: candidate as unknown as FinancialMessageCandidate }
  })
}
export async function gmailRequest<T>(token: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Kakeibo-Session': 'cookie' }
  if (token !== 'cookie') headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`/integrations/${path}`, {
    credentials: 'same-origin', cache: 'no-store', headers,
    method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    let message = 'Gmail連携の操作に失敗しました'
    try { const value = await response.json(); if (typeof value.detail === 'string') message = value.detail.slice(0, 500) } catch { /* Do not render arbitrary HTML responses. */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}
export const gmailCandidateAction = (token: string, id: string, action: 'dismiss' | 'imported') =>
  gmailRequest(token, `gmail/candidates/${encodeURIComponent(id)}/action`, { action })

export type GmailOpenReason = 'candidates' | 'connected' | 'error' | 'complete'
export function gmailOpenReason(search: string): GmailOpenReason | null {
  const value = new URLSearchParams(search).get('gmail')
  return value === 'candidates' || value === 'connected' || value === 'error' || value === 'complete' ? value : null
}
/** Share the same completion promise during StrictMode effect replay; retries must be explicit. */
export function createGmailCompletion() {
  const attempts = new Map<string, Promise<unknown>>()
  return (owner: string, token: string, attempt = 0) => {
    if (!owner || !token) return Promise.reject(new Error('連携を開始した家計簿アカウントでログインしてください'))
    const key = `${owner}:${attempt}`
    const existing = attempts.get(key)
    if (existing) return existing
    const pending = gmailRequest(token, 'gmail/complete', {})
    attempts.set(key, pending)
    return pending
  }
}
export const GMAIL_COMPLETION_KEY = 'kakeibo:gmail-completion-pending'
export function gmailCompletionPending(search: string, storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  const pending = gmailOpenReason(search) === 'complete'
  try {
    if (pending) storage.setItem(GMAIL_COMPLETION_KEY, '1')
    return pending || storage.getItem(GMAIL_COMPLETION_KEY) === '1'
  } catch { return pending }
}
export function googleAuthorizationUrl(raw: string): string {
  const url = new URL(raw)
  if (url.origin !== 'https://accounts.google.com' || url.username || url.password || !url.pathname.startsWith('/o/oauth2/')) throw new Error('Googleの認証URLを確認できませんでした')
  return url.href
}
export function pushApplicationKey(encoded: string): Uint8Array<ArrayBuffer> {
  if (!/^[a-zA-Z0-9_-]{87}$/.test(encoded)) throw new Error('通知の公開鍵を確認できませんでした')
  const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '=')
  const bytes = Uint8Array.from(decoded, (value) => value.charCodeAt(0))
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('通知の公開鍵を確認できませんでした')
  return bytes
}
export const PUSH_DEVICE_KEY = 'kakeibo:push-device-v1'
export function pushDeviceId(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  const old = storage.getItem(PUSH_DEVICE_KEY)
  if (old && /^[a-zA-Z0-9_-]{16,80}$/.test(old)) return old
  const id = crypto.randomUUID()
  storage.setItem(PUSH_DEVICE_KEY, id)
  return id
}
