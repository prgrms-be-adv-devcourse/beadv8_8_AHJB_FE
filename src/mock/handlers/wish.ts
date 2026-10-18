import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { findProduct, requireMe, wishCountOf } from '../services';
import { formatLocalDateTime as ldt, getPageParams } from '../utils';

export function registerWishRoutes(): void {
  route('POST', '/api/v1/products/:id/wishes', (ctx) => {
    const me = requireMe(ctx);
    const product = findProduct(Number(ctx.pathParams.id));
    if (product.sellerId === me.id) fail('PRODUCT015');
    if (db.wishes.some((w) => w.memberId === me.id && w.productId === product.id)) fail('PRODUCT013');
    db.wishes.push({ memberId: me.id, productId: product.id, createdAt: ldt() });
    persist();
    return ok({ productId: product.id, wished: true, wishCount: wishCountOf(product.id) }, 201);
  });

  route('DELETE', '/api/v1/products/:id/wishes', (ctx) => {
    const me = requireMe(ctx);
    const product = findProduct(Number(ctx.pathParams.id));
    const before = db.wishes.length;
    db.wishes = db.wishes.filter((w) => !(w.memberId === me.id && w.productId === product.id));
    if (db.wishes.length === before) fail('PRODUCT014');
    persist();
    return ok({ productId: product.id, wished: false, wishCount: wishCountOf(product.id) });
  });

  /** 내 찜 목록 (삭제된 상품 제외, 최근 찜 순) */
  route('GET', '/api/v1/wishes', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const entries = db.wishes
      .filter((w) => w.memberId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((wish) => {
        const product = db.products.find((p) => p.id === wish.productId && !p.deleted);
        return product ? [{ wish, product }] : [];
      });
    const wishes = entries.slice(page * size, page * size + size).map(({ wish, product }) => ({
      productId: product.id,
      productName: product.name,
      category: product.category,
      startPrice: product.startingPrice,
      wishCount: wishCountOf(product.id),
      wishedAt: wish.createdAt,
      thumbnailUrl: product.imageUrls[0] ?? null,
    }));
    return ok({ wishes, hasNext: entries.length > page * size + size });
  });
}
