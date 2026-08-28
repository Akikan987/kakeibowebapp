import { useState } from 'react'
import { useStore } from '../store'
import { Button, Field } from '../components/ui'

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
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-ios-blue text-3xl">
          🧮
        </div>
        <h1 className="text-3xl font-bold">家計簿</h1>
        <p className="mt-1 text-sm text-ios-label2">
          収入・支出の記録と割り勘の管理
        </p>
      </div>

      <div className="space-y-3">
        {step === 'entry' && (
          <>
            <Button onClick={() => go('login')}>ログイン</Button>
            <Button variant="outline" onClick={() => go('register')}>
              新規登録
            </Button>
            <button
              onClick={s.enterOffline}
              className="w-full rounded-xl px-4 py-3 text-ios-label2"
            >
              アカウントなしで使う（この端末だけ）
            </button>
            <p className="text-center text-xs text-ios-label2">
              あとから登録すれば、記録したデータはそのまま同期されます。
            </p>
          </>
        )}

        {step === 'login' && (
          <>
            <Field
              label="メール / ニックネーム / 電話番号"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />
            <Field
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button
              disabled={busy}
              onClick={() => run(() => s.login(identifier, password))}
            >
              {busy ? '…' : 'ログイン'}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                className="text-ios-blue"
                onClick={() => go('resetRequest')}
              >
                パスワードを忘れた
              </button>
              <button className="text-ios-label2" onClick={() => go('entry')}>
                戻る
              </button>
            </div>
          </>
        )}

        {step === 'register' && (
          <>
            <Field
              label="ニックネーム"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Field
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Field
              label="電話番号"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <Field
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Button
              disabled={busy}
              onClick={() =>
                run(() => s.register(phone, email, nickname, password))
              }
            >
              {busy ? '…' : '登録する'}
            </Button>
            <button
              className="w-full text-center text-sm text-ios-label2"
              onClick={() => go('entry')}
            >
              戻る
            </button>
          </>
        )}

        {step === 'resetRequest' && (
          <>
            <p className="text-sm text-ios-label2">
              登録したメールアドレスに再設定コードを送ります。
            </p>
            <Field
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (await s.requestReset(email)) setStep('resetConfirm')
                })
              }
            >
              コードを送る
            </Button>
            <button
              className="w-full text-center text-sm text-ios-label2"
              onClick={() => go('login')}
            >
              戻る
            </button>
          </>
        )}

        {step === 'resetConfirm' && (
          <>
            <Field
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="メールに届いた6桁コード"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Field
              label="新しいパスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (await s.resetPassword(email, code, password)) {
                    setPassword('')
                    setStep('login')
                  }
                })
              }
            >
              再設定する
            </Button>
            <button
              className="w-full text-center text-sm text-ios-label2"
              onClick={() => go('login')}
            >
              ログインへ
            </button>
          </>
        )}
      </div>
    </div>
  )
}
