import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Box, Button, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import {
  apiDisableTotp,
  apiEnableTotp,
  apiPasskeyOptions,
  apiRemovePasskey,
  apiSecurityStatus,
  apiTotpOptions,
  apiVerifyPasskey,
  type SecurityStatus,
} from '../api'
import { createPasskey, passkeyError, passkeysSupported } from '../passkeys'
import { Card, Modal, SectionHeader } from './ui'

type Passkey = SecurityStatus['passkeys'][number]
type Action =
  | { kind: 'add-passkey' }
  | { kind: 'remove-passkey'; passkey: Passkey }
  | { kind: 'start-totp' }
  | { kind: 'disable-totp' }
  | { kind: 'verify-totp'; challenge: string; secret: string; qr: string }
  | { kind: 'recovery'; codes: string[] }

const actionTitles = {
  'add-passkey': 'パスキーを追加',
  'remove-passkey': 'パスキーを削除',
  'start-totp': '認証アプリを設定',
  'disable-totp': '2段階認証を解除',
  'verify-totp': '認証アプリのコードを確認',
  recovery: '復旧コードを保存',
}

export function AccountSecurity({ token }: { token: string }) {
  const [status, setStatus] = useState<SecurityStatus | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [action, setAction] = useState<Action | null>(null)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const submitting = useRef(false)
  const supportsPasskeys = passkeysSupported()

  useEffect(() => {
    let active = true
    void apiSecurityStatus(token).then((response) => {
      if (active) setStatus(response)
    }).catch(() => {
      if (active) setLoadError('セキュリティ設定を取得できませんでした。')
    })
    return () => { active = false }
  }, [token, reload])

  function loadStatus() {
    setLoadError('')
    setReload((version) => version + 1)
  }

  function show(next: Action | null) {
    setPassword('')
    setCode('')
    setName('')
    setError('')
    setCopied(false)
    setAction(next)
  }

  const needsPassword = !!action && action.kind !== 'verify-totp' && action.kind !== 'recovery'
  const needsTotpCode = action?.kind === 'verify-totp'
  const needsVerification = action?.kind === 'disable-totp' || (status?.totp_enabled && (action?.kind === 'add-passkey' || action?.kind === 'remove-passkey'))
  const valid = (!needsPassword || password !== '')
    && (!needsTotpCode || /^[0-9]{6}$/.test(code.trim()))
    && (!needsVerification || code.trim() !== '')
    && (action?.kind !== 'add-passkey' || name.trim() !== '')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!action || !valid || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const verification = code.trim() || undefined
      if (action.kind === 'add-passkey') {
        const { challenge, options } = await apiPasskeyOptions(token, password, verification)
        const credential = await createPasskey(options)
        await apiVerifyPasskey(token, challenge, credential, name.trim())
      } else if (action.kind === 'remove-passkey') {
        await apiRemovePasskey(token, action.passkey.id, password, verification)
      } else if (action.kind === 'start-totp') {
        const setup = await apiTotpOptions(token, password)
        show({ kind: 'verify-totp', challenge: setup.challenge, secret: setup.secret, qr: setup.qr_data_url })
        return
      } else if (action.kind === 'verify-totp') {
        const result = await apiEnableTotp(token, action.challenge, code.trim())
        show({ kind: 'recovery', codes: result.recovery_codes })
        loadStatus()
        return
      } else if (action.kind === 'disable-totp') {
        await apiDisableTotp(token, password, code.trim())
      }
      show(null)
      loadStatus()
    } catch (err) {
      setError(passkeyError(err))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
    } catch {
      setError('コピーできませんでした。コードを選択してコピーしてください。')
    }
  }

  if (loadError && !status) return <Stack spacing={2}>
    <Alert severity="error">{loadError}</Alert>
    <Button variant="outlined" onClick={loadStatus}>もう一度読み込む</Button>
  </Stack>

  if (!status) return <CircularProgress size={26} aria-label="セキュリティ設定を読み込み中" />

  return <>
    {loadError && <Alert severity="error" action={<Button color="inherit" onClick={loadStatus}>再読み込み</Button>}>{loadError}</Alert>}
    <SectionHeader>パスキー</SectionHeader>
    <Card><CardContent><Stack spacing={1.5}>
      <Typography variant="body2">指紋・顔認証や端末のロック解除でログインできます。</Typography>
      {status.passkeys.length === 0 && <Typography color="text.secondary" variant="body2">登録済みのパスキーはありません。</Typography>}
      {status.passkeys.map((passkey) => <Stack key={passkey.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Typography fontWeight={600}>{passkey.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {Number.isFinite(passkey.created_at) && new Date(passkey.created_at).toLocaleDateString('ja-JP')}
          </Typography>
        </Box>
        <Button size="small" color="error" aria-label={`${passkey.name}を削除`} onClick={() => show({ kind: 'remove-passkey', passkey })} sx={{ flexShrink: 0, minHeight: 44 }}>削除</Button>
      </Stack>)}
      {supportsPasskeys ? <Button variant="outlined" onClick={() => show({ kind: 'add-passkey' })} sx={{ minHeight: 44 }}>パスキーを追加</Button>
        : <Typography color="text.secondary" variant="body2">パスキーの追加は、対応するブラウザーで行ってください。</Typography>}
    </Stack></CardContent></Card>
    <SectionHeader>2段階認証</SectionHeader>
    <Card><CardContent><Stack spacing={1.5}>
      <Typography variant="body2">パスワードや外部サービスでログインするとき、認証アプリのコードで本人確認を追加します。</Typography>
      <Typography fontWeight={600}>{status.totp_enabled ? '有効' : '未設定'}</Typography>
      {status.totp_enabled
        ? <Button color="error" variant="outlined" onClick={() => show({ kind: 'disable-totp' })} sx={{ minHeight: 44 }}>2段階認証を解除</Button>
        : status.totp_available
          ? <Button variant="outlined" onClick={() => show({ kind: 'start-totp' })} sx={{ minHeight: 44 }}>認証アプリを設定</Button>
          : <Typography color="text.secondary" variant="body2">現在、認証アプリを設定できません。</Typography>}
    </Stack></CardContent></Card>

    {action && <Modal title={actionTitles[action.kind]} dismissible={action.kind !== 'recovery'} onClose={() => { if (!submitting.current) show(null) }}>
      {action.kind === 'recovery' ? <Stack spacing={2}>
        <Alert severity="warning">復旧コードはこの画面で一度だけ表示します。認証アプリが使えないときに備えて、安全な場所に保存してください。各コードは1回だけ使えます。</Alert>
        <Box component="ul" sx={{ m: 0, pl: 3, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
          {action.codes.map((item) => <li key={item}>{item}</li>)}
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="outlined" onClick={() => void copyCodes(action.codes)} sx={{ minHeight: 44 }}>{copied ? 'コピーしました' : '復旧コードをコピー'}</Button>
          <Button variant="contained" onClick={() => show(null)} sx={{ minHeight: 44 }}>保存を確認して閉じる</Button>
      </Stack> : <Box component="form" onSubmit={(event) => void submit(event)}>
        <Stack spacing={2}>
          {action.kind === 'remove-passkey' && <Typography>「{action.passkey.name}」を家計簿から削除します。</Typography>}
          {action.kind === 'add-passkey' && <TextField label="パスキーの名前" value={name} onChange={(event) => setName(event.target.value)} placeholder="例：自分のスマートフォン" disabled={busy} slotProps={{ htmlInput: { maxLength: 60 } }} required />}
          {needsPassword && <TextField label="現在のパスワード" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} required />}
          {action.kind === 'verify-totp' && <>
            <Typography variant="body2">認証アプリでQRコードを読み取るか、設定キーを入力してください。</Typography>
            {/^data:image\/(png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(action.qr) && <Box component="img" src={action.qr} alt="認証アプリにアカウントを追加するQRコード" sx={{ alignSelf: 'center', display: 'block', width: 184, maxWidth: '100%', bgcolor: 'white' }} />}
            <TextField label="設定キー" value={action.secret} slotProps={{ htmlInput: { readOnly: true, 'aria-label': '設定キー' } }} />
          </>}
          {(needsTotpCode || needsVerification) && <TextField
            label={needsTotpCode ? '6桁の認証コード' : '認証コードまたは復旧コード'}
            value={code}
            onChange={(event) => setCode(needsTotpCode ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)}
            autoComplete={needsTotpCode ? 'one-time-code' : 'off'}
            slotProps={{ htmlInput: { inputMode: needsTotpCode ? 'numeric' : 'text', autoCapitalize: 'off', spellCheck: false, maxLength: needsTotpCode ? 6 : 32 } }}
            disabled={busy}
            required
          />}
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={busy || !valid} sx={{ minHeight: 44 }}>
            {busy ? '処理中…' : action.kind === 'verify-totp' ? '有効にする' : action.kind === 'start-totp' ? '次へ' : actionTitles[action.kind]}
          </Button>
          <Button disabled={busy} onClick={() => show(null)} sx={{ minHeight: 44 }}>キャンセル</Button>
        </Stack>
      </Box>}
    </Modal>}
  </>
}
