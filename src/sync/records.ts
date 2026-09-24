/** Sync records are flat objects of primitive values; compare fields, not key order. */
export function sameRecord<T extends object>(left: T, right: T): boolean {
  const keys = Object.keys(left) as (keyof T)[]
  return keys.length === Object.keys(right).length && keys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key],
  )
}

/** Preserve React memo dependencies when a DB reload did not change this table. */
export function reuseUnchangedRows<T extends object>(previous: T[], next: T[]): T[] {
  return previous.length === next.length && previous.every(
    (row, index) => sameRecord(row, next[index]),
  ) ? previous : next
}

/** Equal timestamps still accept changed server fields (the existing LWW policy). */
export function recordsToApply<T extends { id: string; updatedAt: number }>(
  current: (T | undefined)[], incoming: T[],
): T[] {
  const local = new Map(current.filter((row): row is T => row !== undefined).map((row) => [row.id, row]))
  const writes = new Map<string, T>()
  for (const row of incoming) {
    const existing = local.get(row.id)
    if (!existing || (row.updatedAt >= existing.updatedAt && !sameRecord(row, existing))) {
      writes.set(row.id, row)
      local.set(row.id, row)
    }
  }
  return [...writes.values()]
}
