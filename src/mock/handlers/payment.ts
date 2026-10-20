import { persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { addTransaction, requireMe } from '../services';
import { formatLocalDateTime as ldt, now } from '../utils';

// 백엔드 PaymentApiController 의 충전 요청/승인과 같은 경로·응답 형태.
// 목업은 토스 결제창을 거치지 않으므로 ChargeDialog 가 요청 직후 바로 승인을 부른다.
// 충전 건은 승인 전까지만 의미가 있어서 목업 DB 에 저장하지 않고 메모리에만 둔다 (새로고침하면 사라짐).

type ChargeStatus = 'REQUESTED' | 'CHARGED' | 'USED' | 'CANCELED' | 'ABORTED';

interface MockCharge {
  chargeId: number;
  memberId: number;
  pgOrderId: string;
  amount: number;
  status: ChargeStatus;
  method: string | null;
  receiptUrl: string | null;
  requestedAt: string;
  approvedAt: string | null;
}

const MANUAL_ORDER_NAME = '찐막 예치금 충전';
const charges = new Map<string, MockCharge>();
let chargeSeq = 1;

/** 백엔드 ChargeSummaryDto 형태 */
function toChargeSummary(charge: MockCharge) {
  return {
    chargeId: charge.chargeId,
    pgOrderId: charge.pgOrderId,
    amount: charge.amount,
    orderName: MANUAL_ORDER_NAME,
    purpose: 'MANUAL' as const,
    status: charge.status,
    cancelable: charge.status === 'CHARGED',
    usedAmount: 0,
    remainingAmount: charge.status === 'CHARGED' ? charge.amount : 0,
    method: charge.method,
    receiptUrl: charge.receiptUrl,
    requestedAt: charge.requestedAt,
    approvedAt: charge.approvedAt,
    usedAt: null,
    canceledAt: null,
    failureCode: null,
    failureMessage: null,
  };
}

export function registerPaymentRoutes(): void {
  /** 충전 요청: pgOrderId 발급. 백엔드 검증은 양수뿐이고 1,000원 단위·상한은 프론트 ChargeDialog 가 맡는다 */
  route('POST', '/api/v1/payments/charges', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number((ctx.body as { amount?: unknown } | null | undefined)?.amount);
    if (!Number.isInteger(amount) || amount <= 0) fail('CHARGE002');
    const chargeId = chargeSeq++;
    const charge: MockCharge = {
      chargeId,
      memberId: me.id,
      pgOrderId: `mock-charge-${me.id}-${chargeId}-${now().toString(36)}`,
      amount,
      status: 'REQUESTED',
      method: null,
      receiptUrl: null,
      requestedAt: ldt(now()),
      approvedAt: null,
    };
    charges.set(charge.pgOrderId, charge);
    return ok(toChargeSummary(charge), 201);
  });

  /** 충전 승인: 금액 검증 → 예치금 입금. 이미 승인된 건을 다시 보내면 그대로 돌려준다 (멱등) */
  route('POST', '/api/v1/payments/charges/confirm', (ctx) => {
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
    if (charge.status === 'CHARGED') return ok(toChargeSummary(charge));
    if (charge.status !== 'REQUESTED') fail('CHARGE004');
    if (charge.amount !== amount) fail('CHARGE003');

    const at = now();
    addTransaction(me.id, 'CHARGE', charge.amount, 'CHARGE', charge.chargeId, '예치금 충전 (토스페이먼츠)', at);
    charge.status = 'CHARGED';
    charge.method = '카드';
    charge.receiptUrl = null;
    charge.approvedAt = ldt(at);
    persist();
    return ok(toChargeSummary(charge));
  });
}
