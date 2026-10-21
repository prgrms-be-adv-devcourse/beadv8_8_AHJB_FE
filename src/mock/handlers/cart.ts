import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { memberById, payCartItems, requireMe, walletOf } from '../services';
import type { ProductRecord } from '../types';
import { now } from '../utils';
import { createPaymentCharge } from './payment';

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
   * 결제 (백엔드 PaymentResponseDto 형태).
   * 예치금이 충분하면 바로 결제하고 isPaid:true. 부족하면 주문 그룹 id 와 부족분 충전 건(pgOrderId)을 만들어
   * isPaid:false + data(결제창 파라미터)로 돌려주고, 실제 결제는 POST /payments/confirm(handlers/payment.ts)에서 끝낸다.
   */
  route('POST', '/api/v1/cart/payment', (ctx) => {
    const me = requireMe(ctx);
    const raw = (ctx.body as { productIds?: unknown } | null | undefined)?.productIds;
    if (!Array.isArray(raw) || !raw.length) fail('COMMON001');
    const productIds = raw.map(Number);
    const at = now();
    const total = db.cartItems
      .filter((c) => c.winnerId === me.id && productIds.includes(c.productId))
      .reduce((acc, c) => acc + c.winningPrice + c.deliveryFee, 0);
    const shortage = total - walletOf(me.id).balance;
    if (total > 0 && shortage > 0) {
      const orderGroupId = nextId('orderGroups');
      const data = createPaymentCharge(me.id, orderGroupId, productIds, total, shortage, at);
      return ok({ orderGroupId, isPaid: false, data });
    }
    const orderGroupId = payCartItems(me.id, productIds, at);
    persist();
    return ok({ orderGroupId, isPaid: true, data: null });
  });
}
