import test from 'node:test'
import assert from 'node:assert/strict'
import { prefetchScreenAssets } from '../src/screenPrefetch.ts'

function environment(options: { online?: boolean; hidden?: boolean; saveData?: boolean; effectiveType?: string } = {}) {
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const timers: (() => void)[] = []
  const links: { href: string }[] = []
  let fetches = 0
  const set = (key: string, value: unknown) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  set('navigator', { onLine: options.online ?? true, connection: options })
  set('document', {
    visibilityState: options.hidden ? 'hidden' : 'visible',
    createElement: () => ({}), head: { append: (link: { href: string }) => links.push(link) },
  })
  set('window', {
    location: { origin: 'https://example.test' },
    setTimeout: (callback: () => void) => { timers.push(callback); return timers.length },
    clearTimeout: (id: number) => { timers[id - 1] = () => {} },
  })
  set('performance', { getEntriesByName: (name: string) => name.includes('CachedScreen') ? [{}] : [] })
  set('fetch', async (_: string, init: RequestInit) => {
    fetches++
    if (init.signal?.aborted) throw new Error('aborted')
    return { ok: true, json: async () => ['assets/CachedScreen-ab.js', 'assets/AddScreen-cd.js', 'https://other.test/x.js', '../escape.js', 'assets/next.js'] }
  })
  return {
    links, fetches: () => fetches,
    async drain() {
      for (let i = 0; i < 10; i++) {
        timers.shift()?.()
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
    },
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test('省データ・低速・非表示・オフラインでは先読みしない', async () => {
  for (const options of [{ saveData: true }, { effectiveType: '3g' }, { hidden: true }, { online: false }]) {
    const env = environment(options)
    try {
      const stop = prefetchScreenAssets()
      await env.drain()
      assert.equal(env.fetches(), 0)
      assert.deepEqual(env.links, [])
      stop()
    } finally { env.restore() }
  }
})

test('先読みは同一サイトのJSに限定し、取得済み画面と不正URLを除く', async () => {
  const env = environment({ effectiveType: '4g' })
  try {
    const stop = prefetchScreenAssets()
    await env.drain()
    assert.equal(env.fetches(), 1)
    assert.deepEqual(env.links.map((link) => link.href), ['https://example.test/assets/AddScreen-cd.js', 'https://example.test/assets/next.js'])
    stop()
  } finally { env.restore() }
})

test('画面終了後の予約済み先読みを中止する', async () => {
  const env = environment()
  try {
    const stop = prefetchScreenAssets()
    stop()
    await env.drain()
    assert.equal(env.fetches(), 0)
    assert.deepEqual(env.links, [])
  } finally { env.restore() }
})
