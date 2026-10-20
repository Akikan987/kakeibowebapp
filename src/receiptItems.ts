export interface ReceiptLineItem {
  name: string
  quantity: number | null
  lineTotalYen: number | null
}

/** Fail closed rather than silently dropping an unreadable line from a bill. */
export function readReceiptItems(value: unknown): ReceiptLineItem[] | null {
  if (!Array.isArray(value) || value.length > 100) return null
  const items: ReceiptLineItem[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null
    const { name, quantity, line_total_yen: amount } = row as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim() || name.length > 160 || /[\u0000-\u001f\u007f]/u.test(name)) return null
    if (quantity !== null && (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 999)) return null
    if (amount !== null && (typeof amount !== 'number' || !Number.isSafeInteger(amount) || Math.abs(amount) > 2_000_000_000)) return null
    items.push({ name: name.trim(), quantity: quantity as number | null, lineTotalYen: amount as number | null })
  }
  return items
}
