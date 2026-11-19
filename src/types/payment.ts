/**
 * 결제 (백엔드 payment 컨텍스트 PaymentApiController 기준)
 * - POST /api/v1/payments/charges                      충전 요청 → ChargeSummary (결제창 파라미터)
 * - POST /api/v1/payments/charges/confirm              충전 승인 → ChargeSummary
 * - POST /api/v1/payments/charges/{chargeId}/cancel    충전 취소 → ChargeSummary
 * - GET  /api/v1/payments/charges/me                   내 충전 내역 → PageResponse<ChargeSummary>
 * - GET  /api/v1/payments/charges/{chargeId}           충전 상세 → ChargeSummary
 * - POST /api/v1/payments/confirm                      주문 결제 승인(결제창을 거친 뒤) → PaymentSummary
 * - GET  /api/v1/payments/quote                        결제 전 견적 → PaymentQuote
 * - GET  /api/v1/payments/me                           내 결제 내역 → PageResponse<PaymentSummary>
 * - GET  /api/v1/payments/me/{paymentId}               내 결제 상세 → PaymentDetail
 * - GET  /api/v1/payments/me/order-groups/{orderGroupId}  주문 그룹으로 결제 상세 → PaymentDetail
 * - GET  /api/v1/payments/me/orders/{orderId}          주문 1건의 결제 정보 → OrderPayment
 * - GET  /api/v1/payments/policy                       결제 정책 → PaymentPolicy
 */
import type { HoldingStatus } from './wallet'

/**
 * 주문 결제에서 포인트로 내고 남은 금액을 무엇으로 낼지 (백엔드 PayMethod).
 * DEPOSIT = 예치금(모자라면 부족분을 계좌이체로 충전), TRANSFER = 계좌이체 직접 결제, CARD = 카드·간편결제 직접 결제.
 * 포인트는 어느 수단과도 함께 쓸 수 있고, 예치금과 직접 결제는 함께 쓸 수 없다.
 */
export type PayMethod = 'DEPOSIT' | 'TRANSFER' | 'CARD'

/** 토스 결제창을 여는 결제수단 (백엔드 PgMethod). SDK requestPayment 의 method 로 그대로 넘긴다 */
export type PgMethod = 'TRANSFER' | 'CARD'

/**
 * 토스 결제 1건의 용도.
 * MANUAL = 사용자가 직접 예치금 충전, FOR_PAYMENT = 주문 결제 중 예치금 부족분 충전 (둘 다 계좌이체로만 받는다),
 * DIRECT_PAYMENT = 주문 대금을 결제창에서 직접 결제 (예치금을 거치지 않는다)
 */
export type ChargePurpose = 'MANUAL' | 'FOR_PAYMENT' | 'DIRECT_PAYMENT'

/**
 * REQUESTED 결제창 띄우기 전 → CHARGED 승인 완료(예치금 반영) → USED(주문 결제용이 홀딩에 소비됨)
 * / CANCELED 충전 취소 / ABORTED 승인 실패·만료
 */
export type ChargeStatus = 'REQUESTED' | 'CHARGED' | 'USED' | 'CANCELED' | 'ABORTED'

/** 충전 1건 (백엔드 ChargeSummaryDto) */
export interface ChargeSummary {
  chargeId: number
  /** 토스 SDK 의 orderId 로 넘기는 값 */
  pgOrderId: string
  amount: number
  /** 토스 결제창에 표시되는 상품명. 백엔드가 정한다 */
  orderName: string
  purpose: ChargePurpose
  status: ChargeStatus
  /** 지금 취소할 수 있는지 (CHARGED 이고 한 푼도 안 쓰인 건) */
  cancelable: boolean
  usedAmount: number
  remainingAmount: number
  /** 직접 결제 건에서 주문 환불로 토스에 취소한 금액의 합. 충전 취소는 전액이라 취소되면 amount 와 같다 */
  canceledAmount: number
  /** 결제창을 열 때 쓰는 결제수단. 예치금 충전(MANUAL · FOR_PAYMENT)은 항상 TRANSFER */
  pgMethod: PgMethod
  /** 토스가 실제로 승인한 결제수단 표기 (계좌이체, 카드, 간편결제 …). 승인 전에는 null */
  method: string | null
  /** 토스 매출전표 링크 (승인된 건만) */
  receiptUrl: string | null
  requestedAt: string
  approvedAt: string | null
  usedAt: string | null
  canceledAt: string | null
  failureCode: string | null
  failureMessage: string | null
}

