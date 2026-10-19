import assert from 'node:assert/strict'
import test from 'node:test'
import { registerModalBackHandler, requestSectionBack, SECTION_BACK_EVENT } from '../src/sectionNavigation.ts'

test('一覧や画面のアンマウント後は内部戻るを消費しない', () => {
  const target = new EventTarget()
  assert.equal(requestSectionBack(target), false)
  const handler = (event: Event) => event.preventDefault()
  target.addEventListener(SECTION_BACK_EVENT, handler)
  assert.equal(requestSectionBack(target), true)
  target.removeEventListener(SECTION_BACK_EVENT, handler)
  assert.equal(requestSectionBack(target), false)
})

test('内部戻るはキャンセル可能な専用イベントだけを通知する', () => {
  const target = new EventTarget()
  let calls = 0
  target.addEventListener(SECTION_BACK_EVENT, (event) => { calls++; assert.equal(event.cancelable, true) })
  assert.equal(requestSectionBack(target), false)
  assert.equal(calls, 1)
})

test('ダイアログの戻るは画面より優先し、入れ子の最前面から閉じる', () => {
  const target = new EventTarget()
  let pages = 0, first = 0, second = 0
  target.addEventListener(SECTION_BACK_EVENT, () => { pages++ })
  const removeFirst = registerModalBackHandler(() => { first++ })
  const removeSecond = registerModalBackHandler(() => { second++ })
  try {
    assert.equal(requestSectionBack(target), true)
    assert.equal(second, 1)
    assert.equal(first, 0)
    assert.equal(pages, 0)
    removeSecond()
    requestSectionBack(target)
    assert.equal(first, 1)
    assert.equal(pages, 0)
  } finally { removeFirst(); removeSecond() }
  assert.equal(requestSectionBack(target), false)
  assert.equal(pages, 1)
})

test('StrictModeの二重解除でも他のダイアログの戻る処理を消さない', () => {
  const target = new EventTarget()
  let calls = 0
  const removeOld = registerModalBackHandler(() => {})
  removeOld(); removeOld()
  const removeNew = registerModalBackHandler(() => { calls++ })
  try { removeOld(); assert.equal(requestSectionBack(target), true); assert.equal(calls, 1) }
  finally { removeNew() }
})
