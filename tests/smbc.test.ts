import assert from 'node:assert/strict'
import test from 'node:test'
import { matchSmbcPayment, parseSmbcMessage, type FinancialMessageInput } from '../src/imports/smbc.ts'
import type { PaymentMethod } from '../src/types.ts'

const debitSender = 'smbc-debit@smbc-card.com'
const usageBody = (changes: { date?: string; merchant?: string; amount?: string; mode?: string; extra?: string } = {}) =>
  `いつもOliveフレキシブルペイをご利用いただきありがとうございます。${changes.mode ?? 'デビットモード'}のご利用内容です。\n◇利用日 ： ${changes.date ?? '2026/04/12 13:24:50'} ◇利用先 ： ${changes.merchant ?? 'Sample Market'} ◇利用金額 ： ${changes.amount ?? '1,280円'} ◇承認番号 ： 654321\n${changes.extra ?? 'カード利用通知は速報です。後日の取消等で内容が変更される場合があります。なお手数料110円の記載は別項目です。'}`
const email = (text: string, changes: Partial<FinancialMessageInput> = {}): FinancialMessageInput => ({
  text,
  subject: 'ご利用のお知らせ【三井住友カード】',
  sender: debitSender,
  source: 'email',
  ...changes,
})
const paymentMethod = (id: string, type: PaymentMethod['type'], lastFour: string): PaymentMethod => ({
  id, name: id, type, cardLastFour: lastFour, closingDay: type === 'credit' ? 31 : 0,
  paymentDay: type === 'credit' ? 27 : 0, updatedAt: 0, deleted: false,
})

test('labels parse the sample-shaped debit notice and ignore approval number and unlabeled fee', () => {
  const parsed = parseSmbcMessage(email(usageBody()))
  assert.equal(parsed.kind, 'card_usage')
  assert.equal(parsed.provider, 'smbc_card')
  assert.equal(parsed.paymentType, 'debit')
  assert.equal(parsed.merchant, 'Sample Market')
  assert.equal(parsed.amountYen, 1280)
  assert.equal(parsed.purchasedAtMillis, Date.UTC(2026, 3, 12, 4, 24, 50))
  assert.equal(parsed.cardLastFour, '')
  assert.match(parsed.warnings.join(' '), /末尾4桁/u)
})

test('full screenshot-shaped explanatory footer does not create duplicate fields or change the transaction mode', () => {
  const footer = [
    '※利用日は日本標準時刻になります。',
    '※利用先は実際の店舗名と異なる場合がございます。',
    '※海外ATMでの現地通貨の引き出しは上記金額にATM利用手数料110円を加えて引き落とし致します。',
    '※カードご利用の承認照会があった場合に通知されるサービスであり、カードのご利用及びご請求を確定するものではありません。',
    '※為替等の影響によりご利用明細から変更があった場合は、再度メールにてご連絡致します。',
    '※iDでのお支払い時は常にデビットモードになります。',
  ].join('\n')
  const parsed = parseSmbcMessage(email(`${usageBody({ extra: '' })}\n${footer}`))
  assert.equal(parsed.kind, 'card_usage')
  assert.equal(parsed.paymentType, 'debit')
  assert.equal(parsed.amountYen, 1280)
  assert.equal(parsed.merchant, 'Sample Market')

  const footerOnlyMode = parseSmbcMessage(email(usageBody({ mode: 'カードご利用内容をお知らせします。', extra: footer })))
  assert.equal(footerOnlyMode.paymentType, 'unknown')
})

test('NFKC normalizes full-width labels, digits and punctuation while preserving line boundaries', () => {
  const parsed = parseSmbcMessage(email('Ｏｌｉｖｅフレキシブルペイ デビットモード\n◇利用日：２０２６／０４／１２ １３：２４ ◇利用先：ＡＢＣ商店 ◇利用金額：９８０円'))
  assert.equal(parsed.kind, 'card_usage')
  assert.equal(parsed.amountYen, 980)
  assert.equal(parsed.merchant, 'ABC商店')
  assert.equal(parsed.purchasedAtMillis, Date.UTC(2026, 3, 12, 4, 24))
})

test('an approval number is never mistaken for a card last four', () => {
  const parsed = parseSmbcMessage(email(usageBody({ extra: '◇承認番号：0123' })))
  assert.equal(parsed.cardLastFour, '')
  assert.equal(matchSmbcPayment(parsed, [paymentMethod('debit', 'debit', '0123')]).id, '')
})

