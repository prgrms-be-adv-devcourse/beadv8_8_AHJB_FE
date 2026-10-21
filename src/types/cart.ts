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

/**
 * POST /api/v1/cart/payment 에서 예치금이 부족할 때 같이 오는 결제창 파라미터 (백엔드 PaymentResponseDto.Data).
 * pgOrderId 를 토스 orderId 로, chargeAmount(부족분) 를 결제 금액으로, orderName 을 상품명으로 넘기고
 * successUrl 로 돌아오면 POST /api/v1/payments/confirm 을 호출한다.
 */
export interface CartPaymentChargeData {
  paymentId: number
  totalPrice: number
  /** 카드로 결제할 부족분 */
  chargeAmount: number
  pgOrderId: string
  orderName: string
}

/** POST /api/v1/cart/payment 응답 (백엔드 PaymentResponseDto). isPaid:false 면 data 에 결제창 파라미터가 있다 */
export interface CartPaymentResult {
  orderGroupId: number
  isPaid: boolean
  data: CartPaymentChargeData | null
}
