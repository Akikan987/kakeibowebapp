import { useRef, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  Box,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { Button, Card, Field, LargeTitle, Screen, SectionHeader, fromLocalInput, toLocalInput, yen } from '../components/ui'
import { expectedWithdrawalDate } from '../payments'
import { emptyDraft, useStore, type ExpenseDraft } from '../store'
import { PAYMENT_TYPES, PAYMENT_TYPE_LABELS, TYPE_EXPENSE, TYPE_INCOME, now } from '../types'

export function AddScreen({ initial, onDone }: { initial?: ExpenseDraft | null; onDone: () => void }) {
  const s = useStore()
  const [draft, setDraft] = useState<ExpenseDraft>(() => initial ?? emptyDraft())
  const [reading, setReading] = useState(false)
  const receiptRef = useRef<HTMLInputElement>(null)
  const patch = (value: Partial<ExpenseDraft>) => setDraft((current) => ({ ...current, ...value }))

  if (!draft.type) {
    return (
      <Screen>
        <LargeTitle>記録する</LargeTitle>
        <Typography color="text.secondary" sx={{ mb: 3 }}>種類を選んでください。選んだ時点の日時を記録します。</Typography>
        <Stack spacing={2}>
          <Button color="#2E7D32" sx={{ minHeight: 68, fontSize: 18 }} onClick={() => patch({ type: TYPE_INCOME, purchasedAtMillis: now() })}>収入を入力</Button>
          <Button color="#D32F2F" sx={{ minHeight: 68, fontSize: 18 }} onClick={() => patch({ type: TYPE_EXPENSE, purchasedAtMillis: now() })}>支出を入力</Button>
        </Stack>
      </Screen>
    )
  }

  const isIncome = draft.type === TYPE_INCOME
  const accent = isIncome ? '#2E7D32' : '#D32F2F'
  const amount = parseInt(draft.amountYen, 10) || 0
  const splitTotal = draft.splits.reduce((total, split) => total + (parseInt(split.amount, 10) || 0), 0)
  const selectedPayment = s.paymentMethods.find((method) => method.id === draft.paymentMethodId)
  const selectedPrepaidBalance = s.prepaidBalances.find((balance) => balance.methodId === draft.paymentMethodId)

  return (
    <Screen>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <LargeTitle>{draft.editingId ? '編集' : isIncome ? '収入を入力' : '支出を入力'}</LargeTitle>
        {!draft.editingId && <Button variant="text" onClick={() => patch({ type: '' })} sx={{ width: 'auto' }}>種類を変更</Button>}
      </Stack>

      <SectionHeader>内容</SectionHeader>
      <Card><CardContent><Stack spacing={2}>
        <Field label="タイトル" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="未入力なら「その他」" />
        <Field label="金額（円）" inputMode="numeric" value={draft.amountYen} onChange={(e) => patch({ amountYen: e.target.value.replace(/[^0-9]/g, '') })} />
        <FormControl fullWidth>
          <InputLabel id="category-label">品目</InputLabel>
          <Select labelId="category-label" label="品目" value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
            {s.categories.map((category) => <MenuItem key={category.id} value={category.name}>{category.name}</MenuItem>)}
            {!s.categories.some((category) => category.name === draft.category) && <MenuItem value={draft.category}>{draft.category}</MenuItem>}
          </Select>
        </FormControl>
        <Field label="記録日時" type="datetime-local" value={toLocalInput(draft.purchasedAtMillis)} onChange={(e) => patch({ purchasedAtMillis: fromLocalInput(e.target.value) })} />
        {!isIncome && (
          <Box>
            <FormControl fullWidth>
              <InputLabel id="payment-label">決済方法</InputLabel>
              <Select labelId="payment-label" label="決済方法" value={draft.paymentMethodId} onChange={(e) => patch({ paymentMethodId: e.target.value })}>
                {!draft.paymentMethodId && <MenuItem value="">選択してください</MenuItem>}
                {PAYMENT_TYPES.flatMap((type) => {
                  const methods = s.paymentMethods.filter((method) => method.type === type)
                  if (methods.length === 0) return []
                  return [
                    <ListSubheader key={`${type}-header`}>{PAYMENT_TYPE_LABELS[type]}</ListSubheader>,
                    ...methods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>),
                  ]
                })}
              </Select>
            </FormControl>
            {selectedPrepaidBalance && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, ml: 1 }}>現在残高 {yen(selectedPrepaidBalance.balance)}</Typography>}
            {selectedPayment?.type === 'credit' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, ml: 1 }}>
                {selectedPayment.closingDay === 31 ? '月末' : `${selectedPayment.closingDay}日`}締め・{selectedPayment.paymentDay === 31 ? '月末' : `${selectedPayment.paymentDay}日`}引き落とし予定（今回分: {new Date(expectedWithdrawalDate(draft.purchasedAtMillis, selectedPayment.closingDay, selectedPayment.paymentDay)).toLocaleDateString('ja-JP')}）
              </Typography>
            )}
          </Box>
        )}
      </Stack></CardContent></Card>

      {!isIncome && (
        <>
          <SectionHeader>レシートから入力</SectionHeader>
          <Card><CardContent>
            <Button variant="outline" disabled={reading} startIcon={<CameraAltRoundedIcon />} onClick={() => receiptRef.current?.click()}>{reading ? '読み取り中…' : 'レシートを読み取る'}</Button>
            <input ref={receiptRef} type="file" accept="image/*" hidden onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setReading(true)
              try {
                const result = await s.readReceipt(file)
                if (result) {
                  const next: Partial<ExpenseDraft> = { title: result.title || draft.title, amountYen: result.amountYen ? String(result.amountYen) : draft.amountYen, source: 'receipt_ocr' }
                  if (result.date) {
                    const date = new Date(`${result.date}T12:00:00`)
                    if (!Number.isNaN(date.getTime())) next.purchasedAtMillis = date.getTime()
                  }
                  patch(next)
                  s.notify('レシートを読み取りました')
                }
              } finally { setReading(false) }
            }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>カメラで撮影するか写真を選ぶと、店名・合計金額・日付を読み取ります。結果は保存前に直せます。</Typography>
          </CardContent></Card>

          <SectionHeader>割り勘（他の人の負担）</SectionHeader>
          <Card><CardContent>
            {s.members.length === 0 ? (
              <Typography variant="body2" color="text.secondary">「設定」でメンバーを追加すると、この支出から他の人の負担を割り当てられます。</Typography>
            ) : (
              <Stack spacing={2}>
                {draft.splits.map((split, index) => (
                  <Stack key={index} direction="row" alignItems="center" spacing={1}>
                    <FormControl fullWidth>
                      <InputLabel id={`member-${index}`}>人</InputLabel>
                      <Select labelId={`member-${index}`} label="人" value={split.memberId} onChange={(e) => { const next = [...draft.splits]; next[index] = { ...next[index], memberId: e.target.value }; patch({ splits: next }) }}>
                        {s.members.map((member) => <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Field label="円" inputMode="numeric" value={split.amount} onChange={(e) => { const next = [...draft.splits]; next[index] = { ...next[index], amount: e.target.value.replace(/[^0-9]/g, '') }; patch({ splits: next }) }} sx={{ maxWidth: 130 }} />
                    <IconButton aria-label="削除" onClick={() => patch({ splits: draft.splits.filter((_, itemIndex) => itemIndex !== index) })}><CloseRoundedIcon /></IconButton>
                  </Stack>
                ))}
                <Button variant="text" startIcon={<AddRoundedIcon />} onClick={() => patch({ splits: [...draft.splits, { memberId: s.members[0].id, amount: '' }] })} sx={{ width: 'fit-content' }}>人を追加</Button>
                {draft.splits.length > 0 && (
                  <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">他の人の負担 計</Typography><Typography variant="body2">{yen(splitTotal)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography fontWeight={700}>あなたの負担（統計に反映）</Typography><Typography fontWeight={700} color={amount - splitTotal < 0 ? 'error.main' : 'success.main'}>{yen(amount - splitTotal)}</Typography></Stack>
                  </Box>
                )}
              </Stack>
            )}
          </CardContent></Card>
        </>
      )}

      <Button color={accent} sx={{ mt: 3 }} onClick={async () => { if (await s.saveExpense(draft)) onDone() }}>{draft.editingId ? '更新' : '保存'}</Button>
    </Screen>
  )
}
