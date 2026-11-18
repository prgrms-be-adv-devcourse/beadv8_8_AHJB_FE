import type { StatusMeta } from '@/lib/status'
import type { DutchAuctionInfo, DutchAuctionSummary } from '@/types/auction'

type DutchLike = Pick<DutchAuctionSummary, 'status' | 'isLastPrice' | 'failureReason'>

/** 하향식 상태 배지 */
export function dutchStatusBadge(auction: DutchLike): StatusMeta {
  switch (auction.status) {
    case 'IN_PROGRESS':
      return auction.isLastPrice ? { tone: 'closing', label: '마지막 가격' } : { tone: 'live', label: '가격 하락 중' }
    case 'SCHEDULED':
      return { tone: 'scheduled', label: '시작 전' }
    case 'FAILED':
      return { tone: 'ended', label: '유찰' }
    default:
      return { tone: 'won', label: '판매 완료' }
  }
}

/** 시작가 대비 몇 % 내렸는지 (정수) */
export function dropPercent(auction: Pick<DutchAuctionInfo, 'startPrice' | 'currentPrice'>): number {
  if (!auction.currentPrice || auction.startPrice <= 0) return 0
  return Math.round(((auction.startPrice - auction.currentPrice) / auction.startPrice) * 100)
}

/** 30초, 1분, 1분 30초 */
export function formatInterval(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (!minutes) return `${rest}초`
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`
}

/** 다음 하락까지 m:ss */
export function formatShortCountdown(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
