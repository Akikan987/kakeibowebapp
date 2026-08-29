export const TYPE_INCOME = 'income'
export const TYPE_EXPENSE = 'expense'
export const DEFAULT_TITLE = 'その他'
export const PAYMENT_TYPES = ['prepaid', 'credit', 'debit', 'cash', 'other'] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  prepaid: 'プリペイド',
  credit: 'クレジット',
  debit: 'デビット',
  cash: '現金',
  other: 'その他',
}

/** 同期対象レコード共通のフィールド */
export interface SyncBase {
  id: string
  updatedAt: number
  deleted: boolean
}

export interface Expense extends SyncBase {
  title: string
  amountYen: number
  purchasedAtMillis: number
  category: string
  source: string
  type: string // income | expense
  paymentMethodId: string
}

export interface Member extends SyncBase {
  name: string
  linkedUid: string
}

export interface Category extends SyncBase {
  name: string
  position: number
}

export interface ExpenseSplit extends SyncBase {
  expenseId: string
  memberId: string
  amountYen: number
}

export interface Settlement extends SyncBase {
  memberId: string
  amountYen: number
  dateMillis: number
}

export interface PaymentMethod extends SyncBase {
  name: string
  type: PaymentType
  /** 1〜30は日付、31は月末。クレジット以外は0 */
  closingDay: number
  /** 1〜30は日付、31は月末。クレジット以外は0 */
  paymentDay: number
}

export interface PrepaidCharge extends SyncBase {
  prepaidMethodId: string
  /** 空なら初期残高・残高調整。指定時はその決済方法の実際の支払いに加算 */
  fundingMethodId: string
  amountYen: number
  chargedAtMillis: number
  note: string
}

export interface PrepaidBalance {
  methodId: string
  name: string
  charged: number
  spent: number
  balance: number
}

export interface CardWithdrawal {
  methodId: string
  methodName: string
  closingDay: number
  paymentDay: number
  withdrawalAtMillis: number
  amountYen: number
  expenseAmountYen: number
  chargeAmountYen: number
  itemCount: number
}

/** ログイン中のアカウント */
export interface Account {
  token: string
  uid: string
  nickname: string
  email: string
  phone: string
  avatarDataUrl: string
}

/** 他の人があなたに割り当てた「あなたが払う分」（サーバー計算） */
export interface Debt {
  ownerUid: string
  ownerNickname: string
  charged: number
  settled: number
  remaining: number
}

/** 名前ごとの残額（相手があなたに払う額） */
export interface MemberBalance {
  memberId: string
  name: string
  linkedUid: string
  charged: number
  settled: number
  remaining: number
}

export interface MonthlySummary {
  incomeTotal: number
  expenseTotal: number
  balance: number
  categoryTotals: { name: string; total: number }[]
  dailyTotals: Map<number, number>
}

export const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const now = () => Date.now()
