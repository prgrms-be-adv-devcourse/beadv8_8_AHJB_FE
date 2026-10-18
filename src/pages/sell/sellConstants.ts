import type { AuctionDuration, ShippingFeeType } from '@/types/product'

/** 사진 최대 장수 (원본 Ua) */
export const MAX_IMAGES = 10

/** 판매 정책 버전 (원본 hp) */
export const POLICY_VERSION = 'v1'

/** 배송비 선택지 순서 (원본 Cb) */
export const SHIPPING_FEE_TYPES: ShippingFeeType[] = ['FREE', 'FIXED_3000', 'FIXED_4000', 'CUSTOM']

/** 진행 기간 선택지 순서 (원본 Sb) */
export const DURATIONS: AuctionDuration[] = ['DAYS_1', 'DAYS_3', 'DAYS_7', 'CUSTOM']

const DAY_MS = 86_400_000

/** 진행 기간별 길이(ms). CUSTOM 은 종료 시각을 직접 받는다 (원본 Ib) */
export const DURATION_MS: Record<Exclude<AuctionDuration, 'CUSTOM'>, number> = {
  DAYS_1: DAY_MS,
  DAYS_3: 3 * DAY_MS,
  DAYS_7: 7 * DAY_MS,
}

/** 등록 후 경매 자동 시작까지 = 수정 가능 시간 1시간 (원본 Ob) */
export const EDIT_WINDOW_MS = 3600 * 1000

/** 새 상품의 '종료 시각 지정' 기본값: 지금부터 3일 뒤 */
export const DEFAULT_CUSTOM_END_OFFSET_MS = 3 * DAY_MS

/** 업로드 사진 축소 기준 (원본 IO(file, 800, 0.8) 호출값) */
export const UPLOAD_MAX_SIZE = 800
export const UPLOAD_QUALITY = 0.8

/** 배송비 유형 → 실제 금액(원). CUSTOM 은 입력값 */
export function shippingFeeOf(feeType: ShippingFeeType, customFee: number): number {
  return feeType === 'CUSTOM' ? customFee : feeType === 'FREE' ? 0 : feeType === 'FIXED_3000' ? 3000 : 4000
}
