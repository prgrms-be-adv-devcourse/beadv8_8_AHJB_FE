export type RefundStatus = 'REQUESTED' | 'ACCEPTED' | 'COMPLETED' | 'REJECTED'

/** GET /api/v1/refunds/{refundId}, GET /api/v1/refunds?orderId= */
export interface Refund {
  refundId: number
  orderId: number
  productId: number
  amount: number
  status: RefundStatus
  requestedAt: string
  processedAt: string | null
}

/** PATCH /api/v1/refunds/{refundId}/accept|reject */
export interface RefundProcessResult {
  refundId: number
  orderId: number
  /** 목업은 내부 회원 번호(number)를 그대로 내려줌 */
  winnerId: number | string
  status: RefundStatus
  amount: number
  requestedAt: string
  processedAt: string | null
}
