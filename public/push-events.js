/* Notifications never display bank, email, merchant or amount data on a lock screen. */
self.addEventListener('push', (event) => {
  let type = ''
  try {
    const value = event.data?.json()
    if (value && typeof value === 'object' && !Array.isArray(value) && value.type === 'push-test') type = 'push-test'
  } catch { /* Malformed payloads use the existing generic candidate notice. */ }
  const isTest = type === 'push-test'
  event.waitUntil(self.registration.showNotification(isTest ? '家計簿 テスト通知' : '家計簿', {
    body: isTest ? 'テスト通知です。家計簿から送信できました。' : '確認できる明細候補があります。アプリを開いて確認してください。',
    icon: '/icon-192.png', badge: '/icon-192.png', tag: isTest ? 'kakeibo-push-test' : 'kakeibo-gmail-candidates',
    data: { type: 'GMAIL_CANDIDATES' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => {
      const url = new URL(client.url)
      return url.origin === self.location.origin && url.pathname === '/'
    })
    if (existing) {
      await existing.focus()
      existing.postMessage({ type: 'GMAIL_CANDIDATES' })
    } else await self.clients.openWindow('/?gmail=candidates')
  })())
})
