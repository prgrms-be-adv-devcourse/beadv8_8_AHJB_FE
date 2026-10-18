/** 현재가 기준 입찰 단위(원) (원본 Td) */
export function bidIncrementOf(price: number): number {
  if (price >= 5_000_000) return 100_000
  if (price >= 1_000_000) return 50_000
  if (price >= 500_000) return 10_000
  if (price >= 100_000) return 5_000
  if (price >= 10_000) return 1_000
  return 500
}

/** 입찰 단위 표 (원본 yo) */
export const BID_INCREMENT_TIERS: Array<{ from: number; unit: number }> = [
  { from: 0, unit: 500 },
  { from: 10_000, unit: 1_000 },
  { from: 100_000, unit: 5_000 },
  { from: 500_000, unit: 10_000 },
  { from: 1_000_000, unit: 50_000 },
  { from: 5_000_000, unit: 100_000 },
]

/**
 * 입찰가 검사 (원본 np). 문제가 없으면 null, 있으면 안내 문구.
 * @param bidPrice 입력한 입찰가 (0 이면 미입력)
 * @param currentPrice 현재가 (단위 계산 기준)
 * @param minBidPrice 최소 입찰가
 * @param _instantWinPrice 원본도 받기만 하고 쓰지 않는 4번째 인자
 */
export function validateBid(
  bidPrice: number,
  currentPrice: number,
  minBidPrice: number,
  _instantWinPrice?: number | null,
): string | null {
  if (!bidPrice) return '입찰가를 입력해 주세요.'
  if (bidPrice < minBidPrice) return `최소 입찰가는 ${minBidPrice.toLocaleString('ko-KR')}원이에요.`
  const unit = bidIncrementOf(currentPrice)
  return (bidPrice - currentPrice) % unit !== 0 ? `${unit.toLocaleString('ko-KR')}원 단위로 올려 주세요.` : null
}
