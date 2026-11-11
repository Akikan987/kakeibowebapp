import { useRef, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { Button, Card, Divider, Field, Modal, SectionHeader, yen } from './ui'
import { useYenField } from './useYenField'
import { DEFAULT_CASH_METHOD_ID } from '../db'
import { useStore, type RecurringTemplateDraft } from '../store'
import { listCategoryNames } from '../domain/categories'
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
    category: '',
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
    <SectionHeader>{s.month.month}月の定期項目</SectionHeader>
    <Card>
      {s.recurringTemplates.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>家賃・給与・サブスクなどを登録すると、毎月確認して明細へ追加できます。</Typography>
      ) : s.recurringTemplates.map((template, index) => {
        const registered = s.recurringRegistered(template.id, s.month.year, s.month.month)
        return <Box key={template.id}>
          {index > 0 && <Divider />}
          <Stack spacing={1.5} sx={{ p: 3 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={600}>{template.title}</Typography>
              <Typography variant="caption" color="text.secondary">毎月{template.dayOfMonth}日 ・ {template.type === TYPE_INCOME ? '収入' : template.category} ・ {yen(template.amountYen)}{!template.active && ' ・ 停止中'}</Typography>
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
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
    {budgetDraft && <BudgetModal
      month={s.month.month}
      draft={budgetDraft}
      onChange={setBudgetDraft}
      onClose={() => setBudgetDraft(null)}
      onSave={async (amount) => {
        if (await s.saveBudget(monthKey, budgetDraft.category, amount)) setBudgetDraft(null)
      }}
    />}
    {pendingTemplateDelete && <Modal title="定期項目を削除しますか？" onClose={() => setPendingTemplateDelete(null)}><Typography color="text.secondary">「{pendingTemplateDelete.title}」を削除します。登録済みの明細は残ります。</Typography><Stack direction="row" spacing={1.5} sx={{ mt: 3 }}><Button variant="outline" onClick={() => setPendingTemplateDelete(null)}>キャンセル</Button><Button color="#D32F2F" onClick={async () => { await s.deleteRecurringTemplate(pendingTemplateDelete); setPendingTemplateDelete(null) }}>削除</Button></Stack></Modal>}
    {pendingBudgetDelete && <Modal title={`${pendingBudgetDelete.category || '月全体'}の予算（${yen(pendingBudgetDelete.amountYen)}）を削除しますか？`} onClose={() => setPendingBudgetDelete(null)}><Stack direction="row" spacing={1.5}><Button variant="outline" onClick={() => setPendingBudgetDelete(null)}>キャンセル</Button><Button color="#D32F2F" onClick={async () => { await s.deleteBudget(pendingBudgetDelete); setPendingBudgetDelete(null) }}>削除</Button></Stack></Modal>}
  </>
}

function BudgetRow({ label, budget, spent, onEdit, onDelete }: { label: string; budget?: Budget; spent: number; onEdit: () => void; onDelete: (budget: Budget) => void }) {
  const remaining = (budget?.amountYen ?? 0) - spent
  const progress = budget ? Math.min(100, (spent / budget.amountYen) * 100) : 0
  return <Box sx={{ p: 3 }}>
    <Typography fontWeight={600}>{label}</Typography>
    {budget ? <><Typography variant="h6" color={remaining >= 0 ? 'text.primary' : 'error.main'} sx={{ mt: 1 }}>{remaining >= 0 ? `残り ${yen(remaining)}` : `${yen(-remaining)} 超過`}</Typography><Typography variant="body2" color="text.secondary">使用 {yen(spent)} / 予算 {yen(budget.amountYen)}</Typography><LinearProgress variant="determinate" value={progress} color={remaining >= 0 ? 'primary' : 'error'} sx={{ mt: 2, height: 6, borderRadius: '3px' }} /></> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>未設定 ・ 支出 {yen(spent)}</Typography>}
    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}><IconButton aria-label={`${label}の予算を設定`} onClick={onEdit}><EditRoundedIcon fontSize="small" /></IconButton>{budget && <IconButton aria-label={`${label}の予算を削除`} onClick={() => onDelete(budget)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>}</Stack>
  </Box>
}

function BudgetModal({ month, draft, onChange, onClose, onSave }: {
  month: number
  draft: { category: string; amountYen: string }
  onChange: (draft: { category: string; amountYen: string }) => void
  onClose: () => void
  onSave: (amount: number) => Promise<void>
}) {
  const s = useStore()
  const amountField = useYenField(draft.amountYen, (amountYen) => onChange({ ...draft, amountYen }))
  return <Modal title={`${month}月の予算を設定`} onClose={onClose}>
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel id="budget-category-label" shrink>対象</InputLabel>
        <Select id="budget-category" labelId="budget-category-label" displayEmpty label="対象" value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>
          <MenuItem value="">月全体</MenuItem>
          {[...new Set([...s.categories.map((category) => category.name), draft.category])].filter(Boolean).map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </Select>
      </FormControl>
      <Field label="予算額（円）" {...amountField.field} />
      <Stack direction="row" spacing={1.5}>
        <Button variant="outline" onClick={onClose}>キャンセル</Button>
        <Button onClick={() => {
          const amount = amountField.validate()
          if (amount !== undefined) void onSave(amount)
        }}>保存</Button>
      </Stack>
    </Stack>
  </Modal>
}

function RecurringModal({ draft, onChange, onClose, onSave }: { draft: RecurringTemplateDraft; onChange: (draft: RecurringTemplateDraft) => void; onClose: () => void; onSave: () => Promise<void> }) {
  const s = useStore()
  const [categoryError, setCategoryError] = useState(false)
  const categoryControlRef = useRef<HTMLDivElement>(null)
  const categoryInputRef = useRef<{ focus: () => void }>(null)
  const categoryNames = listCategoryNames(s.categories, draft.type, draft.category)
  const patch = (value: Partial<RecurringTemplateDraft>) => onChange({ ...draft, ...value })
  const amountField = useYenField(draft.amountYen, (amountYen) => patch({ amountYen }))
  const save = () => {
    if (amountField.validate() === undefined) return
    setCategoryError(!draft.category)
    if (!draft.category) {
      categoryControlRef.current?.scrollIntoView({ block: 'center' })
      categoryInputRef.current?.focus()
      return
    }
    void onSave()
  }
  const changeType = (type: string) => {
    if (draft.type !== type) patch({ type, category: '' })
  }
  return <Modal title={draft.editingId ? '定期項目を編集' : '定期項目を追加'} onClose={onClose}>
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button variant={draft.type === TYPE_EXPENSE ? 'primary' : 'outline'} onClick={() => changeType(TYPE_EXPENSE)}>支出</Button>
        <Button variant={draft.type === TYPE_INCOME ? 'primary' : 'outline'} onClick={() => changeType(TYPE_INCOME)}>収入</Button>
      </Stack>
      <Field label="名前" value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="例: 家賃" />
      <Field label="金額（円）" {...amountField.field} />
      <FormControl fullWidth>
        <InputLabel>毎月の登録日</InputLabel>
        <Select label="毎月の登録日" value={draft.dayOfMonth} onChange={(event) => patch({ dayOfMonth: Number(event.target.value) })}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <MenuItem key={day} value={day}>{day}日</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl ref={categoryControlRef} fullWidth required error={categoryError && !draft.category}>
        <InputLabel id="recurring-category-label" shrink>品目</InputLabel>
        <Select id="recurring-category" labelId="recurring-category-label" inputRef={categoryInputRef} displayEmpty label="品目" value={draft.category} onChange={(event) => patch({ category: event.target.value })}>
          <MenuItem value="" disabled>未選択</MenuItem>
          {categoryNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </Select>
        {categoryError && !draft.category && <FormHelperText>品目を選んでください</FormHelperText>}
      </FormControl>
      {draft.type === TYPE_EXPENSE && <FormControl fullWidth>
        <InputLabel>決済方法</InputLabel>
        <Select label="決済方法" value={draft.paymentMethodId} onChange={(event) => patch({ paymentMethodId: event.target.value })}>
          {s.paymentMethods.map((method) => <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>)}
        </Select>
      </FormControl>}
      <FormControlLabel control={<Checkbox checked={draft.active} onChange={(event) => patch({ active: event.target.checked })} />} label="毎月の候補に表示する" />
      <Typography variant="caption" color="text.secondary">自動では明細を作らず、予算画面で「登録」を押した月だけ追加します。</Typography>
      <Stack direction="row" spacing={1.5}>
        <Button variant="outline" onClick={onClose}>キャンセル</Button>
        <Button onClick={save}>保存</Button>
      </Stack>
    </Stack>
  </Modal>
}
