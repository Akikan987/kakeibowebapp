import { TYPE_INCOME, type Category } from '../types.ts'

// UUIDs use the same SHA-256 prefix as the original Web starter categories.
export const starterCategories = [
  { name: '食費', id: '91df91f8-f4b5-1905-6e3e-c6c549372eb8' },
  { name: '日用品', id: 'eaacdf6e-61a4-fc4c-8369-670fe1f7ec9c' },
  { name: '交通', id: 'bee110bf-882b-5da9-4d67-ad290f417cfd' },
  { name: '娯楽', id: 'fd6ee28f-e1ec-f045-a750-c2947b53aa80' },
  { name: 'その他', id: '5a43ac36-14e0-7947-0192-a5a22fddac13' },
] as const

export const expandedExpenseCategories = [
  { name: '住居', id: '3f62b31b-f698-6b53-f514-d9466c60cb98' },
  { name: '水道光熱', id: 'ab8de149-9c93-ddc2-0ca7-40dcc7221d59' },
  { name: '通信', id: 'e41be7fa-b981-1815-fd1e-98b94c2f788b' },
  { name: '医療', id: '68eb6464-649c-516c-6a39-0d61b2da8eac' },
  { name: 'サブスク', id: 'd89c149a-1a93-af21-5c19-4ff1c4105079' },
  { name: '交際', id: '574f334a-99da-4401-e0fa-55bcf358b517' },
] as const

const expenseDefaults = new Map<string, string>([...starterCategories, ...expandedExpenseCategories].map(({ id, name }) => [id, name]))
const incomePresets = ['給与', '賞与', '副収入', 'その他']

/** Category selections remain names so older clients and backups can read them. */
export function listCategoryNames(categories: readonly Category[], type: string, selected = ''): string[] {
  const isIncome = type === TYPE_INCOME
  const names = isIncome ? [...incomePresets] : []
  for (const category of categories) {
    // Keep custom names shared, including renamed starters and categories from older clients.
    if (!category.deleted && (!isIncome || expenseDefaults.get(category.id) !== category.name)) names.push(category.name)
  }
  if (selected) names.push(selected)
  return [...new Set(names)]
}
