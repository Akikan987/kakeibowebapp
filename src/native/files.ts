import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isHybridNative } from './runtime.ts'

let sharing = false
export async function clearNativeExports() {
  if (isHybridNative() && !sharing) await Filesystem.rmdir({ directory: Directory.Cache, path: 'exports', recursive: true }).catch(() => undefined)
}

export async function exportFile(text: string, filename: string, mime: string) {
  if (!isHybridNative()) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = filename; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  if (sharing) throw new Error('保存・共有が進行中です')
  await clearNativeExports()
  sharing = true
  const path = `exports/${filename}`
  try {
    const file = await Filesystem.writeFile({ directory: Directory.Cache, path, data: text, encoding: Encoding.UTF8, recursive: true })
    await Share.share({ title: '家計簿バックアップ', files: [file.uri], dialogTitle: 'バックアップを保存・共有' })
  } finally { sharing = false }
  // The recipient can read asynchronously after the chooser closes. Clear this private cache
  // on the next export, cold start, or logout, rather than invalidating its content URI here.
}
