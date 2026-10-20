import { useMemo, useState } from 'react'
import { Alert, Box, Checkbox, Chip, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { Button, Field, Modal, yen } from './ui'
import { calculateReceiptSplit, SELF_PARTICIPANT, splitReceiptItem, type ReceiptSplitAllocation, type ReceiptSplitDraft, type ReceiptSplitItem } from '../receiptSplit'
import { newId, type Member } from '../types'

interface Props {
  value: ReceiptSplitDraft
  totalAmount: string
  members: Member[]
  onChange: (value: ReceiptSplitDraft) => void
  onTotalChange: (value: string) => void
  onApply: (allocations: ReceiptSplitAllocation[]) => void
  onClose: () => void
}

/** A local calculator. Only its explicit Apply action changes expense split amounts. */
export function ReceiptSplitCalculator({ value, totalAmount, members, onChange, onTotalChange, onApply, onClose }: Props) {
  const [editingId, setEditingId] = useState('')
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const activeMembers = members.filter((member) => !member.deleted)
  const names = new Map<string, string>([[SELF_PARTICIPANT, 'あなた'], ...activeMembers.map((member): [string, string] => [`member:${member.id}`, member.name])])
  const nameFor = (id: string) => names.get(id) ?? '参加対象外・削除されたメンバー'
  const total = totalAmount.trim() ? Number(totalAmount) : Number.NaN
  const result = useMemo(() => calculateReceiptSplit(value.items, value.participantIds, total, value.differenceMode), [value, total])
  const missingParticipants = value.participantIds.some((id) => !names.has(id))
  const unknownAssignments = value.items.some((item) => item.participantIds.some((id) => !value.participantIds.includes(id)))
  const edit = (id: string, change: Partial<ReceiptSplitItem>) => {
    setError('')
    onChange({ ...value, items: value.items.map((item) => item.id === id ? { ...item, ...change } : item) })
  }
  const addItem = () => {
    const id = newId()
    onChange({ ...value, items: [...value.items, { id, name: '', quantity: 1, amountYen: null, participantIds: [] }] })
    setEditingId(id)
  }
  const splitUnits = (item: ReceiptSplitItem) => {
    try {
      const units = splitReceiptItem(item).map((unit) => ({ ...unit, id: newId() }))
      if (value.items.length - 1 + units.length > 100) throw new Error('商品は100行以内にしてください。')
      onChange({ ...value, items: value.items.flatMap((row) => row.id === item.id ? units : [row]) })
      setEditingId(''); setError('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : '商品を分けられませんでした。') }
  }
  return <Modal title="商品を選んで割り勘" onClose={onClose}>
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">商品を頼んだ人を選んでください。複数人を選ぶと、その商品の行合計を均等に分けます。実際のレシートと金額を確認してください。</Typography>
      <Field label="会計合計（円）" inputMode="numeric" value={totalAmount} onChange={(event) => { if (/^\d{0,10}$/u.test(event.target.value)) onTotalChange(event.target.value) }} onCalculate={onTotalChange} />
      <FormControl fullWidth>
        <InputLabel id="receipt-participants-label">一緒に会計するメンバー</InputLabel>
        <Select multiple labelId="receipt-participants-label" label="一緒に会計するメンバー" value={value.participantIds.filter((id) => id !== SELF_PARTICIPANT)}
          renderValue={(ids) => <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>{ids.length ? ids.map((id) => <Chip size="small" key={id} label={nameFor(id)} sx={{ maxWidth: '100%' }} />) : 'あなたのみ'}</Box>}
          onChange={(event) => { const selected = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value; onChange({ ...value, participantIds: [SELF_PARTICIPANT, ...selected] }) }}>
          {[...new Set([...activeMembers.map((member) => `member:${member.id}`), ...value.participantIds.filter((id) => id !== SELF_PARTICIPANT)])].map((id) => <MenuItem key={id} value={id}><Checkbox checked={value.participantIds.includes(id)} /><Typography sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{nameFor(id)}</Typography></MenuItem>)}
        </Select>
      </FormControl>
      <Typography variant="caption" color="text.secondary">あなたは常に参加します。新しいメンバーの登録は「割り勘」タブからできます。</Typography>
      {(missingParticipants || unknownAssignments) && <Alert severity="warning">参加対象外・削除されたメンバーの割り当てがあります。参加メンバーと各商品の選択を見直してください。</Alert>}
      {value.items.length === 0 && <Alert severity="info">商品明細はまだありません。商品を手入力するか、入力画面の「商品を読んで割り勘」で読み取れます。</Alert>}
      <Stack spacing={1.5}>
        {value.items.map((item, index) => {
          const choices = [...new Set([...value.participantIds, ...item.participantIds])]
          return <Box key={item.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, minWidth: 0 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
                <Typography fontWeight={650} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{index + 1}. {item.name || '商品名を入力してください'}{item.quantity !== null && item.quantity > 1 && ` ×${item.quantity}`}</Typography>
                <Typography fontWeight={650} sx={{ flexShrink: 0 }}>{item.amountYen === null ? '金額未入力' : yen(item.amountYen)}</Typography>
              </Stack>
              <FormControl fullWidth size="small" error={item.participantIds.length === 0 || item.participantIds.some((id) => !value.participantIds.includes(id))}>
                <InputLabel id={`receipt-item-${item.id}`}>この商品を頼んだ人</InputLabel>
                <Select multiple labelId={`receipt-item-${item.id}`} label="この商品を頼んだ人" value={item.participantIds}
                  renderValue={(ids) => <Typography variant="body2" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{ids.map(nameFor).join('・')}</Typography>}
                  onChange={(event) => edit(item.id, { participantIds: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value })}>
                  {choices.map((id) => <MenuItem key={id} value={id} disabled={!value.participantIds.includes(id) && !item.participantIds.includes(id)}><Checkbox checked={item.participantIds.includes(id)} /><Typography sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{nameFor(id)}{!value.participantIds.includes(id) && '（選択を外してください）'}</Typography></MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="text" sx={{ alignSelf: 'flex-start', width: 'auto', minHeight: 36 }} onClick={() => setEditingId(editingId === item.id ? '' : item.id)}>{editingId === item.id ? '修正欄を閉じる' : '商品名・数量・金額を修正'}</Button>
              {editingId === item.id && <Stack spacing={1.5}>
                <Field label="商品名" maxLength={160} value={item.name} onChange={(event) => edit(item.id, { name: event.target.value })} />
                <Field label="この行の合計（円）" inputMode="text" value={priceEdits[item.id] ?? (item.amountYen === null ? '' : String(item.amountYen))} helperText="数量を含む行合計です。明示的な値引きはマイナスで入力できます。" calculatorAllowNegative onCalculate={(raw) => { setPriceEdits((current) => ({ ...current, [item.id]: raw })); edit(item.id, { amountYen: raw.trim() ? Number(raw) : null }) }}
                  onChange={(event) => { const raw = event.target.value; if (!/^-?\d{0,10}$/u.test(raw)) return; setPriceEdits((current) => ({ ...current, [item.id]: raw })); edit(item.id, { amountYen: raw === '' || raw === '-' ? null : Number(raw) }) }} />
                <Field label="印字された数量（任意）" inputMode="numeric" value={item.quantity ?? ''} onChange={(event) => { const raw = event.target.value; if (!/^\d{0,3}$/u.test(raw)) return; edit(item.id, { quantity: raw && Number(raw) > 0 ? Number(raw) : null }) }} />
                <Button variant="outline" disabled={item.quantity === null || item.quantity < 2 || item.quantity > 20 || item.amountYen === null} onClick={() => splitUnits(item)}>数量分の行に分ける（2〜20点）</Button>
                <Button variant="text" color="#d32f2f" onClick={() => onChange({ ...value, items: value.items.filter((row) => row.id !== item.id) })}>この商品行を削除</Button>
              </Stack>}
            </Stack>
          </Box>
        })}
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="outline" disabled={value.items.length >= 100} startIcon={<AddRoundedIcon />} onClick={addItem}>商品を手入力で追加</Button>
        <Button variant="text" disabled={!value.items.some((item) => item.participantIds.length === 0)} onClick={() => onChange({ ...value, items: value.items.map((item) => item.participantIds.length ? item : { ...item, participantIds: [SELF_PARTICIPANT] }) })}>未割り当ての商品をすべて自分にする</Button>
      </Stack>
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" gap={2}><Typography>商品合計</Typography><Typography>{yen(result.subtotalYen)}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between" gap={2} sx={{ mt: 1 }}><Typography>会計合計との差額</Typography><Typography>{Number.isFinite(result.differenceYen) ? yen(result.differenceYen) : '合計未入力'}</Typography></Stack>
      </Box>
      {result.differenceYen !== 0 && <Alert severity="warning">税・値引き・読み取り漏れ等を確認してください。税率が混在する場合などは、一律の比例配分では実際の負担と異なることがあります。正しい商品金額に修正するか、確認してから差額を配分してください。</Alert>}
      <FormControl fullWidth size="small">
        <InputLabel id="receipt-difference-label">差額の扱い</InputLabel>
        <Select labelId="receipt-difference-label" label="差額の扱い" value={value.differenceMode} onChange={(event) => onChange({ ...value, differenceMode: event.target.value as ReceiptSplitDraft['differenceMode'] })}>
          <MenuItem value="unallocated">自動で配分しない</MenuItem><MenuItem value="proportional">確認済み：商品金額の比率で配分する</MenuItem>
        </Select>
      </FormControl>
      <Box aria-live="polite"><Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>人別のお会計{!result.valid && '（確認中）'}</Typography>
        {result.allocations.map((allocation) => <Box key={allocation.participantId} sx={{ py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" gap={2} justifyContent="space-between"><Typography sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{nameFor(allocation.participantId)}</Typography><Typography fontWeight={700} sx={{ flexShrink: 0 }}>{yen(allocation.amountYen)}</Typography></Stack>
          {value.differenceMode === 'proportional' && allocation.adjustmentYen !== 0 && <Typography variant="caption" color="text.secondary">商品 {yen(allocation.itemsAmountYen)} ／ 差額配分 {yen(allocation.adjustmentYen)}</Typography>}
        </Box>)}
      </Box>
      {!result.valid && <Alert severity="info">{result.issues.slice(0, 3).join(' ')}{result.issues.length > 3 && ' ほかの未確認行も見直してください。'}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="caption" color="text.secondary">共有商品の1円未満の端数は表示順（あなたが対象なら先頭）に、比例配分の端数は小数部分の大きい順に振り分け、会計合計と一致させます。複数点の行は分けてから別の人を選べます。</Typography>
      <Typography variant="caption" color="text.secondary">反映すると現在の人別の割り勘金額を置き換えます。あなたが全額を立て替えた場合に保存してください。各自で払う場合は計算だけでも使えます。商品別の作業内容は端末の下書きだけに保持し、保存・共有するのは人別金額です。メンバー名や割り当てをAIへ送信しません。</Typography>
      <Button disabled={!result.valid || missingParticipants} onClick={() => onApply(result.allocations)}>人別の割り勘金額に反映する</Button>
      <Button variant="text" onClick={onClose}>入力画面に戻る</Button>
    </Stack>
  </Modal>
}
