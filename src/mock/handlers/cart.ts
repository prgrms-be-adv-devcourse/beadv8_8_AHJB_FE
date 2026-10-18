import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { memberById, payCartItems, requireMe } from '../services';
import type { ProductRecord } from '../types';
import { now } from '../utils';

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

  route('POST', '/api/v1/cart/payment', (ctx) => {
    const me = requireMe(ctx);
    const productIds = (ctx.body as { productIds?: unknown } | null | undefined)?.productIds;
    if (!Array.isArray(productIds) || !productIds.length) fail('COMMON001');
    payCartItems(me.id, productIds.map(Number), now());
    persist();
    return ok(null);
  });
}
