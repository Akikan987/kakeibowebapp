import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { Box, CardContent, IconButton, Stack, Typography } from '@mui/material'
import { CategoryChart, DailyChart } from '../components/Charts'
import { Card, Divider, LargeTitle, Screen, SectionHeader, yen } from '../components/ui'
import { useStore } from '../store'

function SummaryRow({ label, value, tone }: { label: string; value: number; tone: 'success' | 'error' }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.75 }}>
      <Typography>{label}</Typography>
      <Typography variant="h6" color={`${tone}.main`}>{yen(value)}</Typography>
    </Stack>
  )
}

export function HomeScreen() {
  const s = useStore()
  const { summary, month } = s
  const daysInMonth = new Date(month.year, month.month, 0).getDate()

  return (
    <Screen>
      <LargeTitle>ホーム</LargeTitle>
      {s.account && <Typography color="text.secondary">こんにちは、{s.account.nickname}さん</Typography>}

      <Card sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 0.5 }}>
          <IconButton onClick={s.prevMonth} color="primary" aria-label="前の月"><ChevronLeftRoundedIcon /></IconButton>
          <Typography variant="h6">{month.year}年{month.month}月</Typography>
          <IconButton onClick={s.nextMonth} color="primary" aria-label="次の月"><ChevronRightRoundedIcon /></IconButton>
        </Stack>
      </Card>

      <SectionHeader>今月のサマリー</SectionHeader>
      <Card>
        <SummaryRow label="収入合計" value={summary.incomeTotal} tone="success" />
        <Divider />
        <SummaryRow label="支出合計" value={summary.expenseTotal} tone="error" />
        <Divider />
        <SummaryRow label="収支" value={summary.balance} tone={summary.balance >= 0 ? 'success' : 'error'} />
      </Card>

      <SectionHeader>支出：品目別</SectionHeader>
      <Card><CardContent><CategoryChart data={summary.categoryTotals} /></CardContent></Card>

      <SectionHeader>支出：日付別</SectionHeader>
      <Card><CardContent><DailyChart data={summary.dailyTotals} daysInMonth={daysInMonth} /></CardContent></Card>
      <Box sx={{ height: 1 }} />
    </Screen>
  )
}
