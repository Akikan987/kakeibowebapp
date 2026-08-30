import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { IconButton, Stack, Typography } from '@mui/material'
import { PlanningSections } from '../components/PlanningSections'
import { Card, LargeTitle, Screen } from '../components/ui'
import { useStore } from '../store'

export function PlanningScreen() {
  const s = useStore()

  return (
    <Screen>
      <LargeTitle>予算</LargeTitle>
      <Card>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 0.5 }}>
          <IconButton onClick={s.prevMonth} color="primary" aria-label="前の月">
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Typography variant="h6">{s.month.year}年{s.month.month}月</Typography>
          <IconButton onClick={s.nextMonth} color="primary" aria-label="次の月">
            <ChevronRightRoundedIcon />
          </IconButton>
        </Stack>
      </Card>
      <PlanningSections />
    </Screen>
  )
}
