import { useEffect, useMemo, useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { useStore } from '../store'
import { newId, type AccountTransfer, type CashAccount } from '../types'
import { accountLedger } from '../finance/ledger'
import { buildWithdrawalSchedule, paymentOverview } from '../domain/paymentOverview'
import { Button, Card, Field, Modal, SectionHeader, fromLocalInput, toLocalInput, yen } from './ui'
import { CashAccountSelect } from './CashAccountSelect'

export function AccountsPanel() {
  const s = useStore()
  const [account, setAccount] = useState<CashAccount | null>(null)
  const [transfer, setTransfer] = useState<AccountTransfer | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [limit, setLimit] = useState(30)
  const [busy, setBusy] = useState(false)
  const [remove, setRemove] = useState<CashAccount | AccountTransfer | null>(null)
  const [timestamp, setTimestamp] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setTimestamp(Date.now())
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const ledgers = useMemo(() => new Map(s.cashAccounts.map((row) => [row.id, accountLedger(row, s.expenses, s.prepaidCharges, s.cardStatements, s.accountTransfers, s.expenseRefunds, Math.max(timestamp, Date.now()))])), [s.cashAccounts, s.expenses, s.prepaidCharges, s.cardStatements, s.accountTransfers, s.expenseRefunds, timestamp])
  const selected = s.cashAccounts.find((row) => row.id === detail)
  const ledger = detail ? ledgers.get(detail) : undefined
  const upcoming = paymentOverview(buildWithdrawalSchedule(s.cardWithdrawals, s.cardStatements, s.paymentMethods), timestamp).upcoming
  const save = async (action: () => Promise<boolean>, done: () => void) => { if (busy) return; setBusy(true); try { if (await action()) done() } finally { setBusy(false) } }
  const name = (id: string) => s.cashAccounts.find((row) => row.id === id)?.name ?? '不明な口座'
  return <>
    <SectionHeader>口座・財布（手動管理）</SectionHeader>
    <Typography variant="caption" color="text.secondary">銀行から取得した残高ではありません。開始日時以降の記録から計算します。未指定の入出金・手数料・割り勘の受け渡しは別途記録が必要です。</Typography>
    <Stack spacing={1} sx={{ mt: 1 }}>{s.cashAccounts.map((row) => {
      const balance = ledgers.get(row.id)!.balance
      const end = new Date(timestamp); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 30)
      const payments = upcoming.filter((payment) => {
        const statement = s.cardStatements.filter((item) => item.paymentMethodId === payment.methodId && item.withdrawalAtMillis === payment.withdrawalAtMillis).sort((a, b) => b.updatedAt - a.updatedAt)[0]
        const accountId = statement ? statement.cashAccountId ?? '' : s.paymentMethods.find((method) => method.id === payment.methodId)?.cashAccountId
        return payment.withdrawalAtMillis < end.getTime() && accountId === row.id
      }).reduce((sum, payment) => sum + payment.amountYen, 0)
      return <Card key={row.id} sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>{row.name}</Typography><Typography fontWeight={700}>{yen(balance)}</Typography></Stack><Typography variant="caption">今後30日のカード予定 {yen(payments)} / 差引参考 {yen(balance - payments)}</Typography>{payments > balance && <Alert severity="warning">記録上の残高がカード予定額を下回っています。銀行残高と請求明細を確認してください。</Alert>}<Stack direction="row"><Button variant="text" onClick={() => { setDetail(row.id); setLimit(30) }}>入出金</Button><Button variant="text" onClick={() => setAccount({ ...row })}>編集</Button></Stack></Card>
    })}</Stack>
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}><Button variant="outline" onClick={() => setAccount({ id: newId(), name: '', kind: 'bank', openingBalanceYen: 0, openedAtMillis: Date.now(), updatedAt: 0, deleted: false })}>口座・財布を追加</Button><Button variant="outline" disabled={s.cashAccounts.length < 2} onClick={() => setTransfer({ id: newId(), fromAccountId: s.cashAccounts[0].id, toAccountId: s.cashAccounts[1].id, amountYen: 0, transferredAtMillis: Date.now(), note: '', updatedAt: 0, deleted: false })}>口座間の振替</Button></Stack>
    {s.accountTransfers.length > 0 && <Accordion sx={{ mt: 1 }}><AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>振替履歴（収支には含めません）</AccordionSummary><AccordionDetails><Stack spacing={1}>{[...s.accountTransfers].sort((a, b) => b.transferredAtMillis - a.transferredAtMillis).slice(0, limit).map((row) => <Button variant="text" key={row.id} onClick={() => setTransfer({ ...row })}>{new Date(row.transferredAtMillis).toLocaleDateString('ja-JP')} {name(row.fromAccountId)} → {name(row.toAccountId)} {yen(row.amountYen)}</Button>)}{s.accountTransfers.length > limit && <Button variant="text" onClick={() => setLimit((value) => value + 30)}>さらに表示</Button>}</Stack></AccordionDetails></Accordion>}
    {selected && ledger && <Modal title={`${selected.name}の入出金`} onClose={() => setDetail(null)}><Stack spacing={1.5}><Typography>開始残高 {yen(selected.openingBalanceYen)} / {new Date(selected.openedAtMillis).toLocaleString('ja-JP')}以降</Typography><Typography>記録上の残高 {yen(ledger.balance)}</Typography>{ledger.entries.slice(0, limit).map((row) => <Box key={row.id}><Typography>{row.label} {yen(row.amountYen)}</Typography><Typography variant="caption">{new Date(row.date).toLocaleString('ja-JP')}</Typography></Box>)}{ledger.entries.length > limit && <Button onClick={() => setLimit((value) => value + 30)}>さらに表示</Button>}<Button onClick={() => setDetail(null)}>閉じる</Button></Stack></Modal>}
    {account && <Modal title="口座・財布の登録" onClose={() => setAccount(null)}><Stack spacing={2}><Field label="口座・財布の名前" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /><FormControl fullWidth><InputLabel id="account-kind">種類</InputLabel><Select labelId="account-kind" label="種類" value={account.kind} onChange={(e) => setAccount({ ...account, kind: e.target.value as CashAccount['kind'] })}><MenuItem value="bank">銀行口座</MenuItem><MenuItem value="wallet">現金の財布</MenuItem><MenuItem value="other">その他</MenuItem></Select></FormControl><Field calculatorAllowNegative onCalculate={(value) => setAccount({ ...account, openingBalanceYen: Number(value) })} label="開始残高（円）" type="number" value={account.openingBalanceYen} onChange={(e) => setAccount({ ...account, openingBalanceYen: Number(e.target.value) })} /><Field label="開始日時" type="datetime-local" value={toLocalInput(account.openedAtMillis)} onChange={(e) => setAccount({ ...account, openedAtMillis: fromLocalInput(e.target.value) })} /><Alert severity="info">開始日時の直前の残高を入力してください。開始日時より前の記録は加算しません。開始残高・日時の編集は計算結果全体に影響します。銀行の認証情報や口座番号は不要です。</Alert><Button disabled={busy} onClick={() => void save(() => s.saveCashAccount(account), () => setAccount(null))}>保存</Button>{s.cashAccounts.some((row) => row.id === account.id) && <Button variant="text" onClick={() => setRemove(account)}>この口座を削除</Button>}</Stack></Modal>}
    {transfer && <Modal title="振替を記録" onClose={() => setTransfer(null)}><Stack spacing={2}><CashAccountSelect label="振替元" value={transfer.fromAccountId} allowEmpty={false} onChange={(fromAccountId) => setTransfer({ ...transfer, fromAccountId })} /><CashAccountSelect label="振替先" value={transfer.toAccountId} allowEmpty={false} onChange={(toAccountId) => setTransfer({ ...transfer, toAccountId })} /><Field onCalculate={(value) => setTransfer({ ...transfer, amountYen: Number(value) })} label="振替額（円）" type="number" value={transfer.amountYen || ''} onChange={(e) => setTransfer({ ...transfer, amountYen: Number(e.target.value) })} /><Field label="振替日時" type="datetime-local" value={toLocalInput(transfer.transferredAtMillis)} onChange={(e) => setTransfer({ ...transfer, transferredAtMillis: fromLocalInput(e.target.value) })} /><Field label="メモ" value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} /><Typography variant="caption">送金は実行しません。実際に移した金額を記録するだけです。手数料は支出として別途記録してください。</Typography><Button disabled={busy} onClick={() => void save(() => s.saveTransfer(transfer), () => setTransfer(null))}>記録</Button>{s.accountTransfers.some((row) => row.id === transfer.id) && <Button variant="text" onClick={() => setRemove(transfer)}>この振替記録を削除</Button>}</Stack></Modal>}
    {remove && <Modal title="記録を削除しますか？" onClose={() => setRemove(null)}><Stack spacing={2}><Typography>残高計算から除外します。実際の銀行口座・送金には影響しません。</Typography><Button disabled={busy} onClick={() => void save(() => 'kind' in remove ? s.saveCashAccount({ ...remove, deleted: true }) : s.saveTransfer({ ...remove, deleted: true }), () => { setRemove(null); setAccount(null); setTransfer(null) })}>削除する</Button><Button variant="outline" onClick={() => setRemove(null)}>キャンセル</Button></Stack></Modal>}
  </>
}
