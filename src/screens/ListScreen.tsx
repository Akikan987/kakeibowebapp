import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import { RefundHistory, RefundModal } from '../components/Refunds'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Button, Card, Field, LargeTitle, Modal, MonthSwitcher, Screen, yen } from '../components/ui'
import { useStore, type ExpenseDraft } from '../store'
import { TYPE_EXPENSE, TYPE_INCOME, now, type Expense } from '../types'
import { groupHistoryDays } from '../entries/history'
import { registerModalBackHandler } from '../sectionNavigation'

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
const historyDate = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
const historyTime = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function ListScreen({ onAddExpense, onEdit, onDuplicate }: {
  onAddExpense: () => void
  onEdit: (draft: ExpenseDraft) => void
  onDuplicate: (draft: ExpenseDraft) => void
}) {
  const s = useStore()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const pendingDeleteSplits = pendingDelete ? s.splitsOfExpense(pendingDelete.id) : []
  const [refundTarget, setRefundTarget] = useState<Expense | null>(null)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [entryMenu, setEntryMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const menuExpense = entryMenu ? s.expenses.find((expense) => expense.id === entryMenu.id) : undefined
  const menuOpen = !!menuExpense
  useLayoutEffect(() => {
    if (menuOpen) return registerModalBackHandler(() => setEntryMenu(null))
  }, [menuOpen])

  const categories = useMemo(
    () => [...new Set(s.expenses.map(({ category }) => category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ja')),
    [s.expenses],
  )
  const monthExpenses = useMemo(() => {
    const monthStartMillis = new Date(s.month.year, s.month.month - 1, 1).getTime()
    const monthEndMillis = new Date(s.month.year, s.month.month, 1).getTime()
    return s.expenses.filter(({ purchasedAtMillis }) => purchasedAtMillis >= monthStartMillis && purchasedAtMillis < monthEndMillis)
  }, [s.expenses, s.month.year, s.month.month])

  const filteredExpenses = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase('ja-JP')
    const fromMillis = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : 0
    const toMillis = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER
    const minAmount = filters.minAmount === '' ? 0 : Number(filters.minAmount)
    const maxAmount = filters.maxAmount === '' ? Number.MAX_SAFE_INTEGER : Number(filters.maxAmount)
    return monthExpenses.filter((expense) => {
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
  }, [filters, monthExpenses, s])
  const visibleExpenses = filteredExpenses.slice(0, visibleCount)
  const remainingCount = filteredExpenses.length - visibleExpenses.length
  const historyDays = useMemo(() => groupHistoryDays(filteredExpenses, s.netAmount, visibleCount), [filteredExpenses, s.netAmount, visibleCount])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setEntryMenu(null)
  }, [filters, s.month.year, s.month.month])
  useEffect(() => { if (!menuExpense) setEntryMenu(null) }, [menuExpense])

  const activeFilterCount = Object.entries(filters)
    .filter(([, value]) => value !== '' && value !== false).length

  const draftOf = (expense: Expense, duplicate = false): ExpenseDraft => ({
    cashAccountId: duplicate ? undefined : expense.cashAccountId ?? '',
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
      <MonthSwitcher year={s.month.year} month={s.month.month} onPrevious={s.prevMonth} onNext={s.nextMonth} sx={{ mb: 2 }} />
      {monthExpenses.length > 0 && <>
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ width: '100%', pr: 1 }}>
              <Typography variant="body2" fontWeight={700}>絞り込み{activeFilterCount > 0 && `（${activeFilterCount}件指定）`}</Typography>
              <Typography variant="caption" color="text.secondary">
                {remainingCount > 0
                  ? `${filteredExpenses.length}件中 ${visibleExpenses.length}件表示`
                  : `${filteredExpenses.length}件表示`}
              </Typography>
            </Stack>
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
                <Field onCalculate={(value) => setFilters({ ...filters, minAmount: value })} label="最低金額" type="number" value={filters.minAmount} onChange={(event) => setFilters({ ...filters, minAmount: event.target.value })} />
                <Field onCalculate={(value) => setFilters({ ...filters, maxAmount: value })} label="最高金額" type="number" value={filters.maxAmount} onChange={(event) => setFilters({ ...filters, maxAmount: event.target.value })} />
              </Stack>
              <FormControlLabel
                control={<Checkbox checked={filters.splitOnly} onChange={(event) => setFilters({ ...filters, splitOnly: event.target.checked })} />}
                label="割り勘がある明細だけ"
              />
              {activeFilterCount > 0 && <Button variant="outline" onClick={() => setFilters(initialFilters)}>絞り込みを解除</Button>}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </>}

      {monthExpenses.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                {s.expenses.length > 0 ? 'この月はまだ明細がありません' : 'まだ明細がありません'}
              </Typography>
              <Button onClick={onAddExpense} sx={{ width: 'auto', minHeight: 44 }}>最初の支出を記録する</Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          {filteredExpenses.length === 0 ? (
            <Card sx={{ mt: 1 }}>
              <CardContent>
                <Stack spacing={1.5} alignItems="flex-start">
                  <Typography color="text.secondary">この月に条件と一致する明細はありません</Typography>
                  <Button variant="outline" onClick={() => setFilters(initialFilters)} sx={{ width: 'auto', minHeight: 44 }}>条件をクリア</Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {historyDays.map((day) => (
                <Card key={day.dateMillis}>
                  {day.expenses.length > 1 && <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} useFlexGap flexWrap="wrap" sx={{ px: 2, py: 0.5, bgcolor: 'action.hover' }}>
                    <Typography component="h2" variant="subtitle2" fontWeight={700}>
                      {historyDate.format(day.dateMillis)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {day.hasExpense ? `本人負担（返金前） ${yen(day.expenseTotal)}` : `収入 ${yen(day.incomeTotal)}`}
                    </Typography>
                  </Stack>}
                  <List disablePadding aria-label={historyDate.format(day.dateMillis)}>
                    {day.expenses.map((expense) => {
                      const isIncome = expense.type === TYPE_INCOME
                      const split = s.splitSumOf(expense.id)
                      const details = [
                        day.expenses.length === 1 && historyDate.format(day.dateMillis),
                        expense.category,
                        !isIncome && s.paymentMethodName(expense.paymentMethodId),
                        split > 0 && `本人 ${yen(s.netAmount(expense))}（割り勘 ${yen(split)}）`,
                        historyTime.format(expense.purchasedAtMillis),
                      ].filter(Boolean).join(' ・ ')
                      const amount = `${isIncome ? '+' : '-'}${yen(expense.amountYen)}`
                      return (
                        <Box key={expense.id} component="li" sx={{
                          display: 'flex',
                          alignItems: 'center',
                          pr: 0.75,
                          '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider' },
                        }}>
                          <ListItemButton
                            onClick={() => onEdit(draftOf(expense))}
                            aria-label={`${expense.title}を編集、${amount}、${details}`}
                            sx={{ flex: 1, minWidth: 0, minHeight: 56, pl: 2, pr: 0.75, py: 0.75 }}
                          >
                            <ListItemText
                              disableTypography
                              sx={{ m: 0, minWidth: 0 }}
                              primary={<Stack direction="row" alignItems="baseline" spacing={1}>
                                <Typography variant="body2" fontWeight={600} noWrap title={expense.title} sx={{ flex: 1, minWidth: 0 }}>{expense.title}</Typography>
                                <Typography variant="body2" fontWeight={700} color={isIncome ? 'success.main' : 'text.primary'} sx={{ flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{amount}</Typography>
                              </Stack>}
                              secondary={<Typography component="div" variant="caption" color="text.secondary" noWrap title={details}>{details}</Typography>}
                            />
                          </ListItemButton>
                          <IconButton
                            aria-label={`${expense.title}の操作`}
                            aria-haspopup="menu"
                            aria-expanded={entryMenu?.id === expense.id}
                            onClick={(event) => setEntryMenu({ id: expense.id, anchor: event.currentTarget })}
                            sx={{ width: 44, height: 44, flexShrink: 0 }}
                          ><MoreVertRoundedIcon /></IconButton>
                        </Box>
                      )
                    })}
                  </List>
                </Card>
              ))}
            </Stack>
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

      <Menu
        anchorEl={entryMenu?.anchor}
        open={menuOpen}
        onClose={() => setEntryMenu(null)}
        slotProps={{ list: { 'aria-label': menuExpense ? `${menuExpense.title}の操作` : '明細の操作' } }}
      >
        {menuExpense && menuExpense.type !== TYPE_INCOME && (
          <MenuItem onClick={() => { setEntryMenu(null); setRefundTarget(menuExpense) }}>
            <ListItemIcon><UndoRoundedIcon fontSize="small" /></ListItemIcon>返金を記録
          </MenuItem>
        )}
        {menuExpense && (
          <MenuItem onClick={() => { setEntryMenu(null); onDuplicate(draftOf(menuExpense, true)) }}>
            <ListItemIcon><ContentCopyRoundedIcon fontSize="small" /></ListItemIcon>複製
          </MenuItem>
        )}
        {menuExpense && (
          <MenuItem aria-label={`${menuExpense.title}を削除`} onClick={() => { setEntryMenu(null); setPendingDelete(menuExpense) }} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>削除
          </MenuItem>
        )}
      </Menu>
      <RefundHistory />
      {refundTarget && <RefundModal expense={refundTarget} onClose={() => setRefundTarget(null)} />}
      {pendingDelete && (
        <Modal title="削除しますか？" onClose={() => setPendingDelete(null)}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>「{pendingDelete.title}」（{yen(pendingDelete.amountYen)}）を削除します。</Typography>
          {pendingDeleteSplits.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, overflowWrap: 'anywhere' }}>
              この支出に含まれる負担（{pendingDeleteSplits.map((split) => `${s.memberName(split.memberId)}さん ${yen(split.amountYen)}`).join('、')}）も割当から外れます。
              清算の記録は残ります。取り消す場合は、割り勘の「清算履歴」から操作してください。
            </Typography>
          )}
          <Stack direction="row" spacing={1.5}>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>キャンセル</Button>
            <Button color="#D32F2F" onClick={() => { setPendingDelete(null); void s.deleteExpense(pendingDelete) }}>削除</Button>
          </Stack>
        </Modal>
      )}
    </Screen>
  )
}
