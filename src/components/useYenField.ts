import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { normalizeYenInput, parseYenAmount } from '../entries/amount'

export function useYenField(value: string, onChange: (value: string) => void, { max = Number.MAX_SAFE_INTEGER, refundHint = false } = {}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rejectedValue, setRejectedValue] = useState<string | null>(null)
  const result = parseYenAmount(value, max)
  const reason = result.error
  const refund = reason === 'negative' && refundHint
  const error = Boolean(reason && (refund || rejectedValue === value))
  const messages = {
    empty: '金額を入力してください。',
    negative: refund ? '返金は、履歴の明細から「返金を記録」で登録できます。' : '金額は1円以上で入力してください。',
    format: '金額は円単位の整数で入力してください。',
    zero: '金額は1円以上で入力してください。',
    limit: `金額は${max.toLocaleString('ja-JP')}円以下で入力してください。`,
  }

  const change = (next: string) => {
    setRejectedValue(null)
    onChange(normalizeYenInput(next))
  }

  return {
    validate() {
      if (result.amount !== undefined) return result.amount
      setRejectedValue(value)
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ block: 'nearest' })
      return undefined
    },
    field: {
      value,
      inputRef,
      inputMode: 'numeric' as const,
      error,
      helperText: error && reason ? messages[reason] : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
      onCalculate: change,
    },
  }
}
