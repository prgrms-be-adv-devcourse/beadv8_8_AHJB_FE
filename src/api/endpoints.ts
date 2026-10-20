import { http } from './client'
import type { PageParams, PageResponse } from '@/types/common'
import type { AvailabilityResponse, LoginRequest, LoginResponse, SignupRequest } from '@/types/auth'
import type { Me, MemberSummary, RegisterSellerRequest, Warning } from '@/types/member'
import type {
  MyProduct,
  ProductCreateRequest,
  ProductCreateResponse,
  ProductImageUploadResponse,
  ProductDetail,
  ProductUpdateRequest,
  Qna,
  QnaCreateRequest,
  QnaListParams,
  QnaListResponse,
  ReopenResponse,
  WishListResponse,
  WishToggleResponse,
} from '@/types/product'
import type {
  AuctionDetail,
  AuctionListParams,
  AuctionListResponse,
  Bid,
  BidResponse,
  InstantWinResponse,
  MyBid,
} from '@/types/auction'
import type { CartItem, CartPaymentResult } from '@/types/cart'
import type { DeliveryStatus, Order, SendProductRequest } from '@/types/order'
import type {
  HoldingPage,
  HoldingParams,
  LedgerPage,
  LedgerParams,
  Wallet,
  Withdrawal,
  WithdrawalListParams,
} from '@/types/wallet'
import type {
  ChargeConfirmRequest,
  ChargeListParams,
  ChargeSummary,
  PaymentConfirmRequest,
  PaymentQuote,
  PaymentSummary,
} from '@/types/payment'
import type { Refund, RefundProcessResult } from '@/types/refund'
import type { SettlementDetail, SettlementListParams, SettlementSummary } from '@/types/settlement'
import type {
  Review,
  ReviewCreateRequest,
  ReviewListResponse,
  ReviewUpdateRequest,
  ReviewableOrder,
} from '@/types/review'

type Id = number | string

/** 인증 (원본 Qa) */
export const authApi = {
  /** 201, 바디 없음 */
  signup: (body: SignupRequest) => http.post<null>('auth.signup', '/api/v1/auth/signup', body),
  login: (body: LoginRequest) => http.post<LoginResponse>('auth.login', '/api/v1/auth/login', body),
  /** 보통은 client.ts 의 refreshSession() 이 자동으로 호출한다 */
  reissue: (refreshToken: string) =>
    http.post<LoginResponse>('auth.reissue', '/api/v1/auth/reissue', { refreshToken }),
  /** 204 */
  logout: (refreshToken: string) =>
    http.post<null>('auth.logout', '/api/v1/auth/logout', { refreshToken }),
  emailAvailable: (email: string) =>
    http.get<AvailabilityResponse>('auth.emailAvailable', '/api/v1/auth/email-availability', { email }),
  nicknameAvailable: (nickname: string) =>
    http.get<AvailabilityResponse>('auth.nicknameAvailable', '/api/v1/auth/nickname-availability', {
      nickname,
    }),
}

/** 회원 (원본 Fo) */
export const memberApi = {
  me: () => http.get<Me>('member.me', '/api/v1/member/me'),
  summary: () => http.get<MemberSummary>('member.summary', '/api/v1/member/me/summary'),
  warnings: () => http.get<Warning[]>('member.warnings', '/api/v1/member/me/warnings'),
  /** 201, 바디 없음 */
  registerSeller: (body: RegisterSellerRequest) =>
    http.post<null>('member.registerSeller', '/api/v1/member/me/seller', body),
}

/** 상품 (원본 ws) */
export const productApi = {
  detail: (productId: Id) => http.get<ProductDetail>('product.detail', `/api/v1/products/${productId}`),
  mine: () => http.get<MyProduct[]>('product.mine', '/api/v1/products/me'),
  create: (body: ProductCreateRequest) =>
    http.post<ProductCreateResponse>('product.create', '/api/v1/products', body),
  update: (productId: Id, body: ProductUpdateRequest) =>
    http.patch<null>('product.update', `/api/v1/products/${productId}`, body),
  /** 204 */
  remove: (productId: Id) => http.delete<null>('product.delete', `/api/v1/products/${productId}`),
  /**
   * 곧 시작(경매 생성 전) 목록. 경매 행이 없어서 상품 도메인이 제공한다 (미구현, 경로는 제안).
   * status 는 보내지 않는다. 카테고리·페이지만.
   */
  upcoming: (params: Pick<AuctionListParams, 'category' | 'page' | 'size'>) =>
    http.get<AuctionListResponse>('product.upcoming', '/api/v1/products/upcoming', { ...params }),
  /** 사진 1장 업로드 (판매자만). 받은 imageId 를 등록·수정의 imageIds 로 보낸다 */
  uploadImage: (file: Blob, fileName: string) => {
    const formData = new FormData()
    formData.append('file', file, fileName)
    return http.post<ProductImageUploadResponse>('product.images', '/api/v1/products/images', formData)
  },
  /** 유찰·낙찰 무효 뒤 다음 회차 열기 */
  reopen: (productId: Id) =>
    http.post<ReopenResponse>('auction.reopen', `/api/v1/products/${productId}/rounds`),
}

