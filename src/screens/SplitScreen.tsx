import { useState } from 'react'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import { Box, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material'
import { Button, Card, Divider, Field, LargeTitle, Modal, Screen, SectionHeader, formatDate, yen } from '../components/ui'
import { useStore } from '../store'
import type { Member, MemberBalance, Settlement } from '../types'

export function SplitScreen() {
  const s = useStore()
  const [newMember, setNewMember] = useState('')
  const [renameTarget, setRenameTarget] = useState<Member | null>(null)
  const [renameText, setRenameText] = useState('')
  const [pendingMemberDelete, setPendingMemberDelete] = useState<Member | null>(null)
  const [settleTarget, setSettleTarget] = useState<MemberBalance | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Settlement | null>(null)

  const memberFor = (memberId: string) => s.members.find((member) => member.id === memberId)

  return (
    <Screen>
      <LargeTitle>割り勘</LargeTitle>
      {s.debts.length > 0 && <>
        <SectionHeader>あなたが払う分</SectionHeader>
        <Card>{s.debts.map((debt, index) => <Box key={debt.ownerUid}>{index > 0 && <Divider />}<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}><Box><Typography fontWeight={700}>{debt.ownerNickname}さんへ</Typography><Typography variant="body2" color="text.secondary">割当 {yen(debt.charged)} ・ 清算済 {yen(debt.settled)}</Typography></Box><Typography fontWeight={700} color={debt.remaining > 0 ? 'error.main' : 'text.secondary'}>{yen(debt.remaining)}</Typography></Stack></Box>)}</Card>
        <HelpText>相手が清算を記録すると、同期時にここの残額が減ります。</HelpText>
      </>}

      <SectionHeader>割り勘メンバー</SectionHeader>
      {s.balances.length > 0 ? <Card>{s.balances.map((balance, index) => {
        const member = memberFor(balance.memberId)
        return <Box key={balance.memberId}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 2, pr: 0.75, py: 1.25 }}><Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" alignItems="center" spacing={0.75}><Typography fontWeight={700} noWrap>{balance.name}</Typography><Chip size="small" color={balance.linkedUid ? 'primary' : 'default'} variant={balance.linkedUid ? 'filled' : 'outlined'} label={balance.linkedUid ? '共有中' : 'この端末のみ'} /></Stack><Typography variant="body2" color="text.secondary">割当 {yen(balance.charged)} ・ 清算済 {yen(balance.settled)}</Typography><Typography variant="body2" fontWeight={700} color={balance.remaining > 0 ? 'success.main' : 'text.secondary'}>残り {yen(balance.remaining)}</Typography></Box><Button variant="text" onClick={() => { setSettleTarget(balance); setSettleAmount('') }} sx={{ width: 'auto', minWidth: 48 }}>清算</Button>{member && <><IconButton aria-label={`${member.name}を編集`} onClick={() => { setRenameTarget(member); setRenameText(member.name) }}><EditRoundedIcon /></IconButton><IconButton aria-label={`${member.name}を削除`} onClick={() => setPendingMemberDelete(member)}><DeleteOutlineRoundedIcon /></IconButton></>}</Stack></Box>
      })}</Card> : <Card><CardContent><Typography color="text.secondary">まだメンバーはいません。相手のアカウント名を追加すると、割り勘情報がその相手にも共有されます。</Typography></CardContent></Card>}

      <Card sx={{ mt: 1.5 }}><CardContent><Stack spacing={1.5}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}><Field label="メンバー名（アカウント名）" value={newMember} onChange={(event) => setNewMember(event.target.value)} /><Button startIcon={<PersonAddRoundedIcon />} onClick={async () => { if (await s.addMember(newMember)) setNewMember('') }} sx={{ width: { sm: 'auto' }, flexShrink: 0 }}>追加</Button></Stack><Typography variant="caption" color="text.secondary">登録済みユーザーと名前が完全に一致すると「共有中」になります。見つからない名前も端末内メンバーとして利用でき、あとから編集して共有できます。</Typography></Stack></CardContent></Card>
      <HelpText>支出の登録画面で「他の人の負担」を入れると各人の割当に積み上がります。受け取ったら「清算」で記録すると残額が減ります。</HelpText>

      {s.settlements.length > 0 && <>
        <SectionHeader>清算の履歴</SectionHeader>
        <Card>{s.settlements.map((settlement, index) => <Box key={settlement.id}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 2, pr: 1, py: 1.25 }}><Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap>{s.memberName(settlement.memberId)}</Typography><Typography variant="body2" color="text.secondary">{formatDate(settlement.dateMillis)}</Typography></Box><Typography fontWeight={700} color="success.main">{yen(settlement.amountYen)}</Typography><IconButton aria-label="取り消し" onClick={() => setPendingDelete(settlement)}><DeleteOutlineRoundedIcon /></IconButton></Stack></Box>)}</Card>
      </>}

      {renameTarget && <Modal title="メンバー名を編集" onClose={() => setRenameTarget(null)}><Field label="メンバー名（アカウント名）" autoFocus value={renameText} onChange={(event) => setRenameText(event.target.value)} /><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>登録済みユーザーの名前と完全に一致すると、そのユーザーとの共有に切り替わります。</Typography><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setRenameTarget(null)}>キャンセル</Button><Button onClick={async () => { if (await s.renameMember(renameTarget, renameText)) setRenameTarget(null) }}>保存</Button></Stack></Modal>}
      {pendingMemberDelete && <Modal title="メンバーを削除しますか？" onClose={() => setPendingMemberDelete(null)}><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{pendingMemberDelete.name} をメンバーから削除します。過去の支出記録は残りますが、以後このメンバーとの共有は更新されません。</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingMemberDelete(null)}>やめる</Button><Button color="#D32F2F" onClick={async () => { await s.deleteMember(pendingMemberDelete); setPendingMemberDelete(null) }}>削除</Button></Stack></Modal>}
      {settleTarget && <Modal title={`${settleTarget.name} から清算された額`} onClose={() => setSettleTarget(null)}><Field label="金額（円）" inputMode="numeric" autoFocus value={settleAmount} onChange={(event) => setSettleAmount(event.target.value.replace(/[^0-9]/g, ''))} /><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setSettleTarget(null)}>キャンセル</Button><Button onClick={async () => { if (await s.recordSettlement(settleTarget.memberId, parseInt(settleAmount, 10))) setSettleTarget(null) }}>記録</Button></Stack></Modal>}
      {pendingDelete && <Modal title="取り消しますか？" onClose={() => setPendingDelete(null)}><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{s.memberName(pendingDelete.memberId)} の清算 {yen(pendingDelete.amountYen)} を取り消します。</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingDelete(null)}>やめる</Button><Button color="#D32F2F" onClick={async () => { await s.deleteSettlement(pendingDelete); setPendingDelete(null) }}>取り消す</Button></Stack></Modal>}
    </Screen>
  )
}

function HelpText({ children }: { children: React.ReactNode }) { return <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5, py: 1 }}>{children}</Typography> }
