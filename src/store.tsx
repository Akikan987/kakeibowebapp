import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiError,
  apiLogin,
  apiLogout,
  apiLogoutAll,
  apiRegister,
  apiRequestReset,
  apiResetPassword,
  apiSearchUser,
  apiReadReceipt,
  apiSync,
  type OcrResult,
  type SyncTables,
} from './api'
import {
  activeCategories,
  activeExpenses,
  activeMembers,
  activeSettlements,
  activeSplits,
  clearLocalData,
  db,
  dedupeCategories,
  seedCategoriesIfEmpty,
} from './db'
import {
  DEFAULT_TITLE,
  TYPE_EXPENSE,
  TYPE_INCOME,
  newId,
  now,
  type Account,
  type Category,
  type Debt,
  type Expense,
  type ExpenseSplit,
  type Member,
  type MemberBalance,
  type MonthlySummary,
  type Settlement,
} from './types'

const LS_ACCOUNT = 'kakeibo.account'
const LS_OFFLINE = 'kakeibo.offline'
const LS_LAST_SYNC = 'kakeibo.lastSync'
const LS_OWNER = 'kakeibo.dataOwner'
const LS_DIRTY = 'kakeibo.syncPending'

const readAccount = (): Account | null => {
  try {
    const raw = localStorage.getItem(LS_ACCOUNT)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

export interface DraftSplit {
  memberId: string
  amount: string
}

export interface ExpenseDraft {
  editingId: string | null
  type: string
  title: string
  amountYen: string
  category: string
  purchasedAtMillis: number
  source: string
  splits: DraftSplit[]
}

export const emptyDraft = (): ExpenseDraft => ({
  editingId: null,
  type: '',
  title: '',
  amountYen: '',
  category: DEFAULT_TITLE,
  purchasedAtMillis: now(),
  source: 'manual',
  splits: [],
})

interface Store {
  // データ
  expenses: Expense[]
  members: Member[]
  categories: Category[]
  splits: ExpenseSplit[]
  settlements: Settlement[]
  debts: Debt[]
  // 派生
  summary: MonthlySummary
  balances: MemberBalance[]
  splitSumOf: (expenseId: string) => number
  netAmount: (e: Expense) => number
  // 月
  month: { year: number; month: number }
  prevMonth: () => void
  nextMonth: () => void
  // アカウント
  account: Account | null
  offlineMode: boolean
  loggedIn: boolean
  hasEntered: boolean
  lastSync: number
  syncing: boolean
  hasPendingChanges: boolean
  syncError: boolean
  // メッセージ
  message: { text: string; kind: 'ok' | 'error' } | null
  clearMessage: () => void
  notify: (text: string, kind?: 'ok' | 'error') => void
  // 認証
  login: (identifier: string, password: string) => Promise<void>
  register: (
    phone: string,
    email: string,
    nickname: string,
    password: string,
  ) => Promise<void>
  requestReset: (email: string) => Promise<boolean>
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<boolean>
  enterOffline: () => void
  backToAuth: () => void
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  syncNow: (showMessage?: boolean) => Promise<boolean>
  // 明細
  saveExpense: (draft: ExpenseDraft) => Promise<boolean>
  deleteExpense: (e: Expense) => Promise<void>
  splitsOfExpense: (expenseId: string) => ExpenseSplit[]
  // メンバー
  addMember: (name: string) => Promise<void>
  deleteMember: (m: Member) => Promise<void>
  memberName: (id: string) => string
  // 清算
  recordSettlement: (memberId: string, amount: number) => Promise<boolean>
  deleteSettlement: (s: Settlement) => Promise<void>
  // 品目
  addCategory: (name: string) => Promise<void>
  renameCategory: (c: Category, name: string) => Promise<void>
  deleteCategory: (c: Category) => Promise<void>
  reorderCategories: (ordered: Category[]) => Promise<void>
  // レシートOCR
  readReceipt: (file: File) => Promise<OcrResult | null>
  // バックアップ
  exportJson: () => void
  importJson: (file: File, replace: boolean) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export const useStore = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider がありません')
  return v
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [splits, setSplits] = useState<ExpenseSplit[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [debts, setDebts] = useState<Debt[]>([])

  const today = new Date()
  const [month, setMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  })

  const [account, setAccount] = useState<Account | null>(readAccount)
  const [offlineMode, setOfflineMode] = useState(
    () => localStorage.getItem(LS_OFFLINE) === '1',
  )
  const [lastSync, setLastSync] = useState(() =>
    Number(localStorage.getItem(LS_LAST_SYNC) ?? 0),
  )
  const [syncing, setSyncing] = useState(false)
  const [hasPendingChanges, setHasPendingChanges] = useState(
    () => localStorage.getItem(LS_DIRTY) === '1',
  )
  const [syncError, setSyncError] = useState(false)
  const [message, setMessage] = useState<Store['message']>(null)

  const syncingRef = useRef(false)
  const pendingSyncRef = useRef(false)
  const changeVersionRef = useRef(0)

  const notify = useCallback(
    (text: string, kind: 'ok' | 'error' = 'ok') => setMessage({ text, kind }),
    [],
  )
  const clearMessage = useCallback(() => setMessage(null), [])

  /** ローカルDBから全部読み直す */
  const reload = useCallback(async () => {
    const [e, m, c, s, st] = await Promise.all([
      activeExpenses(),
      activeMembers(),
      activeCategories(),
      activeSplits(),
      activeSettlements(),
    ])
    e.sort((a, b) => b.purchasedAtMillis - a.purchasedAtMillis)
    m.sort((a, b) => a.name.localeCompare(b.name))
    setExpenses(e)
    setMembers(m)
    setCategories(c)
    setSplits(s)
    setSettlements(st)
  }, [])

  // ---------------- 同期 ----------------

  const syncNow = useCallback(
    async (showMessage = true) => {
      const token = account?.token
      if (!token) {
        if (showMessage) notify('先にログインしてください', 'error')
        return false
      }
      if (syncingRef.current) {
        pendingSyncRef.current = true
        return false
      }
      const versionAtStart = changeVersionRef.current
      syncingRef.current = true
      setSyncing(true)
      try {
        const local: SyncTables = {
          expenses: await db.expenses.toArray(),
          members: await db.members.toArray(),
          categories: await db.categories.toArray(),
          expenseSplits: await db.expenseSplits.toArray(),
          settlements: await db.settlements.toArray(),
        }
        // 差分ではなく毎回すべてを取り直す。件数が少ないアプリなので、
        // 取りこぼし（sinceのズレで古いレコードが届かない）を確実に防ぐ方を優先する。
        const res = await apiSync(token, 0, local)

        // last-write-wins でローカルへ反映
        const apply = async <T extends { id: string; updatedAt: number }>(
          table: { toArray: () => Promise<T[]>; bulkPut: (r: T[]) => unknown },
          incoming: T[],
        ) => {
          if (incoming.length === 0) return
          const localMap = new Map((await table.toArray()).map((r) => [r.id, r]))
          const win = incoming.filter((r) => {
            const cur = localMap.get(r.id)
            return !cur || r.updatedAt >= cur.updatedAt
          })
          if (win.length) await table.bulkPut(win)
        }
        await apply(db.expenses, res.changes.expenses)
        await apply(db.members, res.changes.members)
        await apply(db.categories, res.changes.categories)
        await apply(db.expenseSplits, res.changes.expenseSplits)
        await apply(db.settlements, res.changes.settlements)

        // 端末ごとに既定品目のIDが違うと重複するので、取り込み後にまとめる。
        // 消えた分は次回の同期で他の端末にも反映される。
        const deduped = await dedupeCategories()

        setDebts(res.debts)
        localStorage.setItem(LS_LAST_SYNC, String(res.serverTime))
        setLastSync(res.serverTime)
        setSyncError(false)
        if (changeVersionRef.current === versionAtStart) {
          localStorage.removeItem(LS_DIRTY)
          setHasPendingChanges(false)
        }
        await reload()
        // 重複整理で消した分をサーバーにも伝える
        if (deduped) pendingSyncRef.current = true
        if (showMessage) notify('同期しました')
        return true
      } catch (err) {
        setSyncError(true)
        if (err instanceof ApiError && err.status === 401) {
          // トークン無効 → ローカルは残したままログイン画面へ
          localStorage.removeItem(LS_ACCOUNT)
          setAccount(null)
          setDebts([])
        } else if (showMessage) {
          notify(
            `同期に失敗しました: ${err instanceof Error ? err.message : ''}`,
            'error',
          )
        }
        return false
      } finally {
        syncingRef.current = false
        setSyncing(false)
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false
          void syncNow(false)
        }
      }
    },
    [account, notify, reload],
  )

  const autoSync = useCallback(() => {
    changeVersionRef.current += 1
    localStorage.setItem(LS_DIRTY, '1')
    setHasPendingChanges(true)
    if (account?.token) void syncNow(false)
  }, [account, syncNow])

  // 起動時
  useEffect(() => {
    void (async () => {
      await seedCategoriesIfEmpty()
      await reload()
      if (readAccount()?.token) void syncNow(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 圏外で保存したデータは、オンライン復帰時に自動で再送する。
  // サーバーだけが停止している場合にも、未同期中は1分ごとに再試行する。
  useEffect(() => {
    if (!account?.token) return
    const retry = () => void syncNow(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) retry()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    const timer = hasPendingChanges
      ? window.setInterval(retry, 60 * 1000)
      : undefined
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [account, hasPendingChanges, syncNow])

  // ---------------- 認証 ----------------

  const applyLogin = useCallback(
    async (acc: Account) => {
      const owner = localStorage.getItem(LS_OWNER) ?? ''
      // 別アカウントのローカルが残っている場合のみ消す
      if (owner && owner !== acc.uid) await clearLocalData()
      localStorage.setItem(LS_ACCOUNT, JSON.stringify(acc))
      localStorage.setItem(LS_OWNER, acc.uid)
      localStorage.setItem(LS_OFFLINE, '0')
      localStorage.setItem(LS_LAST_SYNC, '0')
      setAccount(acc)
      setOfflineMode(false)
      setLastSync(0)
      await reload()
    },
    [reload],
  )

  // account 更新後に同期を走らせる
  const pendingLoginSync = useRef(false)
  useEffect(() => {
    if (pendingLoginSync.current && account?.token) {
      pendingLoginSync.current = false
      void syncNow(false)
    }
  }, [account, syncNow])

  const authErrorText = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.detail.includes('phone already used'))
        return 'この電話番号は既に使われています'
      if (err.detail.includes('email already used'))
        return 'このメールアドレスは既に使われています'
      if (err.detail.includes('nickname already used'))
        return 'このニックネームは既に使われています'
      if (err.status === 401) return 'ユーザー名またはパスワードが違います'
      return err.detail || `エラー (${err.status})`
    }
    return 'サーバーに接続できませんでした'
  }

  const login = useCallback(
    async (identifier: string, password: string) => {
      try {
        const acc = await apiLogin(identifier, password)
        pendingLoginSync.current = true
        await applyLogin(acc)
        notify('ログインしました')
      } catch (err) {
        notify(authErrorText(err), 'error')
      }
    },
    [applyLogin, notify],
  )

  const register = useCallback(
    async (
      phone: string,
      email: string,
      nickname: string,
      password: string,
    ) => {
      try {
        const acc = await apiRegister(phone, email, nickname, password)
        pendingLoginSync.current = true
        await applyLogin(acc)
        notify('登録しました')
      } catch (err) {
        notify(authErrorText(err), 'error')
      }
    },
    [applyLogin, notify],
  )

  const requestReset = useCallback(
    async (email: string) => {
      try {
        await apiRequestReset(email)
        notify('再設定コードをメールに送りました')
        return true
      } catch {
        notify('送信に失敗しました', 'error')
        return false
      }
    },
    [notify],
  )

  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      try {
        await apiResetPassword(email, code, newPassword)
        notify('パスワードを再設定しました。ログインしてください')
        return true
      } catch {
        notify('再設定に失敗しました（コードの期限切れ/不一致）', 'error')
        return false
      }
    },
    [notify],
  )

  const enterOffline = useCallback(() => {
    localStorage.setItem(LS_OFFLINE, '1')
    setOfflineMode(true)
  }, [])

  const backToAuth = useCallback(() => {
    localStorage.setItem(LS_OFFLINE, '0')
    setOfflineMode(false)
  }, [])

  const clearSession = useCallback(() => {
    // ローカルデータは消さない（未同期の変更を守る）
    localStorage.removeItem(LS_ACCOUNT)
    localStorage.setItem(LS_OFFLINE, '0')
    setAccount(null)
    setOfflineMode(false)
    setDebts([])
  }, [])

  const logout = useCallback(async () => {
    const token = account?.token
    if (token) await apiLogout(token).catch(() => undefined)
    clearSession()
    notify('ログアウトしました')
  }, [account, clearSession, notify])

  const logoutAll = useCallback(async () => {
    const token = account?.token
    if (!token) return
    try {
      await apiLogoutAll(token)
      clearSession()
      notify('すべての端末からログアウトしました')
    } catch {
      notify('全端末ログアウトに失敗しました', 'error')
    }
  }, [account, clearSession, notify])

  // ---------------- 明細 ----------------

  const saveExpense = useCallback(
    async (draft: ExpenseDraft) => {
      const amount = parseInt(draft.amountYen, 10)
      if (!Number.isFinite(amount)) {
        notify('金額を入力してください', 'error')
        return false
      }
      const valid = draft.splits
        .map((s) => ({ memberId: s.memberId, amount: parseInt(s.amount, 10) }))
        .filter((s) => Number.isFinite(s.amount) && s.amount > 0)
      const splitSum = valid.reduce((a, b) => a + b.amount, 0)
      if (splitSum > amount) {
        notify(`割り勘の合計（¥${splitSum}）が金額を超えています`, 'error')
        return false
      }
      const ts = now()
      const id = draft.editingId ?? newId()
      await db.expenses.put({
        id,
        title: draft.title.trim() || DEFAULT_TITLE,
        amountYen: amount,
        purchasedAtMillis: draft.purchasedAtMillis,
        category: draft.category.trim() || DEFAULT_TITLE,
        source: draft.source,
        type: draft.type,
        updatedAt: ts,
        deleted: false,
      })
      // 既存の割り勘を論理削除してから入れ直す
      const olds = await db.expenseSplits.where('expenseId').equals(id).toArray()
      if (olds.length)
        await db.expenseSplits.bulkPut(
          olds.map((o) => ({ ...o, deleted: true, updatedAt: ts })),
        )
      if (draft.type === TYPE_EXPENSE && valid.length) {
        await db.expenseSplits.bulkPut(
          valid.map((v) => ({
            id: newId(),
            expenseId: id,
            memberId: v.memberId,
            amountYen: v.amount,
            updatedAt: ts,
            deleted: false,
          })),
        )
      }
      await reload()
      notify('保存しました')
      autoSync()
      return true
    },
    [autoSync, notify, reload],
  )

  const deleteExpense = useCallback(
    async (e: Expense) => {
      const ts = now()
      const olds = await db.expenseSplits
        .where('expenseId')
        .equals(e.id)
        .toArray()
      if (olds.length)
        await db.expenseSplits.bulkPut(
          olds.map((o) => ({ ...o, deleted: true, updatedAt: ts })),
        )
      await db.expenses.put({ ...e, deleted: true, updatedAt: ts })
      await reload()
      notify('削除しました')
      autoSync()
    },
    [autoSync, notify, reload],
  )

  const splitsOfExpense = useCallback(
    (expenseId: string) => splits.filter((s) => s.expenseId === expenseId),
    [splits],
  )

  // ---------------- メンバー ----------------

  const addMember = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      let linkedUid = ''
      let finalName = trimmed
      if (account?.token) {
        try {
          const res = await apiSearchUser(account.token, trimmed)
          if (res.found) {
            linkedUid = res.uid
            finalName = res.nickname
          }
        } catch {
          /* 検索できなくても通常メンバーとして追加 */
        }
      }
      await db.members.put({
        id: newId(),
        name: finalName,
        linkedUid,
        updatedAt: now(),
        deleted: false,
      })
      await reload()
      notify(
        linkedUid
          ? `「${finalName}」さんのアカウントと連携しました`
          : 'メンバーを追加しました',
      )
      autoSync()
    },
    [account, autoSync, notify, reload],
  )

  const deleteMember = useCallback(
    async (m: Member) => {
      await db.members.put({ ...m, deleted: true, updatedAt: now() })
      await reload()
      autoSync()
    },
    [autoSync, reload],
  )

  const memberName = useCallback(
    (id: string) => members.find((m) => m.id === id)?.name ?? '(削除済み)',
    [members],
  )

  // ---------------- 清算 ----------------

  const recordSettlement = useCallback(
    async (memberId: string, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        notify('清算額は1以上で入力してください', 'error')
        return false
      }
      await db.settlements.put({
        id: newId(),
        memberId,
        amountYen: amount,
        dateMillis: now(),
        updatedAt: now(),
        deleted: false,
      })
      await reload()
      notify('清算を記録しました')
      autoSync()
      return true
    },
    [autoSync, notify, reload],
  )

  const deleteSettlement = useCallback(
    async (s: Settlement) => {
      await db.settlements.put({ ...s, deleted: true, updatedAt: now() })
      await reload()
      notify('清算を取り消しました')
      autoSync()
    },
    [autoSync, notify, reload],
  )

  // ---------------- 品目 ----------------

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      if (categories.some((c) => c.name === trimmed)) {
        notify(`「${trimmed}」は既にあります`, 'error')
        return
      }
      const maxPos = categories.reduce((a, c) => Math.max(a, c.position), -1)
      await db.categories.put({
        id: newId(),
        name: trimmed,
        position: maxPos + 1,
        updatedAt: now(),
        deleted: false,
      })
      await reload()
      autoSync()
    },
    [autoSync, categories, notify, reload],
  )

  const renameCategory = useCallback(
    async (c: Category, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      await db.categories.put({ ...c, name: trimmed, updatedAt: now() })
      await reload()
      autoSync()
    },
    [autoSync, reload],
  )

  const deleteCategory = useCallback(
    async (c: Category) => {
      await db.categories.put({ ...c, deleted: true, updatedAt: now() })
      await reload()
      autoSync()
    },
    [autoSync, reload],
  )

  const reorderCategories = useCallback(
    async (ordered: Category[]) => {
      setCategories(ordered)
      const ts = now()
      await db.categories.bulkPut(
        ordered.map((c, i) => ({ ...c, position: i, updatedAt: ts })),
      )
      await reload()
      autoSync()
    },
    [autoSync, reload],
  )

  // ---------------- レシートOCR ----------------

  const readReceipt = useCallback(
    async (file: File): Promise<OcrResult | null> => {
      const token = account?.token
      if (!token) {
        notify('レシート読み取りにはログインが必要です', 'error')
        return null
      }
      try {
        return await apiReadReceipt(token, file)
      } catch (err) {
        notify(
          err instanceof ApiError && (err.status === 413 || err.status === 415)
            ? err.detail
            : err instanceof ApiError && err.status === 503
              ? 'OCRサービスに接続できませんでした'
              : 'レシートを読み取れませんでした',
          'error',
        )
        return null
      }
    },
    [account, notify],
  )

  // ---------------- バックアップ ----------------

  const exportJson = useCallback(() => {
    const payload = {
      app: 'kakeibo',
      version: 3,
      expenses: expenses.map((e) => ({
        id: e.id,
        title: e.title,
        amountYen: e.amountYen,
        purchasedAtMillis: e.purchasedAtMillis,
        category: e.category,
        source: e.source,
        type: e.type,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kakeibo-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    notify('エクスポートしました')
  }, [expenses, notify])

  const importJson = useCallback(
    async (file: File, replace: boolean) => {
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const items = Array.isArray(json) ? json : (json.expenses ?? [])
        const ts = now()
        const rows: Expense[] = items.map((o: Record<string, unknown>) => ({
          id: String(o.id ?? newId()),
          title: String(o.title ?? DEFAULT_TITLE),
          amountYen: Number(o.amountYen ?? 0),
          purchasedAtMillis: Number(o.purchasedAtMillis ?? ts),
          category: String(o.category ?? DEFAULT_TITLE),
          source: String(o.source ?? 'manual'),
          type: String(o.type ?? TYPE_EXPENSE),
          updatedAt: ts,
          deleted: false,
        }))
        if (replace) {
          await db.transaction('rw', db.expenses, db.expenseSplits, async () => {
            const [allExpenses, allSplits] = await Promise.all([
              db.expenses.toArray(),
              db.expenseSplits.toArray(),
            ])
            if (allExpenses.length) {
              await db.expenses.bulkPut(
                allExpenses.map((e) => ({ ...e, deleted: true, updatedAt: ts })),
              )
            }
            if (allSplits.length) {
              await db.expenseSplits.bulkPut(
                allSplits.map((s) => ({ ...s, deleted: true, updatedAt: ts })),
              )
            }
            await db.expenses.bulkPut(rows)
          })
        } else {
          await db.expenses.bulkPut(rows)
        }
        await reload()
        notify(`${rows.length}件インポートしました`)
        autoSync()
      } catch {
        notify('インポートに失敗しました', 'error')
      }
    },
    [autoSync, notify, reload],
  )

  // ---------------- 派生データ ----------------

  const splitSumMap = useMemo(() => {
    const m = new Map<string, number>()
    const activeExpenseIds = new Set(expenses.map((e) => e.id))
    for (const s of splits) {
      if (!activeExpenseIds.has(s.expenseId)) continue
      m.set(s.expenseId, (m.get(s.expenseId) ?? 0) + s.amountYen)
    }
    return m
  }, [expenses, splits])

  const splitSumOf = useCallback(
    (id: string) => splitSumMap.get(id) ?? 0,
    [splitSumMap],
  )
  const netAmount = useCallback(
    (e: Expense) => e.amountYen - (splitSumMap.get(e.id) ?? 0),
    [splitSumMap],
  )

  const summary = useMemo<MonthlySummary>(() => {
    const start = new Date(month.year, month.month - 1, 1).getTime()
    const end = new Date(month.year, month.month, 1).getTime() - 1
    const inRange = expenses.filter(
      (e) => e.purchasedAtMillis >= start && e.purchasedAtMillis <= end,
    )
    const monthExpenses = inRange.filter((e) => e.type === TYPE_EXPENSE)
    const monthIncome = inRange.filter((e) => e.type === TYPE_INCOME)
    const net = (e: Expense) => e.amountYen - (splitSumMap.get(e.id) ?? 0)

    const catMap = new Map<string, number>()
    for (const e of monthExpenses)
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + net(e))
    const categoryTotals = [...catMap.entries()]
      .map(([name, total]) => ({ name, total }))
      .filter((c) => c.total !== 0)
      .sort((a, b) => b.total - a.total)

    const dailyTotals = new Map<number, number>()
    for (const e of monthExpenses) {
      const d = new Date(e.purchasedAtMillis).getDate()
      dailyTotals.set(d, (dailyTotals.get(d) ?? 0) + net(e))
    }

    const incomeTotal = monthIncome.reduce((a, e) => a + e.amountYen, 0)
    const expenseTotal = monthExpenses.reduce((a, e) => a + net(e), 0)
    return {
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
      categoryTotals,
      dailyTotals,
    }
  }, [expenses, month, splitSumMap])

  const balances = useMemo<MemberBalance[]>(() => {
    const charged = new Map<string, number>()
    for (const s of splits)
      charged.set(s.memberId, (charged.get(s.memberId) ?? 0) + s.amountYen)
    const settled = new Map<string, number>()
    for (const s of settlements)
      settled.set(s.memberId, (settled.get(s.memberId) ?? 0) + s.amountYen)
    return members.map((m) => {
      const c = charged.get(m.id) ?? 0
      const st = settled.get(m.id) ?? 0
      return {
        memberId: m.id,
        name: m.name,
        linkedUid: m.linkedUid,
        charged: c,
        settled: st,
        remaining: c - st,
      }
    })
  }, [members, settlements, splits])

  const value: Store = {
    expenses,
    members,
    categories,
    splits,
    settlements,
    debts,
    summary,
    balances,
    splitSumOf,
    netAmount,
    month,
    prevMonth: () =>
      setMonth((m) =>
        m.month === 1
          ? { year: m.year - 1, month: 12 }
          : { year: m.year, month: m.month - 1 },
      ),
    nextMonth: () =>
      setMonth((m) =>
        m.month === 12
          ? { year: m.year + 1, month: 1 }
          : { year: m.year, month: m.month + 1 },
      ),
    account,
    offlineMode,
    loggedIn: !!account?.token,
    hasEntered: !!account?.token || offlineMode,
    lastSync,
    syncing,
    hasPendingChanges,
    syncError,
    message,
    clearMessage,
    notify,
    login,
    register,
    requestReset,
    resetPassword,
    enterOffline,
    backToAuth,
    logout,
    logoutAll,
    syncNow,
    saveExpense,
    deleteExpense,
    splitsOfExpense,
    addMember,
    deleteMember,
    memberName,
    recordSettlement,
    deleteSettlement,
    addCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,
    readReceipt,
    exportJson,
    importJson,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
