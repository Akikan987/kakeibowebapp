import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { designMotion, moneyText, pressFeedback } from '../src/design.ts'
import { glassSurface } from '../src/glass.ts'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const supports = '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))'

test('押し込みはポインター操作だけ・動きを許可した場合だけに限定する', () => {
  const style = pressFeedback()
  const motion = style['@media (prefers-reduced-motion: no-preference)'] as Record<string, unknown>
  assert.equal(style.transition, undefined)
  assert.equal(style.transform, undefined)
  assert.equal(motion.transition, `transform 120ms ${designMotion.easeOut}`)
  const selector = '&:active:not(:focus-visible):not(.Mui-focusVisible):not(.Mui-disabled):not([aria-disabled="true"])'
  assert.deepEqual(motion[selector], { transform: 'scale(0.97)' })
  assert.equal(style.touchAction, 'manipulation')
  assert.equal(style.userSelect, 'none')
  assert.ok(style['&.Mui-focusVisible, &:focus-visible'])
  assert.deepEqual((pressFeedback(0.99)['@media (prefers-reduced-motion: no-preference)'] as Record<string, unknown>)[selector], { transform: 'scale(0.99)' })
})

test('操作用のタイミングは短くし、金額の省略はしない', () => {
  assert.ok(designMotion.pressMs >= 100 && designMotion.pressMs <= 160)
  assert.ok(designMotion.enterMs < 300)
  assert.ok(designMotion.exitMs <= designMotion.enterMs)
  assert.equal(moneyText.textOverflow, undefined)
  assert.equal(moneyText.whiteSpace, undefined)
  assert.equal(moneyText.fontVariantNumeric, 'tabular-nums')
  assert.equal(moneyText.overflowWrap, 'anywhere')
})

test('カードとダイアログは不透明で、クロームだけを透過させる', () => {
  for (const dark of [true, false]) {
    const flat = glassSurface(dark)
    const panel = flat[supports] as Record<string, unknown>
    assert.equal(panel.backgroundColor, flat.backgroundColor)
    assert.equal(flat.backgroundImage, 'none')
    assert.equal(panel.backdropFilter, 'none')
    const chrome = glassSurface(dark, 20)[supports] as Record<string, unknown>
    assert.match(String(chrome.backgroundColor), /^rgba\(/)
    assert.match(String(chrome.backdropFilter), /blur\(20px\)/)
    const contrast = flat['@media (prefers-contrast: more)'] as Record<string, unknown>
    assert.equal(contrast.backgroundColor, flat.backgroundColor)
    assert.equal(contrast.backdropFilter, 'none')
    assert.equal(contrast.borderColor, dark ? '#ABB2BC' : '#68686E')
  }
})

test('拡大を許可し、Androidの単一theme-colorと安全領域を維持する', () => {
  const html = source('index.html')
  assert.doesNotMatch(html, /maximum-scale|user-scalable/)
  assert.match(html, /viewport-fit=cover/)
  assert.match(html, /interactive-widget=resizes-content/)
  assert.equal([...html.matchAll(/name="theme-color"/g)].length, 1)
  assert.match(html, /id="theme-color" name="theme-color" content="#101418"/)
  const theme = source('src/theme.tsx')
  assert.match(theme, /minWidth: 44, minHeight: 44/)
  assert.match(theme, /minHeight: 48/)
  assert.match(theme, /env\(safe-area-inset-top, 0px\)/)
  assert.match(theme, /env\(safe-area-inset-bottom, 0px\)/)
  assert.match(theme, /useMediaQuery\('\(prefers-reduced-motion: reduce\)'\)/)
  const app = source('src/App.tsx')
  assert.match(app, /minHeight: '4.5rem', height: 'auto'/)
  assert.match(app, /6.625rem \+ env\(safe-area-inset-bottom\)/)
})

test('動きを抑える設定はポータルも含めて適用し、本文のコピーを妨げない', () => {
  const css = source('src/index.css')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /animation: none !important/)
  assert.match(css, /transition-duration: 0s !important/)
  assert.match(css, /scroll-behavior: auto !important/)
  assert.match(css, /button,\s*\[role="button"\] \{[^}]*user-select: none/)
  assert.doesNotMatch(css, /body\s*\{[^}]*user-select: none/)
})

test('ダイアログの名前に閉じるボタンを含めず、MUIの見出しIDと重複しない', () => {
  const ui = source('src/components/ui.tsx')
  assert.match(ui, /aria-labelledby=\{titleId\}/)
  assert.match(ui, /<DialogTitle component="div" id=\{`\$\{titleId\}-header`\}/)
  assert.match(ui, /<Typography id=\{titleId\} component="h2"/)
  assert.match(ui, /<IconButton aria-label="閉じる" onClick=\{onClose\}/)
})

test('検証画面は開発限定で、アカウントストアやAPIを呼ばない', () => {
  const entry = source('src/main.tsx')
  assert.match(entry, /import\.meta\.env\.DEV && new URLSearchParams\(location\.search\)\.get\('design-preview'\) === '1'/)
  const preview = source('src/dev/DesignPreview.tsx')
  assert.doesNotMatch(preview, /useStore|\.\/api|fetch\(|localStorage/)
  assert.match(preview, /Demo data/)
  assert.match(preview, /Worst case/)
  // When dist exists (CI can build first), neither the preview chunk nor its label may ship.
  try {
    const assets = readdirSync(new URL('../dist/assets/', import.meta.url))
    assert.ok(!assets.some(name => name.includes('DesignPreview')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
})
