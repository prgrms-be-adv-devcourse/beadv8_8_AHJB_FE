import type { Category } from './product'

/** 추천 경매 카드. 상품명·사진은 없어서 상품 API 와 조합한다 */
export interface RecommendedAuction {
  auctionId: number
  productId: number
  category: Category
  currentPrice: number
  endAt: string
}
