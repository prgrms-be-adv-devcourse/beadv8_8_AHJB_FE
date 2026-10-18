// 백그라운드 진행 (요청마다 1회 실행, 원본 Yb)
// 경매 자동 시작/종료, 결제 기한 만료, 배송 단계 진행, 자동 구매확정, 예약 이벤트, 정산 지급, 가상 경쟁 입찰.
import { db, nextId, persist } from './db';
import {
  acceptRefund,
  confirmPurchase,
  latestAuctionOf,
  minBidPriceOf,
  payCartItems,
  placeBid,
  shipOrder,
  startAuction,
  winAuction,
  addTransaction,
} from './services';
import type { DeliveryCode } from './types';
import { formatLocalDateTime as ldt, isDemoMember, now, parseTime, payoutTimeOf } from './utils';

const DELIVERY_STEPS: DeliveryCode[] = [
  'INFORMATION_RECEIVED',
  'AT_PICKUP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];
/** 빠른 배송 단계 간격 */
const DELIVERY_STEP_MS = 12000;
/** 마감 5분 전 입찰 시 연장 */
const EXTEND_MS = 5 * 60000;

/** 마지막 "주변 입찰" 시뮬레이션 시각 */
let lastAmbientBidAt = 0;

export function runTick(): void {
  const t = now();
  let changed = false;

  // 1) 경매 시작 예정 시각이 지난 상품 → 경매 시작
  for (const product of db.products) {
    if (product.deleted) continue;
    const latest = latestAuctionOf(product);
    if ((!latest || latest.round < product.round) && parseTime(product.auctionScheduledAt) <= t) {
      startAuction(product, parseTime(product.auctionScheduledAt));
      changed = true;
    }
  }

  // 2) 종료 시각이 지난 경매 → 낙찰 또는 유찰
  for (const auction of db.auctions) {
    if (auction.status !== 'IN_PROGRESS' || parseTime(auction.endAt) > t) continue;
    if (auction.bidCount > 0)
      winAuction(auction, auction.highestBidderId as number, auction.highestBidPrice as number, parseTime(auction.endAt));
    else {
      auction.status = 'FAILED';
      auction.failureReason = 'NO_BID';
    }
    changed = true;
  }

  // 3) 결제 기한이 지난 장바구니 → 미결제 유찰 + 경고
  for (const item of [...db.cartItems]) {
    if (parseTime(item.paymentDueAt) > t) continue;
    db.cartItems = db.cartItems.filter((c) => c.id !== item.id);
    const auction = db.auctions.find((a) => a.id === item.auctionId);
    if (auction) {
      auction.status = 'FAILED';
      auction.failureReason = 'UNPAID';
    }
    db.warnings.push({
      id: nextId('warnings'),
      memberId: item.winnerId,
      reason: 'PAYMENT_DEFAULT',
      orderId: null,
      createdAt: ldt(t),
    });
    changed = true;
  }

  // 4) 빠른 배송 단계 진행, 배송 완료 시 주문 SHIPPED
  for (const delivery of db.deliveries) {
    if (!delivery.fast || delivery.code === 'DELIVERED') continue;
    const step = Math.min(
      DELIVERY_STEPS.length - 1,
      Math.floor((t - parseTime(delivery.createdAt)) / DELIVERY_STEP_MS),
    );
    if (DELIVERY_STEPS[step] !== delivery.code) {
      delivery.code = DELIVERY_STEPS[step];
      delivery.updatedAt = ldt(t);
      changed = true;
      const order = db.orders.find((o) => o.id === delivery.orderId);
      if (delivery.code === 'DELIVERED' && order && order.state === 'SHIPPING') {
        order.state = 'SHIPPED';
        order.shippedAt = ldt(t);
        order.confirmExpiredAt = ldt(t + 7 * 864e5);
        order.updatedAt = ldt(t);
        // 구매자가 데모 회원이 아니면 20초 뒤 자동 구매확정
        if (!isDemoMember(order.winnerId)) db.pending[`confirm:${order.id}`] = t + 20000;
      }
    }
  }

  // 5) 구매확정 기한이 지난 주문 → 자동 구매확정
  for (const order of db.orders) {
    if (order.state === 'SHIPPED' && order.confirmExpiredAt && parseTime(order.confirmExpiredAt) <= t) {
      confirmPurchase(order, t);
      changed = true;
    }
  }

  // 6) 예약 이벤트
  for (const [key, dueAt] of Object.entries(db.pending)) {
    if (dueAt > t) continue;
    delete db.pending[key];
    changed = true;
    const [kind, idText] = key.split(':');
    const id = Number(idText);
    if (kind === 'pay') {
      const item = db.cartItems.find((c) => c.id === id);
      try {
        if (item) payCartItems(item.winnerId, [item.productId], t, true);
      } catch {
        // 결제 실패는 무시
      }
    } else if (kind === 'send') {
      const order = db.orders.find((o) => o.id === id);
      const carriers = ['CJ', 'LOTTE', 'HANJIN', 'EPOST'];
      if (order && order.state === 'PAID') shipOrder(order, carriers[id % 4], String(61e10 + id * 7), t);
    } else if (kind === 'confirm') {
      const order = db.orders.find((o) => o.id === id);
      if (order && order.state === 'SHIPPED') confirmPurchase(order, t);
    } else if (kind === 'sellerRefund') {
      const refund = db.refunds.find((r) => r.id === id);
      if (refund && refund.status === 'REQUESTED') acceptRefund(refund, t);
    } else if (kind === 'refundComplete') {
      const refund = db.refunds.find((r) => r.id === id);
      if (refund && refund.status === 'ACCEPTED') refund.status = 'COMPLETED';
    } else if (kind === 'rival') {
      // 데모 회원이 최고 입찰자인 경매에 가상 회원이 맞입찰
      const auction = db.auctions.find((a) => a.id === id);
      if (
        auction &&
        auction.status === 'IN_PROGRESS' &&
        parseTime(auction.endAt) > t &&
        auction.highestBidderId &&
        isDemoMember(auction.highestBidderId)
      ) {
        const bidPrice = minBidPriceOf(auction);
        if (!auction.instantWinPrice || bidPrice < auction.instantWinPrice) {
          const rivals = db.members.filter((m) => !isDemoMember(m.id) && m.id !== auction.sellerId);
          placeBid(auction, rivals[(auction.id + auction.bidCount) % rivals.length].id, bidPrice, t);
          if (parseTime(auction.endAt) - t <= EXTEND_MS) auction.endAt = ldt(t + EXTEND_MS);
        }
      }
    }
  }

  // 7) 지급일이 지난 정산 → 지급 완료 + 판매자 예치금 입금
  for (const settlement of db.settlements) {
    if (settlement.status !== 'PENDING' || payoutTimeOf(settlement.payoutDate) > t) continue;
    settlement.status = 'COMPLETED';
    settlement.completedAt = ldt(payoutTimeOf(settlement.payoutDate));
    addTransaction(
      settlement.sellerId,
      'SETTLEMENT_RECEIVE',
      settlement.settlementAmount,
      'SETTLEMENT',
      settlement.id,
      `${settlement.productName} 정산`,
      t,
    );
    const holding = db.holdings.find((h) => h.orderId === settlement.orderId);
    if (holding) holding.status = 'RELEASED';
    changed = true;
  }

  // 8) 20초마다 데모 회원이 최고가가 아닌 경매 하나에 가상 입찰
  if (t - lastAmbientBidAt > 20000) {
    lastAmbientBidAt = t;
    const candidates = db.auctions.filter(
      (a) =>
        a.status === 'IN_PROGRESS' &&
        parseTime(a.endAt) - t > 15000 &&
        !(a.highestBidderId && isDemoMember(a.highestBidderId)),
    );
    if (candidates.length) {
      const auction = candidates[Math.floor(Math.random() * candidates.length)];
      const bidPrice = minBidPriceOf(auction);
      const bidders = db.members.filter(
        (m) => !isDemoMember(m.id) && m.id !== auction.sellerId && m.id !== auction.highestBidderId,
      );
      if (bidders.length && (!auction.instantWinPrice || bidPrice < auction.instantWinPrice)) {
        placeBid(auction, bidders[Math.floor(Math.random() * bidders.length)].id, bidPrice, t);
        if (parseTime(auction.endAt) - t <= EXTEND_MS) auction.endAt = ldt(t + EXTEND_MS);
        changed = true;
      }
    }
  }

  if (changed) persist();
}
