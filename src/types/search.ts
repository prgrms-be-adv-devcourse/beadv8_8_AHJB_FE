import type { PageParams } from './common'
import type { Category, Manufacturer } from './product'

/** 검색 결과 상품 상태 */
export type ProductSearchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'SOLD' | 'FAILED'

/** 정렬. 생략하면 검색어가 있으면 RELEVANCE, 없으면 LATEST */
export type ProductSearchSort = 'RELEVANCE' | 'LATEST' | 'ENDING_SOON' | 'PRICE_ASC' | 'PRICE_DESC'

/** GET /api/v1/search 쿼리. size 최대 50 */
export interface ProductSearchParams extends PageParams {
  keyword?: string
  category?: Category
  manufacturer?: Manufacturer
  status?: ProductSearchStatus
  minPrice?: number
  maxPrice?: number
  sort?: ProductSearchSort
}

export interface ProductSearchItem {
  productId: number
  productName: string
  category: Category
  manufacturer: Manufacturer
  manufacturerName: string
  thumbnailUrl: string | null
  startPrice: number
  instantWinPrice: number | null
  status: ProductSearchStatus
  /** 경매 시작 전이면 null */
  auctionId: number | null
  auctionScheduledAt: string
  auctionStartAt: string | null
  auctionEndAt: string | null
  /** SOLD 일 때만 */
  winningPrice: number | null
  registeredAt: string
}

/** GET /api/v1/search */
export interface ProductSearchResponse {
  content: ProductSearchItem[]
  page: number
  size: number
  /** "검색 결과 N건" */
  totalElements: number
  hasNext: boolean
}