/** 상품 Q&A (원본 Xu) */
export const qnaApi = {
  list: (productId: Id, params: QnaListParams = {}) =>
    http.get<QnaListResponse>('qna.list', `/api/v1/products/${productId}/qnas`, params),
  create: (productId: Id, body: QnaCreateRequest) =>
    http.post<Qna>('qna.create', `/api/v1/products/${productId}/qnas`, body),
  update: (qnaId: Id, content: string) => http.patch<Qna>('qna.update', `/api/v1/qnas/${qnaId}`, { content }),
  /** 204 */
  remove: (qnaId: Id) => http.delete<null>('qna.delete', `/api/v1/qnas/${qnaId}`),
}

/** 찜 (원본 Ho) */
export const wishApi = {
  add: (productId: Id) => http.post<WishToggleResponse>('wish.add', `/api/v1/products/${productId}/wishes`),
  remove: (productId: Id) =>
    http.delete<WishToggleResponse>('wish.remove', `/api/v1/products/${productId}/wishes`),
  list: (params: PageParams = {}) => http.get<WishListResponse>('wish.list', '/api/v1/wishes', params),
}

/** 경매 (원본 dr) */
export const auctionApi = {
  /** 진행 중·종료 목록. 곧 시작은 productApi.upcoming (listByTab 이 골라 준다) */
  list: (params: AuctionListParams) =>
    http.get<AuctionListResponse>('auction.list', '/api/v1/auctions', { ...params }),
  /** 탭에 맞는 API 로 목록 조회: 곧 시작 → 상품 API, 나머지 → 경매 API */
  listByTab: (params: AuctionListParams) =>
    params.status === 'SCHEDULED'
      ? productApi.upcoming({ category: params.category, page: params.page, size: params.size })
      : auctionApi.list(params),
  detail: (auctionId: Id) => http.get<AuctionDetail>('auction.detail', `/api/v1/auctions/${auctionId}`),
  bids: (auctionId: Id, params: PageParams = {}) =>
    http.get<PageResponse<Bid>>('auction.bids', `/api/v1/auctions/${auctionId}/bids`, params),
  bid: (auctionId: Id, bidPrice: number) =>
    http.post<BidResponse>('auction.bid', `/api/v1/auctions/${auctionId}/bids`, { bidPrice }),
  instantWin: (auctionId: Id) =>
    http.post<InstantWinResponse>('auction.instantWin', `/api/v1/auctions/${auctionId}/instant-win`),
  myBids: () => http.get<MyBid[]>('auction.myBids', '/api/v1/auctions/me/bids'),
}

/** 장바구니 (원본 Ga) */
export const cartApi = {
  list: () => http.get<CartItem[]>('cart.list', '/api/v1/cart'),
  pay: (productIds: number[]) =>
    http.post<CartPaymentResult | null>('cart.pay', '/api/v1/cart/payment', { productIds }),
}

/** 주문 (원본 js) */
export const orderApi = {
  winner: (params: PageParams = {}) => http.get<Order[]>('order.winner', '/api/v1/order/winner', params),
  seller: (params: PageParams = {}) => http.get<Order[]>('order.seller', '/api/v1/order/seller', params),
  detail: (orderId: Id) => http.get<Order>('order.detail', `/api/v1/order/${orderId}`),
  confirm: (orderId: Id) => http.post<null>('order.confirm', `/api/v1/order/${orderId}/confirm-purchase`),
  requestRefund: (orderId: Id) =>
    http.post<null>('order.refund', `/api/v1/order/${orderId}/request-refund`),
  send: (orderId: Id, body: SendProductRequest) =>
    http.post<null>('order.send', `/api/v1/order/${orderId}/send-product`, body),
  delivery: (orderId: Id) => http.get<DeliveryStatus>('delivery.status', `/api/v1/order/${orderId}/delivery`),
}

