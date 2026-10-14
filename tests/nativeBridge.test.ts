import assert from 'node:assert/strict'
import test from 'node:test'
import { isAndroidNative, nativeNotificationCommand, readNativeNotificationStatus, readNativeNotifications } from '../src/native/notifications.ts'

test('browser mode does not read notifications or request native permissions', async () => {
  assert.equal(isAndroidNative(), false)
  await assert.rejects(nativeNotificationCommand('readPending'), /Android/u)
})

test('native bridge dispatches explicit commands, correlates replies, validates data and preserves ack IDs', async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const calls: Array<Record<string, unknown>> = []
  const bridge: { postMessage: (message: string) => void; onmessage?: (event: { data: string }) => void } = {
    postMessage(message) {
      const request = JSON.parse(message) as Record<string, unknown>
      calls.push(request)
      const result = request.command === 'status' ? { available: true, enabled: true, permissionGranted: true, pendingCount: 1 } :
        request.command === 'readPending' ? { events: [{ id: 'sample-id', packageName: 'com.smbc_card.vpass', title: '利用のお知らせ', text: '利用金額：980円', postedAt: 1 }] } : { updated: true }
      queueMicrotask(() => {
        bridge.onmessage?.({ data: 'not json' })
        bridge.onmessage?.({ data: JSON.stringify({ requestId: 'unrelated', result: { unsafe: true } }) })
        bridge.onmessage?.({ data: JSON.stringify({ requestId: request.requestId, result }) })
      })
    },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { KakeiboNative: bridge } })
  try {
    assert.equal(calls.length, 0)
    assert.equal(isAndroidNative(), true)
    assert.equal((await readNativeNotificationStatus()).pendingCount, 1)
    assert.equal(calls.length, 1) // Status does not request read/enable access implicitly.
    assert.equal((await readNativeNotifications())[0].id, 'sample-id')
    await nativeNotificationCommand('ack', { ids: ['sample-id'] })
    await nativeNotificationCommand('appearance', { dark: true })
    assert.deepEqual(calls.map((call) => call.command), ['status', 'readPending', 'ack', 'appearance'])
    assert.deepEqual(calls[2].ids, ['sample-id'])
    assert.equal(calls[3].dark, true)
    assert.ok(calls.every((call) => call.version === 1 && typeof call.requestId === 'string'))
    await assert.rejects(nativeNotificationCommand('ack', { ids: ['../other'] }))
    await assert.rejects(nativeNotificationCommand('appearance'))
    await assert.rejects(nativeNotificationCommand('arbitrary-command'))
    assert.equal(calls.length, 4)
  } finally {
    if (prior) Object.defineProperty(globalThis, 'window', prior)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
