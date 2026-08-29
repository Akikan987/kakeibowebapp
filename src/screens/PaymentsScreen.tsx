import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Divider,
  Field,
  LargeTitle,
  Modal,
  SectionHeader,
  fromLocalInput,
  toLocalInput,
  yen,
} from '../components/ui'
import { CARD_PRESETS, findCardPresets, type CardPreset } from '../cardPresets'
import { DEFAULT_CASH_METHOD_ID, DEFAULT_OTHER_METHOD_ID } from '../db'
import {
  type PaymentMethodDraft,
  type PrepaidChargeDraft,
  useStore,
} from '../store'
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  now,
  type PaymentMethod,
  type PrepaidCharge,
} from '../types'

const selectClass =
  'w-full rounded-xl border border-ios-sep bg-white px-3 py-2.5 outline-none focus:border-ios-blue'

const emptyMethod = (): PaymentMethodDraft => ({
  editingId: null,
  name: '',
  type: 'credit',
  closingDay: 31,
  paymentDay: 27,
})

const emptyCharge = (prepaidMethodId: string): PrepaidChargeDraft => ({
  prepaidMethodId,
  fundingMethodId: '',
  amountYen: '',
  chargedAtMillis: now(),
  note: '',
})

const dayLabel = (day: number) => (day === 31 ? '月末' : `${day}日`)
const fullDate = (millis: number) =>
  new Date(millis).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