/** GET /api/v1/payments/charges/me 파라미터. 최신순, size 최대 50 */
export interface ChargeListParams {
  page?: number
  size?: number
}

/** POST /api/v1/payments/charges 요청 */
export interface ChargeRequest {
  amount: number
}

/**
 * POST /api/v1/payments/charges/confirm 요청.
 * 토스 successUrl 쿼리(paymentKey, orderId, amount)를 그대로 넣는다. orderId 가 pgOrderId.
 */
export interface ChargeConfirmRequest {
  pgOrderId: string
  paymentKey: string
  amount: number
}

/**
 * 주문 묶음 결제 상태.
 * PENDING 주문 호출 직후 → CHARGING 결제창을 거치는 중(부족분 충전 또는 직접 결제) → PAID 결제 완료 + 홀딩 완료
 * / FAILED 돈이 움직이기 전에 결제가 닫힘(주문이 주문 그룹을 버림)
 */
export type PaymentStatus = 'PENDING' | 'CHARGING' | 'PAID' | 'FAILED'

/**
 * 주문 묶음 결제 1건 (백엔드 PaymentSummaryDto).
 * 총액을 무엇으로 냈는지: pointAmount + walletUsedAmount + pgAmount == totalPrice
 */
export interface PaymentSummary {
  paymentId: number
  orderGroupId: number
  totalPrice: number
  /** 고른 결제수단 */
  payMethod: PayMethod
  /** 포인트로 낸 금액 */
  pointAmount: number
  /** 예치금으로 낸 금액. 부족분을 충전해서 낸 금액도 포함한다 */
  walletUsedAmount: number
  /** 결제창에서 직접 결제한 금액 (예치금을 거치지 않음) */
  pgAmount: number
  /** 직접 결제가 실제로 승인된 결제수단 표기 (계좌이체, 카드, 간편결제 …). 직접 결제가 아니거나 승인 전이면 null */
  pgMethod: string | null
  /**
   * 결제창에서 결제한(할) 금액. 예치금 결제면 부족분을 메우려고 충전한 금액이며 최소 충전 금액 때문에 부족분보다 클 수 있고
   * 차액은 예치금에 남는다. 직접 결제면 pgAmount 와 같다. 0 이면 결제창 없이 결제
   */
  chargeAmount: number
  orderCount: number
  status: PaymentStatus
  requestedAt: string
  paidAt: string | null
}

/** GET /api/v1/payments/me 파라미터. 최신순, size 최대 50 */
export interface PaymentListParams {
  page?: number
  size?: number
}

/** 결제에 포함된 주문 1건 (백엔드 PaymentDetailDto.Item) */
export interface PaymentDetailItem {
  orderId: number
  /** 판매자 회원 번호 */
  sellerId: number
  winningPrice: number
  deliveryFee: number
  /** = winningPrice + deliveryFee */
  amount: number
  refunded: boolean
  refundedAt: string | null
}

/**
 * 결제 상세 (백엔드 PaymentDetailDto). 금액 구성 필드의 뜻은 PaymentSummary 와 같다.
 * GET /api/v1/payments/me/{paymentId}, GET /api/v1/payments/me/order-groups/{orderGroupId} 공통
 */
export interface PaymentDetail extends Omit<PaymentSummary, 'orderCount'> {
  failureReason: string | null
  /**
   * 아직 구매 확정하지 않은 주문을 확정하면 적립될 예상 포인트의 합.
   * 결제 완료 전이거나 모든 주문이 확정 · 환불됐으면 0 (이미 적립된 포인트는 OrderPayment.earnedPoint)
   */
  expectedEarnPoint: number
  items: PaymentDetailItem[]
  /** 이 결제에 연결된 토스 결제 건 (부족분 충전 또는 직접 결제). 결제창 없이 끝났으면 빈 배열 */
  charges: ChargeSummary[]
}

/**
 * 주문 1건의 결제 정보 (백엔드 OrderPaymentDto). GET /api/v1/payments/me/orders/{orderId}
 * 구매자 본인만 조회할 수 있다 (판매자 포함 다른 회원은 PAYMENT008, 결제가 끝나지 않은 주문은 WALLET301).
 */
