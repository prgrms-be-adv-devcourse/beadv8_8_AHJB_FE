// 목업 도메인 로직: 조회 헬퍼, 지갑, 경매/주문/환불 생명주기
import { db, nextId } from './db';
import { fail } from './errors';
import type { HandlerContext } from './router';
import type {
  AuctionDuration,
  AuctionRecord,
  CartItemRecord,
  MemberRecord,
  OrderRecord,
  ProductRecord,
  RefundRecord,
  TransactionReferenceType,
  TransactionType,
  WalletRecord,
} from './types';
import {
  bidUnitOf,
  feeOf,
  formatLocalDateTime as ldt,
  isDemoMember,
  now,
  parseTime,
  payoutDateOf,
  shippingFeeOf,
} from './utils';

// ---------- 인증 / 조회 ----------
/** 로그인 회원 필수 */
export function requireMe(ctx: HandlerContext): MemberRecord {
  if (!ctx.me) fail('COMMON002');
  return ctx.me;
}

/** 존재가 보장된 회원 조회 (없으면 undefined 를 그대로 반환) */
export const memberById = (id: number): MemberRecord => db.members.find((m) => m.id === id) as MemberRecord;

export function findProduct(id: number): ProductRecord {
  const product = db.products.find((p) => p.id === id && !p.deleted);
  if (!product) fail('PRODUCT001');
  return product;
}

export function findAuction(id: number): AuctionRecord {
  const auction = db.auctions.find((a) => a.id === id);
  if (!auction) fail('AUCTION001');
  return auction;
}

export function findOrder(id: number): OrderRecord {
  const order = db.orders.find((o) => o.id === id);
  if (!order) fail('ORDER001');
  return order;
}

/** 상품의 가장 최근 회차 경매 */
export const latestAuctionOf = (product: ProductRecord): AuctionRecord | undefined =>
  db.auctions.filter((a) => a.productId === product.id).sort((a, b) => b.round - a.round)[0];

/** 현재가 (입찰 없으면 시작가) */
export const currentPriceOf = (auction: AuctionRecord): number =>
  auction.bidCount === 0 ? auction.startPrice : (auction.highestBidPrice as number);

/** 최소 입찰가 */
export const minBidPriceOf = (auction: AuctionRecord): number =>
  auction.bidCount === 0 ? auction.startPrice : currentPriceOf(auction) + bidUnitOf(currentPriceOf(auction));

export const wishCountOf = (productId: number) => db.wishes.filter((w) => w.productId === productId).length;

/** 판매자 평점 (시드 기본 평점 + 삭제되지 않은 후기) */
export function sellerRatingOf(memberId: number): { ratingAvg: number | null; reviewCount: number } {
  const member = memberById(memberId);
  const reviews = db.reviews.filter((r) => r.targetId === memberId && !r.deleted);
  const count = member.baseRating.count + reviews.length;
  const sum = member.baseRating.sum + reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    ratingAvg: count ? Math.round((sum / count) * 10) / 10 : null,
    reviewCount: count,
  };
}

// ---------- 지갑 ----------
export function walletOf(memberId: number): WalletRecord {
  let wallet = db.wallets.find((w) => w.memberId === memberId);
  if (!wallet) {
    wallet = { memberId, balance: 0 };
    db.wallets.push(wallet);
  }
  return wallet;
}

/** 잔액 변경 + 거래 내역 기록 */
export function addTransaction(
  memberId: number,
  type: TransactionType,
  amount: number,
  referenceType: TransactionReferenceType,
  referenceId: number | null,
  description: string,
  at: number = now(),
): void {
  const wallet = walletOf(memberId);
  wallet.balance += amount;
  db.transactions.push({
    id: nextId('transactions'),
    memberId,
    type,
    amount,
    balanceAfter: wallet.balance,
    referenceType,
    referenceId,
    description,
    createdAt: ldt(at),
  });
}

// ---------- 경매 ----------
const DURATION_MS: Record<Exclude<AuctionDuration, 'CUSTOM'>, number> = {
  DAYS_1: 864e5,
  DAYS_3: 3 * 864e5,
  DAYS_7: 7 * 864e5,
};

