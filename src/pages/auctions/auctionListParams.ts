import { CATEGORIES } from '@/lib/labels'
import type { AuctionListParams, AuctionListStatus, AuctionSort } from '@/types/auction'
import type { Category } from '@/types/product'

/** 목록 한 페이지 크기 (원본 gA) */
export const AUCTION_PAGE_SIZE = 20

/** 상단 탭 (헤더 내비와 같은 순서). 진행 중이 기본 */
export const STATUS_TABS: Array<{ value: AuctionListStatus; label: string; title: string }> = [
  { value: 'IN_PROGRESS', label: '진행 중 경매', title: '진행 중 경매' },
  { value: 'SCHEDULED', label: '곧 시작', title: '곧 시작하는 경매' },
  { value: 'ENDED', label: '종료된 경매', title: '종료된 경매' },
]

/**
 * 탭별 정렬 선택지 (첫 번째가 기본값, 백엔드 기본값과 같다).
 * 곧 시작은 상품 API 가 시작 임박순으로 고정해서 선택지가 없다.
 */
export const SORT_OPTIONS: Record<AuctionListStatus, Array<{ value: AuctionSort; label: string }>> = {
  IN_PROGRESS: [
    { value: 'ENDING_SOON', label: '마감 임박순' },
    { value: 'NEWEST', label: '최신 등록순' },
    { value: 'MOST_BIDS', label: '입찰 많은순' },
    { value: 'PRICE_ASC', label: '낮은 가격순' },
    { value: 'PRICE_DESC', label: '높은 가격순' },
  ],
  ENDED: [
    { value: 'RECENTLY_ENDED', label: '최근 종료순' },
    { value: 'PRICE_DESC', label: '높은 낙찰가순' },
    { value: 'MOST_BIDS', label: '입찰 많은순' },
  ],
  SCHEDULED: [],
}

const isStatus = (value: string | null): value is AuctionListStatus =>
  value === 'IN_PROGRESS' || value === 'SCHEDULED' || value === 'ENDED'

const isCategory = (value: string | null): value is Category =>
  !!value && (CATEGORIES as string[]).includes(value)

/** URL 쿼리 → 경매 목록 요청 파라미터 (원본 xE). 모르는 값은 버린다 */
export function parseAuctionListParams(searchParams: URLSearchParams): AuctionListParams & {
  status: AuctionListStatus
} {
  const rawStatus = searchParams.get('status')
  const status: AuctionListStatus = isStatus(rawStatus) ? rawStatus : 'IN_PROGRESS'
  const rawCategory = searchParams.get('category')
  const rawSort = searchParams.get('sort')
  const sort = SORT_OPTIONS[status].find((option) => option.value === rawSort)?.value
  const page = Number(searchParams.get('page'))
  return {
    status,
    category: isCategory(rawCategory) ? rawCategory : undefined,
    // 탭에 없는 정렬이면 보내지 않는다 → 백엔드 기본값
    sort,
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: AUCTION_PAGE_SIZE,
  }
}

/** 쿼리 값 갱신용 (null 또는 '' 이면 해당 키 삭제) */
export type ParamUpdates = Record<string, string | null>