export interface OrderPayment {
  paymentId: number
  orderGroupId: number
  orderId: number
  payMethod: PayMethod
  /** 직접 결제가 실제로 승인된 결제수단 표기. 직접 결제가 아니거나 승인 전이면 null */
  pgMethod: string | null
  winningPrice: number
  deliveryFee: number
  /** 이 주문의 결제 금액 = winningPrice + deliveryFee */
  amount: number
  /** 이 주문 대금을 포인트 · 예치금 · 직접 결제로 각각 얼마씩 냈는지 (합 == amount). 환불하면 이 구성 그대로 돌아간다 */
  pointAmount: number
  depositAmount: number
  pgAmount: number
  /** 구매 확정하면 적립될 예상 포인트. 확정 전(status 가 HELD)일 때만 값이 있고 그 밖에는 0 */
  expectedEarnPoint: number
  /** 구매 확정으로 실제 적립된 포인트. 확정 전이거나 적립 대상 금액이 없으면 0 */
  earnedPoint: number
  /** 홀딩 상태 */
  status: HoldingStatus
  heldAt: string
  confirmedAt: string | null
  refundedAt: string | null
}

/** GET /api/v1/payments/policy 응답 (백엔드 PaymentPolicyDto). 화면 안내 문구와 입력 검증에 쓰는 설정값 */
export interface PaymentPolicy {
  /** 예치금 1회 충전 금액 범위. 벗어나면 CHARGE010. 주문 결제 중 부족분 충전도 최소 금액보다 작으면 최소 금액으로 올린다 */
  chargeMinAmount: number
  chargeMaxAmount: number
  /** 포인트 적립률(%). 구매 확정 시 예치금 · 계좌이체 결제액(배송비 제외)에 적용한다 */
  pointEarnRatePercent: number
  /** 판매 수수료율(%). 낙찰가에 적용한다 */
  feeRatePercent: number
}

/**
 * POST /api/v1/payments/confirm 요청. 토스 successUrl 쿼리(paymentKey, orderId, amount)를 그대로 넣는다.
 * orderId 가 pgOrderId, amount 는 결제창에서 결제한 금액(chargeAmount) 이다.
 */
export interface PaymentConfirmRequest {
  pgOrderId: string
  paymentKey: string
  amount: number
}

/** GET /api/v1/payments/quote 파라미터 */
export interface PaymentQuoteParams {
  /** 결제 금액 (주문 총액) */
  amount: number
  /** 생략하면 DEPOSIT */
  payMethod?: PayMethod
  /** 포인트 사용액. 생략하면 0. 결제 금액을 넘으면 PAYMENT010, 포인트 잔액보다 많으면 WALLET204 */
  pointUseAmount?: number
  /** amount 에 포함된 배송비 합. 예상 적립 포인트에서 배송비를 빼는 데 쓴다. 생략하면 0 */
  deliveryFee?: number
}

/** GET /api/v1/payments/quote 응답 (백엔드 PaymentQuoteDto). 저장되지 않는 계산값이라 실제 결제 시점과 다를 수 있다 */
export interface PaymentQuote {
  /** 지금 예치금 · 포인트 잔액 */
  balance: number
  pointBalance: number
  /** 결제 금액 (주문 총액) */
  amount: number
  payMethod: PayMethod
  /** 포인트로 내는 금액 */
  pointUseAmount: number
  /** 지금 있는 예치금으로 충당되는 금액. 직접 결제면 0 */
  walletUseAmount: number
  /** 예치금 결제에서 모자란 금액. 0 이면 충전 없이 결제된다 */
  shortage: number
  /** 예치금이 모자라 충전이 필요한지 */
  needsCharge: boolean
  /** 실제로 충전해야 하는 금액. 부족분이 최소 충전 금액보다 작으면 최소 충전 금액으로 올린다. 직접 결제면 0 */
  chargeAmount: number
  /** 결제한 뒤 예치금에 남는 금액 (충전했다면 충전 금액 포함). 직접 결제면 지금 잔액 그대로 */
  balanceAfterPayment: number
  /** 결제창에서 결제할 금액. 충전이면 chargeAmount, 직접 결제면 포인트를 뺀 나머지. 0 이면 결제창 없이 결제된다 */
  pgAmount: number
  /** 결제창을 열어야 하는 결제수단. 결제창이 필요 없으면 null */
  pgMethod: PgMethod | null
  /** 결제창 금액이 계좌이체 1회 한도를 넘는지. true 면 이 조건으로는 결제 요청이 거절된다 */
  chargeLimitExceeded: boolean
  /** 이 조건으로 결제하고 구매 확정하면 적립될 것으로 예상되는 포인트 (카드·간편결제, 포인트 사용액, 배송비는 제외) */
  expectedEarnPoint: number
  /** 포인트 적립률(%) */
  earnRatePercent: number
}
