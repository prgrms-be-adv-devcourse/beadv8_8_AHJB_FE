import type { PayMethod, PgMethod } from './payment'

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
  /** 백엔드 응답에 없는 필드. 화면에서 상품 상세로 채운다 (useWithProductSummaries) */
  productName?: string
  thumbnailUrl?: string | null
}

/** POST /api/v1/cart/payment 요청 (백엔드 CartPaymentRequestDto) */
export interface CartPaymentRequest {
  productIds: number[]
  /** 포인트로 내고 남은 금액을 낼 결제수단. 생략하면 DEPOSIT(예치금) */
  paymentMethod?: PayMethod
  /** 포인트로 낼 금액. 생략하면 0 */
  pointUseAmount?: number
}

/**
 * POST /api/v1/cart/payment 에서 결제창을 거쳐야 할 때 같이 오는 결제창 파라미터 (백엔드 PaymentResponseDto.Data).
 * 예치금 결제인데 예치금이 모자라 부족분을 충전하는 경우와 직접 결제(계좌이체 · 카드)하는 경우 모두 여기에 해당한다.
 * pgOrderId 를 토스 orderId 로, chargeAmount 를 결제 금액으로, orderName 을 상품명으로, pgMethod 를 method 로 넘기고
 * successUrl 로 돌아오면 POST /api/v1/payments/confirm 을 호출한다.
 */
export interface CartPaymentChargeData {
  paymentId: number
  totalPrice: number
  /** 결제창에서 결제할 금액. 충전이면 최소 충전 금액 때문에 부족분보다 클 수 있고, 직접 결제면 pgAmount 와 같다 */
  chargeAmount: number
  pgOrderId: string
  orderName: string
  /** 결제창을 열 때 써야 하는 결제수단. 예치금 충전은 TRANSFER 이고 다른 수단으로 결제하면 승인 단계에서 취소된다 */
  pgMethod: PgMethod
  /** 이 결제에 적용된 결제수단 */
  payMethod: PayMethod
  /** 총액을 포인트 · 예치금 · 직접 결제로 각각 얼마씩 내는지 (합 == totalPrice) */
  pointAmount: number
  depositAmount: number
  pgAmount: number
}

/**
 * POST /api/v1/cart/payment 응답 (백엔드 PaymentResponseDto). isPaid:false 면 data 에 결제창 파라미터가 있다.
 * 포인트 · 예치금만으로 바로 끝나면 isPaid:true, data:null 이라 paymentId 가 없다 → 결제 정보는 orderGroupId 로 조회한다
 */
export interface CartPaymentResult {
  orderGroupId: number
  isPaid: boolean
  data: CartPaymentChargeData | null
}
