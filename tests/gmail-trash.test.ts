import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { gmailCandidateAction } from '../src/imports/gmail.ts'

const source = await readFile(new URL('../src/components/GmailImport.tsx', import.meta.url), 'utf8')

test('Gmail Trash consent starts false and resets when the owner changes', () => {
  assert.match(source, /\[trashPermissionConsent, setTrashPermissionConsent\] = useState\(false\)/u)
  assert.match(source, /\[trashEnableConsent, setTrashEnableConsent\] = useState\(false\)/u)
  const reset = source.slice(source.indexOf('generation.current += 1'), source.indexOf('const refresh ='))
  assert.match(reset, /setTrashPermissionConsent\(false\)/u)
  assert.match(reset, /setTrashEnableConsent\(false\)/u)
  assert.match(reset, /\[token, s.account\?\.uid\]/u)
})

test('Gmail Trash permission and activation are distinct user actions with reconnect warning', () => {
  assert.match(source, /disabled=\{busy \|\| native \|\| !status.configured \|\| !trashPermissionConsent\}/u)
  assert.match(source, /window\.confirm\('追加権限で再接続すると、現在の未確認候補とAI明細検出への同意がリセット/u)
  assert.match(source, /'gmail\/start', \{ consent: true, trashConsent: true \}/u)
  assert.match(source, /disabled=\{busy \|\| !trashEnableConsent\}/u)
  assert.match(source, /'gmail\/trash-settings', \{ enabled: true, consent: true \}/u)
  assert.match(source, /'gmail\/trash-settings', \{ enabled: false, consent: false \}/u)
})

test('Gmail Trash UI describes sync, narrow targets, wider grant and Gmail retention', () => {
  for (const text of ['サーバーで完了した後', '元メール1通だけ', '30日後に完全削除', '既存候補や過去のメールは対象になりません', '読み取り・作成・送信・管理', '処理中のものは止められません', 'trashPendingCount', 'trashFailedCount']) {
    assert.ok(source.includes(text), text)
  }
})

test('Gmail import acknowledgement passes the saved expense ID, never for dismiss', async () => {
  const previous = globalThis.fetch
  const bodies: unknown[] = []
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(String(options?.body)))
    return new Response('{"ok":true}', { status: 200 })
  }
  try {
    await gmailCandidateAction('cookie', 'candidate-one', 'imported', 'saved-expense-one')
    await gmailCandidateAction('cookie', 'candidate-one', 'dismiss', 'must-not-be-used')
    await gmailCandidateAction('cookie', 'legacy-candidate', 'imported')
    assert.deepEqual(bodies, [{ action: 'imported', expenseId: 'saved-expense-one' }, { action: 'dismiss' }, { action: 'imported' }])
  } finally { globalThis.fetch = previous }
})

test('Saved expense ID is returned after local write and relayed through AddScreen to Gmail ACK', async () => {
  const store = await readFile(new URL('../src/store.tsx', import.meta.url), 'utf8')
  const save = store.slice(store.indexOf('const saveExpense ='), store.indexOf('const deleteExpense ='))
  assert.ok(save.indexOf('await writeExpense(') < save.indexOf('return id'))
  const add = await readFile(new URL('../src/screens/AddScreen.tsx', import.meta.url), 'utf8')
  assert.match(add, /const expenseId = await s\.saveExpense\(draft\)/u)
  assert.match(add, /if \(expenseId\) \{[\s\S]*?onDone\(draft.source, expenseId\)/u)
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /gmailCandidateAction\(s.account.token, gmailImport.id, 'imported', expenseId\)/u)
})
