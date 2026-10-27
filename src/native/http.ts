import { CapacitorHttp, type HttpOptions } from '@capacitor/core'
import { APP_ORIGIN, isHybridNative } from './runtime.ts'

/** Only the existing first-party API may receive the native cookie session. */
export function nativeApiUrl(path: string) {
  if (!/^\/(?:auth|sync|users|ocr|health|integrations)(?:\/|\?|$)/u.test(path) || /[\\\r\n]/u.test(path)) {
    throw new Error('対応していないAPIです')
  }
  const url = new URL(path, APP_ORIGIN)
  if (url.origin !== APP_ORIGIN || /(?:^|\/)\.\.(?:\/|$)/u.test(decodeURIComponent(path))) throw new Error('APIの接続先を確認できません')
  return url.href
}

export async function nativeRequestOptions(path: string, options: RequestInit): Promise<HttpOptions> {
  const original = new Headers(options.headers)
  original.set('Origin', APP_ORIGIN)
  original.set('X-Kakeibo-Session', 'cookie')
  const headers = Object.fromEntries(original.entries())
  let data: unknown = options.body
  let dataType: 'formData' | undefined
  if (options.body instanceof FormData) {
    const fields: Record<string, unknown>[] = []
    for (const [key, value] of options.body.entries()) {
      if (typeof value === 'string') fields.push({ key, value, type: 'string' })
      else {
        if (value.size > 8 * 1024 * 1024) throw new Error('画像は8MB以下にしてください')
        const bytes = new Uint8Array(await value.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
        fields.push({ key, value: btoa(binary), type: 'base64File', fileName: 'receipt.' + (value.type === 'image/png' ? 'png' : value.type === 'image/webp' ? 'webp' : 'jpg'), contentType: value.type })
      }
    }
    data = fields
    dataType = 'formData'
    headers['Content-Type'] = 'multipart/form-data'
  } else if (typeof data === 'string' && headers['content-type']?.includes('application/json')) data = JSON.parse(data)
  return { url: nativeApiUrl(path), method: options.method ?? 'GET', headers, data, dataType, responseType: 'text', connectTimeout: 15000, readTimeout: 120000, disableRedirects: true }
}

/** Native HTTP preserves HttpOnly cookies without weakening Web CORS/CSRF rules. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!isHybridNative()) return fetch(path, options)
  const result = await CapacitorHttp.request(await nativeRequestOptions(path, options))
  const headers = new Headers()
  for (const [key, value] of Object.entries(result.headers)) {
    if (!['set-cookie', 'set-cookie2'].includes(key.toLowerCase())) headers.set(key, value)
  }
  return new Response(result.status === 204 ? null : typeof result.data === 'string' ? result.data : JSON.stringify(result.data), { status: result.status, headers })
}
