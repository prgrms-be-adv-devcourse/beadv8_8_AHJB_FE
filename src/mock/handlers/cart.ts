import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { memberById, payCartItems, requireMe } from '../services';
import type { ProductRecord } from '../types';
import { now } from '../utils';
import { createPaymentCharge, parsePayMethod, planPayment } from './payment';

export function registerCartRoutes(): void {
  /** 장바구니(낙찰 후 결제 대기) - 결제 기한 임박순 */
  route('GET', '/api/v1/cart', (ctx) => {
    const me = requireMe(ctx);
    const items = db.cartItems
      .filter((c) => c.winnerId === me.id)
      .sort((a, b) => a.paymentDueAt.localeCompare(b.paymentDueAt))
      .map((item) => {
        const product = db.products.find((p) => p.id === item.productId) as ProductRecord;
        return {
          id: item.id,
          winnerId: me.uuid,
          sellerId: memberById(item.sellerId).uuid,
          auctionId: item.auctionId,
          productId: item.productId,
          winningPrice: item.winningPrice,
          deliveryFee: item.deliveryFee,
          winAt: item.winAt,
          paymentDueAt: item.paymentDueAt,
          productName: product.name,
          thumbnailUrl: product.imageUrls[0] ?? null,
        };
      });
    return ok(items);
  });

  /**
   * 결제 (백엔드 PaymentResponseDto 형태). { productIds, paymentMethod, pointUseAmount }.
   * 포인트 · 예치금만으로 끝나면 바로 결제하고 isPaid:true. 결제창을 거쳐야 하면(예치금 부족분 충전 또는 직접 결제)
   * 주문 그룹 id 와 토스 결제 건(pgOrderId)을 만들어 isPaid:false + data(결제창 파라미터)로 돌려주고,
   * 실제 결제는 POST /payments/confirm(handlers/payment.ts)에서 끝낸다.
   * 결제창 금액이 계좌이체 1회 한도를 넘으면 예치금 결제는 CHARGE011, 계좌이체 직접 결제는 PAYMENT011.
   */
  route('POST', '/api/v1/cart/payment', (ctx) => {
    const me = requireMe(ctx);
    const body = (ctx.body ?? {}) as { productIds?: unknown; paymentMethod?: unknown; pointUseAmount?: unknown };
    const raw = body.productIds;
    if (!Array.isArray(raw) || !raw.length) fail('COMMON001');
    const productIds = raw.map(Number);
    const payMethod = parsePayMethod(body.paymentMethod);
    const pointUseAmount = Number(body.pointUseAmount ?? 0);
    const at = now();
    const total = db.cartItems
      .filter((c) => c.winnerId === me.id && productIds.includes(c.productId))
      .reduce((acc, c) => acc + c.winningPrice + c.deliveryFee, 0);
    // 내 장바구니에 없는 상품뿐이면 payCartItems 가 CART00x 로 거절한다
    if (total <= 0) {
      const orderGroupId = payCartItems(me.id, productIds, at);
      persist();
      return ok({ orderGroupId, isPaid: true, data: null });
    }
    const plan = planPayment(me.id, total, payMethod, pointUseAmount);
    if (plan.limitExceeded) fail(plan.pgAmount > 0 ? 'PAYMENT011' : 'CHARGE011');
    if (plan.chargeAmount > 0) {
      const orderGroupId = nextId('orderGroups');
      const data = createPaymentCharge(me.id, orderGroupId, productIds, plan, at);
      return ok({ orderGroupId, isPaid: false, data });
    }
    const orderGroupId = payCartItems(me.id, productIds, at, false, undefined, {
      payMethod,
      pointAmount: plan.pointAmount,
    });
    persist();
    return ok({ orderGroupId, isPaid: true, data: null });
  });
}
