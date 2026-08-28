import { useRef, useState } from 'react'
import {
  Button,
  Card,
  Field,
  LargeTitle,
  SectionHeader,
  fromLocalInput,
  toLocalInput,
  yen,
} from '../components/ui'
import { emptyDraft, useStore, type ExpenseDraft } from '../store'
import { TYPE_EXPENSE, TYPE_INCOME, now } from '../types'

export function AddScreen({
  initial,
  onDone,
}: {
  initial?: ExpenseDraft | null
  onDone: () => void
}) {
  const s = useStore()
  const [draft, setDraft] = useState<ExpenseDraft>(() => initial ?? emptyDraft())
  const [reading, setReading] = useState(false)
  const receiptRef = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<ExpenseDraft>) => setDraft((d) => ({ ...d, ...p }))

  // 種類（収入/支出）未選択なら選択画面
  if (!draft.type) {
    return (
      <div className="px-6 pb-6">
        <LargeTitle>記録する</LargeTitle>
        <p className="px-4 pb-6 text-sm text-ios-label2">
          種類を選んでください（押した時点の日時を記録します）
        </p>
        <div className="space-y-3">
          <Button
            color="var(--color-ios-green)"
            className="py-5 text-xl"
            onClick={() =>
              patch({ type: TYPE_INCOME, purchasedAtMillis: now() })
            }
          >
            収入を入力
          </Button>
          <Button
            color="var(--color-ios-red)"
            className="py-5 text-xl"
            onClick={() =>
              patch({ type: TYPE_EXPENSE, purchasedAtMillis: now() })
            }
          >
            支出を入力
          </Button>
        </div>
      </div>
    )
  }

  const isIncome = draft.type === TYPE_INCOME
  const accent = isIncome ? 'var(--color-ios-green)' : 'var(--color-ios-red)'
  const amount = parseInt(draft.amountYen, 10) || 0
  const splitTotal = draft.splits.reduce(
    (a, b) => a + (parseInt(b.amount, 10) || 0),
    0,
  )

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between pr-4">
        <LargeTitle>
          {draft.editingId ? '編集' : isIncome ? '収入を入力' : '支出を入力'}
        </LargeTitle>
        {!draft.editingId && (
          <button
            className="text-sm text-ios-blue"
            onClick={() => patch({ type: '' })}
          >
            種類を変更
          </button>
        )}
      </div>

      <SectionHeader>内容</SectionHeader>
      <Card className="space-y-3 p-3">
        <Field
          label="タイトル"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="未入力なら「その他」"
        />
        <Field
          label="金額（円）"
          inputMode="numeric"
          value={draft.amountYen}
          onChange={(e) =>
            patch({ amountYen: e.target.value.replace(/[^0-9]/g, '') })
          }
        />
        <label className="block">
          <span className="mb-1 block text-[13px] text-ios-label2">品目</span>
          <select
            value={draft.category}
            onChange={(e) => patch({ category: e.target.value })}
            className="w-full rounded-xl border border-ios-sep bg-white px-3 py-2.5 outline-none focus:border-ios-blue"
          >
            {s.categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            {!s.categories.some((c) => c.name === draft.category) && (
              <option value={draft.category}>{draft.category}</option>
            )}
          </select>
        </label>
        <Field
          label="記録日時"
          type="datetime-local"
          value={toLocalInput(draft.purchasedAtMillis)}
          onChange={(e) =>
            patch({ purchasedAtMillis: fromLocalInput(e.target.value) })
          }
        />
      </Card>

      {!isIncome && (
        <>
          <SectionHeader>レシートから入力</SectionHeader>
          <Card className="p-3">
            <button
              className="w-full rounded-xl border border-ios-blue bg-white px-4 py-3 font-semibold text-ios-blue disabled:opacity-50"
              disabled={reading}
              onClick={() => receiptRef.current?.click()}
            >
              {reading ? "読み取り中…" : "📷 レシートを読み取る"}
            </button>
            <input
              ref={receiptRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setReading(true)
                try {
                  const r = await s.readReceipt(file)
                  if (r) {
                    const next: Partial<ExpenseDraft> = {
                      title: r.title || draft.title,
                      amountYen: r.amountYen ? String(r.amountYen) : draft.amountYen,
                      source: 'receipt_ocr',
                    }
                    if (r.date) {
                      const d = new Date(`${r.date}T12:00:00`)
                      if (!Number.isNaN(d.getTime())) next.purchasedAtMillis = d.getTime()
                    }
                    patch(next)
                    s.notify('レシートを読み取りました')
                  }
                } finally {
                  setReading(false)
                }
              }}
            />
            <p className="mt-2 text-xs text-ios-label2">
              カメラで撮影するか、アルバムの写真を選べます。店名・合計金額・日付を自動で読み取ります（あとから手で直せます）。
            </p>
          </Card>

          <SectionHeader>割り勘（他の人の負担）</SectionHeader>
          <Card className="space-y-3 p-3">
            {s.members.length === 0 ? (
              <p className="text-sm text-ios-label2">
                「設定」でメンバーを追加すると、この支出から他の人の負担を割り当てられます。
              </p>
            ) : (
              <>
                {draft.splits.map((sp, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <label className="flex-1">
                      <span className="mb-1 block text-[13px] text-ios-label2">
                        人
                      </span>
                      <select
                        value={sp.memberId}
                        onChange={(e) => {
                          const next = [...draft.splits]
                          next[i] = { ...next[i], memberId: e.target.value }
                          patch({ splits: next })
                        }}
                        className="w-full rounded-xl border border-ios-sep bg-white px-3 py-2.5"
                      >
                        {s.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="w-28">
                      <span className="mb-1 block text-[13px] text-ios-label2">
                        円
                      </span>
                      <input
                        inputMode="numeric"
                        value={sp.amount}
                        onChange={(e) => {
                          const next = [...draft.splits]
                          next[i] = {
                            ...next[i],
                            amount: e.target.value.replace(/[^0-9]/g, ''),
                          }
                          patch({ splits: next })
                        }}
                        className="w-full rounded-xl border border-ios-sep px-3 py-2.5"
                      />
                    </label>
                    <button
                      className="px-2 py-2.5 text-ios-label2"
                      onClick={() =>
                        patch({
                          splits: draft.splits.filter((_, j) => j !== i),
                        })
                      }
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="text-ios-blue"
                  onClick={() =>
                    patch({
                      splits: [
                        ...draft.splits,
                        { memberId: s.members[0].id, amount: '' },
                      ],
                    })
                  }
                >
                  ＋ 人を追加
                </button>
                {draft.splits.length > 0 && (
                  <div className="border-t border-ios-sep pt-2 text-sm">
                    <div className="flex justify-between text-ios-label2">
                      <span>他の人の負担 計</span>
                      <span>{yen(splitTotal)}</span>
                    </div>
                    <div className="mt-1 flex justify-between font-semibold">
                      <span>あなたの負担（統計に反映）</span>
                      <span
                        style={{
                          color:
                            amount - splitTotal < 0
                              ? 'var(--color-ios-red)'
                              : 'var(--color-ios-green)',
                        }}
                      >
                        {yen(amount - splitTotal)}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      <div className="mt-5 px-4">
        <Button
          color={accent}
          onClick={async () => {
            await s.saveExpense(draft)
            onDone()
          }}
        >
          {draft.editingId ? '更新' : '保存'}
        </Button>
      </div>
    </div>
  )
}
