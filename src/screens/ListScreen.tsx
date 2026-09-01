import { useEffect, useMemo, useState } from 'react'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Button, Card, Divider, LargeTitle, Modal, Screen, formatDate, yen } from '../components/ui'
import { useStore, type ExpenseDraft } from '../store'
import { TYPE_EXPENSE, TYPE_INCOME, now, type Expense } from '../types'

type Filters = {
  query: string
  type: string
  category: string
  paymentMethodId: string
  from: string
  to: string
  minAmount: string
  maxAmount: string
  splitOnly: boolean
}

const initialFilters: Filters = {
  query: '',
  type: '',
  category: '',
  paymentMethodId: '',
  from: '',
  to: '',
  minAmount: '',
  maxAmount: '',
  splitOnly: false,
}

const PAGE_SIZE = 50

export function ListScreen({ onEdit, onDuplicate }: {
  onEdit: (draft: ExpenseDraft) => void
  onDuplicate: (draft: ExpenseDraft) => void
}) {
  const s = useStore()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const categories = useMemo(
    () => [...new Set(s.expenses.map(({ category }) => category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ja')),
    [s.expenses],
  )
  const filteredExpenses = useMemo(() => {
    const monthStartMillis = new Date(s.month.year, s.month.month - 1, 1).getTime()
    const monthEndMillis = new Date(s.month.year, s.month.month, 1).getTime() - 1
    const query = filters.query.trim().toLocaleLowerCase('ja-JP')
    const fromMillis = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : 0
    const toMillis = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER
    const minAmount = filters.minAmount === '' ? 0 : Number(filters.minAmount)
    const maxAmount = filters.maxAmount === '' ? Number.MAX_SAFE_INTEGER : Number(filters.maxAmount)
    return s.expenses.filter((expense) => {
      if (expense.purchasedAtMillis < monthStartMillis || expense.purchasedAtMillis > monthEndMillis) return false
      const searchable = `${expense.title} ${expense.category} ${s.paymentMethodName(expense.paymentMethodId)}`
        .toLocaleLowerCase('ja-JP')
      if (query && !searchable.includes(query)) return false
      if (filters.type && expense.type !== filters.type) return false
      if (filters.category && expense.category !== filters.category) return false
      if (filters.paymentMethodId && expense.paymentMethodId !== filters.paymentMethodId) return false
      if (expense.purchasedAtMillis < fromMillis || expense.purchasedAtMillis > toMillis) return false
      if (expense.amountYen < minAmount || expense.amountYen > maxAmount) return false
      if (filters.splitOnly && s.splitSumOf(expense.id) <= 0) return false
      return true
    })
  }, [filters, s])
  const visibleExpenses = filteredExpenses.slice(0, visibleCount)
  const remainingCount = filteredExpenses.length - visibleExpenses.length

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filters, s.month.year, s.month.month])

  const activeFilterCount = Object.entries(filters)
    .filter(([, value]) => value !== '' && value !== false).length

  const draftOf = (expense: Expense, duplicate = false): ExpenseDraft => ({
    editingId: duplicate ? null : expense.id,
    type: expense.type,
    title: expense.title,
    amountYen: String(expense.amountYen),
    category: expense.category,
    purchasedAtMillis: duplicate ? now() : expense.purchasedAtMillis,
    source: duplicate ? 'manual' : expense.source,
    paymentMethodId: expense.paymentMethodId,
    splits: s.splitsOfExpense(expense.id)
      .map((split) => ({ memberId: split.memberId, amount: String(split.amountYen) })),
  })

  return (
    <Screen>
      <LargeTitle>履歴</LargeTitle>
      <Card sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 0.5 }}>
          <IconButton onClick={s.prevMonth} color="primary" aria-label="前の月"><ChevronLeftRoundedIcon /></IconButton>
          <Typography variant="h6">{s.month.year}年{s.month.month}月</Typography>
          <IconButton onClick={s.nextMonth} color="primary" aria-label="次の月"><ChevronRightRoundedIcon /></IconButton>
        </Stack>
      </Card>
      <TextField
        fullWidth
        value={filters.query}
        onChange={(event) => setFilters({ ...filters, query: event.target.value })}
        placeholder="店名・品目・決済方法を検索"
        slotProps={{
          input: {
            startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>,
          },
        }}
      />
      <Accordion
        disableGutters
        elevation={0}
        sx={{ mt: 1.5, bgcolor: 'action.hover', borderRadius: '14px !important', '&::before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<FilterListRoundedIcon />}>
          <Typography fontWeight={700}>絞り込み{activeFilterCount > 0 && `（${activeFilterCount}件指定）`}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControl fullWidth>
                <InputLabel>種類</InputLabel>
                <Select label="種類" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
                  <MenuItem value="">すべて</MenuItem>
                  <MenuItem value={TYPE_EXPENSE}>支出</MenuItem>
                  <MenuItem value={TYPE_INCOME}>収入</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>品目</InputLabel>
                <Select label="品目" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                  <MenuItem value="">すべて</MenuItem>
                  {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <FormControl fullWidth>
              <InputLabel>決済方法</InputLabel>
              <Select label="決済方法" value={filters.paymentMethodId} onChange={(event) => setFilters({ ...filters, paymentMethodId: event.target.value })}>
                <MenuItem value="">すべて</MenuItem>
                {s.paymentMethods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1.5}>
              <TextField fullWidth label="開始日" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth label="終了日" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <Stack direction="row" spacing={1.5}>
              <TextField fullWidth label="最低金額" type="number" value={filters.minAmount} onChange={(event) => setFilters({ ...filters, minAmount: event.target.value })} />
              <TextField fullWidth label="最高金額" type="number" value={filters.maxAmount} onChange={(event) => setFilters({ ...filters, maxAmount: event.target.value })} />
            </Stack>
            <FormControlLabel
              control={<Checkbox checked={filters.splitOnly} onChange={(event) => setFilters({ ...filters, splitOnly: event.target.checked })} />}
              label="割り勘がある明細だけ"
            />
            {activeFilterCount > 0 && <Button variant="outline" onClick={() => setFilters(initialFilters)}>絞り込みを解除</Button>}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {s.expenses.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>まだ明細がありません</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, px: 0.5 }}>
            {remainingCount > 0
              ? `${filteredExpenses.length}件中 ${visibleExpenses.length}件表示`
              : `${filteredExpenses.length}件表示`}
          </Typography>
          {filteredExpenses.length === 0 ? (
            <Card sx={{ mt: 1 }}>
              <Typography color="text.secondary" sx={{ p: 2 }}>この月に条件と一致する明細はありません</Typography>
            </Card>
          ) : (
            <Card sx={{ mt: 1 }}>
              <List disablePadding>
                {visibleExpenses.map((expense, index) => {
                  const isIncome = expense.type === TYPE_INCOME
                  const split = s.splitSumOf(expense.id)
                  return (
                    <Stack key={expense.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        disablePadding
                        secondaryAction={
                          <Stack direction="row">
                            <IconButton onClick={() => onDuplicate(draftOf(expense, true))} aria-label={`${expense.title}を複製`}><ContentCopyRoundedIcon /></IconButton>
                            <IconButton edge="end" onClick={() => setPendingDelete(expense)} aria-label="削除"><DeleteOutlineRoundedIcon /></IconButton>
                          </Stack>
                        }
                      >
                        <ListItemButton onClick={() => onEdit(draftOf(expense))} sx={{ pr: 12, py: 1.5 }}>
                          <ListItemText
                            primary={<Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}><Typography fontWeight={700} noWrap>{expense.title}</Typography><Typography fontWeight={700} color={isIncome ? 'success.main' : 'error.main'}>{isIncome ? '+' : '-'}{yen(expense.amountYen)}</Typography></Stack>}
                            secondary={
                              <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">{isIncome ? '収入' : '支出'} ・ {expense.category} ・ {formatDate(expense.purchasedAtMillis)}</Typography>
                                {!isIncome && <Typography variant="caption" color="text.secondary">決済: {s.paymentMethodName(expense.paymentMethodId)}</Typography>}
                                {split > 0 && <Chip size="small" color="primary" variant="outlined" label={`自分の負担 ${yen(s.netAmount(expense))}（割り勘 ${yen(split)}）`} sx={{ alignSelf: 'flex-start' }} />}
                              </Stack>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    </Stack>
                  )
                })}
              </List>
            </Card>
          )}
          {remainingCount > 0 && (
            <Button
              variant="outline"
              sx={{ mt: 1.5 }}
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              さらに表示（残り{remainingCount}件）
            </Button>
          )}
        </>
      )}

      {pendingDelete && (
        <Modal title="削除しますか？" onClose={() => setPendingDelete(null)}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>「{pendingDelete.title}」（{yen(pendingDelete.amountYen)}）を削除します。</Typography>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>キャンセル</Button>
            <Button color="#D32F2F" onClick={async () => { await s.deleteExpense(pendingDelete); setPendingDelete(null) }}>削除</Button>
          </Stack>
        </Modal>
      )}
    </Screen>
  )
}
