import { useState } from 'react'
import {
  Button,
  Card,
  Divider,
  Field,
  LargeTitle,
  Modal,
  SectionHeader,
  formatDate,
  yen,
} from '../components/ui'
import { useStore } from '../store'
import type { MemberBalance, Settlement } from '../types'

export function SplitScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const s = useStore()
  const [settleTarget, setSettleTarget] = useState<MemberBalance | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Settlement | null>(null)

  return (
    <div className="pb-6">
      <LargeTitle>割り勘</LargeTitle>

      {/* 他の人があなたに割り当てた分（アカウント連携・同期で更新） */}
      {s.debts.length > 0 && (
        <>
          <SectionHeader>あなたが払う分</SectionHeader>
          <Card>
            {s.debts.map((d, i) => (
              <div key={d.ownerUid}>
                {i > 0 && <Divider />}
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="font-medium">{d.ownerNickname}さんへ</div>
                    <div className="text-[13px] text-ios-label2">
                      割当 {yen(d.charged)} ・ 清算済 {yen(d.settled)}
                    </div>
                  </div>
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        d.remaining > 0
                          ? 'var(--color-ios-red)'
                          : 'var(--color-ios-label2)',
                    }}
                  >
                    {yen(d.remaining)}
                  </span>
                </div>
              </div>
            ))}
          </Card>
          <p className="px-5 py-1.5 text-xs text-ios-label2">
            相手が清算を記録すると、同期時にここの残額が減ります。
          </p>
        </>
      )}

      {s.balances.length === 0 ? (
        <>
          <SectionHeader>メンバー未登録</SectionHeader>
          <Card className="p-4">
            <p className="text-ios-label2">
              「設定」でメンバーを追加し、支出の登録時に各人の負担を入れると、ここに残額が出ます。
            </p>
            <button className="mt-2 text-ios-blue" onClick={onOpenSettings}>
              設定を開く
            </button>
          </Card>
        </>
      ) : (
        <>
          <SectionHeader>名前ごとの残額（相手があなたに払う額）</SectionHeader>
          <Card>
            {s.balances.map((b, i) => (
              <div key={b.memberId}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-2 py-2.5 pr-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="text-[13px] text-ios-label2">
                      割当 {yen(b.charged)} ・ 清算済 {yen(b.settled)}
                    </div>
                  </div>
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        b.remaining > 0
                          ? 'var(--color-ios-green)'
                          : 'var(--color-ios-label2)',
                    }}
                  >
                    {yen(b.remaining)}
                  </span>
                  <button
                    className="px-2 text-ios-blue"
                    onClick={() => {
                      setSettleTarget(b)
                      setSettleAmount('')
                    }}
                  >
                    清算
                  </button>
                </div>
              </div>
            ))}
          </Card>
          <p className="px-5 py-2 text-[13px] text-ios-label2">
            支出の登録画面で「他の人の負担」を入れると各人の割当に積み上がります。受け取ったら「清算」で記録すると残額が減ります。
          </p>
        </>
      )}

      {s.settlements.length > 0 && (
        <>
          <SectionHeader>清算の履歴</SectionHeader>
          <Card>
            {s.settlements.map((st, i) => (
              <div key={st.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-2 py-2.5 pr-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {s.memberName(st.memberId)}
                    </div>
                    <div className="text-[13px] text-ios-label2">
                      {formatDate(st.dateMillis)}
                    </div>
                  </div>
                  <span
                    className="font-semibold"
                    style={{ color: 'var(--color-ios-green)' }}
                  >
                    {yen(st.amountYen)}
                  </span>
                  <button
                    className="px-2 py-2 text-ios-label2"
                    onClick={() => setPendingDelete(st)}
                    aria-label="取り消し"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {settleTarget && (
        <Modal
          title={`${settleTarget.name} から清算された額`}
          onClose={() => setSettleTarget(null)}
        >
          <Field
            label="金額（円）"
            inputMode="numeric"
            autoFocus
            value={settleAmount}
            onChange={(e) =>
              setSettleAmount(e.target.value.replace(/[^0-9]/g, ''))
            }
          />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setSettleTarget(null)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                if (
                  await s.recordSettlement(
                    settleTarget.memberId,
                    parseInt(settleAmount, 10),
                  )
                ) {
                  setSettleTarget(null)
                }
              }}
            >
              記録
            </Button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal title="取り消しますか？" onClose={() => setPendingDelete(null)}>
          <p className="mb-4 text-sm text-ios-label2">
            {s.memberName(pendingDelete.memberId)} の清算{' '}
            {yen(pendingDelete.amountYen)} を取り消します。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              やめる
            </Button>
            <Button
              color="var(--color-ios-red)"
              onClick={async () => {
                await s.deleteSettlement(pendingDelete)
                setPendingDelete(null)
              }}
            >
              取り消す
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
