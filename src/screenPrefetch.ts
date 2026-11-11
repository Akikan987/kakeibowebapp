const ASSET_PATH = /^assets\/[A-Za-z0-9_-]+\.js$/

function canPrefetch() {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  return navigator.onLine && document.visibilityState === 'visible' && !connection?.saveData
    && (!connection?.effectiveType || connection.effectiveType === '4g')
}

/** Warm HTTP caches without executing optional screens or interfering with lazy imports. */
export function prefetchScreenAssets() {
  const controller = new AbortController()
  let idle: number | undefined
  let timer: number | undefined

  const schedule = (callback: () => void, delay: number) => {
    timer = window.setTimeout(() => {
      if (!canPrefetch() || controller.signal.aborted) return
      if (window.requestIdleCallback) idle = window.requestIdleCallback(callback)
      else callback()
    }, delay)
  }

  schedule(() => {
    void fetch('/screen-assets.json', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return
      const manifest: unknown = await response.json()
      if (!Array.isArray(manifest)) return
      const assets = manifest.filter((entry): entry is string => typeof entry === 'string' && ASSET_PATH.test(entry))
      const warmNext = () => {
        const asset = assets.shift()
        if (!asset || controller.signal.aborted || !canPrefetch()) return
        const href = new URL(asset, window.location.origin).href
        if (!performance.getEntriesByName(href, 'resource').length) {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.as = 'script'
          link.crossOrigin = 'anonymous'
          link.href = href
          document.head.append(link)
        }
        if (assets.length) schedule(warmNext, 400)
      }
      warmNext()
    }).catch(() => { /* The active screen loads on demand. */ })
  }, 1500)

  return () => {
    controller.abort()
    if (timer !== undefined) window.clearTimeout(timer)
    if (idle !== undefined) window.cancelIdleCallback?.(idle)
  }
}