/** 상품의 현재 회차 경매를 시작한다 (최소 1분) */
export function startAuction(product: ProductRecord, startAt: number): AuctionRecord {
  const endAt =
    product.duration === 'CUSTOM'
      ? parseTime(product.customEndAt as string)
      : startAt + DURATION_MS[product.duration];
  const auction: AuctionRecord = {
    id: nextId('auctions'),
    productId: product.id,
    sellerId: product.sellerId,
    round: product.round,
    startPrice: product.startingPrice,
    instantWinPrice: product.instantWinPrice,
    shippingFee: shippingFeeOf(product),
    status: 'IN_PROGRESS',
    failureReason: null,
    highestBidPrice: null,
    highestBidderId: null,
    bidCount: 0,
    winnerId: null,
    winningPrice: null,
    winAt: null,
    startAt: ldt(startAt),
    endAt: ldt(Math.max(endAt, startAt + 60000)),
  };
  db.auctions.push(auction);
  return auction;
}

/** 낙찰 처리: 장바구니에 담고, 데모 회원이 아니면 40초 뒤 자동 결제 예약 */
export function winAuction(auction: AuctionRecord, winnerId: number, winningPrice: number, at: number): void {
  auction.status = 'WON';
  auction.winnerId = winnerId;
  auction.winningPrice = winningPrice;
  auction.winAt = ldt(at);
  const cartItem: CartItemRecord = {
    id: nextId('cartItems'),
    winnerId,
    sellerId: auction.sellerId,
    auctionId: auction.id,
    productId: auction.productId,
    winningPrice,
    deliveryFee: auction.shippingFee,
    winAt: ldt(at),
    paymentDueAt: ldt(at + 864e5),
  };
  db.cartItems.push(cartItem);
  if (!isDemoMember(winnerId)) db.pending[`pay:${cartItem.id}`] = now() + 40000;
}

export function placeBid(auction: AuctionRecord, bidderId: number, bidPrice: number, at: number): void {
  db.bids.push({
    id: nextId('bids'),
    auctionId: auction.id,
    bidderId,
    bidPrice,
    bidAt: ldt(at),
  });
  auction.highestBidPrice = bidPrice;
  auction.highestBidderId = bidderId;
  auction.bidCount += 1;
}

// ---------- 주문 ----------
/** 구매확정: 경매 완료, 보관금 확정, 정산서(PENDING) 생성 */
export function confirmPurchase(order: OrderRecord, at: number): void {
  order.state = 'CONFIRMED';
  order.confirmedAt = ldt(at);
  order.updatedAt = ldt(at);
  const auction = db.auctions.find((a) => a.id === order.auctionId);
  if (auction) auction.status = 'COMPLETED';
  const holding = db.holdings.find((h) => h.orderId === order.id);
  if (holding) holding.status = 'CONFIRMED';
  const product = db.products.find((p) => p.id === order.productId) as ProductRecord;
  const feeAmount = feeOf(order.winningPrice);
  db.settlements.push({
    id: nextId('settlements'),
    orderId: order.id,
    sellerId: order.sellerId,
    productId: order.productId,
    productName: product.name,
    winningPrice: order.winningPrice,
    deliveryFee: order.deliveryFee,
    feeAmount,
    settlementAmount: order.winningPrice - feeAmount + order.deliveryFee,
    status: 'PENDING',
    confirmedAt: order.confirmedAt,
    payoutDate: payoutDateOf(order.confirmedAt),
    completedAt: null,
  });
}

/** 발송 처리: 빠른 진행(fast) 배송 생성 */
export function shipOrder(order: OrderRecord, carrier: string, waybill: string, at: number): void {
  db.deliveries.push({
    id: nextId('deliveries'),
    orderId: order.id,
    carrier,
    waybill,
    code: 'INFORMATION_RECEIVED',
    fast: true,
    createdAt: ldt(at),
    updatedAt: ldt(at),
  });
  order.state = 'SHIPPING';
  order.updatedAt = ldt(at);
}

/**
 * 장바구니 결제 (원본 QA).
 * forceTopUp=true 면 잔액 부족 시 부족분 대신 결제 총액만큼 잔액을 채워 결제한다(가상 회원 자동 결제용).
 */
