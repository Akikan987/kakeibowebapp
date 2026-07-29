import type {
  Account,
  Category,
  Debt,
  Expense,
  ExpenseSplit,
  Member,
  Settlement,
} from './types'

/** 同一オリジンのサーバー（FastAPI）を使う */
const BASE = ''

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail || `HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`

  const res = await fetch(BASE + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = typeof j?.detail === 'string' ? j.detail : JSON.stringify(j)
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

// ---------------- 認証 ----------------

interface AuthRaw {
  token: string
  uid: string
  nickname: string
  email: string
  phone: string
}

const toAccount = (r: AuthRaw): Account => ({
  token: r.token,
  uid: r.uid,
  nickname: r.nickname,
  email: r.email,
  phone: r.phone,
})

export const apiRegister = async (
  phone: string,
  email: string,
  nickname: string,
  password: string,
): Promise<Account> =>
  toAccount(
    await request<AuthRaw>('/auth/register', {
      method: 'POST',
      body: { phone, email, nickname, password },
    }),
  )

export const apiLogin = async (
  identifier: string,
  password: string,
): Promise<Account> =>
  toAccount(
    await request<AuthRaw>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    }),
  )

export const apiRequestReset = (email: string) =>
  request<{ ok: boolean }>('/auth/request-reset', {
    method: 'POST',
    body: { email },
  })

export const apiResetPassword = (
  email: string,
  code: string,
  newPassword: string,
) =>
  request<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: { email, code, new_password: newPassword },
  })

export const apiSearchUser = (token: string, nickname: string) =>
  request<{ found: boolean; uid: string; nickname: string }>(
    `/users/search?nickname=${encodeURIComponent(nickname)}`,
    { token },
  )

// ---------------- 同期（snake_case 変換） ----------------

type Raw = Record<string, unknown>

const baseOut = (r: { id: string; updatedAt: number; deleted: boolean }) => ({
  id: r.id,
  updated_at: r.updatedAt,
  deleted: r.deleted,
})

const baseIn = (r: Raw) => ({
  id: String(r.id),
  updatedAt: Number(r.updated_at ?? 0),
  deleted: Boolean(r.deleted),
})

const expenseOut = (e: Expense): Raw => ({
  ...baseOut(e),
  title: e.title,
  amount_yen: e.amountYen,
  purchased_at_millis: e.purchasedAtMillis,
  category: e.category,
  source: e.source,
  type: e.type,
})
const expenseIn = (r: Raw): Expense => ({
  ...baseIn(r),
  title: String(r.title ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
  purchasedAtMillis: Number(r.purchased_at_millis ?? 0),
  category: String(r.category ?? 'その他'),
  source: String(r.source ?? 'manual'),
  type: String(r.type ?? 'expense'),
})

const memberOut = (m: Member): Raw => ({
  ...baseOut(m),
  name: m.name,
  linked_uid: m.linkedUid,
})
const memberIn = (r: Raw): Member => ({
  ...baseIn(r),
  name: String(r.name ?? ''),
  linkedUid: String(r.linked_uid ?? ''),
})

const categoryOut = (c: Category): Raw => ({
  ...baseOut(c),
  name: c.name,
  position: c.position,
})
const categoryIn = (r: Raw): Category => ({
  ...baseIn(r),
  name: String(r.name ?? ''),
  position: Number(r.position ?? 0),
})

const splitOut = (s: ExpenseSplit): Raw => ({
  ...baseOut(s),
  expense_id: s.expenseId,
  member_id: s.memberId,
  amount_yen: s.amountYen,
})
const splitIn = (r: Raw): ExpenseSplit => ({
  ...baseIn(r),
  expenseId: String(r.expense_id ?? ''),
  memberId: String(r.member_id ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
})

const settlementOut = (s: Settlement): Raw => ({
  ...baseOut(s),
  member_id: s.memberId,
  amount_yen: s.amountYen,
  date_millis: s.dateMillis,
})
const settlementIn = (r: Raw): Settlement => ({
  ...baseIn(r),
  memberId: String(r.member_id ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
  dateMillis: Number(r.date_millis ?? 0),
})

export interface SyncTables {
  expenses: Expense[]
  members: Member[]
  categories: Category[]
  expenseSplits: ExpenseSplit[]
  settlements: Settlement[]
}

export interface SyncResult {
  serverTime: number
  changes: SyncTables
  debts: Debt[]
}

export async function apiSync(
  token: string,
  since: number,
  local: SyncTables,
): Promise<SyncResult> {
  const body = {
    since,
    changes: {
      expenses: local.expenses.map(expenseOut),
      members: local.members.map(memberOut),
      categories: local.categories.map(categoryOut),
      expense_splits: local.expenseSplits.map(splitOut),
      settlements: local.settlements.map(settlementOut),
    },
  }
  const res = await request<Raw>('/sync', { method: 'POST', body, token })
  const ch = (res.changes ?? {}) as Record<string, Raw[]>
  const debts = ((res.debts ?? []) as Raw[]).map((d) => ({
    ownerUid: String(d.owner_uid ?? ''),
    ownerNickname: String(d.owner_nickname ?? ''),
    charged: Number(d.charged ?? 0),
    settled: Number(d.settled ?? 0),
    remaining: Number(d.remaining ?? 0),
  }))
  return {
    serverTime: Number(res.server_time ?? 0),
    changes: {
      expenses: (ch.expenses ?? []).map(expenseIn),
      members: (ch.members ?? []).map(memberIn),
      categories: (ch.categories ?? []).map(categoryIn),
      expenseSplits: (ch.expense_splits ?? []).map(splitIn),
      settlements: (ch.settlements ?? []).map(settlementIn),
    },
    debts,
  }
}
