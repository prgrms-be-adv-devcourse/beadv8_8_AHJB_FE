export type TransactionType =
  | 'CHARGE'
  | 'CHARGE_CANCEL'
  | 'HOLD_PAY'
  | 'SETTLEMENT_RECEIVE'
  | 'REFUND_RECEIVE'
  | 'REVERSAL'

export type TransactionReferenceType = 'CHARGE' | 'ORDER' | 'REFUND' | 'SETTLEMENT'

/** GET /api/v1/wallet/me, POST /api/v1/wallet/me/charge */
export interface Wallet {
  walletId: number
  balance: number
  /** 결제 후 정산 전까지 묶인 금액 */
  heldAmount: number
}

export interface WalletTransaction {
  transactionId: number
  type: TransactionType
  /** 출금은 음수 */
  amount: number
  balanceAfter: number
  referenceType: TransactionReferenceType
  referenceId: number | null
  description: string
  createdAt: string
}
