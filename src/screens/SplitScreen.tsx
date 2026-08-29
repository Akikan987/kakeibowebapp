import { useState } from 'react'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { Box, CardContent, IconButton, Stack, Typography } from '@mui/material'
import { Button, Card, Divider, Field, LargeTitle, Modal, Screen, SectionHeader, formatDate, yen } from '../components/ui'
import { useStore } from '../store'
import type { MemberBalance, Settlement } from '../types'

export function SplitScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const s = useStore()
  const [settleTarget, setSettleTarget] = useState<MemberBalance | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Settlement | null>(null)

  return (
    <Screen>
      <LargeTitle>割り勘</LargeTitle>
      {s.debts.length > 0 && <>
        <SectionHeader>あなたが払う分</SectionHeader>
        <Card>{s.debts.map((debt, index) => <Box key={debt.ownerUid}>{index > 0 && <Divider />}<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}><Box><Typography fontWeight={700}>{debt.ownerNickname}さんへ</Typography><Typography variant="body2" color="text.secondary">割当 {yen(debt.charged)} ・ 清算済 {yen(debt.settled)}</Typography></Box><Typography fontWeight={700} color={debt.remaining > 0 ? 'error.main' : 'text.secondary'}>{yen(debt.remaining)}</Typography></Stack></Box>)}</Card>
        <HelpText>相手が清算を記録すると、同期時にここの残額が減ります。</HelpText>
      </>}

      {s.balances.length === 0 ? <>
        <SectionHeader>メンバー未登録</SectionHeader>
        <Card><CardContent><Typography color="text.secondary">「設定」でメンバーを追加し、支出の登録時に各人の負担を入れると、ここに残額が出ます。</Typography><Button variant="text" onClick={onOpenSettings} sx={{ width: 'fit-content', mt: 1 }}>設定を開く</Button></CardContent></Card>
      </> : <>
        <SectionHeader>名前ごとの残額（相手があなたに払う額）</SectionHeader>
        <Card>{s.balances.map((balance, index) => <Box key={balance.memberId}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5 }}><Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{balance.name}</Typography><Typography variant="body2" color="text.secondary">割当 {yen(balance.charged)} ・ 清算済 {yen(balance.settled)}</Typography></Box><Typography fontWeight={700} color={balance.remaining > 0 ? 'success.main' : 'text.secondary'}>{yen(balance.remaining)}</Typography><Button variant="text" onClick={() => { setSettleTarget(balance); setSettleAmount('') }} sx={{ width: 'auto' }}>清算</Button></Stack></Box>)}</Card>
        <HelpText>支出の登録画面で「他の人の負担」を入れると各人の割当に積み上がります。受け取ったら「清算」で記録すると残額が減ります。</HelpText>
      </>}

      {s.settlements.length > 0 && <>
        <SectionHeader>清算の履歴</SectionHeader>
        <Card>{s.settlements.map((settlement, index) => <Box key={settlement.id}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 2, pr: 1, py: 1.25 }}><Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{s.memberName(settlement.memberId)}</Typography><Typography variant="body2" color="text.secondary">{formatDate(settlement.dateMillis)}</Typography></Box><Typography fontWeight={700} color="success.main">{yen(settlement.amountYen)}</Typography><IconButton aria-label="取り消し" onClick={() => setPendingDelete(settlement)}><DeleteOutlineRoundedIcon /></IconButton></Stack></Box>)}</Card>
      </>}

      {settleTarget && <Modal title={`${settleTarget.name} から清算された額`} onClose={() => setSettleTarget(null)}><Field label="金額（円）" inputMode="numeric" autoFocus value={settleAmount} onChange={(event) => setSettleAmount(event.target.value.replace(/[^0-9]/g, ''))} /><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setSettleTarget(null)}>キャンセル</Button><Button onClick={async () => { if (await s.recordSettlement(settleTarget.memberId, parseInt(settleAmount, 10))) setSettleTarget(null) }}>記録</Button></Stack></Modal>}
      {pendingDelete && <Modal title="取り消しますか？" onClose={() => setPendingDelete(null)}><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{s.memberName(pendingDelete.memberId)} の清算 {yen(pendingDelete.amountYen)} を取り消します。</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingDelete(null)}>やめる</Button><Button color="#D32F2F" onClick={async () => { await s.deleteSettlement(pendingDelete); setPendingDelete(null) }}>取り消す</Button></Stack></Modal>}
    </Screen>
  )
}

function HelpText({ children }: { children: React.ReactNode }) { return <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5, py: 1 }}>{children}</Typography> }
