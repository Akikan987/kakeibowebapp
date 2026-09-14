/**
 * 支出総額を、本人と追加済みメンバーで均等に分ける。
 * 割り切れない端数は本人の負担に残すため、ここでは他の人の金額だけを返す。
 */
export function equalSplitAmounts(totalAmountYen: number, otherMemberCount: number): number[] {
  if (!Number.isInteger(totalAmountYen) || totalAmountYen <= 0) return []
  if (!Number.isInteger(otherMemberCount) || otherMemberCount <= 0) return []

  const amountPerPerson = Math.floor(totalAmountYen / (otherMemberCount + 1))
  if (amountPerPerson <= 0) return []
  return Array.from({ length: otherMemberCount }, () => amountPerPerson)
}
