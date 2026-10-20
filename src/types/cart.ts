/** GET /api/v1/cart 의 항목 (낙찰 후 결제 대기 상품) */
export interface CartItem {
  id: number
  /** 회원 uuid */
  winnerId: string
  /** 회원 uuid */
  sellerId: string
  auctionId: number
  productId: number
  winningPrice: number
  deliveryFee: number
  winAt: string
  /** 결제 기한 (낙찰 24시간 뒤) */
  paymentDueAt: string
  productName: string
  thumbnailUrl: string | null
}

export interface CartPaymentResult {
  orderGroupId: number
  isPaid: boolean
}
