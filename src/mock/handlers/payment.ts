import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route, type HandlerContext } from '../router';
import { addTransaction, payCartItems, requireMe, walletOf } from '../services';
import type { OrderRecord } from '../types';
import { FEE_RATE, formatLocalDateTime as ldt, getPageParams, now, paginate } from '../utils';

// 백엔드 PaymentApiController 와 같은 경로·응답 형태.
// 목업은 토스 결제창을 거치지 않으므로 ChargeDialog / CartPage 가 요청 직후 바로 승인을 부른다.
// 충전 건은 승인 전까지만 의미가 있어서 목업 DB 에 저장하지 않고 메모리에만 둔다 (새로고침하면 사라짐).
// 목업은 아직 예치금 결제만 한다. 포인트 · 직접 결제 필드는 응답 형태만 맞춰 0 / DEPOSIT 으로 내려준다.

type ChargeStatus = 'REQUESTED' | 'CHARGED' | 'USED' | 'CANCELED' | 'ABORTED';
type ChargePurpose = 'MANUAL' | 'FOR_PAYMENT';

interface MockCharge {
  chargeId: number;
  memberId: number;
  pgOrderId: string;
  amount: number;
  purpose: ChargePurpose;
  status: ChargeStatus;
  method: string | null;
  receiptUrl: string | null;
  requestedAt: string;
  approvedAt: string | null;
  usedAt: string | null;
  canceledAt: string | null;
  /** FOR_PAYMENT 전용: 주문 결제 정보 */
  payment: MockPayment | null;
}

/** 결제창을 거치는 주문 결제. 결제(Payment)를 따로 저장하지 않으므로 paymentId 는 orderGroupId 와 같은 값을 쓴다 */
interface MockPayment {
  orderGroupId: number;
  productIds: number[];
  totalPrice: number;
  chargeAmount: number;
  status: 'CHARGING' | 'PAID';
  requestedAt: string;
  paidAt: string | null;
}

const MANUAL_ORDER_NAME = '찐막 예치금 충전';
const PAYMENT_ORDER_NAME = '찐막 주문 결제 (부족분 충전)';
/** 결제 정책 (백엔드 설정값 wallet.* 과 같은 값) */
const CHARGE_MIN_AMOUNT = 10000;
const CHARGE_MAX_AMOUNT = 2000000;
const POINT_EARN_RATE_PERCENT = 1;
const charges = new Map<string, MockCharge>();
let chargeSeq = 1;

/** 적립 대상 금액(예치금 결제액에서 배송비를 뺀 금액)에 적립률을 곱해 절사한 포인트 */
const earnPointOf = (earnBase: number) => Math.floor((Math.max(earnBase, 0) * POINT_EARN_RATE_PERCENT) / 100);

/** 백엔드 ChargeSummaryDto 형태 */
function toChargeSummary(charge: MockCharge) {
  return {
    chargeId: charge.chargeId,
    pgOrderId: charge.pgOrderId,
    amount: charge.amount,
    orderName: charge.purpose === 'FOR_PAYMENT' ? PAYMENT_ORDER_NAME : MANUAL_ORDER_NAME,
    purpose: charge.purpose,
    status: charge.status,
    cancelable: charge.status === 'CHARGED',
    usedAmount: charge.status === 'USED' ? charge.amount : 0,
    remainingAmount: charge.status === 'CHARGED' ? charge.amount : 0,
    canceledAmount: charge.status === 'CANCELED' ? charge.amount : 0,
    pgMethod: 'TRANSFER' as const,
    method: charge.method,
    receiptUrl: charge.receiptUrl,
    requestedAt: charge.requestedAt,
    approvedAt: charge.approvedAt,
    usedAt: charge.usedAt,
    canceledAt: charge.canceledAt,
    failureCode: null,
    failureMessage: null,
  };
}

/**
 * 주문 묶음 결제 1건. 끝난 결제는 주문 그룹의 주문들에서, 결제창을 기다리는 결제는 메모리의 충전 건에서 만든다.
 * 결제 전에는 주문이 아직 없어서 orders 가 비어 있다 (백엔드는 결제 요청 때 주문을 먼저 만든다).
 */
