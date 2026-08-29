const AVATAR_SIZE = 320
const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_ENCODED_LENGTH = 380_000
const SOURCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/** 選んだ画像を中央で正方形に切り抜き、同期向けの小さなJPEGにする。 */
export async function prepareAvatar(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('画像は10MB以下にしてください')
  }
  if (!SOURCE_TYPES.has(file.type.toLowerCase())) {
    throw new Error('JPEG・PNG・WebP・HEIC画像を選んでください')
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  try {
    image.src = objectUrl
    await image.decode()
  } catch {
    URL.revokeObjectURL(objectUrl)
    throw new Error('この画像を読み込めませんでした。JPEGまたはPNGで試してください')
  }

  try {
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const sourceX = (image.naturalWidth - side) / 2
    const sourceY = (image.naturalHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('画像を処理できませんでした')
    context.fillStyle = '#F7F9FC'
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    context.drawImage(
      image,
      sourceX,
      sourceY,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
    const dataUrl = canvas.toDataURL('image/jpeg', 0.84)
    if (dataUrl.length > MAX_ENCODED_LENGTH) {
      throw new Error('プロフィール画像を小さくできませんでした')
    }
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
