import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAppShortcut } from '../src/shortcuts.ts'

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
