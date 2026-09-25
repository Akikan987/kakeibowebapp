import { expectedWithdrawalDate } from '../payments.ts'
import type { CardStatement, CardWithdrawal, Expense, ExpenseRefund, PaymentMethod, PrepaidCharge } from '../types.ts'

export interface ScheduledWithdrawal extends CardWithdrawal {
  estimatedAmountYen: number
  status: 'estimated' | 'confirmed' | 'paid'
}

export const withdrawalKey = (methodId: string, date: number) => `${methodId}:${date}`
const dayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Keep confirmed statements visible even if their underlying expenses were removed. */
export function buildWithdrawalSchedule(
  calculated: CardWithdrawal[], statements: CardStatement[], methods: PaymentMethod[],
): ScheduledWithdrawal[] {
  const byKey = new Map(calculated.map((row) => [withdrawalKey(row.methodId, row.withdrawalAtMillis), {
    ...row, estimatedAmountYen: row.amountYen, status: 'estimated' as ScheduledWithdrawal['status'],
  }]))
  const latest = new Map<string, CardStatement>()
  for (const statement of statements) {
    if (statement.deleted) continue
    const key = withdrawalKey(statement.paymentMethodId, statement.withdrawalAtMillis)
    if (!latest.has(key) || statement.updatedAt >= latest.get(key)!.updatedAt) latest.set(key, statement)
  }
  const methodMap = new Map(methods.map((method) => [method.id, method]))
  for (const [key, statement] of latest) {
    const method = methodMap.get(statement.paymentMethodId)
    const previous = byKey.get(key) ?? {
      methodId: statement.paymentMethodId, methodName: method?.name ?? '削除済みのカード',
      closingDay: method?.closingDay ?? 0, paymentDay: method?.paymentDay ?? 0,
      withdrawalAtMillis: statement.withdrawalAtMillis, estimatedAmountYen: 0,
      expenseAmountYen: 0, chargeAmountYen: 0, itemCount: 0,
    }
    byKey.set(key, { ...previous, amountYen: statement.actualAmountYen, status: statement.status })
  }
  return [...byKey.values()].sort((a, b) => a.withdrawalAtMillis - b.withdrawalAtMillis || a.methodName.localeCompare(b.methodName))
}

export function withdrawalTotals(rows: ScheduledWithdrawal[]) {
  let confirmed = 0
  let estimated = 0
  for (const row of rows) {
    if (row.status === 'paid') continue
    if (row.status === 'confirmed') confirmed += row.amountYen
    else estimated += row.amountYen
  }
  return { confirmed, estimated, total: confirmed + estimated }
}

export function paymentOverview(schedule: ScheduledWithdrawal[], timestamp: number) {
  const start = dayStart(timestamp)
  const end = (days: number) => { const date = new Date(start); date.setDate(date.getDate() + days); return date.getTime() }
  const unpaid = schedule.filter((row) => row.status !== 'paid')
  const upcoming = unpaid.filter((row) => row.withdrawalAtMillis >= start)
  const past = unpaid.filter((row) => row.withdrawalAtMillis < start)
  const nextDate = upcoming[0]?.withdrawalAtMillis
  return {
    upcoming, past,
    nextDate,
    next: withdrawalTotals(nextDate === undefined ? [] : upcoming.filter((row) => dayStart(row.withdrawalAtMillis) === dayStart(nextDate))),
    week: withdrawalTotals(upcoming.filter((row) => row.withdrawalAtMillis < end(7))),
    month: withdrawalTotals(upcoming.filter((row) => row.withdrawalAtMillis < end(30))),
  }
}

export interface WithdrawalItem { id: string; title: string; date: number; amountYen: number; kind: 'expense' | 'charge' | 'refund' }

export function withdrawalItems(row: CardWithdrawal, expenses: Expense[], charges: PrepaidCharge[], refunds: ExpenseRefund[] = []): WithdrawalItem[] {
  if (row.closingDay < 1 || row.paymentDay < 1) return []
  const matches = (date: number) => expectedWithdrawalDate(date, row.closingDay, row.paymentDay) === row.withdrawalAtMillis
  const items: WithdrawalItem[] = []
  for (const expense of expenses) {
    if (!expense.deleted && expense.type === 'expense' && expense.paymentMethodId === row.methodId && matches(expense.purchasedAtMillis)) {
      items.push({ id: expense.id, title: expense.title, date: expense.purchasedAtMillis, amountYen: expense.amountYen, kind: 'expense' })
    }
  }
  for (const charge of charges) {
    if (!charge.deleted && charge.fundingMethodId === row.methodId && matches(charge.chargedAtMillis)) {
      items.push({ id: charge.id, title: charge.note || 'プリペイドチャージ', date: charge.chargedAtMillis, amountYen: charge.amountYen, kind: 'charge' })
    }
  }
  for (const refund of refunds) if (!refund.deleted && refund.paymentMethodId === row.methodId && refund.cardWithdrawalAtMillis === row.withdrawalAtMillis)
    items.push({ id: refund.id, title: refund.note || '返金', date: refund.refundedAtMillis, amountYen: -refund.amountYen, kind: 'refund' })
  return items.sort((a, b) => b.date - a.date || a.id.localeCompare(b.id))
}
