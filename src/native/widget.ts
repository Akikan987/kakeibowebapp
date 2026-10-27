import { buildWithdrawalSchedule, paymentOverview, withdrawalTotals } from '../domain/paymentOverview.ts'
import type { CardStatement, CardWithdrawal, PaymentMethod } from '../types.ts'
import type { WidgetSnapshot } from './runtime.ts'

/** All dates and amounts come from the same schedule used by the payment screen. */
export function widgetSnapshot(input: {
  owner: string; calculated: CardWithdrawal[]; statements: CardStatement[]; methods: PaymentMethod[]
  lastSync: number; syncError: boolean; online: boolean; timestamp: number
}): WidgetSnapshot {
  const schedule = buildWithdrawalSchedule(input.calculated, input.statements, input.methods)
  const now = new Date(input.timestamp)
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const overview = paymentOverview(schedule, input.timestamp)
  return {
    owner: input.owner,
    monthTotal: withdrawalTotals(schedule.filter((row) => row.withdrawalAtMillis >= start && row.withdrawalAtMillis < end)).total,
    nextDate: overview.nextDate ?? null, nextAmount: overview.next.total,
    updatedAt: input.timestamp, lastSync: input.lastSync,
    monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    state: input.syncError ? 'error' : !input.online ? 'offline' : 'current',
  }
}
