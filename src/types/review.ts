/** GET /api/v1/reviews/reviewable-orders 의 항목 */
export interface ReviewableOrder {
  orderId: number
  productId: number
  productName: string
  sellerId: number
  sellerNickname: string
  winningPrice: number
  confirmedAt: string
  /** 구매확정 30일 뒤 */
  reviewDeadline: string
}

export interface Review {
  reviewId: number
  orderId: number
  productId: number
  productName: string
  writerId: number
  writerNickname: string
  targetId: number
  targetNickname: string
  /** 0.5 단위, 0.5–5.0 */
  rating: number
  content: string
  createdAt: string
  updatedAt: string
}

export interface ReviewListResponse {
  reviews: Review[]
  hasNext: boolean
}

export interface ReviewCreateRequest {
  orderId: number
  rating: number
  content: string
}

export interface ReviewUpdateRequest {
  rating?: number
  content?: string
}
