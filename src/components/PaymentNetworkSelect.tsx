import { useMemo, useRef, useState } from 'react'
import { Autocomplete, Chip, TextField } from '@mui/material'
import {
  MAX_PAYMENT_NETWORK_LENGTH,
  MAX_PAYMENT_NETWORKS,
  PAYMENT_NETWORKS,
  paymentNetworkKey,
  paymentNetworkLabel,
  type PaymentNetwork,
} from '../paymentNetworks'

type Props = {
  value: PaymentNetwork[]
  options?: PaymentNetwork[]
  onChange: (value: PaymentNetwork[]) => void
}

export function PaymentNetworkSelect({ value, options = [], onChange }: Props) {
  const [inputValue, setInputValue] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const limitLength = (text: string) => Array.from(text).slice(0, MAX_PAYMENT_NETWORK_LENGTH).join('')
  const choices = useMemo(() => {
    const seen = new Set<string>()
    return [...PAYMENT_NETWORKS, ...options, ...value].filter((item) => {
      const key = paymentNetworkKey(item)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [options, value])

  const commit = (raw: string) => {
    const replaceIndex = editingKey === null ? -1 : value.findIndex((item) => paymentNetworkKey(item) === editingKey)
    const next = limitLength(raw.trim())
    if (!next) {
      setInputValue('')
      setEditingKey(null)
      return
    }
    const current = [...value]
    const duplicateIndex = current.findIndex((item, index) => index !== replaceIndex && paymentNetworkKey(item) === paymentNetworkKey(next))
    if (replaceIndex >= 0 && replaceIndex < current.length) {
      if (duplicateIndex === -1) current[replaceIndex] = next
    } else if (duplicateIndex === -1 && current.length < MAX_PAYMENT_NETWORKS) {
      current.push(next)
    }
    onChange(current)
    setInputValue('')
    setEditingKey(null)
  }

  return <Autocomplete<PaymentNetwork, true, false, true>
    multiple
    freeSolo
    forcePopupIcon
    openOnFocus
    options={choices}
    value={value}
    inputValue={inputValue}
    getOptionLabel={(option) => paymentNetworkLabel(String(option))}
    isOptionEqualToValue={(option, selected) => paymentNetworkKey(option) === paymentNetworkKey(selected)}
    filterSelectedOptions
    onInputChange={(_, next, reason) => { if (reason !== 'reset') setInputValue(limitLength(next)) }}
    onChange={(_, nextValues, reason, details) => {
      if (reason === 'removeOption' || reason === 'clear') {
        onChange(nextValues as PaymentNetwork[])
        setEditingKey(null)
        setInputValue('')
        return
      }
      const selected = details?.option
      if (typeof selected === 'string' && selected.trim()) commit(selected)
    }}
    renderTags={(tagValues, getTagProps) => tagValues.map((tag, index) => {
      const { key, ...tagProps } = getTagProps({ index })
      return <Chip
        {...tagProps}
        key={key}
        label={paymentNetworkLabel(tag)}
        onClick={() => {
          setEditingKey(paymentNetworkKey(tag))
          setInputValue(tag)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        sx={{ maxWidth: 'calc(100% - 6px)', height: 'auto', minHeight: 32, '& .MuiChip-label': { overflowWrap: 'anywhere', whiteSpace: 'normal', py: 0.5 } }}
      />
    })}
    renderInput={(params) => <TextField
      {...params}
      inputRef={inputRef}
      label="支払方式（任意・複数選択）"
      placeholder={value.length >= MAX_PAYMENT_NETWORKS ? '上限に達しています' : '例: QUICPay、Suica'}
      onBlur={() => { if (inputValue.trim()) commit(inputValue); else setEditingKey(null) }}
      helperText={`選択、または入力して Enter で追加。選んだ名前を押すと編集できます（最大${MAX_PAYMENT_NETWORKS}件・各${MAX_PAYMENT_NETWORK_LENGTH}文字）。同じ方式を複数カードに登録すると自動選択しません。`}
      sx={{ '& .MuiInputBase-root': { flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }, '& .MuiAutocomplete-tag': { maxWidth: '100%' } }}
    />}
  />
}
