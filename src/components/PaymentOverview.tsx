import { useEffect, useMemo, useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { Card, Divider, Modal, SectionHeader, yen } from './ui'
import { paymentOverview, withdrawalItems, withdrawalKey, type ScheduledWithdrawal } from '../domain/paymentOverview'
import type { Expense, PrepaidCharge } from '../types'

const fullDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('ja-JP')
export function WithdrawalStatus({ status }: { status: ScheduledWithdrawal['status'] }) {
  return <Chip size="small" variant={status === 'estimated' ? 'outlined' : 'filled'} color={status === 'paid' ? 'success' : status === 'confirmed' ? 'primary' : 'default'} label={status === 'paid' ? '支払済み' : status === 'confirmed' ? '確定' : '見込み'} />
}

function Total({ label, value }: { label: string; value: ReturnType<typeof paymentOverview>['week'] }) {
  return <Box><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h6">{yen(value.total)}</Typography><Typography variant="caption" color="text.secondary">確定 {yen(value.confirmed)} / 見込み {yen(value.estimated)}</Typography></Box>
}

export function PaymentOverview({ schedule, onSelect }: { schedule: ScheduledWithdrawal[]; onSelect: (row: ScheduledWithdrawal) => void }) {
  const [timestamp, setTimestamp] = useState(Date.now)
  const [limit, setLimit] = useState(12)
  const [pastLimit, setPastLimit] = useState(12)
  useEffect(() => {
    const refresh = () => setTimestamp(Date.now())
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const overview = useMemo(() => paymentOverview(schedule, timestamp), [schedule, timestamp])
  const list = (rows: ScheduledWithdrawal[]) => rows.map((row, index) => <Box key={withdrawalKey(row.methodId, row.withdrawalAtMillis)}>
    {index > 0 && <Divider />}
    <Button fullWidth color="inherit" onClick={() => onSelect(row)} sx={{ textAlign: 'left', px: 2, py: 1.5, display: 'block', borderRadius: 0 }}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Box sx={{ minWidth: 0 }}><Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{row.methodName}</Typography><Typography variant="body2" color="text.secondary">{fullDate(row.withdrawalAtMillis)}予定</Typography></Box>
        <Stack alignItems="flex-end" spacing={0.5}><Typography fontWeight={700}>{yen(row.amountYen)}</Typography><WithdrawalStatus status={row.status} /></Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary">{row.itemCount}件 ・ タップで内訳・請求確認</Typography>
    </Button>
  </Box>)
  return <>
    <SectionHeader>これからの支払い</SectionHeader>
    <Card sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">次の引き落とし（支払済みを除く）</Typography>
      {overview.nextDate === undefined ? <Typography sx={{ my: 1 }}>今後の引き落とし予定はありません</Typography> : <Box sx={{ my: 1 }}>
        <Typography>{fullDate(overview.nextDate)}</Typography><Typography variant="h5">{yen(overview.next.total)}</Typography>
        <Typography variant="caption">確定 {yen(overview.next.confirmed)} / 見込み {yen(overview.next.estimated)}（同日の合計）</Typography>
      </Box>}
      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}><Total label="今日を含む7日間" value={overview.week} /><Total label="今日を含む30日間" value={overview.month} /></Stack>
    </Card>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>支払済みは合計から除外。見込みは登録履歴からの計算で、実際の請求額・残高を保証しません。</Typography>
    {overview.past.length > 0 && <Accordion disableGutters sx={{ mt: 2 }}><AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography>過去の予定・支払確認待ち {overview.past.length}件</Typography></AccordionSummary><AccordionDetails sx={{ p: 0 }}>
      <Alert severity="info">アプリで未確認の予定です。実際の未払い・延滞を示すものではありません。明細で確認して支払済みにできます。</Alert>
      {list([...overview.past].reverse().slice(0, pastLimit))}
      {overview.past.length > pastLimit && <Button fullWidth onClick={() => setPastLimit((value) => value + 12)}>過去の予定をさらに表示</Button>}
    </AccordionDetails></Accordion>}
    <SectionHeader>今後の予定（支払済みを除く）</SectionHeader>
    <Card>{overview.upcoming.length === 0 ? <Typography sx={{ p: 2 }}>カード利用を記録すると予定が表示されます。過去分・支払済みはカレンダーから確認できます。</Typography> : list(overview.upcoming.slice(0, limit))}</Card>
    {overview.upcoming.length > limit && <Button fullWidth onClick={() => setLimit((value) => value + 12)}>さらに12件表示（残り{overview.upcoming.length - limit}件）</Button>}
  </>
}

export function WithdrawalDetails({ row, expenses, charges, onClose, onConfirm }: {
  row: ScheduledWithdrawal; expenses: Expense[]; charges: PrepaidCharge[]; onClose: () => void; onConfirm: () => void,
}) {
  const [limit, setLimit] = useState(30)
  const items = useMemo(() => withdrawalItems(row, expenses, charges), [row, expenses, charges])
  return <Modal title="引き落としの内訳" onClose={onClose}><Stack spacing={1.5}>
    <Typography variant="h6">{row.methodName}</Typography><Typography>{fullDate(row.withdrawalAtMillis)}予定</Typography>
    <Stack direction="row" alignItems="center" spacing={1}><Typography variant="h5">{yen(row.amountYen)}</Typography><WithdrawalStatus status={row.status} /></Stack>
    <Typography variant="body2">利用履歴の合計 {yen(row.estimatedAmountYen)}（カード利用 {yen(row.expenseAmountYen)} / チャージ {yen(row.chargeAmountYen)}）</Typography>
    {row.status !== 'estimated' && row.amountYen !== row.estimatedAmountYen && <Alert severity="info">確定額との差額 {yen(row.amountYen - row.estimatedAmountYen)}。未登録の利用・返金・締め日の違いなどをカード会社の明細で確認してください。</Alert>}
    <Button variant="contained" onClick={onConfirm}>請求額・支払状態を確認する</Button>
    <Typography variant="caption" color="text.secondary">利用時の全額を表示します（割り勘相手の負担も含みます）。チャージはここに含みますが、家計簿の支出統計には二重計上しません。</Typography>
    {items.length === 0 && <Typography color="text.secondary">対応する利用履歴がありません。確定請求の記録は保持しています。</Typography>}
    {items.slice(0, limit).map((item) => <Box key={`${item.kind}:${item.id}`}><Divider /><Stack direction="row" spacing={1} justifyContent="space-between" sx={{ py: 1 }}><Box><Typography sx={{ overflowWrap: 'anywhere' }}>{item.title}</Typography><Typography variant="caption" color="text.secondary">{fullDate(item.date)} ・ {item.kind === 'charge' ? 'チャージ' : 'カード利用'}</Typography></Box><Typography sx={{ flexShrink: 0 }}>{yen(item.amountYen)}</Typography></Stack></Box>)}
    {items.length > limit && <Button onClick={() => setLimit((value) => value + 30)}>内訳をさらに表示</Button>}
    <Button onClick={onClose}>閉じる</Button>
  </Stack></Modal>
}
