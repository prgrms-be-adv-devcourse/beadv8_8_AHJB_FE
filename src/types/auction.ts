import type { PageParams } from './common'
import type { Category, Manufacturer } from './product'

export type AuctionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'WON' | 'PAID' | 'COMPLETED' | 'FAILED'
export type FailureReason = 'NO_BID' | 'UNPAID' | 'REFUNDED'
/** 목록 필터용 상태 (ENDED = 진행 중·시작 전이 아닌 모든 것) */
export type AuctionListStatus = 'IN_PROGRESS' | 'SCHEDULED' | 'ENDED'
export type AuctionSort = 'ENDING_SOON' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'BIDS' | 'WISHES'

export interface AuctionListParams extends PageParams {
  keyword?: string
  status?: AuctionListStatus | string
  category?: Category | string
  manufacturer?: Manufacturer | string
  instantWin?: boolean
  minPrice?: number
  maxPrice?: number
  sort?: AuctionSort | string
}

/** 경매 목록 카드 한 장 (GET /api/v1/auctions 의 content 항목) */
export interface AuctionSummary {
  productId: number
  auctionId: number | null
  productName: string
  thumbnailUrl: string | null
  category: Category
  manufacturer: Manufacturer
  status: AuctionStatus
  startPrice: number
  /** 낙찰가 → 최고 입찰가 → 시작가 순 */
  currentPrice: number
  instantWinPrice: number | null
  bidCount: number
  wishCount: number
  shippingFee: number
  startAt: string
  endAt: string | null
}

export interface AuctionInfo {
  auctionId: number
  productId: number
  startPrice: number
  instantWinPrice: number | null
  startAt: string
  status: AuctionStatus
  currentPrice: number
  /** 진행 중이 아니면 백엔드가 null 을 줌 */
  bidIncrement: number | null
  /** 종료된 경매는 백엔드가 null 을 줄 수 있음 */
  minBidPrice: number | null
  bidCount: number
  endAt: string
  winningPrice: number | null
  failureReason: FailureReason | null
}

/** GET /api/v1/auctions/{auctionId} */
export interface AuctionDetail {
  auction: AuctionInfo
  me: {
    isSeller: boolean
    isHighestBidder: boolean
  }
  /** 서버 시각 (lib/clock syncServerTime 에 넘김) */
  serverTime: string
}

export interface Bid {
  bidId: number
  /** 마스킹된 닉네임 (예: 레**) */
  bidderNickname: string
  bidPrice: number
  bidAt: string
  isMine: boolean
}

/** POST /api/v1/auctions/{auctionId}/bids */
export interface BidResponse {
  bidId: number
  bidPrice: number
  currentPrice: number
  /** 즉시낙찰로 끝났으면 null */
  minBidPrice: number | null
  endAt: string
  isExtended: boolean
  isInstantWin: boolean
}

/** POST /api/v1/auctions/{auctionId}/instant-win */
export interface InstantWinResponse {
  auctionId: number
  winningPrice: number
  winAt: string | null
  status: AuctionStatus
}

/** GET /api/v1/auctions/me/bids 의 항목 */
export interface MyBid {
  auctionId: number
  productId: number
  productName: string
  thumbnailUrl: string | null
  status: AuctionStatus
  myHighestBid: number
  currentPrice: number
  isHighestBidder: boolean
  endAt: string
  bidCount: number
}
