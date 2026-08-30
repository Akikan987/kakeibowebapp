import type {
  Account,
  Budget,
  CardStatement,
  CardStatementStatus,
  Category,
  Debt,
  Expense,
  ExpenseSplit,
  Member,
  PaymentMethod,
  PaymentType,
  PrepaidCharge,
  RecurringTemplate,
  Settlement,
} from './types'
import { PAYMENT_TYPES } from './types'

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
  avatar_data_url?: string
}

const toAccount = (r: AuthRaw): Account => ({
  token: r.token,
  uid: r.uid,
  nickname: r.nickname,
  email: r.email,
  phone: r.phone,
  avatarDataUrl: r.avatar_data_url ?? '',
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

export const apiLogout = (token: string) =>
  request<{ ok: boolean }>('/auth/logout', { method: 'POST', token })

export const apiLogoutAll = (token: string) =>
  request<{ ok: boolean }>('/auth/logout-all', { method: 'POST', token })

export const apiDeleteAccount = (token: string, currentPassword: string) =>
  request<{ ok: boolean }>('/auth/account', {
    method: 'DELETE',
    token,
    body: { current_password: currentPassword },
  })

export const apiUpdateAvatar = async (token: string, avatarDataUrl: string) => {
  const profile = await request<AuthRaw>('/auth/profile/avatar', {
    method: 'PUT',
    token,
    body: { avatar_data_url: avatarDataUrl },
  })
  return profile.avatar_data_url ?? ''
}

export const apiUpdateNickname = async (token: string, nickname: string) => {
  const profile = await request<AuthRaw>('/auth/profile', {
    method: 'PATCH',
    token,
    body: { nickname },
  })
  return {
    nickname: profile.nickname,
    email: profile.email,
    avatarDataUrl: profile.avatar_data_url ?? '',
  }
}

export const apiRequestEmailChange = (
  token: string,
  newEmail: string,
  currentPassword: string,
) =>
  request<{ ok: boolean }>('/auth/profile/email/request', {
    method: 'POST',
    token,
    body: { new_email: newEmail, current_password: currentPassword },
  })

export const apiConfirmEmailChange = async (token: string, code: string) => {
  const profile = await request<AuthRaw>('/auth/profile/email/confirm', {
    method: 'POST',
    token,
    body: { code },
  })
  return {
    nickname: profile.nickname,
    email: profile.email,
    avatarDataUrl: profile.avatar_data_url ?? '',
  }
}

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
  payment_method_id: e.paymentMethodId,
})
const expenseIn = (r: Raw): Expense => ({
  ...baseIn(r),
  title: String(r.title ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
  purchasedAtMillis: Number(r.purchased_at_millis ?? 0),
  category: String(r.category ?? 'その他'),
  source: String(r.source ?? 'manual'),
  type: String(r.type ?? 'expense'),
  paymentMethodId: String(r.payment_method_id ?? ''),
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

const paymentTypeIn = (value: unknown): PaymentType => {
  const type = String(value ?? 'other')
  return PAYMENT_TYPES.includes(type as PaymentType)
    ? (type as PaymentType)
    : 'other'
}

const paymentMethodOut = (m: PaymentMethod): Raw => ({
  ...baseOut(m),
  name: m.name,
  type: m.type,
  closing_day: m.closingDay,
  payment_day: m.paymentDay,
})
const paymentMethodIn = (r: Raw): PaymentMethod => ({
  ...baseIn(r),
  name: String(r.name ?? ''),
  type: paymentTypeIn(r.type),
  closingDay: Number(r.closing_day ?? 0),
  paymentDay: Number(r.payment_day ?? 0),
})

const prepaidChargeOut = (c: PrepaidCharge): Raw => ({
  ...baseOut(c),
  prepaid_method_id: c.prepaidMethodId,
  funding_method_id: c.fundingMethodId,
  amount_yen: c.amountYen,
  charged_at_millis: c.chargedAtMillis,
  note: c.note,
})
const prepaidChargeIn = (r: Raw): PrepaidCharge => ({
  ...baseIn(r),
  prepaidMethodId: String(r.prepaid_method_id ?? ''),
  fundingMethodId: String(r.funding_method_id ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
  chargedAtMillis: Number(r.charged_at_millis ?? 0),
  note: String(r.note ?? ''),
})

const recurringTemplateOut = (r: RecurringTemplate): Raw => ({
  ...baseOut(r),
  title: r.title,
  amount_yen: r.amountYen,
  category: r.category,
  type: r.type,
  payment_method_id: r.paymentMethodId,
  day_of_month: r.dayOfMonth,
  active: r.active,
})
const recurringTemplateIn = (r: Raw): RecurringTemplate => ({
  ...baseIn(r),
  title: String(r.title ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
  category: String(r.category ?? 'その他'),
  type: String(r.type ?? 'expense'),
  paymentMethodId: String(r.payment_method_id ?? ''),
  dayOfMonth: Number(r.day_of_month ?? 1),
  active: Boolean(r.active),
})

const budgetOut = (b: Budget): Raw => ({
  ...baseOut(b),
  month_key: b.monthKey,
  category: b.category,
  amount_yen: b.amountYen,
})
const budgetIn = (r: Raw): Budget => ({
  ...baseIn(r),
  monthKey: String(r.month_key ?? ''),
  category: String(r.category ?? ''),
  amountYen: Number(r.amount_yen ?? 0),
})

const statementStatusIn = (value: unknown): CardStatementStatus =>
  value === 'paid' ? 'paid' : 'confirmed'
const cardStatementOut = (s: CardStatement): Raw => ({
  ...baseOut(s),
  payment_method_id: s.paymentMethodId,
  withdrawal_at_millis: s.withdrawalAtMillis,
  actual_amount_yen: s.actualAmountYen,
  status: s.status,
  note: s.note,
})
const cardStatementIn = (r: Raw): CardStatement => ({
  ...baseIn(r),
  paymentMethodId: String(r.payment_method_id ?? ''),
  withdrawalAtMillis: Number(r.withdrawal_at_millis ?? 0),
  actualAmountYen: Number(r.actual_amount_yen ?? 0),
  status: statementStatusIn(r.status),
  note: String(r.note ?? ''),
})

export interface SyncTables {
  expenses: Expense[]
  members: Member[]
  categories: Category[]
  expenseSplits: ExpenseSplit[]
  settlements: Settlement[]
  paymentMethods: PaymentMethod[]
  prepaidCharges: PrepaidCharge[]
  recurringTemplates: RecurringTemplate[]
  budgets: Budget[]
  cardStatements: CardStatement[]
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
      payment_methods: local.paymentMethods.map(paymentMethodOut),
      prepaid_charges: local.prepaidCharges.map(prepaidChargeOut),
      recurring_templates: local.recurringTemplates.map(recurringTemplateOut),
      budgets: local.budgets.map(budgetOut),
      card_statements: local.cardStatements.map(cardStatementOut),
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
      paymentMethods: (ch.payment_methods ?? []).map(paymentMethodIn),
      prepaidCharges: (ch.prepaid_charges ?? []).map(prepaidChargeIn),
      recurringTemplates: (ch.recurring_templates ?? []).map(recurringTemplateIn),
      budgets: (ch.budgets ?? []).map(budgetIn),
      cardStatements: (ch.card_statements ?? []).map(cardStatementIn),
    },
    debts,
  }
}

// ---------------- レシートOCR ----------------

export interface OcrResult {
  title: string
  amountYen: number
  date: string
  lines: string[]
  text: string
}

/** レシート画像を送って、タイトル・金額・日付の候補を受け取る */
export async function apiReadReceipt(
  token: string,
  file: File,
): Promise<OcrResult> {
  const maxBytes = 8 * 1024 * 1024
  if (file.size > maxBytes) {
    throw new ApiError(413, '画像は8MB以下にしてください')
  }
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowed.has(file.type.toLowerCase())) {
    throw new ApiError(415, 'JPEG・PNG・WebP画像を選んでください')
  }
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/ocr/receipt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json())?.detail ?? ''
    } catch {
      /* 本文が読めない場合は無視 */
    }
    throw new ApiError(res.status, detail)
  }
  const j = (await res.json()) as Record<string, unknown>
  return {
    title: String(j.title ?? ''),
    amountYen: Number(j.amount_yen ?? 0),
    date: String(j.date ?? ''),
    lines: (j.lines as string[]) ?? [],
    text: String(j.text ?? ''),
  }
}
