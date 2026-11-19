// 목업 도메인 로직: 조회 헬퍼, 지갑, 경매/주문/환불 생명주기
import { db, nextId } from './db';
import { fail } from './errors';
import type { HandlerContext } from './router';
import type {
  AuctionDuration,
  AuctionRecord,
  CartItemRecord,
  HoldingRecord,
  MemberRecord,
  OrderRecord,
  PayMethod,
  ProductRecord,
  RefundRecord,
  TransactionReferenceType,
  TransactionType,
  WalletRecord,
} from './types';
import {
  POINT_EARN_RATE_PERCENT,
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
    wallet = { memberId, balance: 0, pointBalance: 0 };
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

/** 포인트 잔액 변경 + 포인트 내역 기록. amount 가 0 이면 아무것도 남기지 않는다 */
export function addPointTransaction(
  memberId: number,
  type: TransactionType,
  amount: number,
  referenceType: TransactionReferenceType,
  referenceId: number | null,
  description: string,
  at: number = now(),
): void {
  if (amount === 0) return;
  const wallet = walletOf(memberId);
  wallet.pointBalance += amount;
  db.transactions.push({
    id: nextId('transactions'),
    memberId,
    account: 'POINT',
    type,
    amount,
    balanceAfter: wallet.pointBalance,
    referenceType,
    referenceId,
    description,
    createdAt: ldt(at),
  });
}

/**
 * 적립 포인트 (백엔드 PointPolicy.earnOf). cashAmount = 주문 금액 중 예치금 · 계좌이체 직접 결제로 낸 금액.
 * 배송비 몫을 빼려고 낙찰가 비율만큼만 적립 대상으로 보고, 적립률을 곱해 절사한다
 */
export function earnPointOf(cashAmount: number, winningPrice: number, deliveryFee: number): number {
  const orderAmount = winningPrice + deliveryFee;
  if (cashAmount <= 0 || winningPrice <= 0) return 0;
  const eligible = Math.floor((Math.min(cashAmount, orderAmount) * winningPrice) / orderAmount);
  return Math.floor((eligible * POINT_EARN_RATE_PERCENT) / 100);
}

/** 금액 구성에서 적립 대상이 되는 현금성 결제액. 카드·간편결제 직접 결제와 포인트로 낸 금액은 빠진다 */
export const cashAmountOf = (share: { payMethod: PayMethod; depositAmount: number; pgAmount: number }) =>
  share.depositAmount + (share.payMethod === 'TRANSFER' ? share.pgAmount : 0);

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
/** 구매확정: 경매 완료, 보관금 확정, 구매자 포인트 적립, 정산서(PENDING) 생성 */
export function confirmPurchase(order: OrderRecord, at: number): void {
  order.state = 'CONFIRMED';
  order.confirmedAt = ldt(at);
  order.updatedAt = ldt(at);
  const auction = db.auctions.find((a) => a.id === order.auctionId);
  if (auction) auction.status = 'COMPLETED';
  const holding = db.holdings.find((h) => h.orderId === order.id);
  const product = db.products.find((p) => p.id === order.productId) as ProductRecord;
  if (holding) {
    holding.status = 'CONFIRMED';
    holding.earnedPoint = earnPointOf(cashAmountOf(shareOf(holding)), order.winningPrice, order.deliveryFee);
    addPointTransaction(order.winnerId, 'POINT_EARN', holding.earnedPoint, 'ORDER', order.id, `${product.name} 구매 확정 적립`, at);
  }
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

/** 홀딩 금액을 무엇으로 냈는지 (백엔드 PaymentShare). 세 값의 합 == holding.amount */
export function shareOf(holding: HoldingRecord) {
  const pointAmount = holding.pointAmount ?? 0;
  const pgAmount = holding.pgAmount ?? 0;
  return {
    payMethod: holding.payMethod ?? ('DEPOSIT' as PayMethod),
    pointAmount,
    depositAmount: holding.amount - pointAmount - pgAmount,
    pgAmount,
  };
}

/** 장바구니 결제를 무엇으로 낼지. pointAmount 를 포인트로 내고 남은 금액을 payMethod 로 낸다 */
export interface CartPayOptions {
  payMethod: PayMethod;
  pointAmount: number;
}

/**
 * 장바구니 결제.
 * forceTopUp=true 면 잔액 부족 시 부족분 대신 결제 총액만큼 잔액을 채워 결제한다(가상 회원 자동 결제용).
 * orderGroupId 를 주면 그 id 로 주문 그룹을 만든다(결제창을 거치는 흐름에서 결제 요청 때 발급한 id 재사용). 만든 주문 그룹 id 를 돌려준다.
 * options 로 결제수단과 포인트 사용액을 정한다. 직접 결제(TRANSFER · CARD)면 남은 금액을 결제창에서 냈다고 보고 예치금을 건드리지 않는다.
 */
export function payCartItems(
  memberId: number,
  productIds: number[],
  at: number,
  forceTopUp = false,
  orderGroupId: number = nextId('orderGroups'),
  options: CartPayOptions = { payMethod: 'DEPOSIT', pointAmount: 0 },
): number {
  const items = productIds.map((productId) => {
    const item = db.cartItems.find((c) => c.productId === productId);
    if (!item) fail('CART001');
    if (item.winnerId !== memberId) fail('CART002');
    if (parseTime(item.paymentDueAt) <= at) fail('CART003');
    return item;
  });
  if (!items.length) fail('ORDER005');
  const total = items.reduce((acc, item) => acc + item.winningPrice + item.deliveryFee, 0);
  const wallet = walletOf(memberId);
  const { payMethod, pointAmount } = options;
  if (pointAmount < 0 || pointAmount > total) fail('PAYMENT010');
  if (pointAmount > wallet.pointBalance) fail('WALLET204');
  const rest = total - pointAmount;
  const direct = payMethod !== 'DEPOSIT';
  if (!direct && wallet.balance < rest) {
    if (forceTopUp) wallet.balance += rest;
    else fail('WALLET201');
  }
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
  const title = orders.length > 1 ? `${names[0]} 외 ${orders.length - 1}건 결제` : `${names[0]} 결제`;
  // 예치금으로 낸 금액은 예치금 내역에, 포인트로 낸 금액은 포인트 내역에 남는다
  if (!direct && rest > 0) {
    addTransaction(
      memberId,
      'HOLD_PAY',
      -rest,
      'ORDER',
      orderGroupId,
      title,
      at,
    );
  }
  addPointTransaction(memberId, 'POINT_HOLD_PAY', -pointAmount, 'ORDER', orderGroupId, title, at);
  // 포인트를 주문 금액에 비례해 나눈다 (백엔드 PaymentShare.allocate 와 같은 누적 절사)
  let amountSoFar = 0;
  let pointSoFar = 0;
  orders.forEach((order) => {
    const amount = order.winningPrice + order.deliveryFee;
    amountSoFar += amount;
    const pointUpToHere = Math.floor((pointAmount * amountSoFar) / total);
    const point = pointUpToHere - pointSoFar;
    pointSoFar = pointUpToHere;
    db.holdings.push({
      orderId: order.id,
      winnerId: memberId,
      amount,
      status: 'HELD',
      payMethod,
      pointAmount: point,
      pgAmount: direct ? amount - point : 0,
    });
    const auction = db.auctions.find((a) => a.id === order.auctionId);
    if (auction) auction.status = 'PAID';
    // 판매자가 데모 회원이 아니면 15초 뒤 자동 발송
    if (!isDemoMember(order.sellerId)) db.pending[`send:${order.id}`] = at + 15000;
  });
  db.cartItems = db.cartItems.filter((c) => !items.includes(c));
  return orderGroupId;
}

// ---------- 환불 ----------
/**
 * 환불 승인: 환불 ACCEPTED, 보관금을 낸 수단 그대로 반환. 1.5초 뒤 환불 완료 처리.
 * 예치금으로 낸 금액은 예치금으로, 포인트는 포인트로 돌아가고, 결제창에서 직접 결제한 금액은 토스 결제 취소라 지갑에 들어오지 않는다.
 */
export function acceptRefund(refund: RefundRecord, at: number): void {
  refund.status = 'ACCEPTED';
  refund.processedAt = ldt(at);
  const order = findOrder(refund.orderId);
  const holding = db.holdings.find((h) => h.orderId === order.id);
  const product = db.products.find((p) => p.id === order.productId) as ProductRecord;
  if (holding && holding.status === 'HELD') {
    holding.status = 'REFUNDED';
    const share = shareOf(holding);
    if (share.depositAmount > 0) {
      addTransaction(order.winnerId, 'REFUND_RECEIVE', share.depositAmount, 'REFUND', refund.id, `${product.name} 환불`, at);
    }
    addPointTransaction(order.winnerId, 'POINT_REFUND_RECEIVE', share.pointAmount, 'REFUND', refund.id, `${product.name} 환불`, at);
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
