import { lazy, Suspense, useEffect, useState } from 'react'
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
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { Toast } from './components/ui'
import { AuthScreen } from './screens/AuthScreen'
import { clearAppShortcutFromUrl, parseAppShortcut } from './shortcuts'
import { emptyDraft, useStore, type ExpenseDraft } from './store'
import { TYPE_EXPENSE, TYPE_INCOME, now } from './types'

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

  const openSettings = () => {
    if (tab !== 'settings') setSettingsReturnTab(tab)
    setTab('settings')
  }

  useEffect(() => {
    if (!s.message) return
    const timer = setTimeout(s.clearMessage, 2800)
    return () => clearTimeout(timer)
  }, [s.message, s.clearMessage])

  useEffect(() => {
    clearAppShortcutFromUrl()
  }, [])

  useEffect(() => {
    if (MAIN_TABS.includes(tab as MainTab)) localStorage.setItem(LAST_TAB_KEY, tab)
  }, [tab])

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
    <Box sx={{ minHeight: '100dvh', pb: 'calc(82px + env(safe-area-inset-bottom))' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          pt: 'env(safe-area-inset-top)',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(16,20,24,0.88)'
              : 'rgba(247,249,252,0.9)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
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
              sx={{ ml: 0.5 }}
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
        elevation={10}
        sx={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          pb: 'env(safe-area-inset-bottom)',
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ position: 'relative', maxWidth: 720, mx: 'auto' }}>
          <BottomNavigation
            showLabels
            value={tab === 'add' || tab === 'settings' ? false : tab}
            onChange={(_, value: MainTab) => setTab(value)}
            sx={{ height: 68, bgcolor: 'transparent' }}
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
            sx={{ position: 'absolute', right: 16, top: -56 }}
          >
            <AddRoundedIcon />
          </Fab>}
        </Box>
      </Paper>

      {s.message && (
        <Toast text={s.message.text} kind={s.message.kind} onDone={s.clearMessage} />
      )}
    </Box>
  )
}
