import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { Avatar, Box, CardContent, Stack, Typography } from '@mui/material'
import { CategoryChart, DailyChart } from '../components/Charts'
import { Button, Card, LargeTitle, MonthSwitcher, Screen, SectionHeader } from '../components/ui'
import { useStore } from '../store'
import { MonthlySummary } from '../components/MonthlySummary'

export function HomeScreen({ onAddExpense }: { onAddExpense: () => void }) {
  const s = useStore()
  const { summary, month } = s
  const daysInMonth = new Date(month.year, month.month, 0).getDate()
  const monthStart = new Date(month.year, month.month - 1, 1).getTime()
  const monthEnd = new Date(month.year, month.month, 1).getTime()
  const today = new Date()
  const todayInMonth = today.getFullYear() === month.year && today.getMonth() === month.month - 1 ? today.getDate() : undefined
  const hasMonthlyRecords = summary.dailyTotals.size > 0 || s.expenses.some(
    (expense) => expense.purchasedAtMillis >= monthStart && expense.purchasedAtMillis < monthEnd,
  )

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

      {hasMonthlyRecords ? <>
        <SectionHeader>支出：日付別</SectionHeader>
        <Card><CardContent><DailyChart key={`${month.year}-${month.month}`} data={summary.dailyTotals} daysInMonth={daysInMonth} today={todayInMonth} /></CardContent></Card>

        <SectionHeader>支出：品目別</SectionHeader>
        <Card><CardContent><CategoryChart data={summary.categoryTotals} /></CardContent></Card>
      </> : <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography component="h2" variant="subtitle1" fontWeight={700}>この月はまだ記録がありません</Typography>
            <Button onClick={onAddExpense} sx={{ width: 'auto', minHeight: 44 }}>最初の支出を記録する</Button>
          </Stack>
        </CardContent>
      </Card>}
      <Box sx={{ height: 1 }} />
    </Screen>
  )
}
