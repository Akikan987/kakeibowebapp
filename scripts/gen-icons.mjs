// public/icon.svg から PWA 用の PNG アイコンを生成する
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const normal = readFileSync('public/icon.svg')
const maskable = readFileSync('public/icon-maskable.svg')

const jobs = [
  [normal, 'public/icon-192.png', 192],
  [normal, 'public/icon-512.png', 512],
  [normal, 'public/apple-touch-icon.png', 180],
  [maskable, 'public/icon-maskable-512.png', 512],
]

for (const [src, out, size] of jobs) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(out)
  console.log(`generated ${out} (${size}x${size})`)
}
