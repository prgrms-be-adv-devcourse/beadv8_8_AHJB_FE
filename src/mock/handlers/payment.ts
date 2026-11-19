import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route, type HandlerContext } from '../router';
import { addTransaction, cashAmountOf, earnPointOf, payCartItems, requireMe, shareOf, walletOf } from '../services';
import type { OrderRecord, PayMethod } from '../types';
import { FEE_RATE, POINT_EARN_RATE_PERCENT, formatLocalDateTime as ldt, getPageParams, now, paginate } from '../utils';

// 백엔드 PaymentApiController 와 같은 경로·응답 형태.
// 목업은 토스 결제창을 거치지 않으므로 ChargeDialog / CartPage 가 요청 직후 바로 승인을 부른다.
// 충전 건은 승인 전까지만 의미가 있어서 목업 DB 에 저장하지 않고 메모리에만 둔다 (새로고침하면 사라짐).
// 결제 금액 구성(포인트 · 예치금 · 직접 결제)과 적립된 포인트는 홀딩 레코드에 남긴다.

type ChargeStatus = 'REQUESTED' | 'CHARGED' | 'USED' | 'CANCELED' | 'ABORTED';
type ChargePurpose = 'MANUAL' | 'FOR_PAYMENT' | 'DIRECT_PAYMENT';
type PgMethod = 'TRANSFER' | 'CARD';

interface MockCharge {
  chargeId: number;
  memberId: number;
  pgOrderId: string;
  amount: number;
  purpose: ChargePurpose;
  /** 결제창을 여는 결제수단. 예치금 충전(MANUAL · FOR_PAYMENT)은 항상 TRANSFER */
  pgMethod: PgMethod;
  status: ChargeStatus;
  /** 같은 상품을 다른 조건으로 다시 결제 요청해서 못 쓰게 된 결제창인지 (승인하면 CHARGE012) */
  superseded: boolean;
  method: string | null;
  receiptUrl: string | null;
  requestedAt: string;
  approvedAt: string | null;
  usedAt: string | null;
  canceledAt: string | null;
  /** FOR_PAYMENT · DIRECT_PAYMENT 전용: 주문 결제 정보 */
  payment: MockPayment | null;
}

/** 결제창을 거치는 주문 결제. 결제(Payment)를 따로 저장하지 않으므로 paymentId 는 orderGroupId 와 같은 값을 쓴다 */
interface MockPayment {
  orderGroupId: number;
  productIds: number[];
  totalPrice: number;
  chargeAmount: number;
  payMethod: PayMethod;
  pointAmount: number;
  depositAmount: number;
  pgAmount: number;
  status: 'CHARGING' | 'PAID';
  requestedAt: string;
  paidAt: string | null;
}

/** 토스 결제창에 표시되는 상품명 (백엔드 ChargeSummaryDto 와 같은 값) */
const ORDER_NAMES: Record<ChargePurpose, string> = {
  MANUAL: '찐막 예치금 충전',
  FOR_PAYMENT: '찐막 주문 결제 (부족분 충전)',
  DIRECT_PAYMENT: '찐막 주문 결제',
};
/** 토스가 승인한 결제수단 표기 */
const PG_METHOD_LABELS: Record<PgMethod, string> = { TRANSFER: '계좌이체', CARD: '카드' };
/** 결제 정책 (백엔드 설정값 wallet.* 과 같은 값) */
const CHARGE_MIN_AMOUNT = 10000;
const CHARGE_MAX_AMOUNT = 2000000;
const charges = new Map<string, MockCharge>();
let chargeSeq = 1;

/** 결제 1건을 어떻게 낼지 정한 결과 (백엔드 PaymentPlan) */
export interface PaymentPlan {
  payMethod: PayMethod;
  totalPrice: number;
  pointAmount: number;
  /** 예치금으로 내는 금액. 부족분을 충전해서 내는 금액도 포함한다 */
  depositAmount: number;
  /** 결제창에서 직접 결제하는 금액 */
  pgAmount: number;
  /** 결제창에서 결제할 금액. 0 이면 결제창 없이 끝난다 */
  chargeAmount: number;
  /** 예치금 결제에서 예치금이 모자란 금액 */
  shortage: number;
  /** 결제창 금액이 계좌이체 1회 한도를 넘는지 */
  limitExceeded: boolean;
}

const PAY_METHODS: readonly PayMethod[] = ['DEPOSIT', 'TRANSFER', 'CARD'];

