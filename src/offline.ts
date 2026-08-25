import { registerSW } from 'virtual:pwa-register'

/**
 * オフライン対応の初期化。
 * - Service Worker を登録し、アプリ本体を端末に保存する（サーバーが止まっていても起動できる）
 * - 保存領域を「永続」に昇格させ、ブラウザの自動削除を受けにくくする
 */
export function setupOffline() {
  // 新しい版が出たら自動で取り込む
  registerSW({ immediate: true })

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
