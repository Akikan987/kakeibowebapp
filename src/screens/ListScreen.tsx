import { useState } from 'react'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { Chip, IconButton, List, ListItem, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'
import { Button, Card, Divider, LargeTitle, Modal, Screen, SectionHeader, formatDate, yen } from '../components/ui'
import { useStore, type ExpenseDraft } from '../store'
import { TYPE_INCOME, type Expense } from '../types'

export function ListScreen({ onEdit }: { onEdit: (draft: ExpenseDraft) => void }) {
  const s = useStore()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)

  const startEdit = (expense: Expense) => {
    onEdit({
      editingId: expense.id,
      type: expense.type,
      title: expense.title,
      amountYen: String(expense.amountYen),
      category: expense.category,
      purchasedAtMillis: expense.purchasedAtMillis,
      source: expense.source,
      paymentMethodId: expense.paymentMethodId,
      splits: s.splitsOfExpense(expense.id).map((split) => ({ memberId: split.memberId, amount: String(split.amountYen) })),
    })
  }

  return (
    <Screen>
      <LargeTitle>履歴</LargeTitle>
      {s.expenses.length === 0 ? (
        <Typography color="text.secondary">まだ明細がありません</Typography>
      ) : (
        <>
          <SectionHeader>タップで編集</SectionHeader>
          <Card>
            <List disablePadding>
              {s.expenses.map((expense, index) => {
                const isIncome = expense.type === TYPE_INCOME
                const split = s.splitSumOf(expense.id)
                return (
                  <Stack key={expense.id}>
                    {index > 0 && <Divider />}
                    <ListItem disablePadding secondaryAction={
                      <IconButton edge="end" onClick={() => setPendingDelete(expense)} aria-label="削除"><DeleteOutlineRoundedIcon /></IconButton>
                    }>
                      <ListItemButton onClick={() => startEdit(expense)} sx={{ pr: 7, py: 1.5 }}>
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
