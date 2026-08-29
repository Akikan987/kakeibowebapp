import { useState } from 'react'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import { Avatar, Box, Container, Link, Paper, Stack, Typography } from '@mui/material'
import { Button, Field } from '../components/ui'
import { useStore } from '../store'

type Step = 'entry' | 'login' | 'register' | 'resetRequest' | 'resetConfirm'

export function AuthScreen() {
  const s = useStore()
  const [step, setStep] = useState<Step>('entry')
  const [identifier, setIdentifier] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const go = (next: Step) => {
    s.clearMessage()
    setStep(next)
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container maxWidth="xs" sx={{ minHeight: '100%', display: 'flex', alignItems: 'center', py: 5 }}>
      <Box sx={{ width: '100%' }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main' }}>
            <CalculateRoundedIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h4" component="h1">家計簿</Typography>
          <Typography variant="body2" color="text.secondary">収入・支出の記録と割り勘の管理</Typography>
        </Stack>

        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2}>
            {step === 'entry' && (
              <>
                <Button onClick={() => go('login')}>ログイン</Button>
                <Button variant="outline" onClick={() => go('register')}>新規登録</Button>
                <Button variant="text" onClick={s.enterOffline} sx={{ color: 'text.secondary' }}>
                  アカウントなしで使う（この端末だけ）
                </Button>
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  あとから登録すれば、記録したデータはそのまま同期されます。
                </Typography>
              </>
            )}

            {step === 'login' && (
              <>
                <Field label="メール / ニックネーム / 電話番号" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
                <Field label="パスワード" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <Button disabled={busy} onClick={() => run(() => s.login(identifier, password))}>{busy ? '…' : 'ログイン'}</Button>
                <Stack direction="row" justifyContent="space-between">
                  <Link component="button" variant="body2" onClick={() => go('resetRequest')}>パスワードを忘れた</Link>
                  <Link component="button" variant="body2" color="text.secondary" onClick={() => go('entry')}>戻る</Link>
                </Stack>
              </>
            )}

            {step === 'register' && (
              <>
                <Field label="ニックネーム" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                <Field label="メールアドレス" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <Field label="電話番号" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                <Field label="パスワード" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                <Button disabled={busy} onClick={() => run(() => s.register(phone, email, nickname, password))}>{busy ? '…' : '登録する'}</Button>
                <Button variant="text" onClick={() => go('entry')} sx={{ color: 'text.secondary' }}>戻る</Button>
              </>
            )}

            {step === 'resetRequest' && (
              <>
                <Typography variant="body2" color="text.secondary">登録したメールアドレスに再設定コードを送ります。</Typography>
                <Field label="メールアドレス" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button disabled={busy} onClick={() => run(async () => { if (await s.requestReset(email)) setStep('resetConfirm') })}>コードを送る</Button>
                <Button variant="text" onClick={() => go('login')} sx={{ color: 'text.secondary' }}>戻る</Button>
              </>
            )}

            {step === 'resetConfirm' && (
              <>
                <Field label="メールアドレス" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Field label="メールに届いた6桁コード" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
                <Field label="新しいパスワード" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button disabled={busy} onClick={() => run(async () => { if (await s.resetPassword(email, code, password)) { setPassword(''); setStep('login') } })}>再設定する</Button>
                <Button variant="text" onClick={() => go('login')} sx={{ color: 'text.secondary' }}>ログインへ</Button>
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    </Container>
  )
}
