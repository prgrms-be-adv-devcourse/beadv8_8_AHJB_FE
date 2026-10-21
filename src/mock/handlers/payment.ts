import { persist } from '../db';
import { fail } from '../errors';
import { ok, route, type HandlerContext } from '../router';
import { addTransaction, payCartItems, requireMe, walletOf } from '../services';
import { formatLocalDateTime as ldt, getPageParams, now, paginate } from '../utils';

// 백엔드 PaymentApiController 와 같은 경로·응답 형태.
// 목업은 토스 결제창을 거치지 않으므로 ChargeDialog / CartPage 가 요청 직후 바로 승인을 부른다.
// 충전 건은 승인 전까지만 의미가 있어서 목업 DB 에 저장하지 않고 메모리에만 둔다 (새로고침하면 사라짐).

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

interface MockPayment {
  paymentId: number;
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
const charges = new Map<string, MockCharge>();
let chargeSeq = 1;
let paymentSeq = 1;

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

/** 백엔드 PaymentSummaryDto 형태 */
function toPaymentSummary(payment: MockPayment) {
  return {
    paymentId: payment.paymentId,
    orderGroupId: payment.orderGroupId,
    totalPrice: payment.totalPrice,
    walletUsedAmount: payment.totalPrice - payment.chargeAmount,
    chargeAmount: payment.chargeAmount,
    orderCount: payment.productIds.length,
    status: payment.status,
    requestedAt: payment.requestedAt,
    paidAt: payment.paidAt,
  };
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
    paymentId: paymentSeq++,
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
    paymentId: payment.paymentId,
    totalPrice,
    chargeAmount,
    pgOrderId: charge.pgOrderId,
    orderName: PAYMENT_ORDER_NAME,
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
    if (payment.status === 'PAID') return ok(toPaymentSummary(payment));
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
    return ok(toPaymentSummary(payment));
  });

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

  /** 결제 전 견적: 지금 잔액으로 amount 를 결제하면 예치금/카드가 각각 얼마인지. 저장하지 않는다 */
  route('GET', '/api/v1/payments/quote', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number(ctx.params.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) fail('COMMON001');
    const balance = walletOf(me.id).balance;
    const shortage = Math.max(0, amount - balance);
    return ok({ balance, amount, walletUseAmount: amount - shortage, shortage, needsCharge: shortage > 0 });
  });
}
