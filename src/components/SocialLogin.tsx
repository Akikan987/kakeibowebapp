import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { ApiError, apiSocialConnections, apiSocialProviders, apiSocialStart, apiSocialUnlink, type SocialProvider, type SocialProviderId } from '../api'
import { Field, Modal } from './ui'

const labels: Record<SocialProviderId, string> = { google: 'Google', line: 'LINE', kakao: 'KakaoTalk', x: 'X' }
export const socialError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 404) return '外部ログインは準備中です。通常のログインをご利用ください。'
    if (error.status === 429) return '試行回数が多すぎます。しばらく待ってからお試しください。'
    if (/already used/.test(error.detail)) return 'この登録情報は既に使われています。登録済みの場合は、通常ログイン後に設定から連携してください。'
    if (error.detail === 'invalid email') return 'メールアドレスの形式を確認してください。'
    return error.detail
  }
  return '接続できませんでした。もう一度お試しください。'
}

export function SocialLogin({ token, disabled = false, onBusyChange }: { token?: string; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [linked, setLinked] = useState<SocialProviderId[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selection, setSelection] = useState<SocialProviderId | null>(null)
  const [password, setPassword] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void Promise.all([apiSocialProviders(), token ? apiSocialConnections(token) : Promise.resolve({ linked: [] })])
      .then(([available, connections]) => { if (active) { setProviders(available.providers); setLinked(connections.linked) } })
      .catch((err: unknown) => { if (active) setError(socialError(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, attempt])

  const start = async (provider: SocialProviderId) => {
    setBusy(true)
    onBusyChange?.(true)
    setError('')
    setNotice('')
    try {
      const { url } = await apiSocialStart(provider, token, password)
      window.location.assign(url)
    } catch (err) { setError(socialError(err)); setBusy(false); onBusyChange?.(false) }
  }
  const submit = async () => {
    if (!selection || !token) return
    if (!linked.includes(selection)) { await start(selection); return }
    setBusy(true)
    setError('')
    try {
      await apiSocialUnlink(selection, token, password)
      setLinked((prev) => prev.filter((id) => id !== selection))
      setSelection(null)
      setPassword('')
      setNotice('連携を解除し、ほかの端末からログアウトしました。')
    } catch (err) { setError(socialError(err)) } finally { setBusy(false) }
  }
  return <Stack spacing={1.5}>
    <Typography variant="subtitle2">{token ? '外部サービスとの連携' : '外部サービスで続ける'}</Typography>
    {loading ? <Box role="status" sx={{ textAlign: 'center', p: 2 }}><CircularProgress size={22} aria-label="ログイン方法を読み込み中" /></Box> :
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
        {providers.map((provider) => <Button key={provider.id} variant="outlined" disabled={busy || disabled || (!provider.enabled && !linked.includes(provider.id))}
          sx={{ minHeight: 48, textTransform: 'none', borderColor: 'divider', color: 'text.primary' }}
          onClick={() => { if (token) { setSelection(provider.id); setPassword(''); setError('') } else void start(provider.id) }}>
          <Stack spacing={0.25}><span>{provider.name}</span><Typography variant="caption" color="text.secondary">
            {linked.includes(provider.id) ? '連携済み・解除' : !provider.enabled ? '準備中' : token ? '連携する' : 'ログイン / 登録'}
          </Typography></Stack>
        </Button>)}
      </Box>}
    {!loading && providers.length > 0 && providers.every((p) => !p.enabled) && <Typography variant="caption" color="text.secondary">外部ログインは設定準備中です。メールでのログイン・登録は利用できます。</Typography>}
    <Typography variant="caption" color="text.secondary">{token ? '連携先は各サービス1アカウントです。解除時は、この端末以外のログインも無効になります。' : '登録済みの方は、いつもの方法でログインして「設定」から連携してください。同じメールでも自動統合しません。'}</Typography>
    {error && !selection && <Alert severity="error" action={!providers.length && !loading ? <Button onClick={() => setAttempt((v) => v + 1)}>再試行</Button> : undefined}>{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    {selection && <Modal title={`${labels[selection]}${linked.includes(selection) ? 'の連携を解除' : 'と連携'}`} onClose={() => { if (!busy) setSelection(null) }}>
      <Box component="form" onSubmit={(event) => { event.preventDefault(); if (!busy) void submit() }}><Stack spacing={2}>
        <Typography variant="body2">家計簿の現在のパスワードを入力してください。{!linked.includes(selection) && '続けると外部サービスの認証画面が開きます。'}</Typography>
        <Field label="現在のパスワード" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={busy || !password}>{busy ? '処理中…' : linked.includes(selection) ? '連携を解除する' : '認証へ進む'}</Button>
      </Stack></Box>
    </Modal>}
  </Stack>
}