interface PaymentView {
  orderGroupId: number;
  totalPrice: number;
  chargeAmount: number;
  orderCount: number;
  status: 'CHARGING' | 'PAID';
  requestedAt: string;
  paidAt: string | null;
  orders: OrderRecord[];
  charge: MockCharge | null;
}

const amountOf = (order: OrderRecord) => order.winningPrice + order.deliveryFee;

function findPayment(memberId: number, orderGroupId: number): PaymentView | undefined {
  const orders = db.orders.filter((o) => o.winnerId === memberId && o.orderGroupId === orderGroupId);
  const charge =
    [...charges.values()].find((c) => c.memberId === memberId && c.payment?.orderGroupId === orderGroupId) ?? null;
  if (orders.length) {
    return {
      orderGroupId,
      totalPrice: orders.reduce((acc, o) => acc + amountOf(o), 0),
      chargeAmount: charge?.amount ?? 0,
      orderCount: orders.length,
      status: 'PAID',
      requestedAt: charge?.payment?.requestedAt ?? orders[0].createdAt,
      paidAt: orders[0].createdAt,
      orders,
      charge,
    };
  }
  if (!charge?.payment) return undefined;
  return {
    orderGroupId,
    totalPrice: charge.payment.totalPrice,
    chargeAmount: charge.amount,
    orderCount: charge.payment.productIds.length,
    status: 'CHARGING',
    requestedAt: charge.payment.requestedAt,
    paidAt: null,
    orders: [],
    charge,
  };
}

/** 내 결제 전체 (최신순) */
function paymentsOf(memberId: number): PaymentView[] {
  const groupIds = new Set<number>();
  db.orders.forEach((o) => {
    if (o.winnerId === memberId) groupIds.add(o.orderGroupId);
  });
  charges.forEach((c) => {
    if (c.memberId === memberId && c.payment) groupIds.add(c.payment.orderGroupId);
  });
  return [...groupIds]
    .sort((a, b) => b - a)
    .map((id) => findPayment(memberId, id))
    .filter((p): p is PaymentView => p !== undefined);
}

/** 금액 구성 (백엔드 PaymentSummaryDto · PaymentDetailDto 공통). 목업은 전액 예치금 */
function toPaymentBase(payment: PaymentView) {
  return {
    paymentId: payment.orderGroupId,
    orderGroupId: payment.orderGroupId,
    totalPrice: payment.totalPrice,
    payMethod: 'DEPOSIT' as const,
    pointAmount: 0,
    walletUsedAmount: payment.totalPrice,
    pgAmount: 0,
    pgMethod: null,
    chargeAmount: payment.chargeAmount,
    status: payment.status,
    requestedAt: payment.requestedAt,
    paidAt: payment.paidAt,
  };
}

/** 백엔드 PaymentSummaryDto 형태 */
const toPaymentSummary = (payment: PaymentView) => ({ ...toPaymentBase(payment), orderCount: payment.orderCount });

const holdingOf = (orderId: number) => db.holdings.find((h) => h.orderId === orderId);

function refundedAtOf(orderId: number): string | null {
  const refund = db.refunds.find((r) => r.orderId === orderId && (r.status === 'ACCEPTED' || r.status === 'COMPLETED'));
  return refund?.processedAt ?? null;
}

/** 구매 확정하면 적립될 예상 포인트. 아직 확정 전(HELD)인 주문만 */
const expectedEarnPointOf = (order: OrderRecord) =>
  holdingOf(order.id)?.status === 'HELD' ? earnPointOf(order.winningPrice) : 0;

/** 백엔드 PaymentDetailDto 형태 */
function toPaymentDetail(payment: PaymentView) {
  return {
    ...toPaymentBase(payment),
    failureReason: null,
    expectedEarnPoint: payment.orders.reduce((acc, o) => acc + expectedEarnPointOf(o), 0),
    items: payment.orders.map((order) => {
      const refunded = holdingOf(order.id)?.status === 'REFUNDED';
      return {
        orderId: order.id,
        sellerId: order.sellerId,
        winningPrice: order.winningPrice,
        deliveryFee: order.deliveryFee,
        amount: amountOf(order),
        refunded,
        refundedAt: refunded ? refundedAtOf(order.id) : null,
      };
    }),
    charges: payment.charge ? [toChargeSummary(payment.charge)] : [],
  };
}

