import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { ok, route, type HandlerContext } from '../router';
import { confirmPurchase, findOrder, requireMe, shipOrder } from '../services';
import type { DeliveryCode, MemberRecord, OrderRecord, RefundRecord } from '../types';
import { formatLocalDateTime as ldt, getPageParams, isDemoMember, now } from '../utils';
import { toOrderView } from '../views';

type OrderRole = 'winner' | 'seller' | 'participant';

/** 주문 조회 + 역할 권한 확인 */
function findOrderAs(ctx: HandlerContext, role: OrderRole): { me: MemberRecord; order: OrderRecord } {
  const me = requireMe(ctx);
  const order = findOrder(Number(ctx.pathParams.orderId));
  const allowed =
    role === 'winner'
      ? order.winnerId === me.id
      : role === 'seller'
        ? order.sellerId === me.id
        : order.winnerId === me.id || order.sellerId === me.id;
  if (!allowed) fail('ORDER002');
  return { me, order };
}

const DELIVERY_MESSAGES: Record<DeliveryCode, string> = {
  UNKNOWN: '상태를 알 수 없음',
  WAITING: '대기중',
  INFORMATION_RECEIVED: '운송장 정보 접수',
  AT_PICKUP: '집하 장소에 있음',
  IN_TRANSIT: '이동 중',
  OUT_FOR_DELIVERY: '배송 출발',
  ATTEMPT_FAIL: '배송 시도 실패',
  DELIVERED: '배송 완료',
  AVAILABLE_FOR_PICKUP: '지정 장소에서 수령 가능',
  EXCEPTION: '확인이 필요한 문제 발생',
  WRONG: '미식별 코드',
};

export function registerOrderRoutes(): void {
  // /order/:orderId 보다 먼저 등록해야 한다
  route('GET', '/api/v1/order/winner', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const orders = db.orders
      .filter((o) => o.winnerId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(orders.slice(page * size, page * size + size).map(toOrderView));
  });

  route('GET', '/api/v1/order/seller', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const orders = db.orders
      .filter((o) => o.sellerId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(orders.slice(page * size, page * size + size).map(toOrderView));
  });

  route('GET', '/api/v1/order/:orderId', (ctx) => ok(toOrderView(findOrderAs(ctx, 'participant').order)));

  route('POST', '/api/v1/order/:orderId/confirm-purchase', (ctx) => {
    const { order } = findOrderAs(ctx, 'winner');
    if (order.state !== 'SHIPPED') fail('ORDER003');
    confirmPurchase(order, now());
    persist();
    return ok(null);
  });

  route('POST', '/api/v1/order/:orderId/request-refund', (ctx) => {
    const { order } = findOrderAs(ctx, 'winner');
    if (order.state !== 'SHIPPED') fail('ORDER003');
    if (db.refunds.some((r) => r.orderId === order.id)) fail('REFUND003');
    const t = now();
    const refund: RefundRecord = {
      id: nextId('refunds'),
      orderId: order.id,
      winnerId: order.winnerId,
      sellerId: order.sellerId,
      productId: order.productId,
      amount: order.winningPrice,
      status: 'REQUESTED',
      requestedAt: ldt(t),
      processedAt: null,
    };
    db.refunds.push(refund);
    order.state = 'REFUND_REQUESTED';
    order.updatedAt = ldt(t);
    // 판매자가 데모 회원이 아니면 30초 뒤 자동 승인
    if (!isDemoMember(order.sellerId)) db.pending[`sellerRefund:${refund.id}`] = t + 30000;
    persist();
    return ok(null);
  });

  route('POST', '/api/v1/order/:orderId/send-product', (ctx) => {
    const { order } = findOrderAs(ctx, 'seller');
    if (order.state !== 'PAID') fail('ORDER003');
    const body = ctx.body as { carrier?: string; waybill?: unknown } | null | undefined;
    const waybill = String(body?.waybill ?? '').replace(/-/g, '');
    if (!body?.carrier) fail('COMMON001');
    if (!/^[0-9]{9,14}$/.test(waybill)) fail('DELIVERY_005');
    shipOrder(order, body.carrier, waybill, now());
    persist();
    return ok(null);
  });

  route('GET', '/api/v1/order/:orderId/delivery', (ctx) => {
    const { order } = findOrderAs(ctx, 'participant');
    const delivery = db.deliveries.find((d) => d.orderId === order.id);
    if (!delivery) fail('DELIVERY_002');
    return ok({
      orderId: order.id,
      code: delivery.code,
      message: DELIVERY_MESSAGES[delivery.code],
      updatedAt: delivery.updatedAt,
      carrier: delivery.carrier,
      waybill: delivery.waybill,
    });
  });
}
