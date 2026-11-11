import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  Fab,
  IconButton,
  Paper,
  Snackbar,
  Skeleton,
  Toolbar,
  Tooltip,
  Typography,
  Button as MuiButton,
} from '@mui/material'
import { Toast } from './components/ui'
import { AuthScreen } from './screens/AuthScreen'
import { SocialCallbackScreen } from './screens/SocialCallbackScreen'
import { clearAppShortcutFromUrl, parseAppShortcut } from './shortcuts'
import { emptyDraft, useStore, type ExpenseDraft } from './store'
import { TYPE_EXPENSE, TYPE_INCOME, now } from './types'
import { glassSurface } from './glass'
import { BACK_EXIT_WINDOW_MS, createBackNavigation } from './backNavigation'
import { requestSectionBack } from './sectionNavigation'
import { nativeNotificationCommand } from './native/notifications'
import { createGmailCompletion, GMAIL_COMPLETION_KEY, gmailCandidateAction, gmailCompletionPending, gmailOpenReason, type GmailOpenReason } from './imports/gmail'
import { prefetchScreenAssets } from './screenPrefetch'
import { isHybridNative } from './native/runtime'

const AddScreen = lazy(() => import('./screens/AddScreen').then((module) => ({ default: module.AddScreen })))
const HomeScreen = lazy(() => import('./screens/HomeScreen').then((module) => ({ default: module.HomeScreen })))
const ListScreen = lazy(() => import('./screens/ListScreen').then((module) => ({ default: module.ListScreen })))
const PaymentsScreen = lazy(() => import('./screens/PaymentsScreen').then((module) => ({ default: module.PaymentsScreen })))
const PlanningScreen = lazy(() => import('./screens/PlanningScreen').then((module) => ({ default: module.PlanningScreen })))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })))
const SplitScreen = lazy(() => import('./screens/SplitScreen').then((module) => ({ default: module.SplitScreen })))

