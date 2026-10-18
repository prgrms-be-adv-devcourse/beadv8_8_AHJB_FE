import type { PageParams } from './common'

export type SettlementStatus = 'PENDING' | 'COMPLETED'

export interface SettlementListParams extends PageParams {
  status?: SettlementStatus | string
}

export interface SettlementSummary {
  settlementId: number
  productName: string
  settlementAmount: number
  status: SettlementStatus
  /** 'YYYY-MM-DD' */
  payoutDate: string
}

export interface SettlementDetail {
  settlementId: number
  orderId: number
  productId: number
  productName: string
  winningPrice: number
  deliveryFee: number
  feeAmount: number
  settlementAmount: number
  status: SettlementStatus
  confirmedAt: string
  /** 'YYYY-MM-DD' */
  payoutDate: string
  completedAt: string | null
}
