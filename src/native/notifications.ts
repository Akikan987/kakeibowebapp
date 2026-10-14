/** Optional Android bridge. Nothing is collected/read just by importing this module. */
export interface NativeNotificationEvent {
  id: string
  packageName: string
  title: string
  text: string
  postedAt: number
}

export interface NativeNotificationStatus {
  available: boolean
  enabled: boolean
  permissionGranted: boolean
  pendingCount: number
}

interface NativeBridge {
  postMessage: (message: string) => void
  onmessage?: (event: { data: string }) => void
}

declare global { interface Window { KakeiboNative?: NativeBridge } }

const sourcePackages = new Set(['jp.co.smbc.direct', 'com.smbc_card.vpass'])
export const isAndroidNative = () => typeof window !== 'undefined' && typeof window.KakeiboNative?.postMessage === 'function'

/** Validate native data as strictly as imported text; never render raw HTML or follow links. */
export function notificationEvents(value: unknown): NativeNotificationEvent[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error('通知の一覧を確認できませんでした')
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('通知データが壊れています')
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) ||
        typeof row.packageName !== 'string' || !sourcePackages.has(row.packageName) ||
        typeof row.title !== 'string' || row.title.length > 256 ||
        typeof row.text !== 'string' || row.text.length > 2000 ||
        typeof row.postedAt !== 'number' || !Number.isSafeInteger(row.postedAt) || row.postedAt <= 0) {
      throw new Error('対応していない通知データです')
    }
    return { id: row.id, packageName: row.packageName, title: row.title, text: row.text, postedAt: row.postedAt }
  })
}

export function notificationStatus(value: unknown): NativeNotificationStatus {
  if (!value || typeof value !== 'object') throw new Error('Androidアプリの状態を取得できませんでした')
  const row = value as Record<string, unknown>
  if (typeof row.available !== 'boolean' || typeof row.enabled !== 'boolean' ||
      typeof row.permissionGranted !== 'boolean' || typeof row.pendingCount !== 'number' ||
      !Number.isSafeInteger(row.pendingCount) || row.pendingCount < 0 || row.pendingCount > 50) {
    throw new Error('Androidアプリを更新して再試行してください')
  }
  return { available: row.available, enabled: row.enabled, permissionGranted: row.permissionGranted, pendingCount: row.pendingCount }
}

const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
let bound: NativeBridge | undefined
const commands = new Set(['status', 'enable', 'disable', 'openNotificationSettings', 'readPending', 'ack', 'appearance'])

export function nativeNotificationCommand(command: string, extra: { ids?: string[]; dark?: boolean } = {}): Promise<unknown> {
  const bridge = typeof window !== 'undefined' ? window.KakeiboNative : undefined
  if (!bridge || !commands.has(command)) return Promise.reject(new Error('Androidアプリ版で利用できます'))
  if (pending.size >= 10) return Promise.reject(new Error('処理が混み合っています。少し待ってください'))
  if (command === 'ack' && (!extra.ids || extra.ids.length > 50 || extra.ids.some((id) => !/^[A-Za-z0-9_-]{1,128}$/.test(id)))) {
    return Promise.reject(new Error('通知IDを確認できませんでした'))
  }
  if (command === 'appearance' && typeof extra.dark !== 'boolean') return Promise.reject(new Error('表示テーマを確認できませんでした'))
  if (bound !== bridge) {
    bound = bridge
    bridge.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data.length > 500_000) return
      try {
        const reply = JSON.parse(event.data) as { requestId?: unknown; error?: unknown; result?: unknown }
        if (typeof reply.requestId !== 'string') return
        const request = pending.get(reply.requestId)
        if (!request) return
        clearTimeout(request.timer)
        pending.delete(reply.requestId)
        if (typeof reply.error === 'string') request.reject(new Error(reply.error.slice(0, 300)))
        else request.resolve(reply.result)
      } catch { /* Ignore invalid or unrelated messages. */ }
    }
  }
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    // Permission/disclosure is deliberately interactive and may take longer than a network request.
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Androidからの応答がありません。画面を開き直してください')) }, 120_000)
    pending.set(requestId, { resolve, reject, timer })
    try { bridge.postMessage(JSON.stringify({ version: 1, command, requestId, ...extra })) }
    catch { clearTimeout(timer); pending.delete(requestId); reject(new Error('Androidアプリとの接続に失敗しました')) }
  })
}

export const readNativeNotificationStatus = async () => notificationStatus(await nativeNotificationCommand('status'))
export const readNativeNotifications = async () => {
  const result = await nativeNotificationCommand('readPending') as { events?: unknown }
  return notificationEvents(result?.events)
}