type Tab = 'home' | 'planning' | 'list' | 'add' | 'payments' | 'split' | 'settings'
type MainTab = Exclude<Tab, 'add' | 'settings'>
type SettingsDestination = 'index' | 'integrations' | 'data'

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
  const [sectionParentLabel, setSectionParentLabel] = useState<string | null>(null)
  const [settingsPageRequest, setSettingsPageRequest] = useState<{ section: SettingsDestination; revision: number }>({ section: 'index', revision: 0 })
  const [addReturnTab, setAddReturnTab] = useState<MainTab>(lastTab)
  const [editDraft, setEditDraft] = useState<ExpenseDraft | null>(shortcutDraft)
  const [addDraftRevision, setAddDraftRevision] = useState(0)
  const [gmailFocusRequest, setGmailFocusRequest] = useState(0)
  useEffect(() => { if (tab !== 'add') setGmailFocusRequest(0) }, [tab])
  const [nativeImport, setNativeImport] = useState<{ id: string; source: string; owner: string } | null>(null)
  const [gmailImport, setGmailImport] = useState<{ id: string; source: string; owner: string } | null>(null)
  const [gmailPrompt, setGmailPrompt] = useState<GmailOpenReason | null>(() => { const reason = gmailOpenReason(window.location.search); return reason === 'complete' ? null : reason })
  const [gmailCompletion, setGmailCompletion] = useState<'waiting' | 'working' | 'error' | null>(() => gmailCompletionPending(window.location.search, sessionStorage) ? 'waiting' : null)
  const [gmailCompletionError, setGmailCompletionError] = useState('')
  const [gmailCompletionAttempt, setGmailCompletionAttempt] = useState(0)
  const gmailNeedsCompletion = useRef(gmailCompletion !== null)
  const completeGmail = useRef<ReturnType<typeof createGmailCompletion> | null>(null)
  if (!completeGmail.current) completeGmail.current = createGmailCompletion()
  const [gmailAckError, setGmailAckError] = useState(false)
  const [gmailCandidateEditHint, setGmailCandidateEditHint] = useState(false)
  const [nativeAckError, setNativeAckError] = useState(false)
  const [exitHint, setExitHint] = useState(false)
  const currentTab = useRef(tab)
  currentTab.current = tab
  const settingsReturnTabRef = useRef(settingsReturnTab)
  settingsReturnTabRef.current = settingsReturnTab
  const goBackWithinScreen = useCallback(() => {
    if (requestSectionBack(window)) return true
    if (currentTab.current !== 'settings') return false
    setTab(settingsReturnTabRef.current)
    return true
  }, [])
  const backNavigation = useRef<ReturnType<typeof createBackNavigation> | null>(null)
  const previousOwner = useRef(s.account?.uid)
  useEffect(() => {
    if (previousOwner.current === s.account?.uid) return
    previousOwner.current = s.account?.uid
    setEditDraft(null)
    setNativeImport(null)
    setGmailImport(null)
    setTab(readLastTab())
  }, [s.account?.uid])

  const openSettings = (section: SettingsDestination = 'index') => {
    setSettingsPageRequest((request) => ({ section, revision: request.revision + 1 }))
    if (tab !== 'settings') setSettingsReturnTab(tab)
    setTab('settings')
  }

  const closeEntry = () => {
    setNativeImport(null)
    setGmailImport(null)
    setEditDraft(null)
    setTab(addReturnTab)
  }

  const openEntry = (returnTab: MainTab, firstExpense = false) => {
    setNativeImport(null)
    setGmailImport(null)
    setAddReturnTab(returnTab)
    if (firstExpense) {
      const today = new Date()
      const { year, month } = s.month
      const date = today.getFullYear() === year && today.getMonth() === month - 1
        ? today
        : new Date(year, month - 1, 1, 12)
      setEditDraft({ ...emptyDraft(), type: TYPE_EXPENSE, purchasedAtMillis: date.getTime() })
    } else setEditDraft(null)
    setTab('add')
  }

  const openGmailCandidates = () => {
    setGmailPrompt(null)
    if (editDraft?.editingId) {
      setGmailCandidateEditHint(true)
      return
    }
    if (tab !== 'add') {
      setAddReturnTab(tab === 'settings' ? (settingsReturnTab === 'add' ? lastTab : settingsReturnTab) : tab)
      setTab('add')
    }
    setGmailFocusRequest((request) => request + 1)
  }

  const clearGmailCompletion = () => {
    gmailNeedsCompletion.current = false
    try { sessionStorage.removeItem(GMAIL_COMPLETION_KEY) } catch { /* Completion contains no credentials. */ }
    const url = new URL(window.location.href)
    if (url.searchParams.get('gmail') === 'complete') {
      url.searchParams.delete('gmail')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
    setGmailCompletion(null)
  }
  useEffect(() => {
    if (!gmailNeedsCompletion.current) return
    if (!s.account?.uid || !s.account.token) { setGmailCompletion('waiting'); return }
    let active = true
    setGmailCompletion('working'); setGmailCompletionError('')
    // The server binds the staged Google token to the initiating account/session.
    void completeGmail.current!(s.account.uid, s.account.token, gmailCompletionAttempt).then(() => {
      if (!active) return
      clearGmailCompletion()
      setGmailPrompt('connected')
      window.dispatchEvent(new Event('kakeibo:gmail-connected'))
    }).catch((error) => {
      if (!active) return
      setGmailCompletion('error')
      setGmailCompletionError(error instanceof Error ? error.message : 'Gmail接続を完了できませんでした')
    })
    return () => { active = false }
  }, [s.account?.uid, s.account?.token, gmailCompletionAttempt])

  const gmailCompletionBanner = gmailCompletion && <Alert severity={gmailCompletion === 'error' ? 'warning' : 'info'} sx={{ m: 2 }}>
    {gmailCompletion === 'waiting' ? 'Gmail接続の本人確認が残っています。連携を開始した家計簿アカウントでログインしてください。' : gmailCompletion === 'working' ? '本人確認を行い、Gmail接続を完了しています…' : `${gmailCompletionError} 連携を開始した家計簿アカウントか確認してください。期限切れの場合は設定から接続をやり直してください。`}
    {gmailCompletion === 'error' && <MuiButton color="inherit" onClick={() => setGmailCompletionAttempt((value) => value + 1)}>再試行</MuiButton>}
    {gmailCompletion !== 'working' && <MuiButton color="inherit" onClick={clearGmailCompletion}>後で設定からやり直す</MuiButton>}
  </Alert>

  useEffect(() => {
    if (!s.message) return
    const timer = setTimeout(s.clearMessage, s.message.action ? 10_000 : 2800)
    return () => clearTimeout(timer)
  }, [s.message, s.clearMessage])

  useEffect(() => {
    clearAppShortcutFromUrl()
    const url = new URL(window.location.href)
    if (url.searchParams.has('gmail') && url.searchParams.get('gmail') !== 'complete') {
      url.searchParams.delete('gmail')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
    const receive = (event: MessageEvent) => {
      if (event.data?.type === 'GMAIL_CANDIDATES') setGmailPrompt('candidates')
    }
    navigator.serviceWorker?.addEventListener('message', receive)
    return () => navigator.serviceWorker?.removeEventListener('message', receive)
  }, [])

  useEffect(() => {
    if (MAIN_TABS.includes(tab as MainTab)) localStorage.setItem(LAST_TAB_KEY, tab)
  }, [tab])

  const backEnabled = s.hasEntered && !socialCallback
  useEffect(() => {
    if (backEnabled && import.meta.env.PROD && !isHybridNative()) return prefetchScreenAssets()
  }, [backEnabled])
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
      goBackWithinScreen,
      goHome: () => {
        currentTab.current = 'home'
        setEditDraft(null)
        setNativeImport(null)
        setGmailImport(null)
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
  }, [backEnabled, goBackWithinScreen])

  useEffect(() => { backNavigation.current?.screenChanged() }, [tab])

  useEffect(() => {
    const url = new URL(location.href)
    if (url.searchParams.get('native_manage') === '1') sessionStorage.setItem('kakeibo:native-manage', '1')
    if (!s.hasEntered || sessionStorage.getItem('kakeibo:native-manage') !== '1') return
    sessionStorage.removeItem('kakeibo:native-manage')
    url.searchParams.delete('native_manage')
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    setSettingsPageRequest({ section: 'integrations', revision: Date.now() })
    setSettingsReturnTab('home'); setTab('settings')
  }, [s.hasEntered])

  useEffect(() => {
    const open = (event: Event) => {
      const shortcut = (event as CustomEvent<string>).detail
      if (shortcut === 'add-expense') {
        setNativeImport(null)
        setGmailImport(null)
        setEditDraft(emptyDraft())
        setAddDraftRevision((revision) => revision + 1)
        setAddReturnTab('home')
        setTab('add')
      }
      else if (shortcut === 'withdrawals') setTab('payments')
    }
    window.addEventListener('kakeibo:native-shortcut', open)
    return () => window.removeEventListener('kakeibo:native-shortcut', open)
  }, [])

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
        {gmailCompletionBanner}
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

  const backParent = sectionParentLabel ?? (tab === 'settings'
    ? TABS.find(({ key }) => key === settingsReturnTab)?.label ?? '入力画面'
    : null)
  const showAddButton = MAIN_TABS.includes(tab as MainTab)

  return (
    <Box sx={{
      '--kakeibo-nav-clearance': 'calc(4.5rem + 8px)',
      minHeight: '100dvh',
      pb: `calc(${showAddButton ? '9.5rem' : '6.625rem'} + env(safe-area-inset-bottom))`,
    }}>
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
          {backParent && <Tooltip title={`${backParent}に戻る`}>
            <IconButton
              aria-label={`${backParent}に戻る`}
              color="inherit"
              onClick={goBackWithinScreen}
              sx={{ mr: 1, width: 44, height: 44 }}
            ><ArrowBackRoundedIcon /></IconButton>
          </Tooltip>}
          <Typography variant="h6" color="text.primary" sx={{ flex: 1 }}>
            家計簿
          </Typography>
          {s.loggedIn ? <Typography
            variant="caption"
            color={s.loggedIn && s.syncError ? 'error.main' : 'text.secondary'}
            aria-live="polite"
          >
            {s.syncing
              ? '同期中…'
              : s.syncError && s.hasPendingChanges
                ? '未同期（接続待ち）'
                : s.hasPendingChanges
                  ? '未同期'
                  : ''}
          </Typography> : <MuiButton size="small" color="inherit" onClick={() => openSettings('data')} sx={{ minHeight: 44, color: 'text.secondary' }}>
            この端末に保存
          </MuiButton>}
          {tab !== 'settings' && <Tooltip title="設定">
            <IconButton
              aria-label="設定を開く"
              color="inherit"
              onClick={() => openSettings()}
              sx={{ ml: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
            >
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>}
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="sm" disableGutters>
        {gmailCompletionBanner}
        <Suspense fallback={
          <Box role="status" aria-label="画面を読み込み中" sx={{ px: { xs: 2.5, sm: 4 }, pt: 3 }}>
            <Typography component="h1" variant="h4" sx={{ mb: 2 }}>{TABS.find(({ key }) => key === tab)?.label ?? (tab === 'settings' ? '設定' : '記録する')}</Typography>
            <Skeleton animation={false} variant="rounded" height={54} sx={{ mb: 2, borderRadius: '24px' }} />
            <Skeleton animation={false} variant="rounded" height={144} sx={{ borderRadius: '24px' }} />
          </Box>
        }>
          {tab === 'home' && <HomeScreen onAddExpense={() => openEntry('home', true)} />}
          {tab === 'planning' && <PlanningScreen />}
          {tab === 'list' && (
            <ListScreen
              onAddExpense={() => openEntry('list', true)}
              onEdit={(draft) => {
                setNativeImport(null)
                setGmailImport(null)
                setEditDraft(draft)
                setAddReturnTab('list')
                setTab('add')
              }}
              onDuplicate={(draft) => {
                setNativeImport(null)
                setGmailImport(null)
                setEditDraft(draft)
                setAddReturnTab('list')
                setTab('add')
              }}
            />
          )}
          {tab === 'add' && (
            <AddScreen
              key={`${s.account?.uid ?? 'offline'}:${editDraft?.editingId ?? 'new'}:${addDraftRevision}`}
              initial={editDraft}
              onDiscard={closeEntry}
              importKey={gmailImport ? `gmail:${gmailImport.id}` : nativeImport ? `native:${nativeImport.id}` : undefined}
              gmailFocusRequest={gmailFocusRequest ? { id: gmailFocusRequest, complete: () => setGmailFocusRequest(0) } : undefined}
              onGmailImport={(draft, gmailCandidateId) => {
                setGmailFocusRequest(0)
                setEditDraft(draft)
                setNativeImport(null)
                setGmailImport(s.account?.uid ? { id: gmailCandidateId, source: draft.source, owner: s.account.uid } : null)
                setAddDraftRevision((revision) => revision + 1)
              }}
              onDone={(source, expenseId) => {
                if (nativeImport && nativeImport.source === source && nativeImport.owner === (s.account?.uid ?? 'offline')) {
                  // Remove a pending notification only after an expense was actually saved.
                  void nativeNotificationCommand('ack', { ids: [nativeImport.id] }).catch(() => setNativeAckError(true))
                }
                if (gmailImport && gmailImport.source === source && gmailImport.owner === s.account?.uid && s.account?.token) {
                  void gmailCandidateAction(s.account.token, gmailImport.id, 'imported', expenseId).catch(() => setGmailAckError(true))
                }
                closeEntry()
              }}
            />
          )}
          {tab === 'payments' && <PaymentsScreen onParentChange={setSectionParentLabel} />}
          {tab === 'split' && <SplitScreen onParentChange={setSectionParentLabel} />}
          {tab === 'settings' && <SettingsScreen requestedSection={settingsPageRequest.section} requestRevision={settingsPageRequest.revision} onParentChange={setSectionParentLabel} onImport={(draft, eventId, gmailCandidateId) => {
            setEditDraft(draft)
            setNativeImport(eventId ? { id: eventId, source: draft.source, owner: s.account?.uid ?? 'offline' } : null)
            setGmailImport(gmailCandidateId && s.account?.uid ? { id: gmailCandidateId, source: draft.source, owner: s.account.uid } : null)
            setAddDraftRevision((revision) => revision + 1)
            setAddReturnTab(settingsReturnTab === 'add' ? lastTab : settingsReturnTab)
            setTab('add')
          }} onOpenGmailCandidates={openGmailCandidates} />}
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
            sx={{ minHeight: '4.5rem', height: 'auto', bgcolor: 'transparent' }}
          >
            {TABS.map((item) => (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={item.label}
                aria-current={tab === item.key ? 'page' : undefined}
                icon={item.icon}
                sx={{ minWidth: 0, px: 0.5 }}
              />
            ))}
          </BottomNavigation>
          {showAddButton && <Fab
            color="primary"
            size="medium"
            aria-label="収入・支出を追加"
            onClick={() => openEntry(tab as MainTab)}
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
        open={!!gmailPrompt}
        message={gmailPrompt === 'connected' ? 'Gmailを接続しました。設定で自動確認を確認できます。' : gmailPrompt === 'error' ? 'Gmailの接続を完了できませんでした。設定で確認してください。' : 'Gmailの明細候補があります。追加画面で確認できます。'}
        action={<MuiButton color="inherit" onClick={gmailPrompt === 'candidates' ? openGmailCandidates : () => { openSettings('integrations'); setGmailPrompt(null) }}>{gmailPrompt === 'candidates' ? tab === 'add' ? '候補まで移動' : '追加画面で確認' : '設定を確認'}</MuiButton>}
        autoHideDuration={12000}
        onClose={() => setGmailPrompt(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Snackbar
        open={gmailAckError}
        message="記録は保存しました。Gmail候補の処理済み更新だけに失敗しました。追加画面で候補を更新してください。"
        action={<MuiButton color="inherit" onClick={openGmailCandidates}>候補を確認</MuiButton>}
        autoHideDuration={10000}
        onClose={() => setGmailAckError(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Snackbar
        open={gmailCandidateEditHint}
        message="編集中の明細を保存するか閉じてから、＋で新しい記録を開いて候補を確認してください。"
        autoHideDuration={9000}
        onClose={() => setGmailCandidateEditHint(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Snackbar
        open={nativeAckError}
        message="記録は保存しました。保留通知の除外だけに失敗したため、設定で確認してください。"
        autoHideDuration={8000}
        onClose={() => setNativeAckError(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Snackbar
        open={exitHint}
        message="もう一度戻ると終了します"
        autoHideDuration={BACK_EXIT_WINDOW_MS}
        transitionDuration={0}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))', zIndex: (theme) => theme.zIndex.snackbar + 1 }}
      />
    </Box>
  )
}
