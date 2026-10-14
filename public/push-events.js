/* Notifications never display bank, email, merchant or amount data on a lock screen. */
self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('家計簿', {
    body: '確認できる明細候補があります。アプリを開いて確認してください。',
    icon: '/icon-192.png', badge: '/icon-192.png', tag: 'kakeibo-gmail-candidates',
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
