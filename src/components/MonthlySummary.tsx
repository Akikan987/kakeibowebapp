import { Box, CardContent, Stack, Typography } from '@mui/material'
import { moneyText } from '../design'
import { Card, Divider, yen } from './ui'

function SummaryRow({ label, value, tone }: { label: string; value: number; tone: 'success' | 'error' }) {
  return <Stack spacing={0.75} sx={{ minWidth: 0 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography color={`${tone}.main`} sx={{ ...moneyText, fontSize: { xs: '1.125rem', sm: '1.25rem' }, fontWeight: 600 }}>{yen(value)}</Typography>
  </Stack>
}

export function MonthlySummary({ balance, incomeTotal, expenseTotal }: {
  balance: number; incomeTotal: number; expenseTotal: number
}) {
  const balanceLabel = yen(balance)
  const longTotals = Math.max(yen(incomeTotal).length, yen(expenseTotal).length) > 10
  return <Card sx={{ containerType: 'inline-size' }}>
    <CardContent>
      <Typography variant="body2" color="text.secondary">収支</Typography>
      <Typography color={balance >= 0 ? 'text.primary' : 'error.main'} sx={{ ...moneyText, mt: 0.75, fontSize: balanceLabel.length > 12 ? 'clamp(1.5rem, 8cqi, 2.75rem)' : 'clamp(2rem, 10cqi, 2.75rem)', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.035em' }}>{balanceLabel}</Typography>
    </CardContent>
    <Divider />
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', [`@container (min-width: ${longTotals ? 24 : 17}rem)`]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5, p: 3 }}>
      <SummaryRow label="収入合計" value={incomeTotal} tone="success" />
      <SummaryRow label="支出合計" value={expenseTotal} tone="error" />
    </Box>
  </Card>
}
