import { useRef, useState } from 'react'
import {
  Button,
  Card,
  Divider,
  Field,
  LargeTitle,
  Modal,
  SectionHeader,
  formatDateTime,
} from '../components/ui'
import { useStore } from '../store'
import type { Category } from '../types'

export function SettingsScreen() {
  const s = useStore()
  const [newMember, setNewMember] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [renameTarget, setRenameTarget] = useState<Category | null>(null)
  const [renameText, setRenameText] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef(false)

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= s.categories.length) return
    const next = [...s.categories]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    void s.reorderCategories(next)
  }

  return (
    <div className="pb-6">
      <LargeTitle>設定</LargeTitle>

      <SectionHeader>アカウント・同期</SectionHeader>
      <Card className="space-y-3 p-3">
        {s.loggedIn && s.account ? (
          <>
            <div>
              <div className="text-lg font-semibold">{s.account.nickname}</div>
              <div className="text-[13px] text-ios-label2">
                UID: {s.account.uid}
              </div>
              {s.account.email && (
                <div className="text-[13px] text-ios-label2">
                  {s.account.email}
                </div>
              )}
              {s.account.phone && (
                <div className="text-[13px] text-ios-label2">
                  電話: {s.account.phone}
                </div>
              )}
              <div className="text-[13px] text-ios-label2">
                最終同期: {formatDateTime(s.lastSync)}
              </div>
            </div>
            <Button disabled={s.syncing} onClick={() => s.syncNow()}>
              {s.syncing ? '同期中…' : '今すぐ同期'}
            </Button>
            <button
              className="w-full py-2 text-sm"
              style={{ color: 'var(--color-ios-red)' }}
              onClick={s.logout}
            >
              ログアウト
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ios-label2">
              この端末のみでオフライン利用中です。
            </p>
            <Button onClick={s.backToAuth}>ログイン / 新規登録</Button>
            <p className="text-xs text-ios-label2">
              登録すると、今のデータもサーバーに同期され、他の端末からも使えます。
            </p>
          </>
        )}
      </Card>

      <SectionHeader>割り勘メンバー</SectionHeader>
      <Card>
        {s.members.length === 0 ? (
          <p className="p-4 text-ios-label2">
            メンバーがいません。下から追加してください。
          </p>
        ) : (
          s.members.map((m, i) => (
            <div key={m.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center justify-between py-2 pr-2 pl-4">
                <div>
                  <div>{m.name}</div>
                  {m.linkedUid && (
                    <div className="text-xs text-ios-blue">アカウント連携済み</div>
                  )}
                </div>
                <button
                  className="px-2 py-2 text-ios-label2"
                  onClick={() => s.deleteMember(m)}
                  aria-label="削除"
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
      <Card className="mt-2 flex items-center gap-2 p-3">
        <div className="flex-1">
          <Field
            label="名前を追加"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder="相手のニックネームで連携"
          />
        </div>
        <button
          className="mt-5 rounded-xl bg-ios-blue px-4 py-2.5 font-semibold text-white"
          onClick={async () => {
            await s.addMember(newMember)
            setNewMember('')
          }}
        >
          追加
        </button>
      </Card>
      <p className="px-5 py-1.5 text-xs text-ios-label2">
        名前がアカウントのニックネームと一致すると自動で連携され、相手のアプリにも「払う分」が表示されます。
      </p>

      <SectionHeader>品目（ドラッグで並び替え）</SectionHeader>
      <Card>
        {s.categories.map((c, i) => (
          <div
            key={c.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i)
              setDragIndex(null)
            }}
            className={dragIndex === i ? 'opacity-50' : ''}
          >
            {i > 0 && <Divider />}
            <div className="flex items-center gap-1 py-2 pr-2 pl-3">
              <span className="cursor-grab px-1 text-ios-label2 select-none">
                ☰
              </span>
              <span className="flex-1">{c.name}</span>
              <button
                className="px-1 text-lg text-ios-blue disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                aria-label="上へ"
              >
                ↑
              </button>
              <button
                className="px-1 text-lg text-ios-blue disabled:opacity-30"
                disabled={i === s.categories.length - 1}
                onClick={() => move(i, i + 1)}
                aria-label="下へ"
              >
                ↓
              </button>
              <button
                className="px-2 text-sm text-ios-blue"
                onClick={() => {
                  setRenameTarget(c)
                  setRenameText(c.name)
                }}
              >
                編集
              </button>
              <button
                className="px-2 py-2 text-ios-label2"
                onClick={() => s.deleteCategory(c)}
                aria-label="削除"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </Card>
      <Card className="mt-2 flex items-center gap-2 p-3">
        <div className="flex-1">
          <Field
            label="品目を追加"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
        </div>
        <button
          className="mt-5 rounded-xl bg-ios-blue px-4 py-2.5 font-semibold text-white"
          onClick={async () => {
            await s.addCategory(newCategory)
            setNewCategory('')
          }}
        >
          追加
        </button>
      </Card>

      <SectionHeader>データ（収入・支出のバックアップ）</SectionHeader>
      <Card>
        <button
          className="w-full px-4 py-4 text-left text-ios-blue"
          onClick={s.exportJson}
        >
          JSONファイルにエクスポート
        </button>
        <Divider />
        <button
          className="w-full px-4 py-4 text-left text-ios-blue"
          onClick={() => {
            replaceRef.current = false
            fileRef.current?.click()
          }}
        >
          インポート（追加）
        </button>
        <Divider />
        <button
          className="w-full px-4 py-4 text-left text-ios-blue"
          onClick={() => {
            replaceRef.current = true
            fileRef.current?.click()
          }}
        >
          インポート（全置換）
        </button>
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) await s.importJson(f, replaceRef.current)
          e.target.value = ''
        }}
      />

      {renameTarget && (
        <Modal title="品目の名前を変更" onClose={() => setRenameTarget(null)}>
          <Field
            label="名前"
            autoFocus
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
          />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                await s.renameCategory(renameTarget, renameText)
                setRenameTarget(null)
              }}
            >
              保存
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
