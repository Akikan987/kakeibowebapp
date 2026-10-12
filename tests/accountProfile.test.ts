import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesAccountProfileSnapshot, type AccountProfileSnapshot } from '../src/accountProfile.ts'

const snapshot: AccountProfileSnapshot = {
  uid: 'u1',
  token: 'cookie',
  nickname: 'N',
  email: 'n@example.com',
  avatarDataUrl: 'avatar-a',
}

test('profile refresh merges only while session and visible profile still match its snapshot', () => {
  assert.equal(matchesAccountProfileSnapshot({ ...snapshot }, snapshot), true)
  assert.equal(matchesAccountProfileSnapshot({ ...snapshot, nickname: 'New name' }, snapshot), false)
  assert.equal(matchesAccountProfileSnapshot({ ...snapshot, email: 'new@example.com' }, snapshot), false)
  assert.equal(matchesAccountProfileSnapshot({ ...snapshot, avatarDataUrl: 'avatar-b' }, snapshot), false)
  assert.equal(matchesAccountProfileSnapshot({ ...snapshot, token: 'new-session' }, snapshot), false)
  assert.equal(matchesAccountProfileSnapshot(null, snapshot), false)
})
