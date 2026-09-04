import sharp from 'sharp'
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('../', import.meta.url))
const [landscape, square] = process.argv.slice(2)
if (!landscape || !square) throw new Error('Usage: node scripts/prepare-pr-images.mjs LANDSCAPE SQUARE')
const assets = resolve(project, 'public/pr/assets')
for (const [source, name, width, height] of [
  [landscape, 'social-og', 1200, 630],
  [square, 'social-square', 1080, 1080],
]) {
  const png = resolve(assets, name + '-20260904.png')
  await sharp(source).resize(width, height, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(png)
  await sharp(png).webp({ quality: 88 }).toFile(resolve(assets, name + '-20260904.webp'))
  await copyFile(png, resolve(assets, name + '.png'))
  if (name === 'social-og') await copyFile(png, resolve(project, 'public/og.png'))
  console.log(name + ': ' + width + '×' + height)
}
