import type { AuctionDuration, Category, Manufacturer, ShippingFeeType } from '@/types/product'
import type { FailureReason } from '@/types/auction'
import type { Carrier, DeliveryCode } from '@/types/order'
import type { LedgerEntry, TransactionType, WalletAccount, WithdrawalStatus } from '@/types/wallet'
import type { ChargePurpose, ChargeStatus } from '@/types/payment'
import type { AccountStatus, WarningReason } from '@/types/member'

/** 카테고리 이름 (원본 $n) */
export const CATEGORY_LABELS: Record<Category, string> = {
  CONSOLE: '게임기 본체',
  GAME_SOFTWARE: '게임 타이틀',
  ACCESSORY: '주변기기',
  LIMITED_EDITION: '한정판',
  ETC: '기타',
}

/** 카테고리 설명 (원본 Qx, 홈 카테고리 카드) */
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  CONSOLE: '패미컴부터 스위치까지',
  GAME_SOFTWARE: '카트리지 · 디스크 · 게임카드',
  ACCESSORY: '패드 · 메모리카드 · 확장기기',
  LIMITED_EDITION: '기념판 · 컬러 한정',
  ETC: '굿즈 · 그 밖의 것',
}

/** 카테고리 키 순서 (원본 _o) */
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

/** 제조사 이름 (원본 Es) */
export const MANUFACTURER_LABELS: Record<Manufacturer, string> = {
  NINTENDO: '닌텐도',
  SONY: '소니',
  MICROSOFT: '마이크로소프트',
  SEGA: '세가',
  ETC: '기타',
}

/** 제조사 키 순서 (원본 oA) */
export const MANUFACTURERS = Object.keys(MANUFACTURER_LABELS) as Manufacturer[]

/** 배송비 유형 (원본 cA) */
export const SHIPPING_FEE_TYPE_LABELS: Record<ShippingFeeType, string> = {
  FREE: '무료배송',
  FIXED_3000: '3,000원',
  FIXED_4000: '4,000원',
  CUSTOM: '직접 입력',
}

/** 경매 기간 (원본 uA) */
export const DURATION_LABELS: Record<AuctionDuration, string> = {
  DAYS_1: '1일',
  DAYS_3: '3일',
  DAYS_7: '7일',
  CUSTOM: '종료 시각 지정',
}

/** 경매 실패 사유 (원본 dA) */
export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  NO_BID: '유찰',
  UNPAID: '낙찰 무효',
  REFUNDED: '환불',
}

/** 택배사 (원본 kd) */
export const CARRIER_LABELS: Record<Carrier, string> = {
  CJ: 'CJ대한통운',
  LOTTE: '롯데택배',
  EPOST: '우체국택배',
  HANJIN: '한진택배',
  LOGEN: '로젠택배',
  KDEXP: '경동택배',
  DAESIN: '대신택배',
  ILYANG: '일양로지스',
  COUPANG: '쿠팡 로지스틱스',
  CU_POST: 'CU 편의점택배',
  GS_POSTBOX: 'GS Postbox',
}

/** 택배사 키 순서 (원본 Bx) */
export const CARRIERS = Object.keys(CARRIER_LABELS) as Carrier[]

/** 배송 추적 코드 (원본 qx) */
export const DELIVERY_CODE_LABELS: Record<DeliveryCode, string> = {
  UNKNOWN: '상태를 알 수 없음',
  WAITING: '대기 중',
  INFORMATION_RECEIVED: '운송장 접수',
  AT_PICKUP: '집하',
  IN_TRANSIT: '이동 중',
  OUT_FOR_DELIVERY: '배송 출발',
  ATTEMPT_FAIL: '배송 시도 실패',
  DELIVERED: '배송 완료',
  AVAILABLE_FOR_PICKUP: '지정 장소 보관',
  EXCEPTION: '확인 필요',
  WRONG: '미식별 코드',
}

/** 배송 진행 단계 순서 (원본 Zu) */
export const DELIVERY_PROGRESS_CODES: DeliveryCode[] = [
  'INFORMATION_RECEIVED',
  'AT_PICKUP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

/** 원장 거래 유형 (원본 Gx). 백엔드 WalletTransactionType 전체. 원장 화면은 없고 충전·결제 내역 연동 시 참고용 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  CHARGE: '충전',
  CHARGE_CANCEL: '충전 취소',
  WITHDRAWAL: '출금',
  HOLD_PAY: '결제',
  HOLD_RECEIVE: '결제 보관',
  SETTLEMENT_PAY: '정산 지급',
  SETTLEMENT_RECEIVE: '정산 입금',
  FEE_PAY: '수수료 지급',
  FEE_RECEIVE: '수수료 입금',
  REFUND_PAY: '환불 지급',
  REFUND_RECEIVE: '환불 입금',
  REVERSAL: '정정',
}

/** 지갑 주머니 이름 */
export const WALLET_ACCOUNT_LABELS: Record<WalletAccount, string> = {
  DEPOSIT: '예치금',
  SETTLEMENT: '정산금',
}

/** 사용자 지갑 내역에서 숨기는 원장 유형 (수수료·시스템 지갑 전용) */
export const HIDDEN_LEDGER_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'FEE_PAY',
  'FEE_RECEIVE',
  'HOLD_RECEIVE',
  'SETTLEMENT_PAY',
  'REFUND_PAY',
])

/**
 * 원장 한 줄의 한글 설명. 백엔드 원장에는 설명 문구가 없어서 유형 + 참조로 만든다.
 * 예) "토스페이먼츠 충전", "주문 결제", "환불 입금", "정산 입금"
 */
export function describeLedgerEntry(entry: LedgerEntry): string {
  switch (entry.type) {
    case 'CHARGE':
      return '토스페이먼츠 충전'
    case 'CHARGE_CANCEL':
      return '충전 취소 (카드 환불)'
    case 'WITHDRAWAL':
      return '예치금 출금 (등록 계좌)'
    case 'HOLD_PAY':
      return '주문 결제'
    case 'SETTLEMENT_RECEIVE':
      return '판매 대금 정산 입금'
    case 'REFUND_RECEIVE':
      return '주문 환불 입금'
    case 'REVERSAL':
      return '기록 정정'
    default:
      return TRANSACTION_TYPE_LABELS[entry.type]
  }
}

/** 출금 상태 */
export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  REQUESTED: '송금 대기',
  COMPLETED: '출금 완료',
  FAILED: '출금 실패',
}

/** 충전 건 상태 */
export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  REQUESTED: '결제 대기',
  CHARGED: '충전 완료',
  USED: '주문에 사용',
  CANCELED: '충전 취소',
  ABORTED: '결제 안 됨',
}

/** 충전 목적 */
export const CHARGE_PURPOSE_LABELS: Record<ChargePurpose, string> = {
  MANUAL: '예치금 충전',
  FOR_PAYMENT: '주문 결제 부족분',
}

/** 경고 사유 (원본 Xx) */
export const WARNING_REASON_LABELS: Record<WarningReason, string> = {
  PAYMENT_DEFAULT: '결제 미이행',
  REFUND_PENALTY: '환불 패널티',
  REPORT: '신고 누적',
}

/** 계정 상태 (원본 Yx) */
export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: '정상',
  LOCKED: '로그인 잠김',
  SUSPENDED: '활동 정지',
  BANNED: '차단',
}

/** 정산 계좌 은행 목록 (원본 Wx) */
export const BANKS = [
  '국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  '농협은행',
  '기업은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  '우체국',
]
