import { Browser } from '@capacitor/browser'
import { apiFetch } from './http.ts'
import { APP_ORIGIN } from './runtime.ts'
import type { Account } from '../types.ts'

const PENDING_KEY = 'kakeibo:native-pkce'
export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
export function nativeReturnId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'kakeibo-native:' || parsed.hostname !== 'auth' || !['', '/'].includes(parsed.pathname)) return null
    const id = parsed.searchParams.get('id')
    return id && /^[A-Za-z0-9_-]{32,128}$/u.test(id) ? id : null
  } catch { return null }
}
export function nativeAccount(raw: Record<string, unknown>): Account {
  if (raw.token !== 'cookie' || typeof raw.uid !== 'string' || !raw.uid || typeof raw.nickname !== 'string' || typeof raw.email !== 'string' || typeof raw.phone !== 'string') throw new Error('認証結果を確認できません')
  return { token: 'cookie', uid: raw.uid, nickname: raw.nickname, email: raw.email, phone: raw.phone,
    avatarDataUrl: typeof raw.avatar_data_url === 'string' ? raw.avatar_data_url : '',
    ...(typeof raw.email_verified === 'boolean' ? { emailVerified: raw.email_verified } : {}),
  }
}
export async function beginNativeLogin() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const response = await apiFetch('/auth/native/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge }) })
  if (!response.ok) throw new Error(response.status === 404 ? 'アプリ用認証APIがまだ公開されていません。メール・パスワードのログインは利用できます。' : 'ブラウザー認証を開始できませんでした')
  const value = await response.json() as { id: string; url: string; expires_at: number }
  const url = new URL(value.url)
  if (url.origin !== APP_ORIGIN || url.pathname !== '/' || url.searchParams.get('native_request') !== value.id || !/^[A-Za-z0-9_-]{32,128}$/u.test(value.id)) throw new Error('認証の接続先を確認できませんでした')
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id: value.id, verifier, expires: value.expires_at }))
  await Browser.open({ url: value.url })
}
let exchanging: Promise<unknown> | null = null
export async function completeNativeLogin(returnedId?: string) {
  if (exchanging) return exchanging
  const raw = sessionStorage.getItem(PENDING_KEY)
  if (!raw) return null
  const flow = JSON.parse(raw) as { id: string; verifier: string; expires: number }
  if (returnedId && returnedId !== flow.id) throw new Error('この端末で開始した認証ではありません')
  if (Date.now() >= flow.expires) { sessionStorage.removeItem(PENDING_KEY); throw new Error('認証の期限が切れました。もう一度開始してください') }
  exchanging = (async () => {
    const response = await apiFetch('/auth/native/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: flow.id, verifier: flow.verifier }) })
    if (response.status === 202) return null
    if (!response.ok) throw new Error('アプリへのログインを完了できませんでした。ブラウザーで許可した後、もう一度お試しください')
    sessionStorage.removeItem(PENDING_KEY)
    return nativeAccount(await response.json() as Record<string, unknown>)
  })().finally(() => { exchanging = null })
  return exchanging
}
export const openAccountInBrowser = () => Browser.open({ url: `${APP_ORIGIN}/?native_manage=1` })
