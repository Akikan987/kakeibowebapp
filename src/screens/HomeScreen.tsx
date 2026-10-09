import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { Avatar, Box, CardContent, Stack, Typography } from '@mui/material'
import { CategoryChart, DailyChart } from '../components/Charts'
import { Card, Divider, LargeTitle, MonthSwitcher, Screen, SectionHeader, yen } from '../components/ui'
import { useStore } from '../store'

function SummaryRow({ label, value, tone }: { label: string; value: number; tone: 'success' | 'error' }) {
  return (
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography color={`${tone}.main`} sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' }, fontWeight: 600 }}>{yen(value)}</Typography>
    </Stack>
  )
}

export function HomeScreen() {
  const s = useStore()
  const { summary, month } = s
  const daysInMonth = new Date(month.year, month.month, 0).getDate()

  return (
    <Screen>
      <LargeTitle>収支</LargeTitle>
      {s.account && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar
            src={s.account.avatarDataUrl || undefined}
            alt=""
            sx={{ width: 32, height: 32, bgcolor: 'action.selected', color: 'primary.main' }}
          >
            <PersonRoundedIcon fontSize="small" />
          </Avatar>
          <Typography color="text.secondary">こんにちは、{s.account.nickname}さん</Typography>
        </Stack>
      )}

      <MonthSwitcher year={month.year} month={month.month} onPrevious={s.prevMonth} onNext={s.nextMonth} sx={{ mt: 3 }} />

      <SectionHeader>今月のサマリー</SectionHeader>
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">収支</Typography>
          <Typography color={summary.balance >= 0 ? 'text.primary' : 'error.main'} sx={{ mt: 0.5, fontSize: { xs: '2.25rem', sm: '2.75rem' }, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.04em' }}>{yen(summary.balance)}</Typography>
        </CardContent>
        <Divider />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, p: 3 }}>
          <SummaryRow label="収入合計" value={summary.incomeTotal} tone="success" />
          <SummaryRow label="支出合計" value={summary.expenseTotal} tone="error" />
        </Box>
      </Card>

      <SectionHeader>支出：日付別</SectionHeader>
      <Card><CardContent><DailyChart data={summary.dailyTotals} daysInMonth={daysInMonth} /></CardContent></Card>

      <SectionHeader>支出：品目別</SectionHeader>
      <Card><CardContent><CategoryChart data={summary.categoryTotals} /></CardContent></Card>
      <Box sx={{ height: 1 }} />
    </Screen>
  )
}
