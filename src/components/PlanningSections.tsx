import { useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { Button, Card, Divider, Field, Modal, SectionHeader, yen } from './ui'
import { DEFAULT_CASH_METHOD_ID } from '../db'
import { useStore, type RecurringTemplateDraft } from '../store'
import { TYPE_EXPENSE, TYPE_INCOME, type Budget, type RecurringTemplate } from '../types'

const monthKeyOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

export function PlanningSections() {
  const s = useStore()
  const monthKey = monthKeyOf(s.month.year, s.month.month)
  const monthBudgets = s.budgets.filter((budget) => budget.monthKey === monthKey)
  const overall = monthBudgets.find((budget) => budget.category === '')
  const [templateDraft, setTemplateDraft] = useState<RecurringTemplateDraft | null>(null)
  const [budgetDraft, setBudgetDraft] = useState<{ category: string; amountYen: string } | null>(null)
  const [pendingTemplateDelete, setPendingTemplateDelete] = useState<RecurringTemplate | null>(null)
  const [pendingBudgetDelete, setPendingBudgetDelete] = useState<Budget | null>(null)

  const emptyTemplate = (): RecurringTemplateDraft => ({
    editingId: null,
    title: '',
    amountYen: '',
    category: s.categories[0]?.name ?? 'その他',
    type: TYPE_EXPENSE,
    paymentMethodId: s.paymentMethods[0]?.id ?? DEFAULT_CASH_METHOD_ID,
    dayOfMonth: 1,
    active: true,
  })
  const editTemplate = (template: RecurringTemplate): RecurringTemplateDraft => ({
    editingId: template.id,
    title: template.title,
    amountYen: String(template.amountYen),
    category: template.category,
    type: template.type,
    paymentMethodId: template.paymentMethodId,
    dayOfMonth: template.dayOfMonth,
    active: template.active,
  })

  return <>
    <SectionHeader>今月の定期項目</SectionHeader>
    <Card>
      {s.recurringTemplates.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>家賃・給与・サブスクなどを登録すると、毎月確認して明細へ追加できます。</Typography>
      ) : s.recurringTemplates.map((template, index) => {
        const registered = s.recurringRegistered(template.id, s.month.year, s.month.month)
        return <Box key={template.id}>
          {index > 0 && <Divider />}
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pl: 2, pr: 0.75, py: 1.25 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={700} noWrap>{template.title}</Typography>
              <Typography variant="caption" color="text.secondary">毎月{template.dayOfMonth}日 ・ {template.type === TYPE_INCOME ? '収入' : template.category} ・ {yen(template.amountYen)}{!template.active && ' ・ 停止中'}</Typography>
            </Box>
            <Button
              variant={registered ? 'outline' : 'primary'}
              disabled={registered || !template.active}
              onClick={() => void s.registerRecurringTemplate(template, s.month.year, s.month.month)}
              sx={{ width: 'auto', minWidth: 66 }}
            >
              {registered ? '登録済み' : '登録'}
            </Button>
            <IconButton aria-label={`${template.title}を編集`} onClick={() => setTemplateDraft(editTemplate(template))}><EditRoundedIcon /></IconButton>
            <IconButton aria-label={`${template.title}を削除`} onClick={() => setPendingTemplateDelete(template)}><DeleteOutlineRoundedIcon /></IconButton>
          </Stack>
        </Box>
      })}
    </Card>
    <Button variant="outline" startIcon={<AddRoundedIcon />} sx={{ mt: 1.5 }} onClick={() => setTemplateDraft(emptyTemplate())}>定期項目を追加</Button>

    <SectionHeader>{s.month.month}月の予算</SectionHeader>
    <Card>
      <BudgetRow label="月全体" budget={overall} spent={s.summary.expenseTotal} onEdit={() => setBudgetDraft({ category: '', amountYen: String(overall?.amountYen ?? '') })} onDelete={setPendingBudgetDelete} />
      {monthBudgets.filter((budget) => budget.category).map((budget) => <Box key={budget.id}><Divider /><BudgetRow label={budget.category} budget={budget} spent={s.summary.categoryTotals.find((item) => item.name === budget.category)?.total ?? 0} onEdit={() => setBudgetDraft({ category: budget.category, amountYen: String(budget.amountYen) })} onDelete={setPendingBudgetDelete} /></Box>)}
    </Card>
    <Button variant="outline" startIcon={<AddRoundedIcon />} sx={{ mt: 1.5 }} onClick={() => setBudgetDraft({ category: '', amountYen: '' })}>予算を設定</Button>

    {templateDraft && <RecurringModal draft={templateDraft} onChange={setTemplateDraft} onClose={() => setTemplateDraft(null)} onSave={async () => { if (await s.saveRecurringTemplate(templateDraft)) setTemplateDraft(null) }} />}
    {budgetDraft && <Modal title={`${s.month.month}月の予算を設定`} onClose={() => setBudgetDraft(null)}><Stack spacing={2}><FormControl fullWidth><InputLabel>対象</InputLabel><Select label="対象" value={budgetDraft.category} onChange={(event) => setBudgetDraft({ ...budgetDraft, category: event.target.value })}><MenuItem value="">月全体</MenuItem>{s.categories.map((category) => <MenuItem key={category.id} value={category.name}>{category.name}</MenuItem>)}</Select></FormControl><Field label="予算額（円）" inputMode="numeric" value={budgetDraft.amountYen} onChange={(event) => setBudgetDraft({ ...budgetDraft, amountYen: event.target.value.replace(/[^0-9]/g, '') })} /><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setBudgetDraft(null)}>キャンセル</Button><Button onClick={async () => { if (await s.saveBudget(monthKey, budgetDraft.category, Number(budgetDraft.amountYen))) setBudgetDraft(null) }}>保存</Button></Stack></Stack></Modal>}
    {pendingTemplateDelete && <Modal title="定期項目を削除しますか？" onClose={() => setPendingTemplateDelete(null)}><Typography color="text.secondary">「{pendingTemplateDelete.title}」を削除します。登録済みの明細は残ります。</Typography><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setPendingTemplateDelete(null)}>キャンセル</Button><Button color="#D32F2F" onClick={async () => { await s.deleteRecurringTemplate(pendingTemplateDelete); setPendingTemplateDelete(null) }}>削除</Button></Stack></Modal>}
    {pendingBudgetDelete && <Modal title="予算を削除しますか？" onClose={() => setPendingBudgetDelete(null)}><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingBudgetDelete(null)}>キャンセル</Button><Button color="#D32F2F" onClick={async () => { await s.deleteBudget(pendingBudgetDelete); setPendingBudgetDelete(null) }}>削除</Button></Stack></Modal>}
  </>
}

