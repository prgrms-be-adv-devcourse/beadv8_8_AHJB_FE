/**
 * 결제 (백엔드 payment 컨텍스트 PaymentApiController 기준)
 * - POST /api/v1/payments/charges          충전 요청 → ChargeSummary (결제창 파라미터)
 * - POST /api/v1/payments/charges/confirm  충전 승인 → ChargeSummary
 * - POST /api/v1/payments/confirm          주문 결제 승인(부족분 토스 결제 후) → PaymentSummary
 * - GET  /api/v1/payments/quote            결제 전 견적 → PaymentQuote
 */

/** MANUAL = 사용자가 직접 충전, FOR_PAYMENT = 주문 결제 중 부족분 충전 */
export type ChargePurpose = 'MANUAL' | 'FOR_PAYMENT'

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
  /** 결제수단 (승인된 건만) */
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
 * PENDING 주문 호출 직후 → CHARGING 부족분 PG 충전 중 → PAID 지갑 차감 + 홀딩 완료 / FAILED PG 실패·주문 만료
 */
export type PaymentStatus = 'PENDING' | 'CHARGING' | 'PAID' | 'FAILED'

/** 주문 묶음 결제 1건 (백엔드 PaymentSummaryDto) */
export interface PaymentSummary {
  paymentId: number
  orderGroupId: number
  totalPrice: number
  /** 예치금에서 나간 금액 = 총액 − 부족분 충전액 */
  walletUsedAmount: number
  /** 토스로 결제한 부족분. 0 이면 전액 예치금 */
  chargeAmount: number
  orderCount: number
  status: PaymentStatus
  requestedAt: string
  paidAt: string | null
}

/**
 * POST /api/v1/payments/confirm 요청. 토스 successUrl 쿼리(paymentKey, orderId, amount)를 그대로 넣는다.
 * orderId 가 pgOrderId, amount 는 부족분(chargeAmount) 이다.
 */
export interface PaymentConfirmRequest {
  pgOrderId: string
  paymentKey: string
  amount: number
}

/** GET /api/v1/payments/quote?amount= 응답. 저장되지 않는 계산값이라 실제 결제 시점과 다를 수 있다 */
export interface PaymentQuote {
  balance: number
  amount: number
  /** 예치금에서 나갈 금액 */
  walletUseAmount: number
  /** 카드로 결제할 부족분 */
  shortage: number
  needsCharge: boolean
}
