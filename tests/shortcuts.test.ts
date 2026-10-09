import assert from 'node:assert/strict'
import test from 'node:test'
import { clearAppShortcutFromUrl, parseAppShortcut } from '../src/shortcuts.ts'

test('PWAショートカットの種類をURLから読み取る', () => {
  assert.equal(parseAppShortcut('?shortcut=add-expense'), 'add-expense')
  assert.equal(parseAppShortcut('?shortcut=add-income'), 'add-income')
  assert.equal(parseAppShortcut('?shortcut=withdrawals'), 'withdrawals')
})

test('未対応または不正なショートカットを無視する', () => {
  assert.equal(parseAppShortcut(''), null)
  assert.equal(parseAppShortcut('?shortcut=unknown'), null)
  assert.equal(parseAppShortcut('?shortcut=add-expense%26admin=true'), null)
})

test('ショートカットURLを消しても戻る制御の履歴stateと他のURL情報を保持', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const state = { 'kakeibo:back-v1': 'guard', other: 42 }
  let replaced: unknown[] | null = null
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { href: 'https://example.test/?shortcut=add-expense&keep=1#section' },
    history: { state, replaceState(...args: unknown[]) { replaced = args } },
  } })
  try {
    clearAppShortcutFromUrl()
    assert.deepEqual(replaced, [state, '', '/?keep=1#section'])
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