export function payCartItems(memberId: number, productIds: number[], at: number, forceTopUp = false): void {
  const items = productIds.map((productId) => {
    const item = db.cartItems.find((c) => c.productId === productId);
    if (!item) fail('CART001');
    if (item.winnerId !== memberId) fail('CART002');
    if (parseTime(item.paymentDueAt) <= at) fail('CART003');
    return item;
  });
  if (!items.length) fail('ORDER005');
  const total = items.reduce((acc, item) => acc + item.winningPrice + item.deliveryFee, 0);
  if (walletOf(memberId).balance < total) {
    if (forceTopUp) walletOf(memberId).balance += total;
    else fail('WALLET201');
  }
  const orderGroupId = nextId('orderGroups');
  const orders: OrderRecord[] = items.map((item) => ({
    id: nextId('orders'),
    orderGroupId,
    winnerId: memberId,
    sellerId: item.sellerId,
    auctionId: item.auctionId,
    productId: item.productId,
    winningPrice: item.winningPrice,
    deliveryFee: item.deliveryFee,
    state: 'PAID',
    shippedAt: null,
    confirmExpiredAt: null,
    confirmedAt: null,
    createdAt: ldt(at),
    updatedAt: ldt(at),
  }));
  db.orders.push(...orders);
  const names = orders.map((o) => (db.products.find((p) => p.id === o.productId) as ProductRecord).name);
  addTransaction(
    memberId,
    'HOLD_PAY',
    -total,
    'ORDER',
    orderGroupId,
    orders.length > 1 ? `${names[0]} 외 ${orders.length - 1}건 결제` : `${names[0]} 결제`,
    at,
  );
  orders.forEach((order) => {
    db.holdings.push({
      orderId: order.id,
      winnerId: memberId,
      amount: order.winningPrice + order.deliveryFee,
      status: 'HELD',
    });
    const auction = db.auctions.find((a) => a.id === order.auctionId);
    if (auction) auction.status = 'PAID';
    // 판매자가 데모 회원이 아니면 15초 뒤 자동 발송
    if (!isDemoMember(order.sellerId)) db.pending[`send:${order.id}`] = at + 15000;
  });
  db.cartItems = db.cartItems.filter((c) => !items.includes(c));
}

// ---------- 환불 ----------
/** 환불 승인: 환불 ACCEPTED, 보관금 반환(지갑 환불). 1.5초 뒤 환불 완료 처리 */
export function acceptRefund(refund: RefundRecord, at: number): void {
  refund.status = 'ACCEPTED';
  refund.processedAt = ldt(at);
  const order = findOrder(refund.orderId);
  const holding = db.holdings.find((h) => h.orderId === order.id);
  const product = db.products.find((p) => p.id === order.productId) as ProductRecord;
  if (holding && holding.status === 'HELD') {
    holding.status = 'REFUNDED';
    addTransaction(order.winnerId, 'REFUND_RECEIVE', holding.amount, 'REFUND', refund.id, `${product.name} 환불`, at);
  }
  db.pending[`refundComplete:${refund.id}`] = at + 1500;
}

/** 환불 완료(지갑 환불 완료 이벤트 역할): 환불 COMPLETED → 주문 REFUNDED, 경매 실패 처리, 구매자 경고 */
export function completeRefund(refund: RefundRecord, at: number): void {
  refund.status = 'COMPLETED';
  const order = findOrder(refund.orderId);
  order.state = 'REFUNDED';
  order.updatedAt = ldt(at);
  const auction = db.auctions.find((a) => a.id === order.auctionId);
  if (auction) {
    auction.status = 'FAILED';
    auction.failureReason = 'REFUNDED';
  }
  db.warnings.push({
    id: nextId('warnings'),
    memberId: order.winnerId,
    reason: 'REFUND_PENALTY',
    orderId: order.id,
    createdAt: ldt(at),
  });
}

/** 환불 거절: 곧바로 구매확정 처리 */
export function rejectRefund(refund: RefundRecord, at: number): void {
  refund.status = 'REJECTED';
  refund.processedAt = ldt(at);
  confirmPurchase(findOrder(refund.orderId), at);
}
