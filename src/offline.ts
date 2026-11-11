/**
 * 壊れたアプリ本体のキャッシュだけを捨てて再取得する。
 * ログイン情報（localStorage）と家計簿データ（IndexedDB）は保持する。
 */
export async function refreshAppShell() {
  if (!navigator.onLine) throw new Error('オフライン中は更新できません')

  const registration = await navigator.serviceWorker?.getRegistration?.('/')
  await registration?.unregister()

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('workbox-precache'))
        .map((name) => caches.delete(name)),
    )
  }

  window.location.reload()
}

/**
 * オフライン対応の初期化。
 * - Service Worker を登録し、アプリ本体を端末に保存する（サーバーが止まっていても起動できる）
 * - 新版を自動で確認し、開いている画面がなくなった時点でブラウザが新版に切り替える
 * - 保存領域を「永続」に昇格させ、ブラウザの自動削除を受けにくくする
 */
export function setupOffline() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    void navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(__APP_BUILD_ID__)}`, {
        scope: '/',
        updateViaCache: 'none',
      })
      .then((registration) => {
        const check = () => {
          if (navigator.onLine && !registration.installing) {
            void registration.update().catch(() => { /* 接続が戻ったときに再試行する。 */ })
          }
        }
        check()
        // 1時間ごと、およびアプリに戻ってきたタイミングで確認する
        setInterval(check, 60 * 60 * 1000)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
        window.addEventListener('online', check)
      })
      .catch(() => {
        // オフライン起動時など、登録できない場合は次回起動時に再試行する
      })
  }

  // デプロイの境目で古い画面が削除済みの分割JSを要求した場合も、
  // ユーザーデータは残したままアプリ本体だけを取り直す。
  window.addEventListener('vite:preloadError', (event) => {
    if (!navigator.onLine) return
    event.preventDefault()
    void refreshAppShell()
  })

  // ブラウザによる自動削除を防ぐ（許可されるかは環境次第）
  if (navigator.storage?.persist) {
    void navigator.storage
      .persisted()
      .then((already) => (already ? true : navigator.storage.persist()))
      .catch(() => false)
  }
}

/** 保存領域の状態（設定画面での表示用） */
export async function storageStatus(): Promise<{
  persisted: boolean
  usageMb: number | null
}> {
  let persisted = false
  let usageMb: number | null = null
  try {
    persisted = (await navigator.storage?.persisted?.()) ?? false
    const est = await navigator.storage?.estimate?.()
    if (est?.usage != null) usageMb = Math.round((est.usage / 1048576) * 10) / 10
  } catch {
    /* 取得できない環境では表示しない */
  }
  return { persisted, usageMb }
}
