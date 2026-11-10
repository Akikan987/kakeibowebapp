export const MAX_ENTRY_YEN = 2_000_000_000

export function normalizeYenInput(value: string): string {
  const normalized = value.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10)).replace(/，/g, ',')
  const trimmed = normalized.trim()
  return /^\d{1,3}(?:,\d{3})+$/.test(trimmed) ? trimmed.replace(/,/g, '') : normalized
}

export function parseYenAmount(value: string, max = Number.MAX_SAFE_INTEGER) {
  const normalized = normalizeYenInput(value).trim()
  if (!normalized) return { error: 'empty' } as const
  if (/[-－−ー]/.test(normalized)) return { error: 'negative' } as const
  if (!/^\d+$/.test(normalized)) return { error: 'format' } as const

  const amount = Number(normalized)
  if (amount === 0) return { error: 'zero' } as const
  if (!Number.isSafeInteger(amount) || amount > max) return { error: 'limit' } as const
  return { amount } as const
}
