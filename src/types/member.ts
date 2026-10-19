export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'BANNED'

export type WarningReason = 'PAYMENT_DEFAULT' | 'REFUND_PENALTY' | 'REPORT'

export interface MemberAddress {
  alias?: string
  recipient: string
  recipientPhone: string
  zipcode: string
  address: string
  addressDetail?: string
}

export interface SellerAccount {
  bank: string
  /** 예: 1234****567 */
  accountNumberMasked: string
  accountHolder: string
}

/** GET /api/v1/member/me */
export interface Me {
  memberId: number
  uuid: string
  email: string
  nickname: string
  username: string
  phone: string
  birthDate: string | null
  isSeller: boolean
  accountStatus: AccountStatus
  warningCount: number
  address: MemberAddress | null
  seller: SellerAccount | null
  createdAt: string
  /**
   * true 면 GET /member/me 없이 로그인 응답 + 토큰으로 만든 정보다.
   * memberId·email·nickname·isSeller·accountStatus 만 믿을 수 있고 나머지는 빈 값이다.
   */
  partial?: boolean
}

/** GET /api/v1/member/me/warnings 의 항목 */
export interface Warning {
  warningId: number
  reason: WarningReason
  orderId: number | null
  createdAt: string
}

export interface RegisterSellerRequest {
  bank: string
  /** 숫자 10–16자리 */
  accountNumber: string
  accountHolder: string
}
