import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { noContent, ok, route, type HandlerContext } from '../router';
import { memberById, requireMe } from '../services';
import type { ProductRecord, ReviewRecord } from '../types';
import { formatLocalDateTime as ldt, getPageParams, now, parseTime } from '../utils';
import { toReviewView } from '../views';

/** 구매확정 후 후기 작성 가능 기간(일) */
const REVIEW_WINDOW_DAYS = 30;
const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 864e5;

/** 0.5 ~ 5.0, 0.5 단위 */
const isValidRating = (rating: unknown): rating is number =>
  typeof rating === 'number' && rating >= 0.5 && rating <= 5 && Math.round(rating * 2) === rating * 2;

interface ReviewBody {
  orderId: number;
  rating: unknown;
  content: unknown;
}

/** 수정/삭제 가능한 내 후기 */
function findMyReview(ctx: HandlerContext): ReviewRecord {
  const me = requireMe(ctx);
  const review = db.reviews.find((r) => r.id === Number(ctx.pathParams.id) && !r.deleted);
  if (!review) fail('REVIEW006');
  if (review.writerId !== me.id) fail('REVIEW007');
  return review;
}

export function registerReviewRoutes(): void {
  route('GET', '/api/v1/reviews/reviewable-orders', (ctx) => {
    const me = requireMe(ctx);
    const t = now();
    const items = db.orders
      .filter((o) => o.winnerId === me.id && o.state === 'CONFIRMED' && o.confirmedAt)
      .filter((o) => !db.reviews.some((r) => r.orderId === o.id))
      .filter((o) => parseTime(o.confirmedAt as string) + REVIEW_WINDOW_MS > t)
      .map((order) => {
        const product = db.products.find((p) => p.id === order.productId) as ProductRecord;
        const confirmedAt = order.confirmedAt as string;
        return {
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          sellerId: order.sellerId,
          sellerNickname: memberById(order.sellerId).nickname,
          winningPrice: order.winningPrice,
          confirmedAt,
          reviewDeadline: ldt(parseTime(confirmedAt) + REVIEW_WINDOW_MS),
        };
      });
    return ok(items);
  });

  route('POST', '/api/v1/reviews', (ctx) => {
    const me = requireMe(ctx);
    const body = ctx.body as Partial<ReviewBody> | null | undefined;
    const order = db.orders.find((o) => o.id === Number(body?.orderId));
    if (!order || order.state !== 'CONFIRMED') fail('REVIEW001');
    if (order.winnerId !== me.id) fail('REVIEW002');
    if (db.reviews.some((r) => r.orderId === order.id)) fail('REVIEW003');
    if (parseTime(order.confirmedAt as string) + REVIEW_WINDOW_MS <= now()) fail('REVIEW004');
    const rating = body?.rating;
    if (!isValidRating(rating)) fail('REVIEW005');
    const content = String(body?.content ?? '').trim();
    if (!content || content.length > 1000) fail('COMMON001');
    const review: ReviewRecord = {
      id: nextId('reviews'),
      orderId: order.id,
      productId: order.productId,
      writerId: me.id,
      targetId: order.sellerId,
      rating,
      content,
      deleted: false,
      createdAt: ldt(),
      updatedAt: ldt(),
    };
    db.reviews.push(review);
    persist();
    return ok(toReviewView(review), 201);
  });

  route('GET', '/api/v1/reviews/received', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const reviews = db.reviews
      .filter((r) => r.targetId === me.id && !r.deleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({
      reviews: reviews.slice(page * size, page * size + size).map(toReviewView),
      hasNext: reviews.length > page * size + size,
    });
  });

  route('GET', '/api/v1/reviews/written', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const reviews = db.reviews
      .filter((r) => r.writerId === me.id && !r.deleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({
      reviews: reviews.slice(page * size, page * size + size).map(toReviewView),
      hasNext: reviews.length > page * size + size,
    });
  });

  route('PATCH', '/api/v1/reviews/:id', (ctx) => {
    const review = findMyReview(ctx);
    const body = ctx.body as Partial<ReviewBody> | null | undefined;
    // 원본 그대로: 평점을 먼저 반영한 뒤 내용 검증 (내용이 비면 평점만 메모리에 반영된 채 400)
    if (body?.rating !== undefined) {
      if (!isValidRating(body.rating)) fail('REVIEW005');
      review.rating = body.rating;
    }
    if (body?.content !== undefined) {
      const content = String(body.content).trim();
      if (!content) fail('COMMON001');
      review.content = content;
    }
    review.updatedAt = ldt();
    persist();
    return ok(toReviewView(review));
  });

  route('DELETE', '/api/v1/reviews/:id', (ctx) => {
    const review = findMyReview(ctx);
    review.deleted = true;
    persist();
    return noContent(204);
  });
}
