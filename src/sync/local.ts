import type { Table } from 'dexie'
import { db, type KakeiboDB } from '../db.ts'
import type { SyncBase } from '../types.ts'
import { recordsToApply } from './records.ts'
import { SYNC_TABLE_NAMES, type SyncTables } from './types.ts'

/** One consistent snapshot, including tombstones. Never advance a timestamp cursor. */
export async function readSyncSnapshot(database: KakeiboDB = db): Promise<SyncTables> {
  return database.transaction('r', SYNC_TABLE_NAMES.map((name) => database[name]), async () => {
    const entries = await Promise.all(SYNC_TABLE_NAMES.map(async (name) =>
      [name, await database[name].toArray()] as const,
    ))
    return Object.fromEntries(entries) as unknown as SyncTables
  })
}

async function applyTable<T extends SyncBase>(table: Table<T, string>, incoming: T[]) {
  if (!incoming.length) return 0
  const current = await table.bulkGet(incoming.map((row) => row.id))
  const writes = recordsToApply(current, incoming)
  if (writes.length) await table.bulkPut(writes)
  return writes.length
}

/** Read + merge + write atomically, so a local edit cannot race an old response. */
export async function applySyncChanges(changes: SyncTables, database: KakeiboDB = db): Promise<number> {
  const names = SYNC_TABLE_NAMES.filter((name) => changes[name].length > 0)
  if (!names.length) return 0
  return database.transaction('rw', names.map((name) => database[name]), async () => {
    let written = 0
    for (const name of names) {
      // The registry pairs each table with its matching array; all share SyncBase.
      written += await applyTable(database[name] as Table<SyncBase, string>, changes[name])
    }
    return written
  })
}
