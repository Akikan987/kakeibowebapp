import assert from 'node:assert/strict'
import test from 'node:test'
import { BACK_EXIT_WINDOW_MS, createBackNavigation } from '../src/backNavigation.ts'

function setup(screen = 'home', external = true) {
  const entries: unknown[] = external ? [{ external: true }, { otherState: 42 }] : [{ otherState: 42 }]
  let index = entries.length - 1
  let time = 0
  let nextTimer = 0
  let forwardPending = false
  let hint = false
  let exits = 0
  const timers = new Map<number, { at: number; callback: () => void }>()
  const history = {
    get state() { return entries[index] },
    replaceState(state: unknown) { entries[index] = state },
    pushState(state: unknown) { entries.splice(index + 1); entries.push(state); index++ },
    forward() { forwardPending = true },
    back() { if (index > 0) index-- },
  }
  const controller = createBackNavigation({
    history,
    clock: {
      setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { at: time + delay, callback }); return id },
      clearTimeout(id) { timers.delete(id) },
    },
    isHome: () => screen === 'home',
    goHome() { screen = 'home' },
    showExitHint(visible) { hint = visible },
  })
  const flush = () => {
    if (forwardPending && index < entries.length - 1) {
      forwardPending = false
      index++
      controller.onPopState()
    }
  }
  return {
    controller, history, entries,
    get screen() { return screen }, get hint() { return hint }, get exits() { return exits },
    get timerCount() { return timers.size }, get index() { return index },
    flush,
    back() {
      if (index === 0) { exits++; return } // Installed PWA root: native back closes.
      index--
      if ((entries[index] as Record<string, unknown>).external) exits++
      else controller.onPopState()
    },
    changeScreen(next: string) { screen = next; controller.screenChanged(); flush() },
    tick(ms: number) {
      time += ms
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) { timers.delete(id); timer.callback() }
      }
      flush()
    },
  }
}

test('どの他画面からも戻る1回で収支へ戻り、履歴を増やさない', () => {
  for (const screen of ['planning', 'list', 'payments', 'split', 'settings', 'add']) {
    const app = setup(screen)
    app.controller.start()
    app.back(); app.flush()
    assert.equal(app.screen, 'home')
    assert.equal(app.hint, false)
    assert.equal(app.exits, 0)
    assert.equal(app.entries.length, 3)
    app.back()
    assert.equal(app.hint, true) // Returning home does not count as exit press 1.
    app.back()
    assert.equal(app.exits, 1)
  }
})

test('収支での1回目は案内、2秒以内の2回目は外部の履歴へ戻れる', () => {
  const app = setup()
  app.controller.start(); app.back()
  assert.equal(app.screen, 'home')
  assert.equal(app.hint, true)
  assert.equal(app.exits, 0)
  app.tick(BACK_EXIT_WINDOW_MS - 1); app.back()
  assert.equal(app.exits, 1)
})

test('PWAの最初の履歴でも2回目はOSの戻るに委ね、3回目を要求しない', () => {
  const app = setup('home', false)
  app.controller.start(); app.back()
  assert.equal(app.exits, 0)
  assert.equal(app.hint, true)
  app.back()
  assert.equal(app.exits, 1)
})

test('2秒を過ぎると再び1回目から、期限切れでも履歴を追加しない', () => {
  const app = setup()
  app.controller.start()
  for (let i = 0; i < 5; i++) {
    app.back()
    assert.equal(app.hint, true)
    app.tick(BACK_EXIT_WINDOW_MS)
    assert.equal(app.hint, false)
    assert.equal(app.entries.length, 3)
    assert.equal(app.exits, 0)
  }
})

test('終了待ちでタブを変えたらリセットし、次の戻るは収支へ', () => {
  const app = setup()
  app.controller.start(); app.back(); app.changeScreen('payments')
  assert.equal(app.hint, false)
  assert.equal(app.timerCount, 0)
  app.back(); app.flush()
  assert.equal(app.screen, 'home')
  assert.equal(app.exits, 0)
  app.back()
  assert.equal(app.hint, true)
})

test('StrictMode再設定や再読込でも履歴は一組だけ、他のstateを維持', () => {
  const app = setup()
  app.controller.start(); app.controller.stop(); app.controller.start()
  assert.equal(app.entries.length, 3)
  assert.equal(app.history.state.otherState, 42)
  app.back(); app.controller.stop()
  assert.equal(app.timerCount, 0)
  app.controller.start(); app.flush()
  assert.equal(app.entries.length, 3)
  assert.equal(app.hint, false)
})

test('BFCache復帰時は終了待ちを解除し、既存の履歴へ戻す', () => {
  const app = setup()
  app.controller.start(); app.back(); app.controller.resume(); app.flush()
  assert.equal(app.hint, false)
  assert.equal(app.timerCount, 0)
  assert.equal(app.entries.length, 3)
  app.back()
  assert.equal(app.hint, true)
})

test('関係ない履歴は捕捉しない', () => {
  const app = setup('payments')
  app.controller.onPopState()
  assert.equal(app.screen, 'payments')
  assert.equal(app.hint, false)
  assert.equal(app.timerCount, 0)
})

test('ログアウトではガードを解放し、認証画面で余分な戻るを要求しない', () => {
  const app = setup()
  app.controller.start(); app.controller.stop(); app.controller.release()
  assert.equal(app.index, 1)
  assert.equal(app.hint, false)
  app.controller.release() // Double effect setup must not go back twice.
  assert.equal(app.index, 1)
  app.back()
  assert.equal(app.exits, 1)
})
