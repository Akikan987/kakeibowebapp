import { useState } from 'react'
import {
  Button,
  Card,
  Divider,
  LargeTitle,
  Modal,
  SectionHeader,
  formatDate,
  yen,
} from '../components/ui'
import { useStore, type ExpenseDraft } from '../store'
import { TYPE_INCOME, type Expense } from '../types'

export function ListScreen({
  onEdit,
}: {
  onEdit: (draft: ExpenseDraft) => void
}) {
  const s = useStore()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)

  const startEdit = (e: Expense) => {
    onEdit({
      editingId: e.id,
      type: e.type,
      title: e.title,
      amountYen: String(e.amountYen),
      category: e.category,
      purchasedAtMillis: e.purchasedAtMillis,
      source: e.source,
      splits: s
        .splitsOfExpense(e.id)
        .map((sp) => ({ memberId: sp.memberId, amount: String(sp.amountYen) })),
    })
  }

  return (
    <div className="pb-6">
      <LargeTitle>履歴</LargeTitle>
      {s.expenses.length === 0 ? (
        <p className="px-4 text-ios-label2">まだ明細がありません</p>
      ) : (
        <>
          <SectionHeader>タップで編集</SectionHeader>
          <Card>
            {s.expenses.map((e, i) => {
              const isIncome = e.type === TYPE_INCOME
              const accent = isIncome
                ? 'var(--color-ios-green)'
                : 'var(--color-ios-red)'
              const split = s.splitSumOf(e.id)
              return (
                <div key={e.id}>
                  {i > 0 && <Divider />}
                  <div className="flex items-center gap-2 py-2.5 pr-2 pl-4">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => startEdit(e)}
                    >
                      <div className="truncate font-medium">{e.title}</div>
                      <div className="text-[13px] text-ios-label2">
                        {isIncome ? '収入' : '支出'} ・ {e.category} ・{' '}
                        {formatDate(e.purchasedAtMillis)}
                      </div>
                      {split > 0 && (
                        <div className="text-xs text-ios-blue">
                          自分の負担 {yen(s.netAmount(e))}（割り勘{' '}
                          {yen(split)}）
                        </div>
                      )}
                    </button>
                    <span className="font-semibold" style={{ color: accent }}>
                      {isIncome ? '+' : '-'}
                      {yen(e.amountYen)}
                    </span>
                    <button
                      className="px-2 py-2 text-ios-label2"
                      onClick={() => setPendingDelete(e)}
                      aria-label="削除"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </Card>
        </>
      )}

      {pendingDelete && (
        <Modal title="削除しますか？" onClose={() => setPendingDelete(null)}>
          <p className="mb-4 text-sm text-ios-label2">
            「{pendingDelete.title}」({yen(pendingDelete.amountYen)}) を削除します。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              キャンセル
            </Button>
            <Button
              color="var(--color-ios-red)"
              onClick={async () => {
                await s.deleteExpense(pendingDelete)
                setPendingDelete(null)
              }}
            >
              削除
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
