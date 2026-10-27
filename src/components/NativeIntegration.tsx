import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
import { App as NativeApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useStore } from '../store'
import { apiFetch } from '../native/http'
import { APP_ORIGIN, isHybridNative, KakeiboDevice } from '../native/runtime'
import { completeNativeLogin, nativeReturnId, openAccountInBrowser } from '../native/auth'
import { widgetSnapshot } from '../native/widget'
import type { Account } from '../types'
import { clearNativeExports } from '../native/files'

const REMINDER_ID = 41001
export const reminderKey = (owner: string) => `kakeibo:native-reminder:${owner}`
let deviceQueue = Promise.resolve()

/** Mounted once. No OS permission is requested by mounting this component. */
export function NativeIntegration() {
  const s = useStore()
  const [tick, setTick] = useState(0)
  const [error, setError] = useState('')
  const accepting = useRef(false)
  useEffect(() => {
    if (!isHybridNative()) return
    let active = true
    void clearNativeExports()
    const accept = async (id?: string) => {
      if (accepting.current) return
      accepting.current = true
      try {
        const result = await completeNativeLogin(id) as Account | null
        if (result && active) {
          if (result.token !== 'cookie' || typeof result.uid !== 'string') throw new Error('認証結果を確認できません')
          await s.acceptSocialAccount(result)
          await Browser.close().catch(() => undefined)
        }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : '認証を確認できません') }
      finally { accepting.current = false }
    }
    const receive = (url: string) => {
      const id = nativeReturnId(url)
      if (id) void accept(id)
      else if (/^kakeibo-native:\/\/(add-expense|withdrawals)\/?$/u.test(url)) {
        window.dispatchEvent(new CustomEvent('kakeibo:native-shortcut', { detail: new URL(url).hostname }))
      }
    }
    const opened = NativeApp.addListener('appUrlOpen', ({ url }) => receive(url))
    const check = () => { void accept() }
    window.addEventListener('kakeibo:native-complete', check)
    const resumed = NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) { setTick((t) => t + 1); void accept() } })
    void NativeApp.getLaunchUrl().then((launch) => { if (launch) receive(launch.url) })
    const timer = window.setInterval(() => setTick((t) => t + 1), 60000)
    return () => { active = false; clearInterval(timer); window.removeEventListener('kakeibo:native-complete', check); void opened.then((h) => h.remove()); void resumed.then((h) => h.remove()) }
  }, [s.acceptSocialAccount])
  useEffect(() => {
    if (!isHybridNative()) return
    const owner = s.account?.uid ?? ''
    const snapshot = owner && s.lastSync > 0 ? widgetSnapshot({ owner, calculated: s.cardWithdrawals, statements: s.cardStatements, methods: s.paymentMethods, lastSync: s.lastSync, syncError: s.syncError, online: navigator.onLine, timestamp: Date.now() }) : null
    // Serialize identity and snapshot writes: an old owner's delayed write must not repopulate the widget.
    let active = true
    deviceQueue = deviceQueue.catch(() => undefined).then(async () => {
      if (!active) return
      await KakeiboDevice.setOwner({ owner })
      if (!owner) await clearNativeExports()
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
      if (!snapshot) return
      await KakeiboDevice.updateWidget(snapshot)
      if (localStorage.getItem(reminderKey(owner)) !== '1' || !snapshot.nextDate) return
      const when = new Date(snapshot.nextDate); when.setHours(9, 0, 0, 0)
      if (when.getTime() <= Date.now()) return
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
      await LocalNotifications.schedule({ notifications: [{ id: REMINDER_ID, title: '家計簿の支払予定', body: '支払予定をアプリで確認してください。', schedule: { at: when, allowWhileIdle: false }, extra: { shortcut: 'withdrawals' } }] })
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : '端末機能の更新に失敗しました') })
    return () => { active = false }
  }, [s.account?.uid, s.lastSync, s.cardWithdrawals, s.cardStatements, s.paymentMethods, s.syncError, tick])
  useEffect(() => {
    if (!isHybridNative()) return
    const refresh = () => setTick((t) => t + 1)
    window.addEventListener('kakeibo:native-settings', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', () => window.dispatchEvent(new CustomEvent('kakeibo:native-shortcut', { detail: 'withdrawals' })))
    return () => { window.removeEventListener('kakeibo:native-settings', refresh); window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); void listener.then((h) => h.remove()) }
  }, [])
  return error ? <Alert severity="warning" onClose={() => setError('')}>{error}</Alert> : null
}