/** 요청으로 받은 결제수단. 값이 없으면 DEPOSIT, 모르는 값이면 PAYMENT009 */
export function parsePayMethod(value: unknown): PayMethod {
  if (value == null || value === '') return 'DEPOSIT';
  const method = String(value).trim().toUpperCase() as PayMethod;
  if (!PAY_METHODS.includes(method)) fail('PAYMENT009');
  return method;
}

/**
 * 결제 금액 구성을 정한다 (백엔드 PaymentPlanner.plan). 견적과 결제 요청이 함께 쓴다.
 * 포인트를 먼저 빼고 남은 금액을 고른 수단으로 낸다. 예치금이 모자라면 부족분을 최소 충전 금액 이상으로 충전한다.
 * 한도 초과는 여기서 막지 않고 limitExceeded 로만 알린다.
 */
export function planPayment(memberId: number, totalPrice: number, payMethod: PayMethod, pointUseAmount: number): PaymentPlan {
  const wallet = walletOf(memberId);
  if (!Number.isInteger(totalPrice) || totalPrice <= 0) fail('PAYMENT007');
  if (!Number.isInteger(pointUseAmount) || pointUseAmount < 0 || pointUseAmount > totalPrice) fail('PAYMENT010');
  if (pointUseAmount > wallet.pointBalance) fail('WALLET204');
  const rest = totalPrice - pointUseAmount;
  const base = { payMethod, totalPrice, pointAmount: pointUseAmount };
  if (payMethod !== 'DEPOSIT') {
    return {
      ...base,
      depositAmount: 0,
      pgAmount: rest,
      chargeAmount: rest,
      shortage: 0,
      limitExceeded: payMethod === 'TRANSFER' && rest > CHARGE_MAX_AMOUNT,
    };
  }
  const shortage = Math.max(0, rest - wallet.balance);
  const chargeAmount = shortage > 0 ? Math.max(shortage, CHARGE_MIN_AMOUNT) : 0;
  return { ...base, depositAmount: rest, pgAmount: 0, chargeAmount, shortage, limitExceeded: chargeAmount > CHARGE_MAX_AMOUNT };
}