/** 경로의 id 로 내 결제를 찾는다. 없거나 남의 결제면 PAYMENT001 */
function requirePayment(ctx: HandlerContext, rawId: string): PaymentView {
  const payment = findPayment(requireMe(ctx).id, Number(rawId));
  if (!payment) fail('PAYMENT001');
  return payment;
}

function newCharge(memberId: number, amount: number, purpose: ChargePurpose, at: number, payment: MockPayment | null): MockCharge {
  const chargeId = chargeSeq++;
  const charge: MockCharge = {
    chargeId,
    memberId,
    pgOrderId: `mock-charge-${memberId}-${chargeId}-${at.toString(36)}`,
    amount,
    purpose,
    status: 'REQUESTED',
    method: null,
    receiptUrl: null,
    requestedAt: ldt(at),
    approvedAt: null,
    usedAt: null,
    canceledAt: null,
    payment,
  };
  charges.set(charge.pgOrderId, charge);
  return charge;
}

/**
 * 장바구니 결제에서 예치금이 부족할 때 (handlers/cart.ts 가 호출).
 * 부족분만큼 FOR_PAYMENT 충전 건을 만들고 결제창 파라미터(백엔드 PaymentResponseDto.Data)를 돌려준다.
 */
export function createPaymentCharge(
  memberId: number,
  orderGroupId: number,
  productIds: number[],
  totalPrice: number,
  chargeAmount: number,
  at: number,
) {
  const payment: MockPayment = {
    orderGroupId,
    productIds,
    totalPrice,
    chargeAmount,
    status: 'CHARGING',
    requestedAt: ldt(at),
    paidAt: null,
  };
  const charge = newCharge(memberId, chargeAmount, 'FOR_PAYMENT', at, payment);
  return {
    paymentId: orderGroupId,
    totalPrice,
    chargeAmount,
    pgOrderId: charge.pgOrderId,
    orderName: PAYMENT_ORDER_NAME,
    pgMethod: 'TRANSFER' as const,
    payMethod: 'DEPOSIT' as const,
    pointAmount: 0,
    depositAmount: totalPrice,
    pgAmount: 0,
  };
}

/** 승인 요청 본문 공통 검증 → 내 충전 건 */
function findChargeForConfirm(ctx: HandlerContext): { charge: MockCharge; amount: number } {
  const me = requireMe(ctx);
  const body = (ctx.body ?? {}) as { pgOrderId?: unknown; paymentKey?: unknown; amount?: unknown };
  const pgOrderId = typeof body.pgOrderId === 'string' ? body.pgOrderId : '';
  const amount = Number(body.amount);
  if (!pgOrderId || typeof body.paymentKey !== 'string' || !body.paymentKey || !Number.isInteger(amount) || amount <= 0) {
    fail('COMMON001');
  }
  const charge = charges.get(pgOrderId);
  if (!charge) fail('CHARGE001');
  if (charge.memberId !== me.id) fail('CHARGE007');
  return { charge, amount };
}

function findChargeById(chargeId: number): MockCharge {
  const charge = [...charges.values()].find((c) => c.chargeId === chargeId);
  if (!charge) fail('CHARGE001');
  return charge;
}

