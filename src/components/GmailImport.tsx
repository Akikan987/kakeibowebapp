import { useEffect, useRef, useState } from 'react'
import { Alert, CardContent, Checkbox, Chip, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Button, Card, Modal, SectionHeader, yen } from './ui'
import { emptyDraft, useStore, type ExpenseDraft } from '../store'
import { TYPE_EXPENSE } from '../types'
import { matchSmbcPayment } from '../imports/smbc'
import { financialMessageSource } from '../imports/source'
import { GMAIL_CONNECTIONS_URL, gmailAiStatusSummary, gmailCandidateAction, gmailCandidates, gmailDisconnectOutcome, gmailRequest, googleAuthorizationUrl, pushApplicationKey, pushDeviceId, type GmailCandidate, type GmailDisconnectOutcome, type GmailStatus } from '../imports/gmail'
import { isAndroidNative } from '../native/notifications'

export function GmailImport({ onImport }: { onImport: (draft: ExpenseDraft, eventId?: string, gmailCandidateId?: string) => void }) {
  const s = useStore()
  const token = s.account?.token
  const native = isAndroidNative()
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(!!token)
  const [statusError, setStatusError] = useState(false)
  const [items, setItems] = useState<GmailCandidate[]>([])
  const [selected, setSelected] = useState<GmailCandidate | null>(null)
  const [methodId, setMethodId] = useState('')
  const [matchNotice, setMatchNotice] = useState('')
  const [connectConsent, setConnectConsent] = useState(false)
  const [aiConsent, setAiConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [disconnectOutcome, setDisconnectOutcome] = useState<GmailDisconnectOutcome | null>(null)
  const [pushReady, setPushReady] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current += 1 }, [])
  useEffect(() => {
    generation.current += 1
    setStatus(null); setItems([]); setSelected(null); setDisconnectOutcome(null)
    setStatusError(false); setStatusLoading(!!token); setError(''); setNotice(''); setBusy(false)
    setConnectConsent(false); setAiConsent(false); setPushReady(false); setPushSubscribed(false)
  }, [token, s.account?.uid])

  const refresh = async (current = generation.current) => {
    if (!token) return
    if (current === generation.current) { setStatusLoading(true); setStatusError(false) }
    try {
      const value = await gmailRequest<GmailStatus>(token, 'gmail/status')
      const rows = value.connected ? gmailCandidates(await gmailRequest(token, 'gmail/candidates')) : []
      if (current !== generation.current) return
      setStatus(value); setItems(rows)
    } catch (err) {
      if (current === generation.current) setStatusError(true)
      throw err
    } finally {
      if (current === generation.current) setStatusLoading(false)
    }
  }
  useEffect(() => {
    if (token) void refresh().catch(() => { /* An explicit refresh surfaces connection errors. */ })
    const connected = () => { if (token) void refresh().catch(() => { /* Manual refresh remains available. */ }) }
    window.addEventListener('kakeibo:gmail-connected', connected)
    return () => window.removeEventListener('kakeibo:gmail-connected', connected)
  }, [token, s.account?.uid])
  useEffect(() => {
    if (!token || native || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !window.isSecureContext) return
    const current = generation.current
    void navigator.serviceWorker.ready.then(async (registration) => {
      if (!registration?.active) return
      const config = await gmailRequest<{ configured: boolean; publicKey: string }>(token, 'push/config')
      const subscription = await registration.pushManager.getSubscription()
      if (current === generation.current) { setPushReady(config.configured); setPushSubscribed(!!subscription) }
    }).catch(() => { /* Permission is never requested by mounting settings. */ })
  }, [token, native])

  const run = async (operation: () => Promise<void>) => {
    const current = generation.current
    setBusy(true); setError(''); setNotice('')
    try { await operation() }
    catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : '操作に失敗しました') }
    finally { if (current === generation.current) setBusy(false) }
  }
  const settings = async (enabled: boolean, aiEnabled: boolean) => {
    if (!token) return
    await gmailRequest(token, 'gmail/settings', { enabled, aiEnabled, aiConsent: aiEnabled && aiConsent })
    await refresh()
    setAiConsent(false)
  }
  const subscribe = async () => {
    if (!token || native) return
    // Preserve the explicit click's user activation (notably on iOS); do not await network first.
    if (await Notification.requestPermission() !== 'granted') throw new Error('通知が許可されませんでした。端末・ブラウザーの設定をご確認ください')
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration?.active) throw new Error('アプリを最新版に更新して、もう一度開いてください')
    const config = await gmailRequest<{ configured: boolean; publicKey: string }>(token, 'push/config')
    if (!config.configured) throw new Error('サーバー側の通知設定が必要です')
    const key = pushApplicationKey(config.publicKey)
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    try {
      await gmailRequest(token, 'push/subscribe', { subscription: subscription.toJSON(), deviceId: pushDeviceId(localStorage) })
    } catch (err) {
      if (!existing) await subscription.unsubscribe().catch(() => false)
      throw err
    }
    setPushSubscribed(true); setNotice('この端末に明細候補の通知を送ります。通知は金額や店名を表示しません。')
  }
  const unsubscribe = async () => {
    if (!token) return
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      await gmailRequest(token, 'push/unsubscribe', { endpoint: subscription.endpoint, deviceId: pushDeviceId(localStorage) })
      if (!await subscription.unsubscribe()) throw new Error('サーバーへの通知停止は完了しました。端末の通知設定も確認してください')
    }
    setPushSubscribed(false)
  }
  const review = (item: GmailCandidate) => {
    const matched = matchSmbcPayment(item.candidate, s.paymentMethods)
    setSelected(item); setMethodId(matched.id); setMatchNotice(matched.message); setError('')
  }
  const continueToEntry = async () => {
    if (!selected) return
    const current = generation.current
    const candidate = selected.candidate
    const method = s.paymentMethods.find((row) => !row.deleted && row.id === methodId)
    if (candidate.kind !== 'card_usage' || !candidate.merchant || !candidate.amountYen || !candidate.purchasedAtMillis ||
        !method || !['credit', 'debit'].includes(method.type) || (candidate.paymentType !== 'unknown' && method.type !== candidate.paymentType)) throw new Error('日時・金額・利用先と、対応する決済方法を確認してください')
    const source = await financialMessageSource(candidate)
    if (current !== generation.current) return
    if (s.expenses.some((row) => !row.deleted && row.source === source)) throw new Error('同じ内容は登録済みです。履歴を確認し、この候補を除外してください')
    onImport({ ...emptyDraft(), type: TYPE_EXPENSE, title: candidate.merchant, amountYen: String(candidate.amountYen), purchasedAtMillis: candidate.purchasedAtMillis, paymentMethodId: method.id, cashAccountId: method.cashAccountId ?? '', source }, undefined, selected.id)
  }
  const candidate = selected?.candidate
  const methods = s.paymentMethods.filter((row) => !row.deleted && ['credit', 'debit'].includes(row.type) && (!candidate || candidate.paymentType === 'unknown' || candidate.paymentType === row.type))
  const aiStatus = gmailAiStatusSummary(status)

  return <>
    <SectionHeader>Gmailの利用通知を自動確認</SectionHeader>
    <Card id="gmail-integration"><CardContent><Stack spacing={2}>
      <Typography variant="body2">三井住友の利用通知から明細候補を作り、追加するか確認できます。確認・保存するまで家計簿には追加しません。</Typography>
      {!token ? <Alert severity="info">Gmail連携には家計簿アカウントへのログインが必要です。</Alert> : <>
        {native && <Alert severity="info">Gmailの接続・通知設定はChrome／Safariなどのブラウザー版・PWAで行ってください。Androidアプリ内ではGoogle認証を開きません。</Alert>}
        {statusLoading && <Alert severity="info">{status ? 'Gmailの接続状態を更新しています。' : 'Gmailの接続状態を読み込み中です。'}</Alert>}
        {statusError && <Alert severity="error">最新のGmail接続状態を取得できませんでした。通信を確認し、「接続状態・候補を更新する」から再試行してください。</Alert>}
        {status?.connected ? <>
          <Typography variant="body2">接続先：{status.email}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap"><Chip size="small" label="Gmail接続済み" /><Chip size="small" label={status.enabled ? '自動確認ON' : '自動確認OFF'} /><Chip size="small" label={`未確認 ${status.pendingCount}件`} /></Stack>
          <Alert severity={aiStatus.severity}><strong>{aiStatus.label}：</strong>{aiStatus.description}</Alert>
          <Typography variant="caption" color="text.secondary">約{Math.max(1, Math.round((status.intervalSeconds || 300) / 60))}分間隔でサーバーが確認します。即時ではなく、PC・サーバーが停止中は確認できません。初回接続より前のメールは取り込みません。</Typography>
          {!!status.lastCheckedAt && <Typography variant="caption" color="text.secondary">最終確認：{new Date(status.lastCheckedAt < 1e12 ? status.lastCheckedAt * 1000 : status.lastCheckedAt).toLocaleString('ja-JP')}</Typography>}
          {status.lastError && <Alert severity="warning">{status.lastError}</Alert>}
          {status.lastError && !native && <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
            if (!window.confirm('Gmailの読み取り権限をGoogle画面で確認して、接続し直します。Gmail全体を読み取れる権限ですが、サーバーでは三井住友の利用通知に検索を絞ります。続けますか？')) return
            const result = await gmailRequest<{ url: string }>(token, 'gmail/start', { consent: true })
            window.location.assign(googleAuthorizationUrl(result.url))
          })}>Googleで接続し直す</Button>}
          <Button variant="outline" disabled={busy} onClick={() => void run(() => settings(!status.enabled, status.aiEnabled))}>{status.enabled ? '自動確認を停止する' : '自動確認を再開する'}</Button>
          <Button variant="outline" disabled={busy || !status.enabled} onClick={() => void run(async () => { const result = await gmailRequest<{ added: number }>(token, 'gmail/check', {}); await refresh(); setNotice(`${result.added}件の候補を追加しました`) })}>今すぐメールを確認</Button>
          <Typography variant="subtitle2">AIによる補助解析（任意）</Typography>
          <Typography variant="caption" color="text.secondary">定型解析で日時・金額・利用先を特定できても決済モードが不明な場合だけ、取引部分をOpenAIへ送って明細らしさを補助判定します。欠けた金額や日付は推測しません。</Typography>
          <Typography variant="caption" color="text.secondary">氏名・リンク・承認番号などを除去しますが、店名・日時・金額自体も個人情報になり得ます。完全な匿名化や解析の正確性は保証できず、API利用料が発生します。メール全文をAIに渡す方式ではありません。</Typography>
          {!status.aiEnabled && <FormControlLabel control={<Checkbox checked={aiConsent} disabled={busy || status.aiAvailable === false} onChange={(_, checked) => setAiConsent(checked)} />} label="取引部分の外部AI送信と費用について理解し、AI補助に同意する" />}
          <Button variant="outline" disabled={busy || (!status.aiEnabled && (!aiConsent || status.aiAvailable === false))} onClick={() => void run(() => settings(status.enabled, !status.aiEnabled))}>{status.aiEnabled ? 'AI補助を停止する' : '同意してAI補助を有効にする'}</Button>
          <Typography variant="subtitle2">この端末への通知</Typography>
          <Typography variant="caption" color="text.secondary">通知には明細候補があることだけを表示します。端末・OSにより届かない場合があります。iPhoneはホーム画面へ追加したPWAから設定してください。</Typography>
          {!native && pushReady ? <>
            <Button variant="outline" disabled={busy} onClick={() => void run(subscribe)}>この端末の通知を登録・再登録する</Button>
            {pushSubscribed && <Button variant="text" disabled={busy} onClick={() => void run(unsubscribe)}>この端末への通知を停止</Button>}
            <Typography variant="caption" color="text.secondary">ログアウト後や通知が届かない場合は、現在の家計簿アカウントで再登録してください。ブラウザーに許可が残っていても、サーバーへの登録が解除されている場合があります。</Typography>
          </> : <Typography variant="caption" color="text.secondary">通知には対応ブラウザー・PWAとサーバー側の通知設定が必要です。候補は通知なしでも下から確認できます。</Typography>}
          <Button variant="text" disabled={busy} onClick={() => void run(async () => {
            if (!window.confirm('Gmail連携を解除し、保留中の候補を削除しますか？ 保存済みの家計簿は残ります。')) return
            const current = generation.current
            const result = await gmailRequest<unknown>(token, 'gmail/disconnect', {})
            if (current !== generation.current) return
            const outcome = gmailDisconnectOutcome(result)
            setDisconnectOutcome(outcome)
            if (outcome.disconnected) {
              setStatus((currentStatus) => currentStatus ? { ...currentStatus, connected: false, email: '', enabled: false, aiEnabled: false, pendingCount: 0, lastError: '' } : currentStatus)
              setItems([]); setSelected(null); setAiConsent(false)
            }
            await refresh(current)
          })}>Gmail連携を解除する</Button>
        </> : status ? <>
          <Alert severity={aiStatus.severity}><strong>{aiStatus.label}：</strong>{aiStatus.description}</Alert>
          <Alert severity="info">Googleの許可画面ではGmail全体を読み取れる権限（gmail.readonly）が表示されます。このアプリのサーバー処理は三井住友の利用通知に検索を絞りますが、権限そのものはそのメールだけに限定できません。</Alert>
          <Typography variant="caption" color="text.secondary">Googleの接続トークンをサーバーで暗号化保存します。メール本文は取得・解析時のみ使用し永続保存しません。日時・店名・金額などの候補はサーバーに保存されます。AI補助は初期OFFです。</Typography>
          <Typography variant="caption" color="text.secondary">家計簿へのログイン用Googleアカウントとは別のGmailも選べます。次のGoogle画面で、利用通知を受信しているアカウントを選んでください。</Typography>
          <FormControlLabel control={<Checkbox checked={connectConsent} disabled={busy || native} onChange={(_, checked) => setConnectConsent(checked)} />} label="権限・データの取り扱いを理解し、Gmail連携に同意する" />
          <Button disabled={busy || native || !status?.configured || !connectConsent} onClick={() => void run(async () => { const result = await gmailRequest<{ url: string }>(token, 'gmail/start', { consent: true }); window.location.assign(googleAuthorizationUrl(result.url)) })}>GoogleでGmailを接続する</Button>
          {status && !status.configured && <Typography variant="caption" color="text.secondary">サーバー側のGmail連携設定が必要です。</Typography>}
        </> : null}
        <Button variant="text" disabled={busy || statusLoading} onClick={() => void refresh().catch(() => { /* The refresh error is shown above. */ })}>接続状態・候補を更新する</Button>
        {items.length > 0 && <Typography variant="subtitle2">追加するか確認する</Typography>}
        {items.map((item) => <Card key={item.id} variant="outlined"><CardContent><Stack spacing={1.5}>
          <Typography>{item.candidate.merchant || '要確認の利用通知'}</Typography>
          <Typography variant="body2">{item.candidate.amountYen === null ? '金額を確認してください' : yen(item.candidate.amountYen)}{item.candidate.purchasedAtMillis ? ` ・ ${new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short' }).format(item.candidate.purchasedAtMillis)}` : ''}</Typography>
          <Button variant="outline" disabled={busy} onClick={() => review(item)}>内容を確認する</Button>
          <Button variant="text" disabled={busy} onClick={() => void run(async () => { await gmailCandidateAction(token, item.id, 'dismiss'); await refresh() })}>この候補を除外する</Button>
        </Stack></CardContent></Card>)}
      </>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {disconnectOutcome && <Alert severity={disconnectOutcome.disconnected && disconnectOutcome.revoked ? 'success' : 'warning'}>
        {disconnectOutcome.message}
        {disconnectOutcome.disconnected && !disconnectOutcome.revoked && <> <a href={GMAIL_CONNECTIONS_URL} target="_blank" rel="noreferrer">Googleアカウント設定でアクセスを手動で削除</a></>}
      </Alert>}
      {error && !selected && <Alert severity="error">{error}</Alert>}
    </Stack></CardContent></Card>
    {candidate && <Modal title="Gmailの明細候補（未保存）" onClose={() => { setSelected(null); setError('') }}><Stack spacing={2}>
      <Typography>利用先：{candidate.merchant || '不明'}</Typography>
      <Typography>利用額：{candidate.amountYen === null ? '不明' : yen(candidate.amountYen)}</Typography>
      <Typography>日時：{candidate.purchasedAtMillis ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'medium' }).format(candidate.purchasedAtMillis) : '不明'}（日本時間）</Typography>
      <Typography variant="body2">{candidate.paymentType === 'debit' ? 'デビット' : candidate.paymentType === 'credit' ? 'クレジット' : '決済モードを要確認'}</Typography>
      {candidate.warnings.map((warning, index) => <Typography key={index} variant="caption" color="text.secondary">・{warning}</Typography>)}
      {matchNotice && <Typography variant="caption" color="text.secondary">{matchNotice}</Typography>}
      <TextField select fullWidth label="記録する決済方法" value={methodId} onChange={(event) => setMethodId(event.target.value)}><MenuItem value="">選択してください</MenuItem>{methods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}（{method.type === 'debit' ? 'デビット' : 'クレジット'}）</MenuItem>)}</TextField>
      {!methods.length && <Alert severity="warning">先に決済タブで対応するカード・デビットを登録してください。</Alert>}
      <Alert severity="info">元のメール・実際の支払いと照合してください。次の入力画面で保存すると支出になります。請求・引き落とし・取消を二重登録しないよう注意してください。</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <Button disabled={busy || !methodId || candidate.kind !== 'card_usage' || !candidate.amountYen || !candidate.purchasedAtMillis || !candidate.merchant} onClick={() => void run(continueToEntry)}>入力画面で確認する</Button>
    </Stack></Modal>}
  </>
}
