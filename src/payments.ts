import {
  TYPE_EXPENSE,
  type CardWithdrawal,
  type Expense,
  type PaymentMethod,
  type PrepaidBalance,
  type PrepaidCharge,
} from './types.ts'

const clampedDay = (year: number, monthIndex: number, day: number) => {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(Math.max(day, 1), last)
}

/**
 * 利用日とカードの締め日から予定引落日を求める。
 * 31は月末扱い。休日による前後調整はカード会社固有なので行わない。
 */
export function expectedWithdrawalDate(
  usedAtMillis: number,
  closingDay: number,
  paymentDay: number,
): number {
  const used = new Date(usedAtMillis)
  const year = used.getFullYear()
  const month = used.getMonth()
  const actualClosingDay = clampedDay(year, month, closingDay)
  const closingMonthOffset = used.getDate() <= actualClosingDay ? 0 : 1
  const paymentMonth = month + closingMonthOffset + 1
  const paymentYear = year + Math.floor(paymentMonth / 12)
  const normalizedPaymentMonth = ((paymentMonth % 12) + 12) % 12
  return new Date(
    paymentYear,
    normalizedPaymentMonth,
    clampedDay(paymentYear, normalizedPaymentMonth, paymentDay),
    12,
  ).getTime()
}

export function computePrepaidBalances(
  methods: PaymentMethod[],
  charges: PrepaidCharge[],
  expenses: Expense[],
): PrepaidBalance[] {
  const charged = new Map<string, number>()
  for (const charge of charges) {
    charged.set(
      charge.prepaidMethodId,
      (charged.get(charge.prepaidMethodId) ?? 0) + charge.amountYen,
    )
  }
  const spent = new Map<string, number>()
  for (const expense of expenses) {
    if (expense.type !== TYPE_EXPENSE) continue
    spent.set(
      expense.paymentMethodId,
      (spent.get(expense.paymentMethodId) ?? 0) + expense.amountYen,
    )
  }
  return methods
    .filter((method) => method.type === 'prepaid')
    .map((method) => {
      const chargeTotal = charged.get(method.id) ?? 0
      const spentTotal = spent.get(method.id) ?? 0
      return {
        methodId: method.id,
        name: method.name,
        charged: chargeTotal,
        spent: spentTotal,
        balance: chargeTotal - spentTotal,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function computeCardWithdrawals(
  methods: PaymentMethod[],
  charges: PrepaidCharge[],
  expenses: Expense[],
): CardWithdrawal[] {
  const cards = new Map(
    methods
      .filter(
        (method) =>
          method.type === 'credit' &&
          method.closingDay >= 1 &&
          method.paymentDay >= 1,
      )
      .map((method) => [method.id, method]),
  )
  const grouped = new Map<string, CardWithdrawal>()

  const add = (
    method: PaymentMethod,
    usedAtMillis: number,
    amountYen: number,
    kind: 'expense' | 'charge',
  ) => {
    const withdrawalAtMillis = expectedWithdrawalDate(
      usedAtMillis,
      method.closingDay,
      method.paymentDay,
    )
    const key = `${method.id}:${withdrawalAtMillis}`
    const current = grouped.get(key) ?? {
      methodId: method.id,
      methodName: method.name,
      closingDay: method.closingDay,
      paymentDay: method.paymentDay,
      withdrawalAtMillis,
      amountYen: 0,
      expenseAmountYen: 0,
      chargeAmountYen: 0,
      itemCount: 0,
    }
    current.amountYen += amountYen
    current.itemCount += 1
    if (kind === 'expense') current.expenseAmountYen += amountYen
    else current.chargeAmountYen += amountYen
    grouped.set(key, current)
  }

  for (const expense of expenses) {
    if (expense.type !== TYPE_EXPENSE) continue
    const card = cards.get(expense.paymentMethodId)
    if (card) add(card, expense.purchasedAtMillis, expense.amountYen, 'expense')
  }
  for (const charge of charges) {
    const card = cards.get(charge.fundingMethodId)
    if (card) add(card, charge.chargedAtMillis, charge.amountYen, 'charge')
  }

  return [...grouped.values()].sort(
    (a, b) =>
      a.withdrawalAtMillis - b.withdrawalAtMillis ||
      a.methodName.localeCompare(b.methodName),
  )
}