/** 지갑 (원본 Mi). 백엔드 WalletApiController */
export const walletApi = {
  /** 잔액. balance = 예치금, settlementBalance = 정산금 */
  me: () => http.get<Wallet>('wallet.me', '/api/v1/wallet/me'),
  /** 원장(입출금 내역). 최신순, size 최대 50 */
  ledger: (params: LedgerParams = {}) => http.get<LedgerPage>('wallet.ledger', '/api/v1/wallet/me/ledger', params),
  /** 홀딩(묶인 돈 / 정산 예정). role 기본 BUYER, size 최대 50 */
  holdings: (params: HoldingParams = {}) =>
    http.get<HoldingPage>('wallet.holdings', '/api/v1/wallet/me/holdings', params),
  /** 예치금 전액 출금(명목상). 잔액 → 0. 잔액 0 이면 WALLET601. 정산금은 출금되지 않는다 */
  withdraw: () => http.post<Withdrawal>('wallet.withdraw', '/api/v1/wallet/me/withdrawals'),
  /** 내 출금 내역. 최신순, size 최대 50 */
  withdrawals: (params: WithdrawalListParams = {}) =>
    http.get<PageResponse<Withdrawal>>('wallet.withdrawals', '/api/v1/wallet/me/withdrawals', params),
}

/** 결제 · 충전 (백엔드 PaymentApiController) */
export const paymentApi = {
  /** 충전 요청. 응답의 pgOrderId / amount / orderName 을 토스 결제창에 넘긴다 */
  requestCharge: (amount: number) =>
    http.post<ChargeSummary>('payment.chargeRequest', '/api/v1/payments/charges', { amount }),
  /** 충전 승인. 토스 successUrl 쿼리(paymentKey, orderId, amount)를 그대로 넘긴다. 멱등 */
  confirmCharge: (body: ChargeConfirmRequest) =>
    http.post<ChargeSummary>('payment.chargeConfirm', '/api/v1/payments/charges/confirm', body),
  /** 내 충전 내역 (수동 충전 + 주문 부족분 충전). 최신순 */
  charges: (params: ChargeListParams = {}) =>
    http.get<PageResponse<ChargeSummary>>('payment.charges', '/api/v1/payments/charges/me', params),
  /** 충전 1건 상세 */
  chargeDetail: (chargeId: number) =>
    http.get<ChargeSummary>('payment.chargeDetail', `/api/v1/payments/charges/${chargeId}`),
  /** 충전 취소. cancelable 인 건만. 예치금에서 차감한 뒤 토스 결제를 취소한다 */
  cancelCharge: (chargeId: number) =>
    http.post<ChargeSummary>('payment.chargeCancel', `/api/v1/payments/charges/${chargeId}/cancel`),
  /** 주문 결제 승인. 토스 승인 → 부족분 충전 → 주문 대금 홀딩까지 한 번에. 멱등 */
  confirmPayment: (body: PaymentConfirmRequest) =>
    http.post<PaymentSummary>('payment.confirm', '/api/v1/payments/confirm', body),
  /** 결제 전 견적: 지금 잔액으로 amount 를 결제하면 예치금/카드가 각각 얼마인지 */
  quote: (amount: number) => http.get<PaymentQuote>('payment.quote', '/api/v1/payments/quote', { amount }),
}

/** 환불 (원본 cd) */
export const refundApi = {
  detail: (refundId: Id) => http.get<Refund>('refund.detail', `/api/v1/refunds/${refundId}`),
  byOrder: (orderId: Id) => http.get<Refund>('refund.byOrder', '/api/v1/refunds', { orderId }),
  accept: (refundId: Id) =>
    http.patch<RefundProcessResult>('refund.accept', `/api/v1/refunds/${refundId}/accept`),
  reject: (refundId: Id) =>
    http.patch<RefundProcessResult>('refund.reject', `/api/v1/refunds/${refundId}/reject`),
}

/** 정산 (원본 Yu) */
export const settlementApi = {
  list: (params: SettlementListParams = {}) =>
    http.get<PageResponse<SettlementSummary>>('settlement.list', '/api/v1/settlements', params),
  detail: (settlementId: Id) =>
    http.get<SettlementDetail>('settlement.detail', `/api/v1/settlements/${settlementId}`),
}

/** 후기 (원본 Oi) */
export const reviewApi = {
  reviewable: () => http.get<ReviewableOrder[]>('review.reviewable', '/api/v1/reviews/reviewable-orders'),
  create: (body: ReviewCreateRequest) => http.post<Review>('review.create', '/api/v1/reviews', body),
  received: (params: PageParams = {}) =>
    http.get<ReviewListResponse>('review.received', '/api/v1/reviews/received', params),
  written: (params: PageParams = {}) =>
    http.get<ReviewListResponse>('review.written', '/api/v1/reviews/written', params),
  update: (reviewId: Id, body: ReviewUpdateRequest) =>
    http.patch<Review>('review.update', `/api/v1/reviews/${reviewId}`, body),
  /** 204 */
  remove: (reviewId: Id) => http.delete<null>('review.delete', `/api/v1/reviews/${reviewId}`),
}
