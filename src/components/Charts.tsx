import { useState } from 'react'
import { Box, IconButton, Stack, Typography, useTheme } from '@mui/material'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { yen } from './ui'

const COLORS = ['#3B82D0', '#65A57A', '#DDA052', '#D76D72', '#9A82BD', '#55A5AD']

export function CategoryChart({
  data: rawData,
}: {
  data: { name: string; total: number }[]
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [focusedName, setFocusedName] = useState<string | null>(null)
  const theme = useTheme()
  const data = rawData.filter((row) => row.total > 0).sort((left, right) => right.total - left.total)
  const credits = rawData.filter((row) => row.total < 0)
  if (data.length === 0)
    return <Typography color="text.secondary">{credits.length > 0 ? '正の支出はありません' : 'この月の支出はまだありません'}{credits.map((row) => ` / ${row.name}：返金超過 ${yen(-row.total)}`).join('')}</Typography>
  const total = data.reduce((sum, item) => sum + item.total, 0)
  const selected = data.find((item) => item.name === selectedName) ?? null
  let angle = -90
  const slices = data.map((item, index) => {
    const start = angle
    angle += (item.total / total) * 360
    return { ...item, color: COLORS[index % COLORS.length], start, end: angle }
  })

  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    return { x: 100 + 86 * Math.cos(radians), y: 100 + 86 * Math.sin(radians) }
  }
  const sectorPath = (start: number, end: number) => {
    const from = point(start)
    const to = point(end)
    return `M 100 100 L ${from.x} ${from.y} A 86 86 0 ${end - start > 180 ? 1 : 0} 1 ${to.x} ${to.y} Z`
  }
  const select = (name: string) => setSelectedName((current) => current === name ? null : name)

  return (
    <Box>
      {credits.length > 0 && <Typography variant="caption" color="text.secondary">円グラフは正の支出のみ。返金超過：{credits.map((row) => `${row.name} ${yen(-row.total)}`).join('、')}</Typography>}
      <Box sx={{ position: 'relative', width: '100%', maxWidth: 220, aspectRatio: '1 / 1', mx: 'auto' }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: 'block' }} aria-label="品目別支出の円グラフ">
          {slices.map((item) => item.end - item.start >= 359.999 ? (
            <circle
              key={item.name}
              cx="100"
              cy="100"
              r="86"
              fill={item.color}
              stroke={selectedName === item.name || focusedName === item.name ? '#fff' : 'transparent'}
              strokeWidth="5"
              role="button"
              tabIndex={0}
              aria-label={`${item.name} ${yen(item.total)}`}
              onClick={() => select(item.name)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(item.name) } }}
              onFocus={() => setFocusedName(item.name)}
              onBlur={() => setFocusedName(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            />
          ) : (
            <path
              key={item.name}
              d={sectorPath(item.start, item.end)}
              fill={item.color}
              stroke={selectedName === item.name || focusedName === item.name ? '#fff' : 'rgba(255,255,255,0.45)'}
              strokeWidth={selectedName === item.name || focusedName === item.name ? 5 : 2}
              role="button"
              tabIndex={0}
              aria-label={`${item.name} ${yen(item.total)}`}
              onClick={() => select(item.name)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(item.name) } }}
              onFocus={() => setFocusedName(item.name)}
              onBlur={() => setFocusedName(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            />
          ))}
          <circle cx="100" cy="100" r="49" fill={theme.palette.background.paper} opacity="0.96" />
        </svg>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ position: 'absolute', inset: '28% 16%', textAlign: 'center', pointerEvents: 'none' }}
        >
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 110 }}>
            {selected?.name ?? '合計'}
          </Typography>
          <Typography fontWeight={800}>{yen(selected?.total ?? total)}</Typography>
        </Stack>
      </Box>
      <Stack component="ul" sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }}>
        {slices.map((item) => (
          <Box component="li" key={item.name}><Stack
            component="button"
            type="button"
            direction="row"
            alignItems="center"
            spacing={0.75}
            onClick={() => select(item.name)}
            aria-pressed={selectedName === item.name}
            sx={{ appearance: 'none', border: 0, borderRadius: '12px', bgcolor: selectedName === item.name ? 'action.selected' : 'transparent', color: 'text.primary', px: 1, py: 1, minHeight: 44, width: '100%', cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
          >
            <Box sx={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', bgcolor: item.color }} />
            <Typography variant="body2" fontWeight={selectedName === item.name ? 800 : 400} sx={{ flex: 1, minWidth: 0, textAlign: 'left', overflowWrap: 'anywhere' }}>{item.name}</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{yen(item.total)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {new Intl.NumberFormat('ja-JP', { style: 'percent', maximumFractionDigits: 1 }).format(item.total / total)}
            </Typography>
          </Stack></Box>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        円グラフをタップすると品目の金額を表示します。
      </Typography>
    </Box>
  )
}

export function DailyChart({
  data,
  daysInMonth,
  today,
}: {
  data: Map<number, number>
  daysInMonth: number
  today?: number
}) {
  const [selected, setSelected] = useState<number | null>(null)

  if ([...data.values()].every((value) => value === 0))
    return <Typography color="text.secondary">この月の支出はまだありません</Typography>

  const max = Math.max(1, ...[...data.values()].map(Math.abs))
  const top = [...data.entries()].sort((a, b) => b[1] - a[1])[0]
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1)

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))`, height: 180 }}>
        {days.map((day) => {
          const value = data.get(day) ?? 0
          const isSelected = selected === day
          return (
            <Box
              component="button"
              key={day}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              aria-label={`${day}日 ${yen(value)}`}
              aria-current={day === today ? 'date' : undefined}
              aria-pressed={isSelected}
              sx={{
                appearance: 'none',
                border: 0,
                p: 0,
                bgcolor: day === today ? 'action.selected' : 'transparent',
                height: '100%',
                minWidth: 0,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                cursor: 'pointer',
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
              }}
            >
              <Box
                sx={{
                  width: 'calc(100% - 2px)',
                  minHeight: 2,
                  height: value !== 0 ? `${Math.max(2, (Math.abs(value) / max) * 100)}%` : 2,
                  bgcolor: isSelected
                    ? 'warning.main'
                    : value > 0
                      ? 'primary.main'
                      : value < 0 ? 'success.main' : 'divider',
                  borderRadius: '4px 4px 0 0',
                  // Financial data should be immediate; do not animate height on month changes.
                  transition: 'none',
                }}
              />
            </Box>
          )
        })}
      </Box>
      <Box aria-hidden="true" sx={{ position: 'relative', height: 22, mt: 0.5 }}>
        {[1, 5, 10, 15, 20, 25, daysInMonth].map((day) => (
          <Typography key={day} variant="caption" color="text.secondary" sx={{
            position: 'absolute',
            left: day === 1 ? 0 : day === daysInMonth ? undefined : `${((day - 0.5) / daysInMonth) * 100}%`,
            right: day === daysInMonth ? 0 : undefined,
            transform: day > 1 && day < daysInMonth ? 'translateX(-50%)' : undefined,
          }}>{day === 1 || day === daysInMonth ? `${day}日` : day}</Typography>
        ))}
      </Box>
      {[...data.values()].some((value) => value < 0) && <Typography variant="caption">緑の棒は返金が支出を上回った日です（高さは絶対額）。</Typography>}
      {top && top[1] > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          最も使った日: {top[0]}日（{yen(top[1])}）
        </Typography>
      )}
      {selected !== null ? (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <IconButton aria-label="前の日" disabled={selected === 1} onClick={() => setSelected(selected - 1)} sx={{ width: 44, height: 44 }}><ChevronLeftRoundedIcon /></IconButton>
          <Typography variant="body2" fontWeight={700} aria-live="polite">
            {selected}日 {yen(data.get(selected) ?? 0)}
            {(data.get(selected) ?? 0) === 0 && '（支出なし）'}
          </Typography>
          <IconButton aria-label="次の日" disabled={selected === daysInMonth} onClick={() => setSelected(selected + 1)} sx={{ width: 44, height: 44 }}><ChevronRightRoundedIcon /></IconButton>
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          棒をタップすると、その日の金額が出ます。{today && '背景の色が付いた列は今日です。'}
        </Typography>
      )}
    </Box>
  )
}
