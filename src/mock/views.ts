// DB 레코드 → API 응답 형태 변환
import { db } from './db';
import { currentPriceOf, memberById, latestAuctionOf, walletOf, wishCountOf } from './services';
import type {
  AuctionRecord,
  OrderRecord,
  ProductRecord,
  QnaRecord,
  RefundRecord,
  ReviewRecord,
} from './types';
import { shippingFeeOf } from './utils';

/** 상품 기준 경매 상태: 현재 회차 경매가 아직 없으면 SCHEDULED */
export function productAuctionStatus(product: ProductRecord, latest: AuctionRecord | undefined): string {
  return !latest || latest.round < product.round ? 'SCHEDULED' : latest.status;
}

/** 경매 목록/내 상품 카드 */
export function toAuctionSummary(product: ProductRecord) {
  const latest = latestAuctionOf(product);
  const current = latest && latest.round === product.round ? latest : undefined;
  return {
    productId: product.id,
    auctionId: current?.id ?? null,
    productName: product.name,
    thumbnailUrl: product.imageUrls[0] ?? null,
    category: product.category,
    manufacturer: product.manufacturer,
    status: productAuctionStatus(product, latest),
    startPrice: product.startingPrice,
    currentPrice: current ? (current.winningPrice ?? currentPriceOf(current)) : product.startingPrice,
    instantWinPrice: product.instantWinPrice,
    bidCount: current?.bidCount ?? 0,
    wishCount: wishCountOf(product.id),
    shippingFee: shippingFeeOf(product),
    startAt: current?.startAt ?? product.auctionScheduledAt,
    endAt: current?.endAt ?? null,
  };
}

export type AuctionSummary = ReturnType<typeof toAuctionSummary>;

export function toOrderView(order: OrderRecord) {
  const product = db.products.find((p) => p.id === order.productId) as ProductRecord;
  return {
    id: order.id,
    winnerId: memberById(order.winnerId).uuid,
    sellerId: memberById(order.sellerId).uuid,
    productId: order.productId,
    winningPrice: order.winningPrice,
    deliveryFee: order.deliveryFee,
    state: order.state,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    productName: product.name,
    thumbnailUrl: product.imageUrls[0] ?? null,
    confirmExpiredAt: order.confirmExpiredAt,
  };
}

export interface QnaView {
  qnaId: number;
  parentId: number | null;
  content: string | null;
  writerId: number;
  writerNickname: string;
  isSeller: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: QnaView[];
}

export function toQnaView(qna: QnaRecord, sellerId: number): QnaView {
  const writer = memberById(qna.writerId);
  return {
    qnaId: qna.id,
    parentId: qna.parentId,
    content: qna.deleted ? null : qna.content,
    writerId: qna.writerId,
    writerNickname: writer.nickname,
    isSeller: qna.writerId === sellerId,
    isDeleted: qna.deleted,
    createdAt: qna.createdAt,
    updatedAt: qna.updatedAt,
    replies: [],
  };
}

export function toReviewView(review: ReviewRecord) {
  const product = db.products.find((p) => p.id === review.productId) as ProductRecord;
  return {
    reviewId: review.id,
    orderId: review.orderId,
    productId: review.productId,
    productName: product.name,
    writerId: review.writerId,
    writerNickname: memberById(review.writerId).nickname,
    targetId: review.targetId,
    targetNickname: memberById(review.targetId).nickname,
    rating: review.rating,
    content: review.content,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

/** 환불 조회 응답 */
export const toRefundView = (refund: RefundRecord) => ({
  refundId: refund.id,
  orderId: refund.orderId,
  productId: refund.productId,
  amount: refund.amount,
  status: refund.status,
  requestedAt: refund.requestedAt,
  processedAt: refund.processedAt,
});

/** 환불 승인/거절 응답 */
export const toRefundProcessView = (refund: RefundRecord) => ({
  refundId: refund.id,
  orderId: refund.orderId,
  winnerId: refund.winnerId,
  status: refund.status,
  amount: refund.amount,
  requestedAt: refund.requestedAt,
  processedAt: refund.processedAt,
});

/** 내 지갑: 보관금 = HELD + CONFIRMED 홀딩 합계 */
export function toWalletView(memberId: number) {
  return {
    walletId: 3000 + memberId,
    balance: walletOf(memberId).balance,
    heldAmount: db.holdings
      .filter((h) => h.winnerId === memberId && (h.status === 'HELD' || h.status === 'CONFIRMED'))
      .reduce((acc, h) => acc + h.amount, 0),
  };
}