test('debit and credit modes remain distinct and Olive alone does not imply debit', () => {
  const debit = parseSmbcMessage(email(usageBody()))
  const credit = parseSmbcMessage(email(usageBody({ mode: 'クレジットカードでのお支払い（クレジットモード）' }), { sender: undefined }))
  const oliveOnly = parseSmbcMessage(email(usageBody({ mode: 'Oliveフレキシブルペイをご利用' }), { sender: undefined }))
  assert.equal(debit.paymentType, 'debit')
  assert.equal(credit.paymentType, 'credit')
  assert.equal(oliveOnly.paymentType, 'unknown')
  assert.equal(matchSmbcPayment(credit, [paymentMethod('debit', 'debit', '1234')]).id, '')
})

test('only a unique exact last-four and type match selects a payment method', () => {
  const parsed = parseSmbcMessage(email(usageBody({ extra: '◇カード末尾：0123' })))
  assert.equal(parsed.cardLastFour, '0123')
  assert.equal(matchSmbcPayment(parsed, [paymentMethod('debit', 'debit', '0123')]).id, 'debit')
  assert.equal(matchSmbcPayment(parsed, [paymentMethod('credit', 'credit', '0123')]).id, '')
  assert.equal(matchSmbcPayment(parsed, [paymentMethod('one', 'debit', '0123'), paymentMethod('two', 'debit', '0123')]).id, '')
  assert.equal(matchSmbcPayment(parsed, [{ ...paymentMethod('deleted', 'debit', '0123'), deleted: true }]).id, '')
})

test('date parsing applies JST offset and rejects invalid or duplicate dates', () => {
  const leap = parseSmbcMessage(email(usageBody({ date: '2024年2月29日 00:05:09' })))
  const badLeap = parseSmbcMessage(email(usageBody({ date: '2025/02/29 00:05:09' })))
  const duplicate = parseSmbcMessage(email(`${usageBody()}\n◇利用日：2026/04/13 13:00`))
  assert.equal(leap.purchasedAtMillis, Date.UTC(2024, 1, 28, 15, 5, 9))
  assert.equal(badLeap.kind, 'unsupported')
  assert.equal(badLeap.purchasedAtMillis, null)
  assert.equal(duplicate.kind, 'unsupported')
})

test('conflicting or multiple labeled values are not resolved by taking the first', () => {
  const duplicateAmount = parseSmbcMessage(email(`${usageBody()}\n◇利用金額：2,000円`))
  const conflictingMerchant = parseSmbcMessage(email(`${usageBody()}\n◇利用先：別店舗`))
  const malformed = parseSmbcMessage(email(usageBody({ amount: '-980円' })))
  const excessive = parseSmbcMessage(email(usageBody({ amount: '2,000,000,001円' })))
  assert.equal(duplicateAmount.kind, 'unsupported')
  assert.equal(conflictingMerchant.kind, 'unsupported')
  assert.equal(malformed.kind, 'unsupported')
  assert.equal(excessive.kind, 'unsupported')
})

test('rejects absent labels, absent brand, sender mismatch, and oversized input', () => {
  assert.equal(parseSmbcMessage(email('三井住友カード Olive')).kind, 'unsupported')
  const unverified = parseSmbcMessage(email(usageBody(), { subject: 'お知らせ', sender: undefined }))
  assert.equal(unverified.kind, 'card_usage')
  assert.match(unverified.warnings.join(' '), /送信元を確認できない/u)
  assert.equal(parseSmbcMessage(email(usageBody(), { sender: 'display name <smbc-debit@smbc-card.com>' })).kind, 'unsupported')
  assert.equal(parseSmbcMessage(email('三井住友カード ' + 'x'.repeat(32_001))).kind, 'unsupported')
})

test('classifies bills, bank notices, cancellations, refunds, and authentication messages separately', () => {
  const bill = parseSmbcMessage(email('三井住友カード ご請求額：18,000円'))
  const bank = parseSmbcMessage({ text: '三井住友銀行 ATM出金のお知らせ', source: 'notification', packageName: 'jp.co.smbc.direct' })
  const wrongApp = parseSmbcMessage({ text: usageBody(), source: 'notification', packageName: 'untrusted.app' })
  const cancel = parseSmbcMessage(email('三井住友カード ご利用分の取消のお知らせ'))
  const refund = parseSmbcMessage(email('三井住友カード ご返金のお知らせ'))
  const auth = parseSmbcMessage(email('三井住友カード 認証コード：123456'))
  assert.equal(bill.kind, 'card_bill')
  assert.equal(bank.kind, 'bank_notice')
  assert.equal(bank.provider, 'smbc_bank')
  assert.equal(wrongApp.kind, 'unsupported')
  assert.equal(cancel.kind, 'unsupported')
  assert.equal(refund.kind, 'unsupported')
  assert.equal(auth.kind, 'unsupported')
})

test('does not treat a normal usage notice cancellation disclaimer as a cancellation notice', () => {
  assert.equal(parseSmbcMessage(email(usageBody())).kind, 'card_usage')
})
