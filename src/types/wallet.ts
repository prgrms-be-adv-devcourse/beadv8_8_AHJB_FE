/**
 * 지갑 (백엔드 payment 컨텍스트 WalletApiController 기준)
 * - GET /api/v1/wallet/me           → Wallet
 * - GET /api/v1/wallet/me/ledger    → LedgerPage
 * - GET /api/v1/wallet/me/holdings  → HoldingPage
 */

/** 지갑 안의 잔액 구분. DEPOSIT = 예치금(결제에 쓰는 돈), SETTLEMENT = 정산금(판매 대금, 예치금과 분리 보관) */
export type WalletAccount = 'DEPOSIT' | 'SETTLEMENT'

/**
 * 원장 거래 유형 (백엔드 WalletTransactionType 전체).
 * 사용자 지갑에 실제로 찍히는 건 CHARGE, CHARGE_CANCEL, WITHDRAWAL, HOLD_PAY, SETTLEMENT_RECEIVE, REFUND_RECEIVE, REVERSAL 이고
 * 나머지는 시스템 지갑(ESCROW·FEE) 전용이라 화면에는 나오지 않는다.
 */
export type TransactionType =
  | 'CHARGE'
  | 'CHARGE_CANCEL'
  | 'WITHDRAWAL'
  | 'HOLD_PAY'
  | 'HOLD_RECEIVE'
  | 'SETTLEMENT_PAY'
  | 'SETTLEMENT_RECEIVE'
  | 'FEE_PAY'
  | 'FEE_RECEIVE'
  | 'REFUND_PAY'
  | 'REFUND_RECEIVE'
  | 'REVERSAL'

/** 원장 기록의 원인. PAYMENT = 충전 건(Charge) id, ORDER = 주문 id, WITHDRAWAL = 출금 건 id */
export type TransactionReferenceType = 'PAYMENT' | 'ORDER' | 'WITHDRAWAL'

/** GET /api/v1/wallet/me. balance = 예치금, settlementBalance = 정산금 */
export interface Wallet {
  balance: number
  settlementBalance: number
}

/** 원장 한 줄 (백엔드 LedgerEntryDto) */
export interface LedgerEntry {
  id: number
  /** 어느 주머니의 변동인지 */
  account: WalletAccount
  type: TransactionType
  /** 입금 +, 출금 - */
  amount: number
  /** 이 기록 직후의 해당 주머니 잔액 */
  balanceAfter: number
  referenceType: TransactionReferenceType
  referenceId: number | null
  /** 같은 거래로 묶인 기록들의 그룹 id */
  transactionGroupId: string | null
  createdAt: string
}

/** GET /api/v1/wallet/me/ledger 응답 (백엔드 LedgerPageDto). 페이지 + 현재 잔액 */
export interface LedgerPage {
  balance: number
  settlementBalance: number
  content: LedgerEntry[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface LedgerParams {
  /** 주머니 필터. 생략하면 전체 */
  account?: WalletAccount
  /** 유형 필터. 생략하면 전체 */
  type?: TransactionType
  page?: number
  /** 최대 50 */
  size?: number
}

/** 홀딩 조회 시 내가 어느 쪽인가. BUYER = 내 돈이 묶여 있음, SELLER = 내가 받을 돈이 묶여 있음 */
export type HoldingRole = 'BUYER' | 'SELLER'

/** HELD 보관 중 → CONFIRMED 구매 확정 → RELEASED 정산 완료 / REFUNDED 환불 완료 */
export type HoldingStatus = 'HELD' | 'CONFIRMED' | 'RELEASED' | 'REFUNDED'

/** 홀딩 한 건 (백엔드 HoldingSummaryDto) */
export interface Holding {
  holdingId: number
  orderId: number
  paymentId: number
  /** 구매자가 보면 판매자 id, 판매자가 보면 구매자 id */
  counterpartyId: number
  winningPrice: number
  deliveryFee: number
  /** 묶인 금액 = winningPrice + deliveryFee */
  amount: number
  feeAmount: number
  /** 판매자 실지급액 = amount − feeAmount */
  settlementAmount: number
  status: HoldingStatus
  heldAt: string
  confirmedAt: string | null
  releasedAt: string | null
  refundedAt: string | null
}

/** GET /api/v1/wallet/me/holdings 응답 (백엔드 HoldingPageDto) */
export interface HoldingPage {
  role: HoldingRole
  /** 아직 정산·환불되지 않은 홀딩(HELD + CONFIRMED) 합계. BUYER 는 묶인 내 돈, SELLER 는 받을 돈 */
  heldTotal: number
  /** 그중 구매 확정이 끝나 정산만 남은 금액 (CONFIRMED) */
  settleableTotal: number
  content: Holding[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface HoldingParams {
  /** 기본 BUYER */
  role?: HoldingRole
  status?: HoldingStatus
  page?: number
  /** 최대 50 */
  size?: number
}
