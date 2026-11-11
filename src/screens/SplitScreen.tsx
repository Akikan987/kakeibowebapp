import { useEffect, useRef, useState } from 'react'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import { Alert, Box, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material'
import { Button, Card, Divider, Field, LargeTitle, Modal, Screen, SectionHeader, formatDate, yen } from '../components/ui'
import { useStore } from '../store'
import type { Member, MemberBalance, Settlement } from '../types'
import { SplitInvitations } from '../components/SplitInvitations'
import { NavigationRow, SectionPageHeader, useSectionNavigation } from '../components/SectionNavigation'
import { useYenField } from '../components/useYenField'

function receivedBalanceText(remaining: number) {
  if (remaining < 0) return `${yen(-remaining)} 多く受け取っています`
  return `残り ${yen(remaining)}`
}

function SettlementDialog({ target, onClose }: { target: MemberBalance; onClose: () => void }) {
  const { recordSettlement, notify } = useStore()
  const [amountText, setAmountText] = useState('')
  const [amountToConfirm, setAmountToConfirm] = useState<number | null>(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const amountField = useYenField(amountText, setAmountText)
  const available = Math.max(0, target.remaining)

  const save = async (amount: number) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      if (await recordSettlement(target.memberId, amount)) onClose()
    } catch {
      notify('清算の記録に失敗しました。清算履歴を確認してください。', 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return <Modal title={`${target.name} から清算された額`} onClose={() => { if (!savingRef.current) onClose() }}>
    <Stack spacing={2}>
      <Typography fontWeight={600}>{receivedBalanceText(target.remaining)}</Typography>
      {amountToConfirm !== null ? <>
        <Alert severity="warning">
          {amountToConfirm > available
            ? `記録する額（${yen(amountToConfirm)}）が残額（${yen(available)}）を超えています。このまま記録しますか？`
            : `残額が変わりました。${yen(amountToConfirm)}を記録しますか？`}
        </Alert>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outline" autoFocus disabled={saving} onClick={() => setAmountToConfirm(null)}>入力に戻る</Button>
          <Button disabled={saving} onClick={() => void save(amountToConfirm)}>このまま記録</Button>
        </Stack>
      </> : <>
        <Field label="金額（円）" autoFocus disabled={saving} {...amountField.field} />
        <Button
          variant="outline"
          sx={{ alignSelf: 'flex-start', width: 'auto' }}
          disabled={available === 0 || saving}
          onClick={() => setAmountText(String(available))}
        >全額（{yen(available)}）</Button>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outline" disabled={saving} onClick={onClose}>キャンセル</Button>
          <Button disabled={saving} onClick={() => {
            const amount = amountField.validate()
            if (amount === undefined) return
            if (amount > available) setAmountToConfirm(amount)
            else void save(amount)
          }}>記録</Button>
        </Stack>
      </>}
    </Stack>
  </Modal>
}

export function SplitScreen({ onParentChange }: { onParentChange: (label: string | null) => void }) {
  const s = useStore()
  const { section, parentSection, openSection } = useSectionNavigation<'overview' | 'members' | 'sharing' | 'history'>('overview')
  const [newMember, setNewMember] = useState('')
  const [renameTarget, setRenameTarget] = useState<Member | null>(null)
  const [renameText, setRenameText] = useState('')
  const [pendingMemberDelete, setPendingMemberDelete] = useState<Member | null>(null)
  const [settleMemberId, setSettleMemberId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Settlement | null>(null)

  useEffect(() => { if (s.account) void s.syncNow(false) }, [s.account?.uid])
  useEffect(() => {
    setRenameTarget(null); setRenameText(''); setPendingMemberDelete(null)
    setSettleMemberId(null); setPendingDelete(null)
  }, [section])
  const outstanding = s.balances.filter((balance) => balance.remaining !== 0)
  const settleTarget = s.balances.find((balance) => balance.memberId === settleMemberId)
  const payable = s.debts.filter((debt) => debt.remaining !== 0)
  const pendingInvitations = s.invitations.filter((row) => row.direction === 'incoming' && row.status === 'pending').length

  return (
    <Screen>
      {section === 'overview' ? <LargeTitle>割り勘</LargeTitle> : <SectionPageHeader title={section === 'members' ? 'メンバー' : section === 'sharing' ? '共有の招待・承認' : '清算履歴'} parentLabel={parentSection === 'members' ? 'メンバー' : '割り勘'} onParentChange={onParentChange} />}
      {section === 'overview' && <>
      {payable.length > 0 && <>
        <SectionHeader>あなたが払う分</SectionHeader>
        <Card>{payable.map((debt, index) => <Box key={debt.ownerUid}>{index > 0 && <Divider />}<Stack spacing={1} sx={{ p: 3 }}><Typography fontWeight={600}>{debt.ownerNickname}さんへ</Typography><Typography variant="h6" color={debt.remaining > 0 ? 'error.main' : 'text.secondary'}>{yen(debt.remaining)}</Typography><Typography variant="body2" color="text.secondary">割当 {yen(debt.charged)} ・ 清算済 {yen(debt.settled)}</Typography></Stack></Box>)}</Card>
        <HelpText>相手が清算を記録すると、同期時にここの残額が減ります。</HelpText>
      </>}

      {outstanding.length > 0 && <SectionHeader>あなたが受け取る分</SectionHeader>}
      {outstanding.length > 0 ? <Card>{outstanding.map((balance, index) => {
        return <Box key={balance.memberId}>
          {index > 0 && <Divider />}
          <Stack spacing={1} sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" gap={1}>
              <Typography fontWeight={600}>{balance.name}</Typography>
              <Chip size="small" color={balance.linkedUid ? 'primary' : 'default'} variant="outlined" label={balance.linkedUid ? '共有中' : '自分だけ'} />
            </Stack>
            <Typography variant="h6" color={balance.remaining > 0 ? 'success.main' : 'text.secondary'}>{receivedBalanceText(balance.remaining)}</Typography>
            <Typography variant="body2" color="text.secondary">割当 {yen(balance.charged)} ・ 清算済 {yen(balance.settled)}</Typography>
            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
              <Button variant="text" onClick={() => setSettleMemberId(balance.memberId)} sx={{ width: 'auto' }}>清算</Button>
            </Stack>
          </Stack>
        </Box>
      })}</Card> : payable.length === 0 && <Card><CardContent><Typography fontWeight={600}>未清算の割り勘はありません</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{s.members.length ? '清算済みの相手は「メンバー」から確認できます。' : 'メンバーを追加し、支出の登録画面から負担額を割り当てられます。'}</Typography></CardContent></Card>}
      <SectionHeader>管理・履歴</SectionHeader>
      <Card>
        <NavigationRow title="メンバー" description="追加・名前の変更・相手ごとの残額" badge={`${s.members.length}人`} onClick={() => openSection('members')} /><Divider />
        <NavigationRow title="共有の招待・承認" description={pendingInvitations ? `招待が${pendingInvitations}件届いています` : '招待を送る・共有状況を確認する'} badge={pendingInvitations || undefined} onClick={() => openSection('sharing')} /><Divider />
        <NavigationRow title="清算履歴" description="受け取った記録を確認する" badge={s.settlements.length} onClick={() => openSection('history')} />
      </Card>
      </>}

      {section === 'sharing' && <SplitInvitations />}
      {section === 'members' && <>
      {s.members.length > 0 ? <Card>{s.members.map((member, index) => {
        const balance = s.balances.find((row) => row.memberId === member.id)
        return <Box key={member.id}>{index > 0 && <Divider />}<Stack spacing={1} sx={{ p: 3 }}>
          <Stack direction="row" useFlexGap flexWrap="wrap" alignItems="center" gap={1}><Typography fontWeight={600}>{member.name}</Typography><Chip size="small" variant="outlined" label={member.linkedUid ? '共有中' : '自分だけ'} /></Stack>
          <Typography variant="body2" color="text.secondary">{receivedBalanceText(balance?.remaining ?? 0)}</Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
            {balance && <Button variant="text" sx={{ width: 'auto' }} onClick={() => setSettleMemberId(balance.memberId)}>清算</Button>}
            <IconButton aria-label={`${member.name}を編集`} onClick={() => { setRenameTarget(member); setRenameText(member.name) }}><EditRoundedIcon fontSize="small" /></IconButton>
            <IconButton aria-label={`${member.name}を削除`} onClick={() => setPendingMemberDelete(member)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
          </Stack>
        </Stack></Box>
      })}</Card> : <Typography color="text.secondary">まだメンバーはいません。</Typography>}

      <Card sx={{ mt: 1.5 }}><CardContent><Stack spacing={1.5}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}><Field label="メンバーの表示名" value={newMember} onChange={(event) => setNewMember(event.target.value)} /><Button startIcon={<PersonAddRoundedIcon />} onClick={async () => { if (await s.addMember(newMember)) setNewMember('') }} sx={{ width: { sm: 'auto' }, flexShrink: 0 }}>追加</Button></Stack><Typography variant="caption" color="text.secondary">追加しただけでは共有しません。「共有の招待・承認」から相手のアカウント名を指定して招待できます。</Typography></Stack></CardContent></Card>
      <HelpText>支出の登録画面で「他の人の負担」を入れると各人の割当に積み上がります。受け取ったら「清算」で記録すると残額が減ります。</HelpText>
      <Button variant="text" onClick={() => openSection('sharing')}>共有の招待・承認へ</Button>
      </>}

      {section === 'history' && <>
        {!s.settlements.length && <Typography color="text.secondary">清算履歴はありません。</Typography>}
        <Card>{s.settlements.map((settlement, index) => <Box key={settlement.id}>{index > 0 && <Divider />}<Stack direction="row" alignItems="center" spacing={1} sx={{ p: 3 }}><Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={600}>{s.memberName(settlement.memberId)}</Typography><Typography variant="body2" color="text.secondary">{formatDate(settlement.dateMillis)}</Typography><Typography fontWeight={600} color="success.main">{yen(settlement.amountYen)}</Typography></Box><IconButton aria-label="取り消し" onClick={() => setPendingDelete(settlement)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Stack></Box>)}</Card>
      </>}

      {renameTarget && <Modal title="メンバー名を編集" onClose={() => setRenameTarget(null)}><Field label="メンバーの表示名" autoFocus value={renameText} onChange={(event) => setRenameText(event.target.value)} /><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>表示名のみ変更します。共有先は変わりません。</Typography><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setRenameTarget(null)}>キャンセル</Button><Button onClick={async () => { if (await s.renameMember(renameTarget, renameText)) setRenameTarget(null) }}>保存</Button></Stack></Modal>}
      {pendingMemberDelete && <Modal title="メンバーを削除しますか？" onClose={() => setPendingMemberDelete(null)}><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{pendingMemberDelete.name} をメンバーから削除します。過去の支出記録は残りますが、以後このメンバーとの共有は更新されません。</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingMemberDelete(null)}>やめる</Button><Button color="#D32F2F" onClick={async () => { await s.deleteMember(pendingMemberDelete); setPendingMemberDelete(null) }}>削除</Button></Stack></Modal>}
      {settleTarget && <SettlementDialog target={settleTarget} onClose={() => setSettleMemberId(null)} />}
      {pendingDelete && <Modal title="取り消しますか？" onClose={() => setPendingDelete(null)}><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{s.memberName(pendingDelete.memberId)} の清算 {yen(pendingDelete.amountYen)} を取り消します。</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingDelete(null)}>やめる</Button><Button color="#D32F2F" onClick={async () => { await s.deleteSettlement(pendingDelete); setPendingDelete(null) }}>取り消す</Button></Stack></Modal>}
    </Screen>
  )
}

function HelpText({ children }: { children: React.ReactNode }) { return <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5, py: 1 }}>{children}</Typography> }
