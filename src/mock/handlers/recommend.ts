// 추천 목업. 진행 중 경매에서 간단한 기준으로 고른다 (실제는 임베딩·인기도 기반)
import { db } from '../db';
import { ok, route } from '../router';
import { currentPriceOf, findAuction, requireMe } from '../services';
import type { AuctionRecord } from '../types';

const LIMIT = 10;

function toRecommended(auction: AuctionRecord) {
  const product = db.products.find((p) => p.id === auction.productId);
  return {
    auctionId: auction.id,
    productId: auction.productId,
    category: product?.category ?? 'ETC',
    currentPrice: currentPriceOf(auction),
    endAt: auction.endAt,
  };
}

const inProgress = () =>
  db.auctions.filter(
    (a) => a.status === 'IN_PROGRESS' && db.products.some((p) => p.id === a.productId && !p.deleted),
  );

export function registerRecommendRoutes(): void {
  /** 입찰 수 많은 순 */
  route('GET', '/api/v1/recommend/popular', () =>
    ok(inProgress().sort((a, b) => b.bidCount - a.bidCount).slice(0, LIMIT).map(toRecommended)),
  );

  /** 내가 찜하거나 입찰한 카테고리 우선, 내 경매 제외 */
  route('GET', '/api/v1/recommend/me', (ctx) => {
    const me = requireMe(ctx);
    const likedProductIds = new Set([
      ...db.wishes.filter((w) => w.memberId === me.id).map((w) => w.productId),
      ...db.bids.filter((b) => b.bidderId === me.id).map((b) => findAuction(b.auctionId).productId),
    ]);
    const likedCategories = new Set(
      db.products.filter((p) => likedProductIds.has(p.id)).map((p) => p.category),
    );
    const categoryOf = (a: AuctionRecord) => db.products.find((p) => p.id === a.productId)?.category ?? '';
    const items = inProgress()
      .filter((a) => a.sellerId !== me.id)
      .sort((a, b) => Number(likedCategories.has(categoryOf(b))) - Number(likedCategories.has(categoryOf(a))));
    return ok(items.slice(0, LIMIT).map(toRecommended));
  });

  /** 같은 카테고리, 자기 자신 제외 */
  route('GET', '/api/v1/recommend/auction/:id', (ctx) => {
    const base = findAuction(Number(ctx.pathParams.id));
    const category = db.products.find((p) => p.id === base.productId)?.category;
    const items = inProgress().filter(
      (a) => a.id !== base.id && db.products.find((p) => p.id === a.productId)?.category === category,
    );
    return ok(items.slice(0, LIMIT).map(toRecommended));
  });
}
