import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  Fab,
  IconButton,
  Paper,
  Snackbar,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { Toast } from './components/ui'
import { AuthScreen } from './screens/AuthScreen'
import { SocialCallbackScreen } from './screens/SocialCallbackScreen'
import { clearAppShortcutFromUrl, parseAppShortcut } from './shortcuts'
import { emptyDraft, useStore, type ExpenseDraft } from './store'
import { TYPE_EXPENSE, TYPE_INCOME, now } from './types'
import { glassSurface } from './glass'
import { BACK_EXIT_WINDOW_MS, createBackNavigation } from './backNavigation'

const AddScreen = lazy(() => import('./screens/AddScreen').then((module) => ({ default: module.AddScreen })))
const HomeScreen = lazy(() => import('./screens/HomeScreen').then((module) => ({ default: module.HomeScreen })))
const ListScreen = lazy(() => import('./screens/ListScreen').then((module) => ({ default: module.ListScreen })))
const PaymentsScreen = lazy(() => import('./screens/PaymentsScreen').then((module) => ({ default: module.PaymentsScreen })))
const PlanningScreen = lazy(() => import('./screens/PlanningScreen').then((module) => ({ default: module.PlanningScreen })))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })))
const SplitScreen = lazy(() => import('./screens/SplitScreen').then((module) => ({ default: module.SplitScreen })))

type Tab = 'home' | 'planning' | 'list' | 'add' | 'payments' | 'split' | 'settings'
type MainTab = Exclude<Tab, 'add' | 'settings'>

const LAST_TAB_KEY = 'kakeibo:last-main-tab'
const MAIN_TABS: MainTab[] = ['home', 'planning', 'list', 'payments', 'split']

const readLastTab = (): MainTab => {
  const saved = localStorage.getItem(LAST_TAB_KEY)
  return MAIN_TABS.includes(saved as MainTab) ? (saved as MainTab) : 'home'
}

const TABS = [
  { key: 'home', label: '収支', icon: <InsightsRoundedIcon /> },
  { key: 'planning', label: '予算', icon: <SavingsRoundedIcon /> },
  { key: 'list', label: '履歴', icon: <ReceiptLongRoundedIcon /> },
  { key: 'payments', label: '決済', icon: <CreditCardRoundedIcon /> },
  { key: 'split', label: '割り勘', icon: <GroupsRoundedIcon /> },
] satisfies { key: MainTab; label: string; icon: React.ReactNode }[]

