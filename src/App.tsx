import { useEffect, useState } from 'react'
import { Toast } from './components/ui'
import { AddScreen } from './screens/AddScreen'
import { AuthScreen } from './screens/AuthScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ListScreen } from './screens/ListScreen'
import { PaymentsScreen } from './screens/PaymentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SplitScreen } from './screens/SplitScreen'
import { useStore, type ExpenseDraft } from './store'

type Tab = 'home' | 'list' | 'add' | 'payments' | 'split' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'ホーム', icon: '🏠' },
  { key: 'list', label: '履歴', icon: '🧾' },
  { key: 'payments', label: '決済', icon: '💳' },
  { key: 'split', label: '割り勘', icon: '👥' },
  { key: 'settings', label: '設定', icon: '⚙️' },
]

export default function App() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [editDraft, setEditDraft] = useState<ExpenseDraft | null>(null)

  // メッセージは数秒で自動的に消す
  useEffect(() => {
    if (!s.message) return
    const t = setTimeout(s.clearMessage, 2800)
    return () => clearTimeout(t)
  }, [s.message, s.clearMessage])

  if (!s.hasEntered) {
    return (
      <>
        <AuthScreen />
        {s.message && (
          <Toast
            text={s.message.text}
            kind={s.message.kind}
            onDone={s.clearMessage}
          />
        )}
      </>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-ios-bg/90 px-4 py-3 backdrop-blur">
        <span className="font-semibold">家計簿</span>
        <span
          className="text-xs"
          style={{
            color: s.syncError
              ? 'var(--color-ios-red)'
              : 'var(--color-ios-label2)',
          }}
        >
          {s.syncing
            ? '同期中…'
            : s.syncError && s.hasPendingChanges
              ? '未同期（接続待ち）'
              : s.hasPendingChanges
                ? '未同期'
                : ''}
        </span>
      </header>

      <main className="flex-1 pb-24">
        {tab === 'home' && <HomeScreen />}
        {tab === 'list' && (
          <ListScreen
            onEdit={(d) => {
              setEditDraft(d)
              setTab('add')
            }}
          />
        )}
        {tab === 'add' && (
          <AddScreen
            initial={editDraft}
            onDone={() => {
              setEditDraft(null)
              setTab('home')
            }}
          />
        )}
        {tab === 'payments' && <PaymentsScreen />}
        {tab === 'split' && (
          <SplitScreen onOpenSettings={() => setTab('settings')} />
        )}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      {/* ボトムタブ（中央に追加ボタン） */}
      <nav className="fixed right-0 bottom-0 left-0 z-20 border-t border-ios-sep bg-ios-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[58px] max-w-2xl items-center">
          {TABS.slice(0, 2).map((t) => (
            <TabButton
              key={t.key}
              label={t.label}
              icon={t.icon}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
            />
          ))}
          <div className="flex flex-1 justify-center">
            <button
              onClick={() => {
                setEditDraft(null)
                setTab('add')
              }}
              className="flex size-12 items-center justify-center rounded-full bg-ios-blue text-2xl text-white shadow-lg"
              aria-label="追加"
            >
              ＋
            </button>
          </div>
          {TABS.slice(2).map((t) => (
            <TabButton
              key={t.key}
              label={t.label}
              icon={t.icon}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
            />
          ))}
        </div>
      </nav>

      {s.message && (
        <Toast
          text={s.message.text}
          kind={s.message.kind}
          onDone={s.clearMessage}
        />
      )}
    </div>
  )
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-0.5 py-1"
      style={{
        color: active ? 'var(--color-ios-blue)' : 'var(--color-ios-label2)',
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </button>
  )
}
