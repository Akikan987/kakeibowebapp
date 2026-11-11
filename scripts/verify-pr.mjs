import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
    if (/^(https?:|mailto:)/.test(value)) continue
    const local = value.split(/[?#]/)[0]
    await access(local.startsWith('/') ? resolve(publicRoot, '.' + local) : resolve(dirname(file), local))
  }
}
const ctas = [...html.matchAll(/<a\b[^>]*class="[^"]*\bbutton\b[^"]*"[^>]*>/g)]
assert.equal(ctas.length, 4)
for (const [tag] of ctas) assert(tag.includes('href="https://app.kakeibodata.com/"'), 'CTA targets public app')
for (const text of ['月間予算', '定期項目は自動登録ではありません', '引き落としカレンダー', '確定請求額', '円グラフ', 'CSV', 'ログインとオンライン接続']) {
  assert(html.includes(text), 'Required feature or caveat: ' + text)
}
assert(!html.includes('1タップで記録'))
assert(!html.includes('kakeibo-hero.png'))
for (const internalContent of ['家計簿を紹介する', 'SNSで使える紹介画像', 'media-section', 'media-title', 'PNGを保存', 'download=']) {
  assert(!html.includes(internalContent), 'Internal asset-distribution section removed: ' + internalContent)
}
assert(html.includes('name="color-scheme" content="light dark"'))
assert(css.includes('@media(prefers-color-scheme:dark)'), 'Automatic dark palette')
for (const scheme of ['light', 'dark']) assert(html.includes('media="(prefers-color-scheme: ' + scheme + ')"'), 'Theme color and screenshots support ' + scheme)
assert(html.includes('<details class="mobile-menu">'), 'Native mobile navigation')
assert(html.includes('aria-label="ページ内メニュー"'), 'Mobile navigation has an accessible label')
assert(!/<script\b(?![^>]*\bsrc=)|\son[a-z]+\s*=/i.test(html), 'No inline scripts or handlers')
assert.equal((html.match(/<script\b/g) ?? []).length, 1, 'Only the local menu behavior script')
assert(html.includes('<script src="./menu.js?v=20261111" defer></script>'))
assert(css.includes('min-height:44px'), 'Touch targets remain at least 44px')
for (const id of ['pricing', 'faq', 'gmail']) assert(ids.includes(id), 'Information section: ' + id)
assert(html.includes('アカウントなしで使う'), 'Entry label agrees with app')
const screenNames = ['overview', 'budget', 'payments', 'history', 'split']
const pictures = [...html.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/g)]
assert.equal(pictures.length, screenNames.length, 'Five actual application captures')
for (const [index, name] of screenNames.entries()) {
  const markup = pictures[index][1]
  for (const scheme of ['light', 'dark']) {
    const file = 'screen-20261111-' + name + '-' + scheme + '.webp'
    assert(markup.includes(file), name + ': ' + scheme + ' screenshot source')
    const metadata = await sharp(resolve(publicRoot, 'pr/assets', file)).metadata()
    assert.equal(metadata.format, 'webp', file)
    assert.equal(metadata.width, 780, file)
    assert.equal(metadata.height, 1640, file)
  }
  const img = markup.match(/<img\b[^>]*>/)?.[0] ?? ''
  assert(/alt="[^"]+"/.test(img), name + ': descriptive alternative text')
  assert(img.includes('width="780"') && img.includes('height="1640"'), name + ': reserved layout dimensions')
  assert(img.includes('decoding="async"'), name + ': asynchronous decoding')
  if (name === 'overview') assert(img.includes('fetchpriority="high"'), 'Hero prioritized')
  else assert(img.includes('loading="lazy"'), name + ': below-fold loading')
}

// Fixed hashes protect the original Gmail paragraphs, including restriction/review caveats.
// They are independent of the current commit and deliberately fail on copy changes.
const gmailDetails = html.match(/<details class="info-detail gmail-detail">([\s\S]*?)<\/details>/)?.[1] ?? ''
const gmailParagraphHashes = [...gmailDetails.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) => createHash('sha256').update(match[1].replace(/\s+/g, ' ').trim()).digest('hex'))
assert.deepEqual(gmailParagraphHashes, ["bf10aab9b4facfdde1dc35238a534ef517261584c1e867d331a34e31489c10e3","ee213d78d75fc57332163622596ca6dfad9d94756ab95a9eeaec93902c73e8fa"], 'Original Gmail content preserved verbatim')
assert(html.includes('運営者が承認した少数の利用者に限って試験提供'), 'Gmail remains limited trial access')
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
assert((html.match(/href="\.\/install.html"/g) ?? []).length >= 3, 'Guide available from navigation, hero and start section')
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
console.log('PR checks passed: HTML structure, local links/assets, 4 app CTAs, current feature copy, card count, CSS syntax, 15 image sizes/formats, installation guide with 8 diagrams and mobile navigation.')
