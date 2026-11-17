import { useRef, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { apiCompleteMfa, type MfaChallenge } from '../api'
import type { Account } from '../types'

export function MfaChallengeForm({ challenge, onAuthenticated, onCancel }: {
  challenge: MfaChallenge
  onAuthenticated: (account: Account) => Promise<void>
  onCancel: () => void
}) {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const normalized = code.trim()
  const valid = useRecoveryCode ? normalized.length > 0 : /^[0-9]{6}$/.test(normalized)

  const verify = async () => {
    if (submitting.current || !valid) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      await onAuthenticated(await apiCompleteMfa(challenge.challenge, normalized))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コードを確認できませんでした。')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <Box component="form" onSubmit={(event) => { event.preventDefault(); void verify() }}>
    <Stack spacing={2}>
      <Typography component="h2" variant="h6">2段階認証</Typography>
      <Typography color="text.secondary" variant="body2">
        {useRecoveryCode ? '設定時に保存した、未使用の復旧コードを入力してください。' : '認証アプリに表示されている6桁のコードを入力してください。'}
      </Typography>
      <TextField
        autoFocus
        label={useRecoveryCode ? '復旧コード' : '認証コード'}
        value={code}
        disabled={busy}
        onChange={(event) => setCode(useRecoveryCode ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))}
        autoComplete={useRecoveryCode ? 'off' : 'one-time-code'}
        slotProps={{ htmlInput: { inputMode: useRecoveryCode ? 'text' : 'numeric', autoCapitalize: 'off', spellCheck: false, maxLength: useRecoveryCode ? 32 : 6 } }}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" disabled={!valid || busy} sx={{ minHeight: 44 }}>認証する</Button>
      <Button disabled={busy} onClick={() => {
        setUseRecoveryCode(!useRecoveryCode)
        setCode('')
        setError('')
      }} sx={{ minHeight: 44 }}>{useRecoveryCode ? '認証アプリを使う' : '復旧コードを使う'}</Button>
      <Button disabled={busy} onClick={onCancel} sx={{ minHeight: 44 }}>ログインに戻る</Button>
    </Stack>
  </Box>
}
