import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { Avatar, Box, CardContent, Stack, Typography } from '@mui/material'
import { CategoryChart, DailyChart } from '../components/Charts'
import { Card, LargeTitle, MonthSwitcher, Screen, SectionHeader } from '../components/ui'
import { useStore } from '../store'
import { MonthlySummary } from '../components/MonthlySummary'

export function HomeScreen() {
  const s = useStore()
  const { summary, month } = s
  const daysInMonth = new Date(month.year, month.month, 0).getDate()

  return (
    <Screen>
      <LargeTitle>収支</LargeTitle>
      {s.account && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Avatar
            src={s.account.avatarDataUrl || undefined}
            alt=""
            sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'action.selected', color: 'primary.main' }}
          >
            <PersonRoundedIcon fontSize="small" />
          </Avatar>
          <Typography color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>こんにちは、{s.account.nickname}さん</Typography>
        </Stack>
      )}

      <MonthSwitcher year={month.year} month={month.month} onPrevious={s.prevMonth} onNext={s.nextMonth} sx={{ mt: 3 }} />

      <SectionHeader>今月のサマリー</SectionHeader>
      <MonthlySummary balance={summary.balance} incomeTotal={summary.incomeTotal} expenseTotal={summary.expenseTotal} />

      <SectionHeader>支出：日付別</SectionHeader>
      <Card><CardContent><DailyChart data={summary.dailyTotals} daysInMonth={daysInMonth} /></CardContent></Card>

      <SectionHeader>支出：品目別</SectionHeader>
      <Card><CardContent><CategoryChart data={summary.categoryTotals} /></CardContent></Card>
      <Box sx={{ height: 1 }} />
    </Screen>
  )
}
