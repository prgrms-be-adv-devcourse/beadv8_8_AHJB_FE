/** 판매 수수료율 10% */
export const FEE_RATE = 0.1

/** 낙찰가 기준 수수료 (원 단위 내림) */
export const feeOf = (winningPrice: number) => Math.floor(winningPrice * FEE_RATE)

/** 구매확정일 기준 정산 지급일: 다음 달 15일 */
export function payoutDateOf(confirmedAt: Date): Date {
  return new Date(confirmedAt.getFullYear(), confirmedAt.getMonth() + 1, 15)
}
