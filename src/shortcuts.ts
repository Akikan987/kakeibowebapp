export type AppShortcut = 'add-expense' | 'add-income' | 'withdrawals'

const APP_SHORTCUTS: AppShortcut[] = ['add-expense', 'add-income', 'withdrawals']

export function parseAppShortcut(search: string): AppShortcut | null {
  const value = new URLSearchParams(search).get('shortcut')
  return APP_SHORTCUTS.includes(value as AppShortcut) ? (value as AppShortcut) : null
}

/** 一度処理したショートカットをURLから除き、通常の再読込に持ち越さない。 */
export function clearAppShortcutFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('shortcut')) return
  url.searchParams.delete('shortcut')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}
