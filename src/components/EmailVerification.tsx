import { useEffect, useRef, useState } from 'react'
import { Alert, Stack, Typography } from '@mui/material'
import { ApiError, type EmailVerificationChallenge } from '../api'
import { Button, Field, Modal } from './ui'

const deadlineMillis = (value: number) => value < 1_000_000_000_000 ? value * 1000 : value

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) return '確認コードが違うか、有効期限が切れています。確認コードを再送してやり直してください。'
    if (error.status === 409 && error.detail.includes('認証済み')) return 'このメールアドレスはすでに認証されています。'
    if (error.status === 429) return '送信回数の上限に達しました。時間をおいてからお試しください。'
    if (error.status === 503) return '確認メールを送信できませんでした。しばらくしてからお試しください。'
    return error.detail || 'メールアドレスを確認できませんでした。'
  }
  return 'サーバーに接続できませんでした。通信状態を確認してください。'
}

export function EmailVerification({
  email,
  emailVerified,
  refreshProfile,
  requestVerification,
  confirmVerification,
}: {
  email: string
  emailVerified?: boolean
  refreshProfile: () => Promise<void>
  requestVerification: () => Promise<EmailVerificationChallenge | null>
  confirmVerification: (verificationId: string, code: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [challenge, setChallenge] = useState<EmailVerificationChallenge | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())
  const [resendAt, setResendAt] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [email])
  useEffect(() => {
    if (!challenge) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [challenge])

  const expiresAt = challenge ? deadlineMillis(challenge.expires_at) : 0
  const secondsLeft = challenge ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const resendIn = challenge ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0

  const sendCode = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await requestVerification()
      if (!alive.current) return
      if (!next) {
        setError('ログイン状態が変わりました。設定を開き直してください。')
        return
      }
      setChallenge(next)
      setCode('')
      setNow(Date.now())
      setResendAt(Date.now() + 60_000)
      setNotice(`${next.email} に確認コードを送りました。`)
    } catch (caught) {
      if (!alive.current) return
      const message = errorMessage(caught)
      if (caught instanceof ApiError && caught.status === 409) {
        await refreshProfile()
        if (!alive.current) return
        setOpen(false)
        setNotice(message)
      } else {
        setError(message)
      }
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const confirmCode = async () => {
    if (!challenge || code.length !== 6) return
    setBusy(true)
    setError('')
    try {
      const saved = await confirmVerification(challenge.verification_id, code)
      if (!alive.current) return
      if (saved) {
        await refreshProfile()
        if (!alive.current) return
        setChallenge(null)
        setOpen(false)
        setNotice('メールアドレスを認証しました。')
      } else {
        setError('ログイン状態が変わりました。設定を開き直してください。')
      }
    } catch (caught) {
      if (alive.current) setError(errorMessage(caught))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return <>
    <Stack spacing={1}>
      <Typography variant="body2" fontWeight={600}>
        {emailVerified === true ? 'メールアドレス認証済み' : emailVerified === false ? 'メールアドレス未認証' : 'メールアドレスの認証状態を確認できません'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {emailVerified === true
          ? 'このアドレスの認証が完了しています。'
          : '認証すると、アカウントの連絡先としてこのメールアドレスを確認できます。認証前もログインや家計簿の共有は引き続き利用できます。'}
      </Typography>
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && !open && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {emailVerified !== true && <Button variant="outline" onClick={() => { setError(''); setNotice(''); setOpen(true) }}>
        メールアドレスを認証
      </Button>}
    </Stack>

    {open && <Modal title="メールアドレスを認証" onClose={() => { if (!busy) setOpen(false) }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">現在のメールアドレスに届く6桁のコードを入力してください。メールアドレスの変更は行いません。</Typography>
        <Field label="現在のメールアドレス" type="email" value={email} readOnly />
        {challenge ? <>
          <Field
            label="6桁の確認コード"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            disabled={busy || secondsLeft === 0}
            helperText={secondsLeft > 0 ? `有効期限まで約${Math.ceil(secondsLeft / 60)}分` : 'コードの有効期限が切れました。再送してください。'}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Stack spacing={1.25}>
            <Button disabled={busy || code.length !== 6 || secondsLeft === 0} onClick={() => void confirmCode()}>{busy ? '確認中…' : 'メールアドレスを認証'}</Button>
            <Button variant="outline" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
              {resendIn > 0 ? `コードを再送（${resendIn}秒後）` : '確認コードを再送'}
            </Button>
          </Stack>
        </> : <>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>キャンセル</Button>
            <Button disabled={busy || !email} onClick={() => void sendCode()}>{busy ? '送信中…' : '確認コードを送る'}</Button>
          </Stack>
        </>}
      </Stack>
    </Modal>}
  </>
}
