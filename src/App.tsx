import { useEffect, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
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
import { AddScreen } from './screens/AddScreen'
import { AuthScreen } from './screens/AuthScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ListScreen } from './screens/ListScreen'
import { PaymentsScreen } from './screens/PaymentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SplitScreen } from './screens/SplitScreen'
import { useStore, type ExpenseDraft } from './store'

type Tab = 'home' | 'list' | 'add' | 'payments' | 'split' | 'settings'
type MainTab = Exclude<Tab, 'add' | 'settings'>

const TABS = [
  { key: 'home', label: 'ホーム', icon: <HomeRoundedIcon /> },
  { key: 'list', label: '履歴', icon: <ReceiptLongRoundedIcon /> },
  { key: 'payments', label: '決済', icon: <CreditCardRoundedIcon /> },
  { key: 'split', label: '割り勘', icon: <GroupsRoundedIcon /> },
] satisfies { key: MainTab; label: string; icon: React.ReactNode }[]

export default function App() {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [settingsReturnTab, setSettingsReturnTab] = useState<Exclude<Tab, 'settings'>>('home')
  const [editDraft, setEditDraft] = useState<ExpenseDraft | null>(null)

  const openSettings = () => {
    if (tab !== 'settings') setSettingsReturnTab(tab)
    setTab('settings')
  }

  useEffect(() => {
    if (!s.message) return
    const timer = setTimeout(s.clearMessage, 2800)
    return () => clearTimeout(timer)
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
    <Box sx={{ minHeight: '100%', pb: 'calc(82px + env(safe-area-inset-bottom))' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
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
        {tab === 'home' && <HomeScreen />}
        {tab === 'list' && (
          <ListScreen
            onEdit={(draft) => {
              setEditDraft(draft)
              setTab('add')
            }}
            onDuplicate={(draft) => {
              setEditDraft(draft)
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
        {tab === 'split' && <SplitScreen />}
        {tab === 'settings' && <SettingsScreen />}
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
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ position: 'relative', maxWidth: 720, mx: 'auto' }}>
          <BottomNavigation
            showLabels
            value={tab === 'add' || tab === 'settings' ? false : tab}
            onChange={(_, value: MainTab) => setTab(value)}
            sx={{ height: 68 }}
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
          {tab !== 'settings' && <Fab
            color="primary"
            size="medium"
            aria-label="収入・支出を追加"
            onClick={() => {
              setEditDraft(null)
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