export function registerPaymentRoutes(): void {
  /** 수동 충전 요청: pgOrderId 발급. 백엔드 검증은 양수뿐이고 1,000원 단위·상한은 프론트 ChargeDialog 가 맡는다 */
  route('POST', '/api/v1/payments/charges', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number((ctx.body as { amount?: unknown } | null | undefined)?.amount);
    if (!Number.isInteger(amount) || amount <= 0) fail('CHARGE002');
    const charge = newCharge(me.id, amount, 'MANUAL', now(), null);
    return ok(toChargeSummary(charge), 201);
  });

  /** 수동 충전 승인: 금액 검증 → 예치금 입금. 이미 승인된 건을 다시 보내면 그대로 돌려준다 (멱등) */
  route('POST', '/api/v1/payments/charges/confirm', (ctx) => {
    const { charge, amount } = findChargeForConfirm(ctx);
    if (charge.purpose !== 'MANUAL') fail('CHARGE008'); // 주문 결제용 충전을 수동 충전 승인으로 보냄
    if (charge.status === 'CHARGED') return ok(toChargeSummary(charge));
    if (charge.status !== 'REQUESTED') fail('CHARGE004');
    if (charge.amount !== amount) fail('CHARGE003');

    const at = now();
    addTransaction(charge.memberId, 'CHARGE', charge.amount, 'CHARGE', charge.chargeId, '예치금 충전 (토스페이먼츠)', at);
    charge.status = 'CHARGED';
    charge.method = '카드';
    charge.approvedAt = ldt(at);
    persist();
    return ok(toChargeSummary(charge));
  });

  /**
   * 주문 결제 승인: 부족분 충전(CHARGE 입금) → 장바구니 결제(지갑 차감·주문·홀딩) 를 한 번에.
   * 이미 PAID 인 결제를 다시 보내면 그대로 돌려준다 (멱등).
   */
  route('POST', '/api/v1/payments/confirm', (ctx) => {
    const { charge, amount } = findChargeForConfirm(ctx);
    if (charge.purpose !== 'FOR_PAYMENT' || !charge.payment) fail('CHARGE008'); // 수동 충전 건을 주문 승인으로 보냄
    const payment = charge.payment;
    const summary = () => ok(toPaymentSummary(requirePayment(ctx, String(payment.orderGroupId))));
    if (payment.status === 'PAID') return summary();
    if (charge.status !== 'REQUESTED') fail('CHARGE004');
    if (charge.amount !== amount) fail('CHARGE003');

    const at = now();
    addTransaction(charge.memberId, 'CHARGE', charge.amount, 'CHARGE', charge.chargeId, '주문 결제 부족분 충전 (토스페이먼츠)', at);
    charge.status = 'CHARGED';
    charge.method = '카드';
    charge.approvedAt = ldt(at);
    // 장바구니 상품이 그새 사라졌으면(기한 만료 등) payCartItems 가 CART00x 로 실패한다. 충전은 들어온 채 남는다 (실제 백엔드는 토스 취소로 보상)
    payCartItems(charge.memberId, payment.productIds, at, false, payment.orderGroupId);
    charge.status = 'USED';
    charge.usedAt = ldt(at);
    payment.status = 'PAID';
    payment.paidAt = ldt(at);
    persist();
    return summary();
  });

  /** 내 결제 내역 (주문 묶음 단위, 최신순) */
  route('GET', '/api/v1/payments/me', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    return ok(paginate(paymentsOf(me.id).map(toPaymentSummary), page, size));
  });

  /** 내 결제 상세 */
  route('GET', '/api/v1/payments/me/:paymentId', (ctx) =>
    ok(toPaymentDetail(requirePayment(ctx, ctx.pathParams.paymentId))),
  );

  /** 주문 그룹으로 내 결제 상세. 응답은 결제 상세와 같다 */
  route('GET', '/api/v1/payments/me/order-groups/:orderGroupId', (ctx) =>
    ok(toPaymentDetail(requirePayment(ctx, ctx.pathParams.orderGroupId))),
  );

  /** 주문 1건의 결제 정보 (백엔드 OrderPaymentDto). 구매자만. 결제가 끝나지 않은 주문은 WALLET301 */
  route('GET', '/api/v1/payments/me/orders/:orderId', (ctx) => {
    const me = requireMe(ctx);
    const order = db.orders.find((o) => o.id === Number(ctx.pathParams.orderId));
    const holding = order ? holdingOf(order.id) : undefined;
    if (!order || !holding) fail('WALLET301');
    if (order.winnerId !== me.id) fail('PAYMENT008');
    return ok({
      paymentId: order.orderGroupId,
      orderGroupId: order.orderGroupId,
      orderId: order.id,
      payMethod: 'DEPOSIT',
      pgMethod: null,
      winningPrice: order.winningPrice,
      deliveryFee: order.deliveryFee,
      amount: holding.amount,
      pointAmount: 0,
      depositAmount: holding.amount,
      pgAmount: 0,
      expectedEarnPoint: expectedEarnPointOf(order),
      // 목업에는 아직 포인트 적립이 없다
      earnedPoint: 0,
      status: holding.status,
      heldAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      refundedAt: holding.status === 'REFUNDED' ? refundedAtOf(order.id) : null,
    });
  });

  /** 결제 정책 (백엔드 PaymentPolicyDto) */
  route('GET', '/api/v1/payments/policy', () =>
    ok({
      chargeMinAmount: CHARGE_MIN_AMOUNT,
      chargeMaxAmount: CHARGE_MAX_AMOUNT,
      pointEarnRatePercent: POINT_EARN_RATE_PERCENT,
      feeRatePercent: Math.round(FEE_RATE * 100),
    }),
  );

  /** 내 충전 내역 (최신순). /charges/:chargeId 보다 먼저 등록해 'me' 가 id 로 잡히지 않게 한다 */
  route('GET', '/api/v1/payments/charges/me', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const mine = [...charges.values()]
      .filter((c) => c.memberId === me.id)
      .sort((a, b) => b.chargeId - a.chargeId)
      .map(toChargeSummary);
    return ok(paginate(mine, page, size));
  });

  /** 충전 상세 */
  route('GET', '/api/v1/payments/charges/:chargeId', (ctx) => {
    const me = requireMe(ctx);
    const charge = findChargeById(Number(ctx.pathParams.chargeId));
    if (charge.memberId !== me.id) fail('CHARGE007');
    return ok(toChargeSummary(charge));
  });

  /** 충전 취소: CHARGED 이고 안 쓰인 건만. 예치금에서 차감(CHARGE_CANCEL) 후 CANCELED. 잔액이 모자라면 거절 */
  route('POST', '/api/v1/payments/charges/:chargeId/cancel', (ctx) => {
    const me = requireMe(ctx);
    const charge = findChargeById(Number(ctx.pathParams.chargeId));
    if (charge.memberId !== me.id) fail('CHARGE007');
    if (charge.status !== 'CHARGED') fail('CHARGE005');
    if (walletOf(me.id).balance < charge.amount) fail('WALLET201');
    const at = now();
    addTransaction(me.id, 'CHARGE_CANCEL', -charge.amount, 'CHARGE', charge.chargeId, '충전 취소 (토스페이먼츠 환불)', at);
    charge.status = 'CANCELED';
    charge.canceledAt = ldt(at);
    persist();
    return ok(toChargeSummary(charge));
  });

  /**
   * 결제 전 견적 (백엔드 PaymentQuoteDto). 저장하지 않는다.
   * 목업은 예치금 결제만 계산한다: payMethod · pointUseAmount 는 무시하고, 부족분을 최소 충전 금액으로 올리지 않는다.
   */
  route('GET', '/api/v1/payments/quote', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number(ctx.params.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) fail('COMMON001');
    const deliveryFee = Math.max(0, Number(ctx.params.get('deliveryFee')) || 0);
    const balance = walletOf(me.id).balance;
    const shortage = Math.max(0, amount - balance);
    return ok({
      balance,
      pointBalance: 0,
      amount,
      payMethod: 'DEPOSIT',
      pointUseAmount: 0,
      walletUseAmount: amount - shortage,
      shortage,
      needsCharge: shortage > 0,
      chargeAmount: shortage,
      balanceAfterPayment: balance + shortage - amount,
      pgAmount: shortage,
      pgMethod: shortage > 0 ? 'TRANSFER' : null,
      chargeLimitExceeded: shortage > CHARGE_MAX_AMOUNT,
      expectedEarnPoint: earnPointOf(amount - deliveryFee),
      earnRatePercent: POINT_EARN_RATE_PERCENT,
    });
  });
}
