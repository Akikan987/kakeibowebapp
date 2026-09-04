import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import sharp from 'sharp'
import { CARD_PRESETS } from '../src/cardPresets.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const publicRoot = resolve(root, 'public')
const pagePath = resolve(publicRoot, 'pr/index.html')
const html = await readFile(pagePath, 'utf8')
const css = await readFile(resolve(publicRoot, 'pr/styles.css'), 'utf8')
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert.equal(ids.length, new Set(ids).size, 'IDs must be unique')
assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'One primary heading')
const voidTags = new Set(['meta', 'link', 'img', 'br', 'hr', 'input', 'source'])
const stack = []
for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
  const [, closing, rawName] = match
  const name = rawName.toLowerCase()
  if (voidTags.has(name)) continue
  if (!closing) stack.push(name)
  else assert.equal(stack.pop(), name, 'Balanced HTML tag: ' + name)
}
assert.equal(stack.length, 0, 'All HTML elements closed')
for (const page of ['index.html', 'social-og.html', 'social-square.html', 'install.html']) {
  const file = resolve(publicRoot, 'pr', page)
  const content = await readFile(file, 'utf8')
  const pageIds = [...content.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(pageIds.length, new Set(pageIds).size, page + ': unique IDs')
  if (page === 'index.html' || page === 'install.html') assert.equal((content.match(/<h1\b/g) ?? []).length, 1, page + ': one primary heading')
  const pageStack = []
  for (const [, closing, rawName, ending] of content.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)) {
    const name = rawName.toLowerCase()
    if (voidTags.has(name) || ending === '/') continue
    if (!closing) pageStack.push(name)
    else assert.equal(pageStack.pop(), name, page + ': balanced element ' + name)
  }
  assert.equal(pageStack.length, 0, page + ': all elements closed')
  for (const [, value] of content.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (value.startsWith('#')) { assert(pageIds.includes(value.slice(1)), page + ': anchor ' + value); continue }
    if (/^https?:/.test(value)) continue
    const local = value.split(/[?#]/)[0]
    await access(local.startsWith('/') ? resolve(publicRoot, '.' + local) : resolve(dirname(file), local))
  }
}
const ctas = [...html.matchAll(/<a\b[^>]*class="[^"]*\bbutton\b[^"]*"[^>]*>/g)]
assert.equal(ctas.length, 3)
for (const [tag] of ctas) assert(tag.includes('href="https://app.kakeibodata.com/"'), 'CTA targets public app')
for (const text of ['月間予算', '定期項目は自動登録ではありません', '引き落としカレンダー', '確定請求額', '円グラフ', 'CSV', 'ログインとオンライン接続', '実際の画面・利用データとは異なります']) {
  assert(html.includes(text), 'Required feature or caveat: ' + text)
}
assert(!html.includes('1タップで記録'))
assert(!html.includes('kakeibo-hero.png'))
for (const internalContent of ['家計簿を紹介する', 'SNSで使える紹介画像', 'media-section', 'media-title', 'PNGを保存', 'download=']) {
  assert(!html.includes(internalContent), 'Internal asset-distribution section removed: ' + internalContent)
}
assert(html.includes('content="light"'))
const presetCount = CARD_PRESETS.length
assert(html.includes(presetCount + '件のカード候補'), 'Card candidate count agrees with source')
const cssResult = transformSync(css, { loader: 'css', minify: true })
assert.equal(cssResult.warnings.length, 0, 'CSS parses without warnings')
const guide = await readFile(resolve(publicRoot, 'pr/install.html'), 'utf8')
const guideCss = await readFile(resolve(publicRoot, 'pr/install.css'), 'utf8')
assert.equal(transformSync(guideCss, { loader: 'css', minify: true }).warnings.length, 0)
assert.equal((guide.match(/class="step-number"/g) ?? []).length, 8, 'Four steps per platform')
assert.equal((guide.match(/role="img"/g) ?? []).length, 8, 'Eight labelled instructional diagrams')
for (const copy of ['Google Chrome', 'Safari', 'Webアプリとして開く', 'アクションを編集', 'この説明ページではなく', '実際のスクリーンショットではありません', 'バックアップではありません']) {
  assert(guide.includes(copy), 'Installation guide: ' + copy)
}
assert(!guide.includes('rel="manifest"'), 'Do not install the guide itself')
assert.equal((html.match(/href="\.\/install.html"/g) ?? []).length, 3, 'Guide available from navigation, hero and start section')
for (const [, tag] of guide.matchAll(/(<a\b[^>]*target="_blank"[^>]*>)/g)) assert(tag.includes('rel="noopener"'))
for (const [file, width, height] of [
  ['og.png', 1200, 630],
  ['pr/assets/social-og-20260904.png', 1200, 630],
  ['pr/assets/social-square-20260904.png', 1080, 1080],
  ['pr/assets/social-og-20260904.webp', 1200, 630],
  ['pr/assets/social-square-20260904.webp', 1080, 1080],
]) {
  const metadata = await sharp(resolve(publicRoot, file)).metadata()
  assert.equal(metadata.width, width, file)
  assert.equal(metadata.height, height, file)
  assert.equal(metadata.format, file.endsWith('.webp') ? 'webp' : 'png', file)
}
console.log('PR checks passed: HTML structure, local links/assets, 3 app CTAs, current feature copy, card count, CSS syntax, 5 image sizes/formats, installation guide with 8 diagrams and 3 entry links.')
