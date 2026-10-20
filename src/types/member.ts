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

/** 앱 전체에서 쓰는 내 정보 (AuthProvider). 목업 GET /api/v1/member/me 또는 토큰 + 요약으로 만든다 */
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
  createdAt: string
  /**
   * true 면 토큰 + 내 정보 요약(member/me/summary) + 로그인 이메일로 만든 정보다.
   * memberId·email·nickname·isSeller·accountStatus 만 믿을 수 있고 나머지는 빈 값이다.
   */
  partial?: boolean
}

/** GET /api/v1/member/me/summary */
export interface MemberSummary {
  nickname: string
  seller: boolean
  suspended: boolean
}

/** GET /api/v1/member/me (회원 정보 화면의 기본 정보) */
export interface MemberDetail {
  nickname: string
  email: string
  username: string
  phone: string
  birthDate: string | null
  addressAlias: string | null
  address: string | null
  signUpDate: string
}

/** GET /api/v1/member/me/seller */
export interface SellerInfo {
  bank: string
  /** 예: **********9489 (서버에서 마스킹) */
  accountNumberMasked: string
  accountHolder: string
  registeredAt: string
}

/** GET /api/v1/member/me/warnings 의 warnings 항목 */
export interface Warning {
  warningId: number
  /** 백엔드는 문자열로 준다. 아는 값은 WarningReason 라벨로 보여준다 */
  reason: string
  orderId: number | null
  createdAt: string
}

/** GET /api/v1/member/me/warnings (계정 상태 · 경고 이력) */
export interface AccountStatusInfo {
  accountStatus: AccountStatus
  warningCount: number
  suspendedUntil: string | null
  /** 최신순 */
  warnings: Warning[]
}

export interface RegisterSellerRequest {
  bank: string
  /** 숫자 10–16자리 */
  accountNumber: string
  accountHolder: string
}