function BudgetRow({ label, budget, spent, onEdit, onDelete }: { label: string; budget?: Budget; spent: number; onEdit: () => void; onDelete: (budget: Budget) => void }) {
  const remaining = (budget?.amountYen ?? 0) - spent
  const progress = budget ? Math.min(100, (spent / budget.amountYen) * 100) : 0
  return <Box sx={{ px: 2, py: 1.5 }}>
    <Stack direction="row" alignItems="center" spacing={1}><Box sx={{ flex: 1 }}><Typography fontWeight={700}>{label}</Typography>{budget ? <><Typography variant="body2" color={remaining >= 0 ? 'success.main' : 'error.main'}>残り {yen(remaining)}（{yen(spent)} / {yen(budget.amountYen)}）</Typography><LinearProgress variant="determinate" value={progress} color={remaining >= 0 ? 'primary' : 'error'} sx={{ mt: 1, height: 7, borderRadius: 4 }} /></> : <Typography variant="body2" color="text.secondary">未設定 ・ 支出 {yen(spent)}</Typography>}</Box><IconButton aria-label={`${label}の予算を設定`} onClick={onEdit}><EditRoundedIcon /></IconButton>{budget && <IconButton aria-label={`${label}の予算を削除`} onClick={() => onDelete(budget)}><DeleteOutlineRoundedIcon /></IconButton>}</Stack>
  </Box>
}

function RecurringModal({ draft, onChange, onClose, onSave }: { draft: RecurringTemplateDraft; onChange: (draft: RecurringTemplateDraft) => void; onClose: () => void; onSave: () => Promise<void> }) {
  const s = useStore()
  const patch = (value: Partial<RecurringTemplateDraft>) => onChange({ ...draft, ...value })
  return <Modal title={draft.editingId ? '定期項目を編集' : '定期項目を追加'} onClose={onClose}><Stack spacing={2}><Stack direction="row" spacing={1}><Button variant={draft.type === TYPE_EXPENSE ? 'primary' : 'outline'} onClick={() => patch({ type: TYPE_EXPENSE })}>支出</Button><Button variant={draft.type === TYPE_INCOME ? 'primary' : 'outline'} onClick={() => patch({ type: TYPE_INCOME })}>収入</Button></Stack><Field label="名前" value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="例: 家賃" /><Field label="金額（円）" inputMode="numeric" value={draft.amountYen} onChange={(event) => patch({ amountYen: event.target.value.replace(/[^0-9]/g, '') })} /><FormControl fullWidth><InputLabel>毎月の登録日</InputLabel><Select label="毎月の登録日" value={draft.dayOfMonth} onChange={(event) => patch({ dayOfMonth: Number(event.target.value) })}>{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <MenuItem key={day} value={day}>{day}日</MenuItem>)}</Select></FormControl><FormControl fullWidth><InputLabel>品目</InputLabel><Select label="品目" value={draft.category} onChange={(event) => patch({ category: event.target.value })}>{s.categories.map((category) => <MenuItem key={category.id} value={category.name}>{category.name}</MenuItem>)}</Select></FormControl>{draft.type === TYPE_EXPENSE && <FormControl fullWidth><InputLabel>決済方法</InputLabel><Select label="決済方法" value={draft.paymentMethodId} onChange={(event) => patch({ paymentMethodId: event.target.value })}>{s.paymentMethods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>)}</Select></FormControl>}<FormControlLabel control={<Checkbox checked={draft.active} onChange={(event) => patch({ active: event.target.checked })} />} label="毎月の候補に表示する" /><Typography variant="caption" color="text.secondary">自動では明細を作らず、ホームで「登録」を押した月だけ追加します。</Typography><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={onClose}>キャンセル</Button><Button onClick={() => void onSave()}>保存</Button></Stack></Stack></Modal>
}