export function PaymentsScreen() {
  const s = useStore()
  const [methodDraft, setMethodDraft] = useState<PaymentMethodDraft | null>(null)
  const [chargeDraft, setChargeDraft] = useState<PrepaidChargeDraft | null>(null)
  const [pendingMethodDelete, setPendingMethodDelete] =
    useState<PaymentMethod | null>(null)
  const [pendingChargeDelete, setPendingChargeDelete] =
    useState<PrepaidCharge | null>(null)

  const upcomingWithdrawals = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(1)
    return s.cardWithdrawals
      .filter((item) => item.withdrawalAtMillis >= start.getTime())
      .slice(0, 12)
  }, [s.cardWithdrawals])

  const prepaidMethods = s.paymentMethods.filter(
    (method) => method.type === 'prepaid',
  )

  const editMethod = (method: PaymentMethod) =>
    setMethodDraft({
      editingId: method.id,
      name: method.name,
      type: method.type,
      closingDay: method.closingDay || 31,
      paymentDay: method.paymentDay || 27,
    })

  return (
    <div className="pb-6">
      <LargeTitle>決済</LargeTitle>

      <SectionHeader>カードの引き落とし予定</SectionHeader>
      <Card>
        {upcomingWithdrawals.length === 0 ? (
          <p className="p-4 text-sm text-ios-label2">
            クレジットカードを登録して支出に指定すると、締め日から引き落とし予定額を計算します。
          </p>
        ) : (
          upcomingWithdrawals.map((item, index) => (
            <div key={`${item.methodId}:${item.withdrawalAtMillis}`}>
              {index > 0 && <Divider />}
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.methodName}</div>
                    <div className="text-[13px] text-ios-label2">
                      {fullDate(item.withdrawalAtMillis)}予定 ・{' '}
                      {dayLabel(item.closingDay)}締め
                    </div>
                  </div>
                  <span className="font-semibold text-ios-red">
                    {yen(item.amountYen)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ios-label2">
                  カード利用 {yen(item.expenseAmountYen)}
                  {item.chargeAmountYen > 0 && (
                    <> ・ プリペイドチャージ {yen(item.chargeAmountYen)}</>
                  )}{' '}
                  ・ {item.itemCount}件
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
      <p className="px-5 py-1.5 text-xs text-ios-label2">
        休日による実際の引き落とし日の前後は、カード会社の明細で確認してください。
      </p>

      <SectionHeader>プリペイド残高</SectionHeader>
      <Card>
        {s.prepaidBalances.length === 0 ? (
          <p className="p-4 text-sm text-ios-label2">
            プリペイドを登録すると、チャージと利用から現在残高を表示します。
          </p>
        ) : (
          s.prepaidBalances.map((balance, index) => (
            <div key={balance.methodId}>
              {index > 0 && <Divider />}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{balance.name}</div>
                  <div className="text-xs text-ios-label2">
                    チャージ {yen(balance.charged)} ・ 利用 {yen(balance.spent)}
                  </div>
                </div>
                <span className="font-semibold text-ios-blue">
                  {yen(balance.balance)}
                </span>
                <button
                  className="text-sm text-ios-blue"
                  onClick={() => setChargeDraft(emptyCharge(balance.methodId))}
                >
                  チャージ
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {s.prepaidCharges.length > 0 && (
        <>
          <SectionHeader>チャージ履歴</SectionHeader>
          <Card>
            {s.prepaidCharges.slice(0, 20).map((charge, index) => (
              <div key={charge.id}>
                {index > 0 && <Divider />}
                <div className="flex items-center gap-2 py-2.5 pr-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {s.paymentMethodName(charge.prepaidMethodId)}
                    </div>
                    <div className="text-xs text-ios-label2">
                      {fullDate(charge.chargedAtMillis)} ・{' '}
                      {charge.fundingMethodId
                        ? s.paymentMethodName(charge.fundingMethodId)
                        : '初期残高・残高調整'}
                      {charge.note && ` ・ ${charge.note}`}
                    </div>
                  </div>
                  <span className="font-semibold text-ios-green">
                    +{yen(charge.amountYen)}
                  </span>
                  <button
                    className="px-2 py-2 text-ios-label2"
                    onClick={() => setPendingChargeDelete(charge)}
                    aria-label="チャージ記録を取り消す"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionHeader>決済方法</SectionHeader>
      <Card>
        {s.paymentMethods.map((method, index) => (
          <div key={method.id}>
            {index > 0 && <Divider />}
            <div className="flex items-center gap-2 py-2.5 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{method.name}</div>
                <div className="text-xs text-ios-label2">
                  {PAYMENT_TYPE_LABELS[method.type]}
                  {method.type === 'credit' && (
                    <>
                      {' '}
                      ・ {dayLabel(method.closingDay)}締め ・{' '}
                      {dayLabel(method.paymentDay)}引き落とし
                    </>
                  )}
                </div>
              </div>
              {method.id !== DEFAULT_CASH_METHOD_ID &&
                method.id !== DEFAULT_OTHER_METHOD_ID && (
                  <>
                    <button
                      className="px-2 text-sm text-ios-blue"
                      onClick={() => editMethod(method)}
                    >
                      編集
                    </button>
                    <button
                      className="px-2 py-2 text-ios-label2"
                      onClick={() => setPendingMethodDelete(method)}
                      aria-label="決済方法を削除"
                    >
                      🗑
                    </button>
                  </>
                )}
            </div>
          </div>
        ))}
      </Card>
      <div className="mt-3 px-4">
        <Button variant="outline" onClick={() => setMethodDraft(emptyMethod())}>
          ＋ 決済方法を追加
        </Button>
      </div>
      <p className="px-5 py-2 text-xs text-ios-label2">
        クレジットのカード名を入力すると、公式確認済みの候補から締め日・引き落とし日を補助入力できます。
      </p>

      {methodDraft && (
        <PaymentMethodModal
          draft={methodDraft}
          onChange={setMethodDraft}
          onClose={() => setMethodDraft(null)}
          onSave={async () => {
            if (await s.savePaymentMethod(methodDraft)) setMethodDraft(null)
          }}
        />
      )}

      {chargeDraft && (
        <ChargeModal
          draft={chargeDraft}
          methods={s.paymentMethods}
          prepaidMethods={prepaidMethods}
          onChange={setChargeDraft}
          onClose={() => setChargeDraft(null)}
          onSave={async () => {
            if (await s.recordPrepaidCharge(chargeDraft)) setChargeDraft(null)
          }}
        />
      )}

      {pendingMethodDelete && (
        <Modal
          title="決済方法を削除しますか？"
          onClose={() => setPendingMethodDelete(null)}
        >
          <p className="mb-4 text-sm text-ios-label2">
            「{pendingMethodDelete.name}」を削除します。使用済みの場合は削除できません。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPendingMethodDelete(null)}>
              キャンセル
            </Button>
            <Button
              color="var(--color-ios-red)"
              onClick={async () => {
                await s.deletePaymentMethod(pendingMethodDelete)
                setPendingMethodDelete(null)
              }}
            >
              削除
            </Button>
          </div>
        </Modal>
      )}

      {pendingChargeDelete && (
        <Modal
          title="チャージ記録を取り消しますか？"
          onClose={() => setPendingChargeDelete(null)}
        >
          <p className="mb-4 text-sm text-ios-label2">
            {yen(pendingChargeDelete.amountYen)}のチャージを取り消すと、残高とカード引落予定から除かれます。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPendingChargeDelete(null)}>
              キャンセル
            </Button>
            <Button
              color="var(--color-ios-red)"
              onClick={async () => {
                await s.deletePrepaidCharge(pendingChargeDelete)
                setPendingChargeDelete(null)
              }}
            >
              取り消す
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DaySelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-[13px] text-ios-label2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={selectClass}
      >
        {Array.from({ length: 30 }, (_, index) => index + 1).map((day) => (
          <option key={day} value={day}>
            {day}日
          </option>
        ))}
        <option value={31}>月末</option>
      </select>
    </label>
  )
}

function PaymentMethodModal({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: PaymentMethodDraft
  onChange: (draft: PaymentMethodDraft) => void
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const patch = (value: Partial<PaymentMethodDraft>) =>
    onChange({ ...draft, ...value })
  const trimmedCardName = draft.name.trim()
  const presetCandidates =
    draft.type !== 'credit'
      ? []
      : trimmedCardName.length < 2
        ? CARD_PRESETS
        : findCardPresets(draft.name)
  const selectedPreset = presetCandidates.find(
    (preset) => preset.name === draft.name,
  )
  const applyPreset = (preset: CardPreset) =>
    patch({
      name: preset.name,
      closingDay: preset.closingDay,
      paymentDay: preset.paymentDay,
    })
  return (
    <Modal title={draft.editingId ? '決済方法を編集' : '決済方法を追加'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[13px] text-ios-label2">種類</span>
          <select
            value={draft.type}
            onChange={(e) =>
              patch({ type: e.target.value as PaymentMethodDraft['type'] })
            }
            className={selectClass}
          >
            {PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PAYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={draft.type === 'credit' ? 'カード名' : '名前'}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={draft.type === 'credit' ? '例: 楽天カード' : '例: Suica'}
        />
        {draft.type === 'credit' && (
          <div className="rounded-xl bg-ios-bg px-3 py-2.5">
            <div className="text-xs font-medium text-ios-label2">
              {trimmedCardName.length < 2
                ? '登録済みカードから選ぶ'
                : '公式情報からの入力候補'}
            </div>
            {presetCandidates.length === 0 ? (
              <p className="mt-1 text-xs text-ios-label2">
                登録済みの候補はありません。締め日と引き落とし日を手入力してください。
              </p>
            ) : (
              <div className="mt-1 space-y-2">
                {presetCandidates.map((preset) => (
                  <div key={preset.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{preset.name}</div>
                      <div className="text-xs text-ios-label2">{preset.note}</div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-sm text-ios-blue"
                      onClick={() => applyPreset(preset)}
                    >
                      反映
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {draft.type === 'credit' && (
          <>
            <div className="flex gap-2">
              <DaySelect
                label="締め日"
                value={draft.closingDay}
                onChange={(closingDay) => patch({ closingDay })}
              />
              <DaySelect
                label="引き落とし日"
                value={draft.paymentDay}
                onChange={(paymentDay) => patch({ paymentDay })}
              />
            </div>
            <p className="text-xs text-ios-label2">
              締め日までの利用分を、翌月の引き落とし日として計算します。
            </p>
            {selectedPreset && (
              <p className="text-xs text-ios-label2">
                この候補は公式情報を{selectedPreset.verifiedAt}に確認。保存前に実際のカード明細も確認してください。{' '}
                <a
                  href={selectedPreset.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ios-blue underline"
                >
                  公式情報
                </a>
              </p>
            )}
          </>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={() => void onSave()}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function ChargeModal({
  draft,
  methods,
  prepaidMethods,
  onChange,
  onClose,
  onSave,
}: {
  draft: PrepaidChargeDraft
  methods: PaymentMethod[]
  prepaidMethods: PaymentMethod[]
  onChange: (draft: PrepaidChargeDraft) => void
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const patch = (value: Partial<PrepaidChargeDraft>) =>
    onChange({ ...draft, ...value })
  return (
    <Modal title="プリペイドにチャージ" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[13px] text-ios-label2">チャージ先</span>
          <select
            value={draft.prepaidMethodId}
            onChange={(e) => patch({ prepaidMethodId: e.target.value })}
            className={selectClass}
          >
            {prepaidMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="チャージ額（円）"
          inputMode="numeric"
          value={draft.amountYen}
          onChange={(e) =>
            patch({ amountYen: e.target.value.replace(/[^0-9]/g, '') })
          }
        />
        <Field
          label="チャージ日時"
          type="datetime-local"
          value={toLocalInput(draft.chargedAtMillis)}
          onChange={(e) => patch({ chargedAtMillis: fromLocalInput(e.target.value) })}
        />
        <label className="block">
          <span className="mb-1 block text-[13px] text-ios-label2">
            チャージに使った決済方法
          </span>
          <select
            value={draft.fundingMethodId}
            onChange={(e) => patch({ fundingMethodId: e.target.value })}
            className={selectClass}
          >
            <option value="">初期残高・残高調整（引落に加算しない）</option>
            {methods
              .filter((method) => method.id !== draft.prepaidMethodId)
              .map((method) => (
                <option key={method.id} value={method.id}>
                  [{PAYMENT_TYPE_LABELS[method.type]}] {method.name}
                </option>
              ))}
          </select>
        </label>
        <Field
          label="メモ（任意）"
          value={draft.note}
          onChange={(e) => patch({ note: e.target.value })}
        />
        <p className="text-xs text-ios-label2">
          チャージは支出統計には加えません。クレジットを選ぶと、そのカードの引き落とし予定額に加算します。
        </p>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={() => void onSave()}>記録</Button>
        </div>
      </div>
    </Modal>
  )
}
