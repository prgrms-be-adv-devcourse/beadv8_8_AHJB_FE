import type { PageParams, PageResponse } from './common'
import type { AuctionSummary, FailureReason } from './auction'

export type Category = 'CONSOLE' | 'GAME_SOFTWARE' | 'ACCESSORY' | 'LIMITED_EDITION' | 'ETC'
export type Manufacturer = 'NINTENDO' | 'SONY' | 'MICROSOFT' | 'SEGA' | 'ETC'
export type ShippingFeeType = 'FREE' | 'FIXED_3000' | 'FIXED_4000' | 'CUSTOM'
export type AuctionDuration = 'DAYS_1' | 'DAYS_3' | 'DAYS_7' | 'CUSTOM'

export interface ShippingInput {
  feeType: ShippingFeeType
  customFee: number | null
  bundleAllowed: boolean
}

export interface ProductShipping extends ShippingInput {
  /** 실제 배송비(원) */
  fee: number
}

export interface AuctionTerms {
  startingPrice: number
  instantWinPrice: number | null
  duration: AuctionDuration
  /** duration === 'CUSTOM' 일 때만. 'YYYY-MM-DDTHH:mm:ss' */
  customEndAt: string | null
}

export interface ProductSeller {
  memberId: number
  nickname: string
  ratingAvg: number | null
  reviewCount: number
}

/** GET /api/v1/products/{productId} */
export interface ProductDetail {
  productId: number
  /** 현재 회차 경매 id. 아직 시작 전이면 null */
  auctionId: number | null
  round: number
  name: string
  category: Category
  manufacturer: Manufacturer
  manufacturerEtc: string | null
  description: string
  /** 'photo:<이름>' 또는 실제 URL/data URL */
  imageUrls: string[]
  shipping: ProductShipping
  auctionTerms: AuctionTerms
  auctionScheduledAt: string
  seller: ProductSeller
  wishCount: number
  wished: boolean
  isMine: boolean
  createdAt: string
}

export interface UpcomingListParams extends PageParams {
  /** 비우면 전체 */
  category?: Category | string
}

/** GET /api/v1/products/upcoming (곧 시작). 카드는 경매 목록과 같은 모양이고 status 는 항상 SCHEDULED */
export interface UpcomingListResponse extends PageResponse<AuctionSummary> {
  serverTime: string
}

/** GET /api/v1/products/me 의 항목 */
export interface MyProduct extends AuctionSummary {
  round: number
  auctionScheduledAt: string
  editable: boolean
  failureReason: FailureReason | null
  orderId: number | null
}

/** POST /api/v1/products */
export interface ProductCreateRequest {
  policyAgreed: boolean
  policyVersion: string
  name: string
  category: Category
  manufacturer: Manufacturer
  manufacturerEtc?: string
  imageIds: number[]
  imageUrls: string[]
  description: string
  shipping: ShippingInput
  auctionTerms: AuctionTerms
}

export interface ProductCreateResponse {
  productId: number
}

/** POST /api/v1/products/images (multipart, 파일 1장) */
export interface ProductImageUploadResponse {
  /** 상품 등록·수정의 imageIds 로 보낸다 */
  imageId: number
  /** 미리보기용 */
  imageUrl: string
}

/** PATCH /api/v1/products/{productId}. imageIds 를 보내면 이미지 목록 전체를 교체한다 */
export type ProductUpdateRequest = Partial<Omit<ProductCreateRequest, 'policyAgreed' | 'policyVersion'>>

/** POST /api/v1/products/{productId}/rounds */
export interface ReopenResponse {
  auctionId: number
  round: number
}

/* ---------- Q&A ---------- */

export interface Qna {
  qnaId: number
  parentId: number | null
  /** 삭제된 글이면 null */
  content: string | null
  writerId: number
  writerNickname: string
  /** 작성자가 상품 판매자인지 */
  isSeller: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  replies: Qna[]
}

export interface QnaListParams extends PageParams {
  /** 이 id 보다 큰 질문만 */
  after?: number
}

export interface QnaListResponse {
  qnas: Qna[]
  hasNext: boolean
  latestQnaId: number | null
}

export interface QnaCreateRequest {
  content: string
  /** 답글이면 질문 id */
  parentId?: number | null
}

/* ---------- 찜 ---------- */

export interface WishToggleResponse {
  productId: number
  wished: boolean
  wishCount: number
}

export interface WishItem {
  productId: number
  productName: string
  category: Category
  startPrice: number
  wishCount: number
  wishedAt: string
  thumbnailUrl: string | null
}

export interface WishListResponse {
  wishes: WishItem[]
  hasNext: boolean
}
