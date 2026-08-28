import { registerSW } from 'virtual:pwa-register'

/**
 * オフライン対応の初期化。
 * - Service Worker を登録し、アプリ本体を端末に保存する（サーバーが止まっていても起動できる）
 * - 新しい版が出ていないか定期的に確認する（更新が届かないまま古い画面が残るのを防ぐ）
 * - 保存領域を「永続」に昇格させ、ブラウザの自動削除を受けにくくする
 */
export function setupOffline() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      // 1時間ごと、およびアプリに戻ってきたタイミングで確認する
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
    },
    onNeedRefresh() {
      // 新しい版があればすぐ取り込む
      void updateSW(true)
    },
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