export function NativeSettings() {
  const s = useStore()
  const [showAmounts, setShowAmounts] = useState(false)
  const [reminder, setReminder] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!isHybridNative()) return
    void KakeiboDevice.getWidgetSettings().then((value) => setShowAmounts(value.showAmounts)).catch(() => setMessage('端末の設定を取得できませんでした'))
    setReminder(!!s.account && localStorage.getItem(reminderKey(s.account.uid)) === '1')
  }, [s.account?.uid])
  if (!isHybridNative()) return null
  const run = async (fn: () => Promise<void>) => { try { setMessage(''); await fn() } catch { setMessage('端末の設定を更新できませんでした。OSの許可とアプリの状態を確認してください。') } }
  return <Stack spacing={1.5} sx={{ my: 3 }}>
    <Typography variant="h6">端末のウィジェット・通知</Typography>
    <Typography variant="body2">ホーム画面に「家計簿 Native」の支払予定ウィジェットを追加できます。見込み額を含み、アプリで最後に確認・同期した内容を表示します。</Typography>
    <FormControlLabel label="ウィジェットに金額を表示する（初期OFF）" control={<Checkbox checked={showAmounts} disabled={!s.account} onChange={(_, checked) => void run(async () => { await KakeiboDevice.setWidgetPrivacy({ showAmounts: checked }); setShowAmounts(checked) })} />} />
    <Typography variant="caption">共有画面・ランチャーが表示を保持する可能性があります。金額を秘密にしたい場合はOFFのままお使いください。ロック中は金額を隠します。</Typography>
    <FormControlLabel label="次の引き落とし日の朝9時に端末へ通知する" control={<Checkbox checked={reminder} disabled={!s.account} onChange={(_, checked) => void run(async () => {
      if (!s.account) return
      if (checked && (await LocalNotifications.requestPermissions()).display !== 'granted') { setMessage('通知は許可されていません。OS設定から許可できます。'); return }
      localStorage.setItem(reminderKey(s.account.uid), checked ? '1' : '0'); setReminder(checked)
      if (!checked) await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
      window.dispatchEvent(new Event('kakeibo:native-settings'))
      setMessage('設定を保存しました。支払予定はアプリ再表示・同期時に通知へ反映します。')
    })} />} />
    <Button onClick={() => void run(async () => {
      if ((await LocalNotifications.requestPermissions()).display !== 'granted') { setMessage('通知は許可されていません'); return }
      await LocalNotifications.schedule({ notifications: [{ id: 41002, title: '家計簿 Native', body: '端末通知のテストです。金額や通知本文は含みません。', schedule: { at: new Date(Date.now() + 3000) } }] })
      setMessage('テスト通知を予約しました。OSの設定によって表示が遅れる場合があります。')
    })}>この端末で通知をテスト</Button>
    <Typography variant="caption">Androidの定期処理は保存済み表示の更新・期限確認を行います。バックグラウンドでの常時同期や即時通知は保証しません。サーバーからのFCM／APNs Pushは未接続です。</Typography>
    {message && <Alert severity="info">{message}</Alert>}
  </Stack>
}

/** OAuth redirects may remove query params, so retain only the non-secret request id. */
export function BrowserNativeApproval() {
  const s = useStore()
  const [id] = useState(() => {
    if (isHybridNative()) return null
    const value = new URLSearchParams(location.search).get('native_request')
    if (value && /^[A-Za-z0-9_-]{32,128}$/u.test(value)) sessionStorage.setItem('kakeibo:native-browser-request', value)
    return sessionStorage.getItem('kakeibo:native-browser-request')
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  if (!id || done || isHybridNative()) return null
  return <Alert severity="info" sx={{ m: 2 }}>
    <Stack spacing={1}>
      <Typography>家計簿 Nativeへのログイン要求です。自分でアプリから開始した場合だけ許可してください。</Typography>
      <Typography>{s.account ? `このアカウントで許可: ${s.account.nickname} (${s.account.uid})` : 'いつものGoogle・LINEまたはメールで、このブラウザーへログインしてください。'}</Typography>
      <Button disabled={!s.account || busy} onClick={() => { setBusy(true); void (async () => {
        const response = await apiFetch('/auth/native/approve', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kakeibo-Session': 'cookie' }, body: JSON.stringify({ id }) })
        if (!response.ok) throw new Error('許可できませんでした。アプリから認証をやり直してください。')
        const result = await response.json() as { url: string }
        if (nativeReturnId(result.url) !== id) throw new Error('アプリへの戻り先を確認できません')
        sessionStorage.removeItem('kakeibo:native-browser-request'); setDone(true)
        location.assign(result.url)
      })().catch((err) => setError(err instanceof Error ? err.message : '許可できませんでした')).finally(() => setBusy(false)) }}>このアカウントでアプリへのログインを許可</Button>
      <Button disabled={busy} onClick={() => { sessionStorage.removeItem('kakeibo:native-browser-request'); setDone(true) }}>キャンセル</Button>
      {error && <Typography color="error">{error}</Typography>}
    </Stack>
  </Alert>
}

export function NativeBrowserAccountButton() {
  const s = useStore()
  const [failed, setFailed] = useState(false)
  return <><Button onClick={() => { setFailed(false); void openAccountInBrowser().catch(() => setFailed(true)) }}>ブラウザーでアカウント・Gmailを管理</Button>
    {s.account && <Typography variant="caption" display="block">アプリのアカウント: {s.account.nickname} ({s.account.uid})。ブラウザー側も同じアカウントか確認してください。</Typography>}
    {failed && <Typography color="error">ブラウザーを開けませんでした。</Typography>}</>
}

export const canonicalLegalUrl = (path: string) => new URL(path, APP_ORIGIN).href
