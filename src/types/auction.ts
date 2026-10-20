import type { PageParams } from './common'
import type { Category, Manufacturer } from './product'

export type AuctionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'WON' | 'PAID' | 'COMPLETED' | 'FAILED'
export type FailureReason = 'NO_BID' | 'UNPAID' | 'REFUNDED'
/**
 * 목록 탭 (상단 탭과 1:1)
 * - IN_PROGRESS, ENDED: 경매 API (GET /api/v1/auctions)
 * - SCHEDULED(곧 시작): 경매가 아직 없어서 상품 API (product.upcoming)
 */
export type AuctionListStatus = 'IN_PROGRESS' | 'SCHEDULED' | 'ENDED'
/** 경매 API 정렬 값 (백엔드 AuctionSortType 과 같다). 탭별 선택지는 auctionListParams.SORT_OPTIONS */
export type AuctionSort = 'ENDING_SOON' | 'RECENTLY_ENDED' | 'NEWEST' | 'MOST_BIDS' | 'PRICE_ASC' | 'PRICE_DESC'

export interface AuctionListParams extends PageParams {
  status?: AuctionListStatus
  /** 상품 카테고리 enum 이름. 생략 = 전체 */
  category?: Category
  /** 생략하면 백엔드가 탭별 기본값 (진행 중 ENDING_SOON, 종료 RECENTLY_ENDED) */
  sort?: AuctionSort
}

/**
 * 경매 목록 카드 한 장
 * - 경매 API(GET /api/v1/auctions)는 아래 필수 필드만 준다.
 * - 선택 필드(?)는 상품 API(곧 시작, 내 상품)·목업에서만 온다.
 */
export interface AuctionSummary {
  productId: number
  auctionId: number | null
  productName: string
  thumbnailUrl: string | null
  category: Category
  status: AuctionStatus
  /** 종료된 경매는 낙찰가, 아니면 최고 입찰가 → 시작가 */
  currentPrice: number
  instantWinPrice: number | null
  bidCount: number
  endAt: string | null
  manufacturer?: Manufacturer
  startPrice?: number
  wishCount?: number
  shippingFee?: number
  /** 곧 시작 카드의 '○○ 후 시작'에 필요 */
  startAt?: string
}

/** GET /api/v1/auctions 응답 (페이지 + 서버 시각) */
export interface AuctionListResponse {
  content: AuctionSummary[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
  /** 경매 API만 준다 (상품 API·목업은 없을 수 있음) */
  serverTime?: string
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

/** GET /api/v1/auctions/me/bids 의 항목 (내가 입찰한 진행 중 경매, 마감 임박순) */
export interface MyBid {
  auctionId: number
  productId: number
  productName: string
  thumbnailUrl: string | null
  currentPrice: number
  /** false 면 '밀림' → 다시 입찰 버튼 */
  isHighestBidder: boolean
  endAt: string
}
