import test from 'node:test'
import assert from 'node:assert/strict'
import { glassBackdrop, glassSurface } from '../src/glass.ts'

const supports = '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))'

test('ガラス面は未対応ブラウザで不透明、カード群にはぼかしを重ねない', () => {
  for (const dark of [false, true]) {
    const panel = glassSurface(dark)
    assert.equal(panel.backgroundColor, dark ? '#1C2026' : '#FFFFFF')
    assert.equal((panel[supports] as Record<string, unknown>).backdropFilter, 'none')
    const chrome = glassSurface(dark, 24)
    const supported = chrome[supports] as Record<string, unknown>
    assert.equal(supported.backdropFilter, 'blur(24px) saturate(135%)')
    assert.equal(supported.WebkitBackdropFilter, supported.backdropFilter)
  }
})

test('透明度を抑える設定と強制配色では透過・ぼかし・装飾を無効にする', () => {
  for (const dark of [false, true]) {
    const surface = glassSurface(dark, 24)
    const reduced = surface['@media (prefers-reduced-transparency: reduce)'] as Record<string, unknown>
    assert.equal(reduced.backgroundColor, dark ? '#1C2026' : '#FFFFFF')
    assert.equal(reduced.backdropFilter, 'none')
    assert.equal(reduced.backgroundImage, 'none')
    const forced = surface['@media (forced-colors: active)'] as Record<string, unknown>
    assert.equal(forced.backgroundColor, 'Canvas')
    assert.equal(forced.borderColor, 'CanvasText')
    assert.equal(forced.WebkitBackdropFilter, 'none')
  }
})

test('背景の光は固定のCSS装飾のみで入力やスクロールを妨げない', () => {
  const backdrop = glassBackdrop(true)
  assert.equal(backdrop.pointerEvents, 'none')
  assert.equal(backdrop.position, 'fixed')
  assert.equal(backdrop.zIndex, -1)
  assert.equal(backdrop.animation, undefined)
})
