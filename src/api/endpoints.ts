import { http } from './client'
import type { PageParams, PageResponse } from '@/types/common'
import type { AvailabilityResponse, LoginRequest, LoginResponse, SignupRequest } from '@/types/auth'
import type { Me, RegisterSellerRequest, Warning } from '@/types/member'
import type {
  MyProduct,
  ProductCreateRequest,
  ProductCreateResponse,
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
  AuctionSummary,
  Bid,
  BidResponse,
  InstantWinResponse,
  MyBid,
} from '@/types/auction'
import type { CartItem, CartPaymentResult } from '@/types/cart'
import type { DeliveryStatus, Order, SendProductRequest } from '@/types/order'
import type { Wallet, WalletTransaction } from '@/types/wallet'
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
  list: (params: AuctionListParams) =>
    http.get<PageResponse<AuctionSummary>>('auction.list', '/api/v1/auctions', { ...params }),
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

/** 예치금 (원본 Mi) */
export const walletApi = {
  me: () => http.get<Wallet>('wallet.me', '/api/v1/wallet/me'),
  transactions: (params: PageParams = {}) =>
    http.get<PageResponse<WalletTransaction>>('wallet.transactions', '/api/v1/wallet/me/transactions', params),
  charge: (amount: number) => http.post<Wallet>('wallet.charge', '/api/v1/wallet/me/charge', { amount }),
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
