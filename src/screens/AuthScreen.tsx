import { useState } from 'react'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import { Alert, Avatar, Box, Button, Container, Divider, IconButton, InputAdornment, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { SocialLogin, socialError } from '../components/SocialLogin'
import { apiSocialRegister } from '../api'
import { useStore } from '../store'

type Step = 'login' | 'register' | 'resetRequest' | 'resetConfirm'

function PasswordField({ label, value, onChange, confirm = false, error = false, creating = false }: {
  label: string; value: string; onChange: (value: string) => void; confirm?: boolean; error?: boolean; creating?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return <TextField label={label} required fullWidth value={value} onChange={(e) => onChange(e.target.value)}
    type={visible ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} error={error}
    helperText={error ? 'パスワードが一致していません' : creating && !confirm ? '8文字以上。アカウントの管理や予備のログインに使います。' : undefined}
    slotProps={{ htmlInput: { minLength: creating ? 8 : 1, maxLength: 256 }, input: { endAdornment:
      <InputAdornment position="end"><IconButton edge="end" aria-label={`${label}を${visible ? '隠す' : '表示'}`} onClick={() => setVisible(!visible)}>
        {visible ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
      </IconButton></InputAdornment> } }} />
}

export function AuthScreen({ socialSignup = false, onCancel }: { socialSignup?: boolean; onCancel?: () => void }) {
  const s = useStore()
  const [step, setStep] = useState<Step>(socialSignup ? 'register' : 'login')
  const [identifier, setIdentifier] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = (next: Step) => { s.clearMessage(); setError(''); setPassword(''); setPasswordConfirm(''); setStep(next) }
  const mismatch = passwordConfirm !== '' && password !== passwordConfirm
  const creating = step === 'register' || step === 'resetConfirm'
  const submit = async () => {
    if (busy || (creating && (!passwordConfirm || password !== passwordConfirm))) return
    setBusy(true)
    setError('')
    try {
      if (step === 'login') await s.login(identifier, password)
      if (step === 'register') {
        if (socialSignup) {
          await s.acceptSocialAccount(await apiSocialRegister(phone, email, nickname, password))
          onCancel?.()
        } else await s.register(phone, email, nickname, password)
      }
      if (step === 'resetRequest' && await s.requestReset(email)) go('resetConfirm')
      if (step === 'resetConfirm' && await s.resetPassword(email, code, password)) go('login')
    } catch (err) { setError(socialError(err)) } finally { setBusy(false) }
  }

  return <Container maxWidth="sm" sx={{ minHeight: '100%', py: { xs: 3, sm: 6 } }}>
    <Stack alignItems="center" spacing={1} sx={{ mb: 3, textAlign: 'center' }}>
      <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', mb: 0.5 }}><CalculateRoundedIcon fontSize="large" /></Avatar>
      <Typography variant="h4" component="h1" fontWeight={800}>家計簿</Typography>
      <Typography variant="body2" color="text.secondary">毎日のお金を、ひとつの場所で。</Typography>
    </Stack>
    <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: '24px', border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={3}>
        {!socialSignup && (step === 'login' || step === 'register') ? <>
          <Tabs value={step} variant="fullWidth" onChange={(_, value: Step) => { if (!busy) go(value) }} aria-label="ログインまたは新規登録">
            <Tab label="ログイン" value="login" disabled={busy} /><Tab label="新規登録" value="register" disabled={busy} />
          </Tabs>
          <SocialLogin disabled={busy} onBusyChange={setBusy} />
          <Divider><Typography variant="caption" color="text.secondary">またはメールなどで{step === 'login' ? 'ログイン' : '登録'}</Typography></Divider>
        </> : <Typography variant="h6" component="h2">{socialSignup ? '初回の登録を完了する' : 'パスワードを再設定'}</Typography>}

        {socialSignup && <Alert severity="info">外部サービスの認証が完了しました。初回だけ家計簿の登録情報と予備のパスワードを設定します。次回から外部サービスでログインできます。登録済みの方は戻って通常ログイン後、設定から連携してください。</Alert>}
        <Box component="form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Stack spacing={2.5}>
            {step === 'login' && <TextField label="メール / ニックネーム / 電話番号" required autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />}
            {step === 'register' && <TextField label="ニックネーム" required autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} slotProps={{ htmlInput: { maxLength: 64 } }} helperText="割り勘で相手に表示される名前です" />}
            {step !== 'login' && <TextField label="メールアドレス" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} slotProps={{ htmlInput: { maxLength: 254 } }} />}
            {step === 'register' && <TextField label="電話番号" type="tel" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} slotProps={{ htmlInput: { maxLength: 32 } }} />}
            {step === 'resetRequest' && <Typography variant="body2" color="text.secondary">登録したメールアドレスへ、再設定用の6桁コードを送ります。</Typography>}
            {step === 'resetConfirm' && <TextField label="メールに届いた6桁コード" required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 } }} />}
            {step !== 'resetRequest' && <PasswordField label={step === 'resetConfirm' ? '新しいパスワード' : 'パスワード'} value={password} onChange={setPassword} creating={creating} />}
            {creating && <PasswordField label="パスワード（確認）" value={passwordConfirm} onChange={setPasswordConfirm} creating confirm error={mismatch} />}
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy || (creating && (!passwordConfirm || mismatch))} sx={{ minHeight: 48 }}>
              {busy ? '処理中…' : step === 'login' ? 'ログイン' : step === 'register' ? '登録してはじめる' : step === 'resetRequest' ? 'コードを送る' : 'パスワードを再設定'}
            </Button>
            {step === 'login' && <Button size="small" disabled={busy} onClick={() => go('resetRequest')}>パスワードを忘れた方</Button>}
            {(step.startsWith('reset') || socialSignup) && <Button disabled={busy} onClick={() => { if (socialSignup) onCancel?.(); else go('login') }}>ログイン画面に戻る</Button>}
          </Stack>
        </Box>
      </Stack>
    </Paper>
    {!socialSignup && <Stack spacing={0.5} sx={{ mt: 2.5, textAlign: 'center' }}>
      <Button disabled={busy} onClick={s.enterOffline} sx={{ color: 'text.secondary' }}>アカウントなしで試す</Button>
      <Typography variant="caption" color="text.secondary">記録はこの端末に保存。あとから登録して同期できます。</Typography>
    </Stack>}
  </Container>
}
