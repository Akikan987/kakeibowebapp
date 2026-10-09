export const BACK_EXIT_WINDOW_MS = 2000
const STATE_KEY = 'kakeibo:back-v1'

type BackHistory = Pick<History, 'state' | 'replaceState' | 'pushState' | 'forward' | 'back'>
type Clock = {
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout: (id: number) => void
}

function marker(state: unknown): unknown {
  return state && typeof state === 'object' ? (state as Record<string, unknown>)[STATE_KEY] : null
}

function markedState(state: unknown, value: 'base' | 'guard') {
  return { ...(state && typeof state === 'object' ? state : {}), [STATE_KEY]: value }
}

/** One same-URL history pair, not one entry per tab. The second back is native. */
export function createBackNavigation({ history, clock, isHome, goHome, showExitHint }: {
  history: BackHistory
  clock: Clock
  isHome: () => boolean
  goHome: () => void
  showExitHint: (visible: boolean) => void
}) {
  let timer: number | null = null
  let restoring = false

  const clearHint = () => {
    if (timer !== null) clock.clearTimeout(timer)
    timer = null
    showExitHint(false)
  }
  const restoreGuard = () => {
    // Reuse the forward entry: pushState after popstate can make Chrome skip
    // all same-document entries until the next user activation.
    if (marker(history.state) === 'base' && !restoring) {
      restoring = true
      history.forward()
    }
  }

  return {
    start() {
      const current = marker(history.state)
      if (current === 'base') restoreGuard()
      else if (current !== 'guard') {
        history.replaceState(markedState(history.state, 'base'), '')
        history.pushState(markedState(history.state, 'guard'), '')
      }
    },
    onPopState() {
      const current = marker(history.state)
      if (current === 'guard') {
        restoring = false
        clearHint()
        return
      }
      // Never trap a different document's history or an external/hash entry.
      if (current !== 'base') return
      if (!isHome()) {
        clearHint()
        goHome()
        restoreGuard()
        return
      }
      // Stay on the base entry for two seconds. A second hardware/browser back
      // can leave normally, including when this is the first entry in a PWA.
      clearHint()
      showExitHint(true)
      timer = clock.setTimeout(() => {
        timer = null
        showExitHint(false)
        restoreGuard()
      }, BACK_EXIT_WINDOW_MS)
    },
    screenChanged() {
      clearHint()
      restoreGuard()
    },
    resume() {
      restoring = false
      clearHint()
      restoreGuard()
    },
    stop() {
      if (timer !== null) clock.clearTimeout(timer)
      timer = null
    },
    release() {
      clearHint()
      // Only when leaving the entered app in-place (e.g. logout), after the
      // listener is removed. StrictMode cleanup must not traverse history.
      if (marker(history.state) === 'guard') history.back()
    },
  }
}
