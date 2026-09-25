import { useEffect, useState } from 'react'
import { Alert, Stack, Typography } from '@mui/material'
import { useStore } from '../store'
import type { SplitInvitation } from '../types'
import { Button, Card, Field, Modal, SectionHeader } from './ui'

export function SplitInvitations() {
  const s = useStore()
  const [target, setTarget] = useState<{ id: string; nickname: string } | null>(null)
  const [action, setAction] = useState<{ row: SplitInvitation; action: 'accept' | 'reject' | 'revoke' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [limit, setLimit] = useState(20)
  useEffect(() => { if (s.account) void s.syncNow(false) }, [s.account?.uid])
  const run = async (operation: () => Promise<boolean>) => { if (busy) return; setBusy(true); try { if (await operation()) { setAction(null); setTarget(null) } } finally { setBusy(false) } }
  const labels = { pending: '承認待ち', accepted: '共有中', rejected: '辞退済み', revoked: '共有停止' }
  return <><SectionHeader>共有の招待・承認</SectionHeader>
    <Alert severity="info">新しい共有は相手の承認後に開始します。既存の共有は維持されています。メンバー名の変更だけでは共有先は変わりません。</Alert>
    {!s.account ? <Typography sx={{ my: 1 }}>招待・承認はログインすると使えます。自分用の割り勘記録はそのまま使えます。</Typography> : <>
      <Button variant="text" disabled={s.syncing} onClick={() => void s.syncNow(false)}>招待の状況を更新</Button>
      <Stack spacing={1}>{s.invitations.slice(0, limit).map((row) => <Card key={row.id} sx={{ p: 2 }}><Typography fontWeight={700}>{row.direction === 'incoming' ? `${row.nickname}さんから` : `${row.nickname}さんへ`}：{labels[row.status]}{row.legacy && '（既存共有）'}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {row.direction === 'incoming' && row.status === 'pending' && <><Button onClick={() => setAction({ row, action: 'accept' })}>承認</Button><Button variant="outline" onClick={() => setAction({ row, action: 'reject' })}>辞退</Button></>}
        {(row.status === 'accepted' || row.status === 'pending' && row.direction === 'outgoing') && <Button variant="text" onClick={() => setAction({ row, action: 'revoke' })}>{row.status === 'pending' ? '招待を取り消す' : '共有を停止する'}</Button>}
      </Stack></Card>)}</Stack>
      {s.invitations.length > limit && <Button variant="text" onClick={() => setLimit((value) => value + 20)}>招待履歴をさらに表示</Button>}
      <Stack spacing={1} sx={{ mt: 1 }}>{s.members.filter((member) => !s.invitations.some((row) => row.direction === 'outgoing' && row.memberId === member.id && ['pending', 'accepted'].includes(row.status))).map((member) => <Button key={member.id} variant="outline" onClick={() => setTarget({ id: member.id, nickname: member.name })}>{member.name}の割り勘を共有する</Button>)}</Stack>
    </>}
    {target && <Modal title="共有の招待を送る" onClose={() => setTarget(null)}><Stack spacing={2}><Field label="相手のアカウント名（完全一致）" value={target.nickname} onChange={(e) => setTarget({ ...target, nickname: e.target.value })} /><Typography>承認後、このメンバーに割り当てた過去・今後の金額の合計と清算状況が相手に表示されます。他の明細・口座残高は共有しません。</Typography><Typography variant="caption">辞退・停止後の再招待は24時間あけてください。</Typography><Button disabled={busy || !target.nickname.trim()} onClick={() => void run(() => s.inviteMember(target.id, target.nickname.trim()))}>この相手に招待を送る</Button><Button variant="outline" onClick={() => setTarget(null)}>キャンセル</Button></Stack></Modal>}
    {action && <Modal title={action.action === 'accept' ? '招待を承認しますか？' : action.action === 'reject' ? '招待を辞退しますか？' : '共有を停止しますか？'} onClose={() => setAction(null)}><Stack spacing={2}><Typography>{action.row.nickname}さんとの共有です。</Typography><Typography>{action.action === 'accept' ? '相手があなたに割り当てた過去・今後の合計金額と清算状況を表示します。あなた自身の家計簿や口座が相手に公開されることはありません。' : '相手の家計簿・清算記録は消さず、共有表示を停止します。同期前の別端末では古い表示が残る場合があります。'}</Typography><Button disabled={busy} onClick={() => void run(() => s.invitationAction(action.row.id, action.action))}>確定する</Button><Button variant="outline" onClick={() => setAction(null)}>やめる</Button></Stack></Modal>}
  </>
}
