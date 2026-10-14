import { useEffect, useRef, useState } from 'react'
import { Alert, Box, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Button, Card, Modal, SectionHeader, yen } from './ui'
import { parseSmbcMessage, matchSmbcPayment, type FinancialMessageCandidate, type FinancialMessageInput } from '../imports/smbc'
import { financialMessageSource } from '../imports/source'
import { isAndroidNative, nativeNotificationCommand, readNativeNotifications, readNativeNotificationStatus, type NativeNotificationEvent, type NativeNotificationStatus } from '../native/notifications'
import { emptyDraft, useStore, type ExpenseDraft } from '../store'
import { TYPE_EXPENSE } from '../types'

export function FinancialImport({ onImport }: { onImport: (draft: ExpenseDraft, eventId?: string) => void }) {
  const s = useStore()
  const native = isAndroidNative()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('ご利用のお知らせ【三井住友カード】')
  const [sender, setSender] = useState('')
  const [text, setText] = useState('')
  const [candidate, setCandidate] = useState<FinancialMessageCandidate | null>(null)
  const [methodId, setMethodId] = useState('')
  const [eventId, setEventId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [matchNotice, setMatchNotice] = useState('')
  const [status, setStatus] = useState<NativeNotificationStatus | null>(null)
  const [events, setEvents] = useState<NativeNotificationEvent[]>([])
  const [fileLoading, setFileLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  useEffect(() => () => { generation.current += 1 }, [])
  useEffect(() => {
    if (!open || !native) return
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      const current = generation.current
      void readNativeNotificationStatus().then((value) => { if (current === generation.current) setStatus(value) }).catch(() => { /* Manual refresh remains available. */ })
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [open, native])

  const close = () => {
    generation.current += 1
    setOpen(false); setText(''); setSender(''); setCandidate(null); setEvents([])
    setEventId(undefined); setError(''); setBusy(false); setFileLoading(false)
  }
  const show = async () => {
    setOpen(true); setError('')
    if (native) {
      const current = generation.current
      try { const value = await readNativeNotificationStatus(); if (current === generation.current) setStatus(value) }
      catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : 'Androidの状態を取得できませんでした') }
    }
  }
  const analyze = (input: FinancialMessageInput, selectedEvent?: string) => {
    const result = parseSmbcMessage(input)
    const matched = matchSmbcPayment(result, s.paymentMethods)
    setCandidate(result); setMethodId(matched.id); setMatchNotice(matched.message)
    setEventId(selectedEvent); setError('')
  }
  const runNative = async (command: 'enable' | 'disable' | 'openNotificationSettings' | 'readPending' | 'status') => {
    const current = generation.current
    setBusy(true); setError('')
    try {
      if (command === 'readPending') {
        const value = await readNativeNotifications()
        if (current !== generation.current) return
        setEvents(value)
        if (!value.length) setError('対象の保留通知はありません。有効化・許可後に届いた通知が対象です。')
      } else if (command !== 'status') {
        await nativeNotificationCommand(command)
        if (current !== generation.current) return
        if (command === 'disable') { setEvents([]); setCandidate(null); setEventId(undefined) }
      }
      const next = await readNativeNotificationStatus()
      if (current === generation.current) setStatus(next)
    } catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : 'Androidの操作に失敗しました') }
    finally { if (current === generation.current) setBusy(false) }
  }
  const continueToEntry = async () => {
    if (!candidate || candidate.kind !== 'card_usage' || candidate.amountYen === null || !candidate.purchasedAtMillis || !candidate.merchant) return
    const method = s.paymentMethods.find((row) => !row.deleted && row.id === methodId)
    if (!method || !['credit', 'debit'].includes(method.type) ||
        (candidate.paymentType !== 'unknown' && method.type !== candidate.paymentType)) {
      setError('通知のモードに合う決済方法を選んでください。Oliveのクレジットとデビットは分けて登録してください。')
      return
    }
    const current = generation.current
    setBusy(true); setError('')
    try {
      const source = await financialMessageSource(candidate)
      if (current !== generation.current) return
      if (s.expenses.some((row) => !row.deleted && row.source === source)) {
        setError('同じ内容の通知は登録済みです。履歴で内容を確認・修正してください。')
        return
      }
      const draft: ExpenseDraft = {
        ...emptyDraft(), type: TYPE_EXPENSE, title: candidate.merchant, amountYen: String(candidate.amountYen),
        purchasedAtMillis: candidate.purchasedAtMillis, paymentMethodId: method.id,
        cashAccountId: method.cashAccountId ?? '', source,
      }
      onImport(draft, eventId)
      close()
    } catch { if (current === generation.current) setError('入力候補を作れませんでした。もう一度お試しください。') }
    finally { if (current === generation.current) setBusy(false) }
  }
  const loadTextFile = async (file: File) => {
    const current = generation.current
    setFileLoading(true); setError(''); setCandidate(null)
    try {
      if (!/\.txt$/i.test(file.name) || file.size > 128 * 1024) throw new Error('128KB以下のUTF-8テキスト（.txt）を選んでください。.emlやHTMLは本文をコピーしてください。')
      const value = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
      if (value.length > 32_000) throw new Error('メール本文は32,000文字以内にしてください')
      if (current === generation.current) { setText(value); setEventId(undefined) }
    } catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : 'テキストを読み込めませんでした') }
    finally { if (current === generation.current) setFileLoading(false) }
  }
  const methods = s.paymentMethods.filter((row) => !row.deleted && ['credit', 'debit'].includes(row.type) &&
    (!candidate || candidate.paymentType === 'unknown' || row.type === candidate.paymentType))
  const ready = candidate?.kind === 'card_usage' && candidate.amountYen !== null && !!candidate.purchasedAtMillis && !!candidate.merchant

  return <>
    <SectionHeader>メール・通知から入力</SectionHeader>
    <Card><CardContent><Stack spacing={1.5}>
      <Typography variant="body2">三井住友カードの利用通知から日時・利用先・金額を読み取り、確認して記録できます。</Typography>
      <Button variant="outline" onClick={() => void show()}>メール・通知を取り込む</Button>
      <Typography variant="caption" color="text.secondary">本文の貼り付けはWebでも利用可能です。通知読み取りはAndroidアプリ版で別途許可が必要です。Gmailの自動確認は下のGmail連携から設定できます。</Typography>
    </Stack></CardContent></Card>
    {open && <Modal title="メール・通知から入力" onClose={close}>
      <Stack spacing={2.5}>
        <Alert severity="info">本文の解析はこの端末で行い、外部AIへ送りません。明細の保存までは家計簿に追加しません。メール送信元の真正性は保証できないため、元の明細も確認してください。</Alert>
        {native && <Box><Stack spacing={1.5}>
          <Typography variant="subtitle2">Androidの通知取り込み</Typography>
          <Typography variant="body2" color="text.secondary">三井住友銀行・Vpassの取引通知のみが対象です。保留通知は端末内で暗号化して最大50件・7日間保存します。Gmailや過去のメールは読みません。取り込んだ記録は現在の家計簿アカウントへ保存されます。</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" label={status?.enabled ? '収集ON' : '収集OFF'} />
            <Chip size="small" label={status?.permissionGranted ? '通知アクセス許可済み' : '通知アクセス未許可'} />
            {status && <Chip size="small" label={`保留 ${status.pendingCount}件`} />}
          </Stack>
          <Button variant="outline" disabled={busy} onClick={() => void runNative('enable')}>説明を確認して収集を有効にする</Button>
          <Button variant="outline" disabled={busy} onClick={() => void runNative('openNotificationSettings')}>Androidの通知アクセス設定を開く</Button>
          <Button variant="text" disabled={busy} onClick={() => void runNative('status')}>許可状態を更新する</Button>
          <Button disabled={busy || !status?.enabled || !status.permissionGranted} onClick={() => void runNative('readPending')}>保留通知を読み込む</Button>
          <Button variant="text" disabled={busy || !status?.enabled} onClick={() => void runNative('disable')}>収集を停止して保留通知を消去</Button>
          {events.map((event) => <Card key={event.id}><CardContent><Stack spacing={1}>
            <Typography variant="body2">{event.title || '取引通知'}</Typography>
            <Typography variant="caption" color="text.secondary">{event.text.slice(0, 160)}</Typography>
            <Button variant="outline" disabled={busy} onClick={() => analyze({ text: event.text, subject: event.title, source: 'notification', packageName: event.packageName, receivedAt: event.postedAt }, event.id)}>この通知を確認する</Button>
            <Button variant="text" disabled={busy} onClick={async () => {
              const current = generation.current
              setBusy(true); setError('')
              try {
                await nativeNotificationCommand('ack', { ids: [event.id] })
                if (current === generation.current) { setEvents((old) => old.filter((row) => row.id !== event.id)); if (eventId === event.id) { setCandidate(null); setEventId(undefined) } }
              } catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : '通知を除外できませんでした') }
              finally { if (current === generation.current) setBusy(false) }
            }}>この保留通知を除外</Button>
          </Stack></CardContent></Card>)}
        </Stack></Box>}
        <Typography variant="subtitle2">利用通知メールの本文を貼り付け</Typography>
        <TextField label="件名" fullWidth value={subject} onChange={(event) => { setSubject(event.target.value.slice(0, 300)); setCandidate(null) }} />
        <TextField label="差出人アドレス（任意）" fullWidth value={sender} onChange={(event) => { setSender(event.target.value.slice(0, 254)); setCandidate(null) }} helperText="差出人名ではなくメールアドレス。省略した場合も真正性は確認できません。" />
        <TextField label="メール本文" fullWidth multiline minRows={5} maxRows={12} value={text}
          slotProps={{ htmlInput: { maxLength: 32_000 } }}
          onChange={(event) => { setText(event.target.value); setCandidate(null); setEventId(undefined) }}
          helperText="利用日・利用先・利用金額と、Olive／三井住友カードやモードが分かる部分を含めてください。承認番号は不要です。" />
        <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadTextFile(file); event.target.value = '' }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="outline" disabled={busy || fileLoading} onClick={() => fileRef.current?.click()}>テキストを読み込む</Button>
          <Button disabled={busy || fileLoading || !text.trim()} onClick={() => analyze({ text, subject, sender: sender.trim() || undefined, source: 'email' })}>本文を解析する</Button>
        </Stack>
        {candidate && <Stack spacing={1.5}>
          <Typography variant="h6">読み取り結果（未保存）</Typography>
          {candidate.kind === 'card_usage' ? <>
            <Typography>利用先：{candidate.merchant || '読み取れませんでした'}</Typography>
            <Typography>利用額：{candidate.amountYen === null ? '読み取れませんでした' : yen(candidate.amountYen)}</Typography>
            <Typography>利用日時：{candidate.purchasedAtMillis ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'medium' }).format(candidate.purchasedAtMillis) : '読み取れませんでした'}（日本時間）</Typography>
            <Chip label={candidate.paymentType === 'debit' ? 'デビットモード' : candidate.paymentType === 'credit' ? 'クレジットモード' : '決済モードを要確認'} sx={{ alignSelf: 'flex-start' }} />
            {matchNotice && <Typography variant="caption" color="text.secondary">{matchNotice}</Typography>}
            <TextField select label="記録する決済方法" fullWidth value={methodId} onChange={(event) => setMethodId(event.target.value)}>
              <MenuItem value="">選択してください</MenuItem>
              {methods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}（{method.type === 'debit' ? 'デビット' : 'クレジット'}）</MenuItem>)}
            </TextField>
            {!methods.length && <Alert severity="warning">決済タブで対応する種類の決済方法を追加してください。Oliveのデビットはクレジットと分けて登録します。</Alert>}
            {!ready && <Alert severity="warning">日時・金額・利用先を特定できないため自動反映しません。全文を取り込むか、通常の追加画面から手入力してください。</Alert>}
          </> : <Alert severity="warning">{candidate.kind === 'bank_notice' ? '銀行の入出金通知は振替やカード引き落としの可能性があるため、支出へ自動変換しません。' : candidate.kind === 'card_bill' ? '請求額のお知らせは個別の支出ではありません。決済タブの請求照合で確認してください。' : '対応する利用通知を確認できませんでした。通常の追加画面から手入力してください。'}</Alert>}
          {candidate.warnings.map((warning, index) => <Typography key={index} variant="caption" color="text.secondary">・{warning}</Typography>)}
          <Button disabled={busy || !ready || !methodId} onClick={() => void continueToEntry()}>入力画面で確認する</Button>
        </Stack>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Modal>}
  </>
}
