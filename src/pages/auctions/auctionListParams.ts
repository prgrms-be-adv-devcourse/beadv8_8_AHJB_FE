import type { AuctionListParams, AuctionListStatus, AuctionSort } from '@/types/auction'

/** 목록 한 페이지 크기 (원본 gA) */
export const AUCTION_PAGE_SIZE = 20

/** 정렬 옵션 (원본 yE) */
export const SORT_OPTIONS: Array<{ value: AuctionSort; label: string }> = [
  { value: 'ENDING_SOON', label: '마감 임박순' },
  { value: 'NEWEST', label: '최신 등록순' },
  { value: 'BIDS', label: '입찰 많은순' },
  { value: 'WISHES', label: '찜 많은순' },
  { value: 'PRICE_ASC', label: '낮은 가격순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
]

/** 경매 상태 필터 (원본 ep). value 가 없으면 '진행 중 + 곧 시작' */
export const STATUS_OPTIONS: Array<{ value: AuctionListStatus | undefined; label: string }> = [
  { value: undefined, label: '진행 중 + 곧 시작' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'SCHEDULED', label: '곧 시작' },
  { value: 'ENDED', label: '종료' },
]

/** URL 쿼리 → 경매 목록 요청 파라미터 (원본 xE) */
export function parseAuctionListParams(searchParams: URLSearchParams): AuctionListParams {
  const numberParam = (key: string) => (searchParams.get(key) ? Number(searchParams.get(key)) : undefined)
  return {
    keyword: searchParams.get('keyword') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    manufacturer: searchParams.get('manufacturer') ?? undefined,
    instantWin: searchParams.get('instantWin') === 'true' || undefined,
    minPrice: numberParam('minPrice'),
    maxPrice: numberParam('maxPrice'),
    sort: searchParams.get('sort') ?? 'ENDING_SOON',
    page: numberParam('page') ?? 0,
    size: AUCTION_PAGE_SIZE,
  }
}

/** 쿼리 값 갱신용 (null 또는 '' 이면 해당 키 삭제) */
export type ParamUpdates = Record<string, string | null>
