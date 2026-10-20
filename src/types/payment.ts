/**
 * 결제 (백엔드 payment 컨텍스트 PaymentApiController 기준)
 * - POST /api/v1/payments/charges          충전 요청 → ChargeSummary (결제창 파라미터)
 * - POST /api/v1/payments/charges/confirm  충전 승인 → ChargeSummary
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
