import type {
  Budget, CardStatement, Category, Debt, Expense, ExpenseSplit, Member,
  PaymentMethod, PrepaidCharge, RecurringTemplate, Settlement,
} from '../types.ts'

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

export const SYNC_TABLE_NAMES = [
  'expenses', 'members', 'categories', 'expenseSplits', 'settlements',
  'paymentMethods', 'prepaidCharges', 'recurringTemplates', 'budgets', 'cardStatements',
] as const satisfies readonly (keyof SyncTables)[]

export interface SyncResult {
  serverTime: number
  changes: SyncTables
  debts: Debt[]
}