/** 백엔드 ChargeSummaryDto 형태 */
function toChargeSummary(charge: MockCharge) {
  return {
    chargeId: charge.chargeId,
    pgOrderId: charge.pgOrderId,
    amount: charge.amount,
    orderName: ORDER_NAMES[charge.purpose],
    purpose: charge.purpose,
    status: charge.status,
    cancelable: charge.status === 'CHARGED',
    usedAmount: charge.status === 'USED' ? charge.amount : 0,
    remainingAmount: charge.status === 'CHARGED' ? charge.amount : 0,
    canceledAmount: charge.status === 'CANCELED' ? charge.amount : 0,
    pgMethod: charge.pgMethod,
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
  payMethod: PayMethod;
  pointAmount: number;
  depositAmount: number;
  pgAmount: number;
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
    // 끝난 결제의 금액 구성은 주문별 홀딩에서 모은다. 충전 건은 메모리에만 있어 새로고침 뒤에는 없을 수 있다
    const shares = orders.map((o) => holdingOf(o.id)).map((h) => (h ? shareOf(h) : null));
    const sumOf = (key: 'pointAmount' | 'depositAmount' | 'pgAmount') =>
      shares.reduce((acc, s) => acc + (s?.[key] ?? 0), 0);
    const totalPrice = orders.reduce((acc, o) => acc + amountOf(o), 0);
    const pointAmount = sumOf('pointAmount');
    const pgAmount = sumOf('pgAmount');
    return {
      orderGroupId,
      totalPrice,
      payMethod: shares[0]?.payMethod ?? 'DEPOSIT',
      pointAmount,
      depositAmount: totalPrice - pointAmount - pgAmount,
      pgAmount,
      chargeAmount: charge?.amount ?? pgAmount,
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
    payMethod: charge.payment.payMethod,
    pointAmount: charge.payment.pointAmount,
    depositAmount: charge.payment.depositAmount,
    pgAmount: charge.payment.pgAmount,
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
    .map((id) => findPayment(memberId, id))
    .filter((p): p is PaymentView => p !== undefined)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.orderGroupId - a.orderGroupId);
}

/** 직접 결제가 승인된 결제수단 표기. 직접 결제가 아니거나 승인 전이면 null */
function approvedPgMethodOf(payMethod: PayMethod, pgAmount: number, paid: boolean, charge: MockCharge | null): string | null {
  if (payMethod === 'DEPOSIT' || pgAmount <= 0 || !paid) return null;
  return charge?.method ?? PG_METHOD_LABELS[payMethod];
}

/** 금액 구성 (백엔드 PaymentSummaryDto · PaymentDetailDto 공통) */
function toPaymentBase(payment: PaymentView) {
  return {
    paymentId: payment.orderGroupId,
    orderGroupId: payment.orderGroupId,
    totalPrice: payment.totalPrice,
    payMethod: payment.payMethod,
    pointAmount: payment.pointAmount,
    walletUsedAmount: payment.depositAmount,
    pgAmount: payment.pgAmount,
    pgMethod: approvedPgMethodOf(payment.payMethod, payment.pgAmount, payment.status === 'PAID', payment.charge),
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
function expectedEarnPointOf(order: OrderRecord): number {
  const holding = holdingOf(order.id);
  if (holding?.status !== 'HELD') return 0;
  return earnPointOf(cashAmountOf(shareOf(holding)), order.winningPrice, order.deliveryFee);
}

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

function newCharge(
  memberId: number,
  amount: number,
  purpose: ChargePurpose,
  pgMethod: PgMethod,
  at: number,
  payment: MockPayment | null,
): MockCharge {
  const chargeId = chargeSeq++;
  const charge: MockCharge = {
    chargeId,
    memberId,
    pgOrderId: `mock-charge-${memberId}-${chargeId}-${at.toString(36)}`,
    amount,
    purpose,
    pgMethod,
    status: 'REQUESTED',
    superseded: false,
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
 * 장바구니 결제에서 결제창을 거쳐야 할 때 (handlers/cart.ts 가 호출).
 * 예치금 결제면 부족분 충전 건(FOR_PAYMENT, 계좌이체), 직접 결제면 직접 결제 건(DIRECT_PAYMENT)을 만들고
 * 결제창 파라미터(백엔드 PaymentResponseDto.Data)를 돌려준다.
 * 같은 상품으로 먼저 띄운 결제창이 있으면 그 결제창은 못 쓰게 한다 (승인하면 CHARGE012).
 */
export function createPaymentCharge(memberId: number, orderGroupId: number, productIds: number[], plan: PaymentPlan, at: number) {
  charges.forEach((c) => {
    if (c.memberId !== memberId || c.status !== 'REQUESTED' || !c.payment) return;
    if (c.payment.productIds.some((id) => productIds.includes(id))) c.superseded = true;
  });
  const direct = plan.pgAmount > 0;
  const pgMethod: PgMethod = plan.payMethod === 'CARD' ? 'CARD' : 'TRANSFER';
  const payment: MockPayment = {
    orderGroupId,
    productIds,
    totalPrice: plan.totalPrice,
    chargeAmount: plan.chargeAmount,
    payMethod: plan.payMethod,
    pointAmount: plan.pointAmount,
    depositAmount: plan.depositAmount,
    pgAmount: plan.pgAmount,
    status: 'CHARGING',
    requestedAt: ldt(at),
    paidAt: null,
  };
  const purpose: ChargePurpose = direct ? 'DIRECT_PAYMENT' : 'FOR_PAYMENT';
  const charge = newCharge(memberId, plan.chargeAmount, purpose, pgMethod, at, payment);
  return {
    paymentId: orderGroupId,
    totalPrice: plan.totalPrice,
    chargeAmount: plan.chargeAmount,
    pgOrderId: charge.pgOrderId,
    orderName: ORDER_NAMES[purpose],
    pgMethod,
    payMethod: plan.payMethod,
    pointAmount: plan.pointAmount,
    depositAmount: plan.depositAmount,
    pgAmount: plan.pgAmount,
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
  /** 수동 충전 요청: pgOrderId 발급. 금액이 최소·최대 충전 금액을 벗어나면 CHARGE010 (1,000원 단위는 프론트 ChargeDialog 만의 규칙) */
  route('POST', '/api/v1/payments/charges', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number((ctx.body as { amount?: unknown } | null | undefined)?.amount);
    if (!Number.isInteger(amount) || amount <= 0) fail('CHARGE002');
    if (amount < CHARGE_MIN_AMOUNT || amount > CHARGE_MAX_AMOUNT) fail('CHARGE010');
    const charge = newCharge(me.id, amount, 'MANUAL', 'TRANSFER', now(), null);
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
    charge.method = '계좌이체';
    charge.approvedAt = ldt(at);
    persist();
    return ok(toChargeSummary(charge));
  });

  /**
   * 주문 결제 승인. 부족분 충전이면 충전(CHARGE 입금) → 장바구니 결제(포인트 · 예치금 차감, 주문, 홀딩)를 한 번에,
   * 직접 결제면 예치금을 거치지 않고 포인트 차감 → 주문 · 홀딩만 한다.
   * 이미 PAID 인 결제를 다시 보내면 그대로 돌려준다 (멱등).
   */
  route('POST', '/api/v1/payments/confirm', (ctx) => {
    const { charge, amount } = findChargeForConfirm(ctx);
    if (charge.purpose === 'MANUAL' || !charge.payment) fail('CHARGE008'); // 수동 충전 건을 주문 승인으로 보냄
    const payment = charge.payment;
    const summary = () => ok(toPaymentSummary(requirePayment(ctx, String(payment.orderGroupId))));
    if (payment.status === 'PAID') return summary();
    if (charge.status !== 'REQUESTED') fail('CHARGE004');
    if (charge.amount !== amount) fail('CHARGE003');
    if (charge.superseded) fail('CHARGE012'); // 수단 · 포인트를 바꿔 다시 결제 요청하기 전의 결제창

    // 결제창에 있는 동안 포인트나 예치금이 줄었으면 승인 전에 막는다 (돈이 움직이지 않는다)
    const direct = charge.purpose === 'DIRECT_PAYMENT';
    const wallet = walletOf(charge.memberId);
    if (wallet.pointBalance < payment.pointAmount) fail('WALLET204');
    if (wallet.balance + (direct ? 0 : charge.amount) < payment.depositAmount) fail('WALLET201');

    const at = now();
    if (!direct) {
      addTransaction(charge.memberId, 'CHARGE', charge.amount, 'CHARGE', charge.chargeId, '주문 결제 부족분 충전 (토스페이먼츠)', at);
    }
    charge.status = 'CHARGED';
    charge.method = PG_METHOD_LABELS[charge.pgMethod];
    charge.approvedAt = ldt(at);
    // 장바구니 상품이 그새 사라졌으면(기한 만료 등) payCartItems 가 CART00x 로 실패한다. 충전은 들어온 채 남는다 (실제 백엔드는 토스 취소로 보상)
    payCartItems(charge.memberId, payment.productIds, at, false, payment.orderGroupId, {
      payMethod: payment.payMethod,
      pointAmount: payment.pointAmount,
    });
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
    const share = shareOf(holding);
    const charge = findPayment(me.id, order.orderGroupId)?.charge ?? null;
    return ok({
      paymentId: order.orderGroupId,
      orderGroupId: order.orderGroupId,
      orderId: order.id,
      payMethod: share.payMethod,
      pgMethod: approvedPgMethodOf(share.payMethod, share.pgAmount, true, charge),
      winningPrice: order.winningPrice,
      deliveryFee: order.deliveryFee,
      amount: holding.amount,
      pointAmount: share.pointAmount,
      depositAmount: share.depositAmount,
      pgAmount: share.pgAmount,
      expectedEarnPoint: expectedEarnPointOf(order),
      earnedPoint: holding.earnedPoint ?? 0,
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
   * 결제 전 견적 (백엔드 PaymentQuoteDto). 저장하지 않는다. 결제 요청과 같은 계산(planPayment)을 쓴다.
   * 포인트 사용액이 결제 금액을 넘으면 PAYMENT010, 포인트 잔액보다 많으면 WALLET204. 한도 초과는 오류 대신 chargeLimitExceeded 로 알린다.
   */
  route('GET', '/api/v1/payments/quote', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number(ctx.params.get('amount'));
    const deliveryFee = Number(ctx.params.get('deliveryFee') ?? 0);
    if (!Number.isInteger(deliveryFee) || deliveryFee < 0 || (deliveryFee > 0 && deliveryFee >= amount)) fail('PAYMENT007');
    const payMethod = parsePayMethod(ctx.params.get('payMethod'));
    const plan = planPayment(me.id, amount, payMethod, Number(ctx.params.get('pointUseAmount') ?? 0));
    const { balance, pointBalance } = walletOf(me.id);
    const direct = plan.pgAmount > 0;
    const chargeAmount = direct ? 0 : plan.chargeAmount;
    return ok({
      balance,
      pointBalance,
      amount,
      payMethod,
      pointUseAmount: plan.pointAmount,
      walletUseAmount: plan.depositAmount - plan.shortage,
      shortage: plan.shortage,
      needsCharge: plan.shortage > 0,
      chargeAmount,
      balanceAfterPayment: balance + chargeAmount - plan.depositAmount,
      pgAmount: plan.chargeAmount,
      pgMethod: plan.chargeAmount > 0 ? (payMethod === 'CARD' ? 'CARD' : 'TRANSFER') : null,
      chargeLimitExceeded: plan.limitExceeded,
      expectedEarnPoint: earnPointOf(cashAmountOf(plan), amount - deliveryFee, deliveryFee),
      earnRatePercent: POINT_EARN_RATE_PERCENT,
    });
  });
}
