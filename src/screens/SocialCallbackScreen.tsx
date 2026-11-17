import { useEffect, useRef, useState } from 'react'
import { Alert, Button, CircularProgress, Container, Stack, Typography } from '@mui/material'
import { apiSocialCancel, apiSocialComplete, type MfaChallenge } from '../api'
import { MfaChallengeForm } from '../components/MfaChallengeForm'
import { socialError } from '../components/SocialLogin'
import { useStore } from '../store'
import { AuthScreen } from './AuthScreen'

export function SocialCallbackScreen({ failed, onDone }: { failed: boolean; onDone: (linked?: boolean) => void }) {
  const s = useStore()
  const started = useRef(false)
  const [signup, setSignup] = useState(false)
  const [mfa, setMfa] = useState<MfaChallenge | null>(null)
  const [error, setError] = useState(failed ? '認証が中断されたか、期限が切れました。同じブラウザで、もう一度お試しください。' : '')
  useEffect(() => {
    if (started.current || failed) return
    started.current = true // StrictMode must not exchange a one-use flow twice.
    void apiSocialComplete(s.account?.token, true).then(async (response) => {
      if (response.status === 'signup') { setSignup(true); return }
      if (response.status === 'mfa_required') { setMfa(response); return }
      if (response.status === 'authenticated') await s.acceptSocialAccount(response.account)
      else s.notify('外部サービスと連携しました')
      onDone(response.status === 'linked')
    }).catch((err: unknown) => setError(socialError(err)))
  }, [failed, onDone, s])
  const cancel = () => { void apiSocialCancel().catch(() => undefined).finally(() => onDone()) }
  if (signup) return <AuthScreen socialSignup onCancel={cancel} />
  if (mfa) return <Container maxWidth="xs" sx={{ py: 4 }}>
    <MfaChallengeForm challenge={mfa} onCancel={cancel} onAuthenticated={async (account) => {
      await s.acceptSocialAccount(account)
      onDone()
    }} />
  </Container>
  return <Container maxWidth="xs" sx={{ py: 8 }}><Stack spacing={3} alignItems="center">
    <Typography variant="h6">外部サービスでログイン</Typography>
    {error ? <><Alert severity="error">{error}</Alert><Button variant="outlined" onClick={cancel}>戻ってやり直す</Button></> : <><CircularProgress /><Typography role="status">認証を確認しています…</Typography></>}
  </Stack></Container>
}
