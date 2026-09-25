/** Small decimal/rational parser. Never evaluates JavaScript or rounds intermediate amounts. */
export type Rounding = 'nearest' | 'floor' | 'ceil'
type Fraction = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a
function fraction(n: bigint, d = 1n): Fraction {
  if (!d) throw new Error('0では割れません')
  if (d < 0n) { n = -n; d = -d }
  const divisor = gcd(n < 0n ? -n : n, d)
  n /= divisor; d /= divisor
  if (n.toString().length > 80 || d.toString().length > 80) throw new Error('計算が大きすぎます')
  return { n, d }
}

export function calculateYen(input: string, rounding: Rounding = 'nearest') {
  const text = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '')
  if (!text || text.length > 160 || /[^0-9.+*/()-]/.test(text)) throw new Error('数字と四則演算・括弧で入力してください')
  let index = 0
  const atom = (): Fraction => {
    if (text[index] === '+' || text[index] === '-') {
      const negative = text[index++] === '-'; const value = atom()
      return negative ? { ...value, n: -value.n } : value
    }
    if (text[index] === '(') {
      index++; const value = sum()
      if (text[index++] !== ')') throw new Error('括弧を閉じてください')
      return value
    }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(index))
    if (!match) throw new Error('式を最後まで入力してください')
    index += match[0].length
    const [whole, decimals = ''] = match[0].split('.')
    return fraction(BigInt((whole || '0') + decimals), 10n ** BigInt(decimals.length))
  }
  const product = (): Fraction => {
    let left = atom()
    while (text[index] === '*' || text[index] === '/') {
      const operator = text[index++]; const right = atom()
      left = operator === '*' ? fraction(left.n * right.n, left.d * right.d) : fraction(left.n * right.d, left.d * right.n)
    }
    return left
  }
  const sum = (): Fraction => {
    let left = product()
    while (text[index] === '+' || text[index] === '-') {
      const operator = text[index++]; const right = product()
      left = fraction(left.n * right.d + (operator === '+' ? 1n : -1n) * right.n * left.d, left.d * right.d)
    }
    return left
  }
  const value = sum()
  if (index !== text.length) throw new Error('式を確認してください')
  const exact = value.n % value.d === 0n
  const floor = value.n / value.d - (value.n < 0n && !exact ? 1n : 0n)
  const ceil = exact ? floor : floor + 1n
  const rounded = rounding === 'floor' ? floor : rounding === 'ceil' ? ceil : value.n - floor * value.d >= (value.d + 1n) / 2n ? ceil : floor
  if (rounded > 2_000_000_000n || rounded < -2_000_000_000n) throw new Error('入力できる金額は±20億円までです')
  return { amount: String(rounded), exact, preview: exact ? String(value.n / value.d) : (Number(value.n) / Number(value.d)).toLocaleString('ja-JP', { maximumSignificantDigits: 12 }) }
}