export default function App() {
  const s = useStore()
  const [socialCallback, setSocialCallback] = useState(() => new URLSearchParams(window.location.search).get('social'))
  const lastTab = readLastTab()
  const shortcut = parseAppShortcut(window.location.search)
  const shortcutDraft = shortcut === 'add-expense' || shortcut === 'add-income'
    ? {
        ...emptyDraft(),
        type: shortcut === 'add-income' ? TYPE_INCOME : TYPE_EXPENSE,
        purchasedAtMillis: now(),
      }
    : null
  const initialTab: Tab = shortcutDraft ? 'add' : shortcut === 'withdrawals' ? 'payments' : lastTab
  const [tab, setTab] = useState<Tab>(initialTab)
  const [settingsReturnTab, setSettingsReturnTab] = useState<Exclude<Tab, 'settings'>>(shortcutDraft ? lastTab : initialTab)
  const [addReturnTab, setAddReturnTab] = useState<MainTab>(lastTab)
  const [editDraft, setEditDraft] = useState<ExpenseDraft | null>(shortcutDraft)
  const [exitHint, setExitHint] = useState(false)
  const currentTab = useRef(tab)
  currentTab.current = tab
  const backNavigation = useRef<ReturnType<typeof createBackNavigation> | null>(null)
  const previousOwner = useRef(s.account?.uid)
  useEffect(() => {
    if (previousOwner.current === s.account?.uid) return
    previousOwner.current = s.account?.uid
    setEditDraft(null)
    setTab(readLastTab())
  }, [s.account?.uid])

  const openSettings = () => {
    if (tab !== 'settings') setSettingsReturnTab(tab)
    setTab('settings')
  }

  useEffect(() => {
    if (!s.message) return
    const timer = setTimeout(s.clearMessage, s.message.action ? 10_000 : 2800)
    return () => clearTimeout(timer)
  }, [s.message, s.clearMessage])

  useEffect(() => {
    clearAppShortcutFromUrl()
  }, [])

  useEffect(() => {
    if (MAIN_TABS.includes(tab as MainTab)) localStorage.setItem(LAST_TAB_KEY, tab)
  }, [tab])

  const backEnabled = s.hasEntered && !socialCallback
  useEffect(() => {
    if (!backEnabled) {
      backNavigation.current?.release()
      backNavigation.current = null
      setExitHint(false)
      return
    }
    const controller = createBackNavigation({
      history: window.history,
      clock: { setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: (id) => window.clearTimeout(id) },
      isHome: () => currentTab.current === 'home',
      goHome: () => {
        currentTab.current = 'home'
        setEditDraft(null)
        setTab('home')
      },
      showExitHint: setExitHint,
    })
    backNavigation.current = controller
    window.addEventListener('popstate', controller.onPopState)
    const resume = (event: PageTransitionEvent) => { if (event.persisted) controller.resume() }
    window.addEventListener('pageshow', resume)
    controller.start()
    return () => {
      window.removeEventListener('popstate', controller.onPopState)
      window.removeEventListener('pageshow', resume)
      controller.stop()
    }
  }, [backEnabled])

  useEffect(() => { backNavigation.current?.screenChanged() }, [tab])

  if (socialCallback === 'complete' || socialCallback === 'error') {
    return <><SocialCallbackScreen failed={socialCallback === 'error'} onDone={(linked) => {
      const url = new URL(window.location.href)
      url.searchParams.delete('social')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      setSocialCallback(null)
      if (linked) setTab('settings')
    }} />{s.message && <Toast text={s.message.text} kind={s.message.kind} onDone={s.clearMessage} />}</>
  }

  if (!s.hasEntered) {
    return (
      <>
        <AuthScreen />
        {s.message && (
          <Toast
            text={s.message.text}
            kind={s.message.kind}
            action={s.message.action}
            onDone={s.clearMessage}
          />
        )}
      </>
    )
  }

  return (
    <Box sx={{ minHeight: '100dvh', pb: 'calc(106px + env(safe-area-inset-bottom))' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={(theme) => ({
          ...glassSurface(theme.palette.mode === 'dark', 20),
          pt: 'env(safe-area-inset-top)',
          borderWidth: '0 0 1px',
          boxShadow: 'none',
        })}
      >
        <Toolbar sx={{ minHeight: '56px !important', maxWidth: 720, width: '100%', mx: 'auto' }}>
          <Typography variant="h6" color="text.primary" sx={{ flex: 1 }}>
            家計簿
          </Typography>
          <Typography
            variant="caption"
            color={s.syncError ? 'error.main' : 'text.secondary'}
            aria-live="polite"
          >
            {s.syncing
              ? '同期中…'
              : s.syncError && s.hasPendingChanges
                ? '未同期（接続待ち）'
                : s.hasPendingChanges
                  ? '未同期'
                  : ''}
          </Typography>
          <Tooltip title={tab === 'settings' ? '設定を閉じる' : '設定'}>
            <IconButton
              aria-label={tab === 'settings' ? '設定を閉じる' : '設定を開く'}
              color="inherit"
              onClick={() => tab === 'settings' ? setTab(settingsReturnTab) : openSettings()}
              sx={{ ml: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
            >
              {tab === 'settings' ? <ArrowBackRoundedIcon /> : <SettingsRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="sm" disableGutters>
        <Suspense fallback={<Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">画面を読み込み中…</Typography></Box>}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'planning' && <PlanningScreen />}
          {tab === 'list' && (
            <ListScreen
              onEdit={(draft) => {
                setEditDraft(draft)
                setAddReturnTab('list')
                setTab('add')
              }}
              onDuplicate={(draft) => {
                setEditDraft(draft)
                setAddReturnTab('list')
                setTab('add')
              }}
            />
          )}
          {tab === 'add' && (
            <AddScreen
              key={`${s.account?.uid ?? 'offline'}:${editDraft?.editingId ?? 'new'}`}
              initial={editDraft}
              onDone={() => {
                setEditDraft(null)
                setTab(addReturnTab)
              }}
            />
          )}
          {tab === 'payments' && <PaymentsScreen />}
          {tab === 'split' && <SplitScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </Suspense>
      </Container>

      <Paper
        component="nav"
        square
        elevation={0}
        sx={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          pb: 'calc(8px + env(safe-area-inset-bottom))',
          bgcolor: 'transparent',
          backgroundImage: 'none',
        }}
      >
        <Box sx={(theme) => ({
          ...glassSurface(theme.palette.mode === 'dark', 24),
          position: 'relative',
          maxWidth: 600,
          width: 'calc(100% - 24px)',
          mx: 'auto',
          px: 0.5,
          borderRadius: '32px',
        })}>
          <BottomNavigation
            showLabels
            value={tab === 'add' || tab === 'settings' ? false : tab}
            onChange={(_, value: MainTab) => setTab(value)}
            sx={{ height: 72, bgcolor: 'transparent' }}
          >
            {TABS.map((item) => (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={item.label}
                icon={item.icon}
                sx={{ minWidth: 0, px: 0.5 }}
              />
            ))}
          </BottomNavigation>
          {MAIN_TABS.includes(tab as MainTab) && <Fab
            color="primary"
            size="medium"
            aria-label="収入・支出を追加"
            onClick={() => {
              setEditDraft(null)
              setAddReturnTab(tab as MainTab)
              setTab('add')
            }}
            sx={{ position: 'absolute', right: 4, top: -68 }}
          >
            <AddRoundedIcon />
          </Fab>}
        </Box>
      </Paper>

      {s.message && (
        <Toast text={s.message.text} kind={s.message.kind} action={s.message.action} onDone={s.clearMessage} />
      )}
      <Snackbar
        open={exitHint}
        message="もう一度戻ると終了します"
        autoHideDuration={BACK_EXIT_WINDOW_MS}
        transitionDuration={0}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: 'calc(104px + env(safe-area-inset-bottom))', zIndex: (theme) => theme.zIndex.snackbar + 1 }}
      />
    </Box>
  )
}
