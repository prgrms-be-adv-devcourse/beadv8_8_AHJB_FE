import type { AuctionDuration, Category, Manufacturer, ShippingFeeType } from '@/types/product'

/**
 * 오류 키 = 포커스할 요소 id 의 접미사(`sell-<key>`).
 * 순서가 곧 제출 시 포커스 우선순위다.
 */
export type SellFieldKey =
  | 'images'
  | 'name'
  | 'category'
  | 'manufacturer'
  | 'description'
  | 'customFee'
  | 'startingPrice'
  | 'instantWinPrice'
  | 'customEndAt'
  | 'agreed'

export type SellErrors = Record<SellFieldKey, string | null>

export interface SellFormValues {
  images: string[]
  name: string
  category: Category | ''
  manufacturer: Manufacturer | ''
  manufacturerEtc: string
  description: string
  shippingFeeType: ShippingFeeType
  /** 직접 입력 배송비 입력값(쉼표 포함 문자열) */
  customFeeText: string
  startingPrice: number
  instantWinPrice: number
  /** 즉시낙찰가 입력값. 비었으면 검사하지 않음 */
  instantWinPriceText: string
  duration: AuctionDuration
  /** datetime-local 값 'YYYY-MM-DDTHH:mm' */
  customEndAtText: string
  /** 계산된 종료 시각(ms) */
  endAt: number
  /** 경매 시작 예정 시각(ms) */
  startAt: number
  agreed: boolean
}

/** 판매 폼 검사 (원본 mp 의 useMemo). 항목별 오류 문구, 문제없으면 null */
export function validateSellForm(v: SellFormValues): SellErrors {
  return {
    images: v.images.length < 1 ? '사진을 1장 이상 올려 주세요.' : null,
    name: v.name.trim() ? (v.name.length > 100 ? '상품명은 100자까지예요.' : null) : '상품명을 입력해 주세요.',
    category: v.category ? null : '카테고리를 골라 주세요.',
    manufacturer: v.manufacturer
      ? v.manufacturer === 'ETC' && !v.manufacturerEtc.trim()
        ? '제조사 이름을 직접 입력해 주세요.'
        : null
      : '제조사를 골라 주세요.',
    description: v.description.trim().length < 10 ? '구성품·상태·동작 여부를 10자 이상 적어 주세요.' : null,
    customFee: v.shippingFeeType === 'CUSTOM' && !v.customFeeText ? '배송비를 입력해 주세요.' : null,
    startingPrice: v.startingPrice < 1000 ? '시작가는 1,000원 이상이에요.' : null,
    instantWinPrice:
      v.instantWinPriceText && v.instantWinPrice <= v.startingPrice
        ? '즉시낙찰가는 시작가보다 커야 해요.'
        : null,
    // NaN(빈 값/잘못된 값) 은 비교가 false 라 통과하지만, 빈 값은 !customEndAtText 로 걸린다
    customEndAt:
      v.duration === 'CUSTOM' && (!v.customEndAtText || v.endAt <= v.startAt + 3600 * 1000)
        ? '종료 시각은 경매 시작(등록 1시간 뒤)보다 1시간 이상 뒤여야 해요.'
        : null,
    agreed: v.agreed ? null : '판매 정책에 동의해 주세요.',
  }
}
