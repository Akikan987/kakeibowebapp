import { useState } from 'react'
import { Alert, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { useStore } from '../store'
import { type Expense, type ExpenseRefund, newId } from '../types'
import { expectedWithdrawalDate } from '../payments'
import { refundTotal } from '../finance/ledger'
import { Button, Card, Field, Modal, SectionHeader, fromLocalInput, toLocalInput, yen } from './ui'
import { CashAccountSelect } from './CashAccountSelect'

export function RefundModal({ expense, initial, onClose }: { expense: Expense; initial?: ExpenseRefund; onClose: () => void }) {
  const s = useStore()
  const [draft, setDraft] = useState<ExpenseRefund>(() => {
    const method = s.paymentMethods.find((row) => row.id === expense.paymentMethodId)
    return initial ?? { id: newId(), expenseId: expense.id, amountYen: 0, refundedAtMillis: Date.now(), category: expense.category, paymentMethodId: method?.id ?? '', cashAccountId: expense.cashAccountId ?? '', cardWithdrawalAtMillis: method?.type === 'credit' ? expectedWithdrawalDate(Date.now(), method.closingDay, method.paymentDay) : 0, note: '', updatedAt: 0, deleted: false }
  })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const method = s.paymentMethods.find((row) => row.id === draft.paymentMethodId)
  const remaining = expense.amountYen - s.splitSumOf(expense.id) - refundTotal(s.expenseRefunds, expense.id, draft.id)
  const save = async (deleted = false) => { if (busy) return; setBusy(true); try { if (await s.saveRefund({ ...(deleted && initial ? initial : draft), deleted })) onClose() } finally { setBusy(false) } }
  return <Modal title="返金を記録" onClose={onClose}><Stack spacing={2}>
    <Typography>{expense.title} / 元の支出 {yen(expense.amountYen)}</Typography><Typography>本人負担分の未返金額 {yen(remaining)}</Typography>
    <Alert severity="info">返金日の支出を減らします。収入には含めません。割り勘相手の負担・清算は自動変更しません。相手分も返金された場合は負担の配分を見直してから記録してください。</Alert>
    <Field onCalculate={(value) => setDraft({ ...draft, amountYen: Number(value) })} label="返金額（本人負担分・円）" type="number" value={draft.amountYen || ''} onChange={(e) => setDraft({ ...draft, amountYen: Number(e.target.value) })} />
    <Field label="返金日時" type="datetime-local" value={toLocalInput(draft.refundedAtMillis)} onChange={(e) => setDraft({ ...draft, refundedAtMillis: fromLocalInput(e.target.value) })} />
    <FormControl fullWidth><InputLabel id="refund-method">返金先の決済方法</InputLabel><Select labelId="refund-method" label="返金先の決済方法" value={draft.paymentMethodId} onChange={(e) => {
      const next = s.paymentMethods.find((row) => row.id === e.target.value)!
      setDraft({ ...draft, paymentMethodId: next.id, cashAccountId: next.cashAccountId ?? '', cardWithdrawalAtMillis: next.type === 'credit' ? expectedWithdrawalDate(draft.refundedAtMillis, next.closingDay, next.paymentDay) : 0 })
    }}>{s.paymentMethods.map((row) => <MenuItem value={row.id} key={row.id}>{row.name}</MenuItem>)}</Select></FormControl>
    {method && !['credit', 'prepaid'].includes(method.type) && <CashAccountSelect label="返金を受け取った口座・財布" value={draft.cashAccountId} onChange={(cashAccountId) => setDraft({ ...draft, cashAccountId })} />}
    {method?.type === 'credit' && <><Field label="返金が反映される請求日" type="date" value={draft.cardWithdrawalAtMillis ? toLocalInput(draft.cardWithdrawalAtMillis).slice(0, 10) : ''} onChange={(e) => setDraft({ ...draft, cardWithdrawalAtMillis: fromLocalInput(`${e.target.value}T12:00`) })} /><Typography variant="caption">カード会社の明細で対象請求日を確認してください。確定済み請求額は自動変更せず、返金超過額も翌月や口座入金へ自動繰越しません。</Typography></>}
    <Field label="返金メモ" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
    <Button disabled={busy} onClick={() => void save()}>返金を保存</Button><Button variant="outline" onClick={onClose}>閉じる</Button>
    {initial && <Button variant="text" onClick={() => setConfirmDelete(true)}>返金記録を削除</Button>}
    {confirmDelete && <Alert severity="warning">この返金記録を残高・統計から除外します。<Button disabled={busy} onClick={() => void save(true)}>削除を確定する</Button><Button variant="text" onClick={() => setConfirmDelete(false)}>やめる</Button></Alert>}
  </Stack></Modal>
}

export function RefundHistory() {
  const s = useStore()
  const [selected, setSelected] = useState<ExpenseRefund | null>(null)
  const [limit, setLimit] = useState(30)
  const start = new Date(s.month.year, s.month.month - 1, 1).getTime()
  const end = new Date(s.month.year, s.month.month, 1).getTime()
  const rows = s.expenseRefunds.filter((row) => row.refundedAtMillis >= start && row.refundedAtMillis < end).sort((a, b) => b.refundedAtMillis - a.refundedAtMillis)
  const original = selected && s.expenses.find((row) => row.id === selected.expenseId)
  if (!rows.length) return null
  return <><SectionHeader>この月の返金（支出の減額）</SectionHeader><Card sx={{ p: 1 }}>{rows.slice(0, limit).map((row) => <Button variant="text" key={row.id} onClick={() => setSelected(row)}>{new Date(row.refundedAtMillis).toLocaleDateString('ja-JP')} {s.expenses.find((expense) => expense.id === row.expenseId)?.title ?? '元の明細なし'} −{yen(row.amountYen)}</Button>)}{rows.length > limit && <Button variant="text" onClick={() => setLimit((value) => value + 30)}>さらに表示</Button>}</Card>{selected && original && <RefundModal initial={selected} expense={original} onClose={() => setSelected(null)} />}</>
}
