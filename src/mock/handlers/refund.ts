import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route, type HandlerContext } from '../router';
import { acceptRefund, rejectRefund, requireMe } from '../services';
import type { RefundRecord } from '../types';
import { now, numberOr } from '../utils';
import { toRefundProcessView, toRefundView } from '../views';

function findRefund(id: number): RefundRecord {
  const refund = db.refunds.find((r) => r.id === id);
  if (!refund) fail('REFUND001');
  return refund;
}

/** 판매자가 처리할 수 있는 요청 상태의 환불 */
function findProcessableRefund(ctx: HandlerContext): RefundRecord {
  const me = requireMe(ctx);
  const refund = findRefund(Number(ctx.pathParams.id));
  if (refund.sellerId !== me.id) fail('REFUND004');
  if (refund.status !== 'REQUESTED') fail('REFUND005');
  return refund;
}

export function registerRefundRoutes(): void {
  /** 주문 id 로 환불 조회 */
  route('GET', '/api/v1/refunds', (ctx) => {
    const me = requireMe(ctx);
    const orderId = numberOr(ctx.params.get('orderId'), -1);
    const refund = db.refunds.find((r) => r.orderId === orderId);
    if (!refund) fail('REFUND001');
    if (refund.winnerId !== me.id && refund.sellerId !== me.id) fail('REFUND002');
    return ok(toRefundView(refund));
  });

  route('GET', '/api/v1/refunds/:id', (ctx) => {
    const me = requireMe(ctx);
    const refund = findRefund(Number(ctx.pathParams.id));
    if (refund.winnerId !== me.id && refund.sellerId !== me.id) fail('REFUND002');
    return ok(toRefundView(refund));
  });

  route('PATCH', '/api/v1/refunds/:id/accept', (ctx) => {
    const refund = findProcessableRefund(ctx);
    acceptRefund(refund, now());
    persist();
    return ok(toRefundProcessView(refund));
  });

  route('PATCH', '/api/v1/refunds/:id/reject', (ctx) => {
    const refund = findProcessableRefund(ctx);
    rejectRefund(refund, now());
    persist();
    return ok(toRefundProcessView(refund));
  });
}
