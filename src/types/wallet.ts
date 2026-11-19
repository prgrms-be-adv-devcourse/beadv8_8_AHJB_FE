/**
 * 지갑 (백엔드 payment 컨텍스트 WalletApiController 기준)
 * - GET /api/v1/wallet/me           → Wallet
 * - GET /api/v1/wallet/me/ledger    → LedgerPage
 * - GET /api/v1/wallet/me/holdings  → HoldingPage
 * - POST /api/v1/wallet/me/withdrawals → Withdrawal (전액 출금, 명목상)
 * - GET /api/v1/wallet/me/withdrawals  → PageResponse<Withdrawal>
 */

/**
 * 지갑 안의 잔액 구분.
 * DEPOSIT = 예치금(결제에 쓰는 돈), SETTLEMENT = 정산금(판매 대금, 예치금과 분리 보관),
 * POINT = 포인트(결제에 쓸 수 있으나 출금할 수 없음, 1포인트 = 1원)
 */
export type WalletAccount = 'DEPOSIT' | 'SETTLEMENT' | 'POINT'

/**
 * 원장 거래 유형 (백엔드 WalletTransactionType 전체).
 * 사용자 지갑에 실제로 찍히는 건 CHARGE, CHARGE_CANCEL, WITHDRAWAL, HOLD_PAY, SETTLEMENT_RECEIVE, REFUND_RECEIVE,
 * POINT_EARN, POINT_HOLD_PAY, POINT_REFUND_RECEIVE, REVERSAL 이고
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
  | 'POINT_EARN'
  | 'POINT_HOLD_PAY'
  | 'POINT_HOLD_RECEIVE'
  | 'POINT_REFUND_PAY'
  | 'POINT_REFUND_RECEIVE'
  | 'PG_HOLD_RECEIVE'
  | 'PG_REFUND_PAY'
  | 'REVERSAL'

/** 원장 기록의 원인. PAYMENT = 충전 건(Charge) id, ORDER = 주문 id, WITHDRAWAL = 출금 건 id */
export type TransactionReferenceType = 'PAYMENT' | 'ORDER' | 'WITHDRAWAL'

/** GET /api/v1/wallet/me. balance = 예치금, settlementBalance = 정산금, pointBalance = 포인트 */
export interface Wallet {
  balance: number
  settlementBalance: number
  pointBalance: number
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
  pointBalance: number
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
  /**
   * 이 주문 대금을 포인트 · 예치금 · 직접 결제로 각각 얼마씩 냈는지 (합 == amount). 환불하면 이 구성 그대로 돌아간다.
   * 구매자에게만 내려주고 판매자가 볼 때(role=SELLER)는 0 이다
   */
  pointAmount: number
  depositAmount: number
  pgAmount: number
  /** 구매 확정으로 구매자에게 적립된 포인트. 확정 전이거나 적립 대상 금액이 없으면 0. 판매자가 볼 때는 0 */
  earnedPoint: number
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

/** 출금 상태. 지금은 실제 송금이 없어 요청 즉시 COMPLETED 로 기록된다 */
export type WithdrawalStatus = 'REQUESTED' | 'COMPLETED' | 'FAILED'

/** 출금 1건 (백엔드 WithdrawalDto) */
export interface Withdrawal {
  withdrawalId: number
  amount: number
  /** 어느 주머니에서 나갔는지. 지금은 DEPOSIT(예치금)만 */
  account: WalletAccount
  status: WithdrawalStatus
  requestedAt: string
  completedAt: string | null
  failedAt: string | null
  failureReason: string | null
}

export interface WithdrawalListParams {
  page?: number
  /** 최대 50 */
  size?: number
}
