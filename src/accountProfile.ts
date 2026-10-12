import type { Account } from './types'

export type AccountProfileSnapshot = Pick<Account, 'uid' | 'token' | 'nickname' | 'email' | 'avatarDataUrl'>

/** A profile read may merge only while its session and visible profile are unchanged. */
export function matchesAccountProfileSnapshot(
  current: AccountProfileSnapshot | null,
  snapshot: AccountProfileSnapshot,
) {
  return Boolean(
    current &&
    current.uid === snapshot.uid &&
    current.token === snapshot.token &&
    current.nickname === snapshot.nickname &&
    current.email === snapshot.email &&
    current.avatarDataUrl === snapshot.avatarDataUrl,
  )
}
