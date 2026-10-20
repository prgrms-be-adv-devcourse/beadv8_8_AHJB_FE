import { db } from '../db';
import { ok, route } from '../router';
import { requireMe } from '../services';
import { feeOf, getPageParams, paginate } from '../utils';
import { toWalletView } from '../views';
import type { HoldingRecord, TransactionRecord } from '../types';

// 백엔드 WalletApiController 와 같은 경로·응답 형태. 목업 DB 레코드는 그대로 두고 응답 시점에 변환한다.

/** 목업 거래 유형 → 백엔드 WalletTransactionType. 목업은 사용자 지갑에 찍히는 유형만 쓴다 */
type LedgerType = 'CHARGE' | 'CHARGE_CANCEL' | 'WITHDRAWAL' | 'HOLD_PAY' | 'SETTLEMENT_RECEIVE' | 'REFUND_RECEIVE' | 'REVERSAL';
type ReferenceType = 'PAYMENT' | 'ORDER' | 'WITHDRAWAL';
type HoldingRole = 'BUYER' | 'SELLER';

/**
 * 목업 참조 → 백엔드 참조 (PAYMENT = 충전 건, ORDER = 주문, WITHDRAWAL = 출금).
 * 목업은 환불·정산 레코드 id 를 들고 있어서 주문 id 로 바꿔 준다.
 */
function toReference(tx: TransactionRecord): { referenceType: ReferenceType; referenceId: number | null } {
  switch (tx.referenceType) {
    case 'CHARGE':
      return { referenceType: 'PAYMENT', referenceId: tx.referenceId };
    case 'ORDER':
      return { referenceType: 'ORDER', referenceId: tx.referenceId };
    case 'REFUND': {
      const refund = db.refunds.find((r) => r.id === tx.referenceId);
      return { referenceType: 'ORDER', referenceId: refund?.orderId ?? tx.referenceId };
    }
    case 'SETTLEMENT': {
      const settlement = db.settlements.find((s) => s.id === tx.referenceId);
      return { referenceType: 'ORDER', referenceId: settlement?.orderId ?? tx.referenceId };
    }
  }
}

/** 원장 한 줄 (백엔드 LedgerEntryDto). 목업은 주머니가 하나라 account 는 항상 DEPOSIT */
function toLedgerEntry(tx: TransactionRecord) {
  return {
    id: tx.id,
    account: 'DEPOSIT' as const,
    type: tx.type as LedgerType,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    ...toReference(tx),
    transactionGroupId: `mock-${tx.id}`,
    createdAt: tx.createdAt,
  };
}

/** 홀딩 한 건 (백엔드 HoldingSummaryDto). 주문·정산·환불 레코드에서 채운다 */
function toHoldingView(holding: HoldingRecord, role: HoldingRole) {
  const order = db.orders.find((o) => o.id === holding.orderId);
  const settlement = db.settlements.find((s) => s.orderId === holding.orderId);
  const refund = db.refunds.find((r) => r.orderId === holding.orderId && (r.status === 'ACCEPTED' || r.status === 'COMPLETED'));
  const winningPrice = order?.winningPrice ?? holding.amount;
  const deliveryFee = order?.deliveryFee ?? 0;
  const feeAmount = settlement?.feeAmount ?? feeOf(winningPrice);
  return {
    holdingId: holding.orderId,
    orderId: holding.orderId,
    paymentId: order?.orderGroupId ?? holding.orderId,
    counterpartyId: role === 'BUYER' ? (order?.sellerId ?? 0) : holding.winnerId,
    winningPrice,
    deliveryFee,
    amount: holding.amount,
    feeAmount,
    settlementAmount: holding.amount - feeAmount,
    status: holding.status,
    heldAt: order?.createdAt ?? '',
    confirmedAt: order?.confirmedAt ?? null,
    releasedAt: holding.status === 'RELEASED' ? (settlement?.completedAt ?? null) : null,
    refundedAt: holding.status === 'REFUNDED' ? (refund?.processedAt ?? null) : null,
  };
}

export function registerWalletRoutes(): void {
  /** 잔액. balance = 예치금, settlementBalance = 정산금(목업은 0) */
  route('GET', '/api/v1/wallet/me', (ctx) => ok(toWalletView(requireMe(ctx).id)));

  /** 원장. account / type 필터, 최신순, size 최대 50 */
  route('GET', '/api/v1/wallet/me/ledger', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const account = ctx.params.get('account');
    const type = ctx.params.get('type');
    // 목업은 예치금 주머니만 있어서 SETTLEMENT 를 요청하면 빈 목록
    if (account === 'SETTLEMENT') return ok({ ...toWalletView(me.id), ...paginate([], page, size) });
    const entries = db.transactions
      .filter((tx) => tx.memberId === me.id && (!type || tx.type === type))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .map(toLedgerEntry);
    return ok({ ...toWalletView(me.id), ...paginate(entries, page, size) });
  });

  /** 홀딩. role=BUYER 내 돈이 묶인 주문, role=SELLER 내가 받을 정산 예정 금액 */
  route('GET', '/api/v1/wallet/me/holdings', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const role: HoldingRole = ctx.params.get('role') === 'SELLER' ? 'SELLER' : 'BUYER';
    const status = ctx.params.get('status');
    const mine = db.holdings.filter((h) => {
      if (role === 'BUYER') return h.winnerId === me.id;
      const order = db.orders.find((o) => o.id === h.orderId);
      return order?.sellerId === me.id;
    });
    const views = mine
      .map((h) => toHoldingView(h, role))
      .sort((a, b) => b.heldAt.localeCompare(a.heldAt) || b.orderId - a.orderId);
    const open = views.filter((v) => v.status === 'HELD' || v.status === 'CONFIRMED');
    const sumOf = (list: typeof views) =>
      list.reduce((acc, v) => acc + (role === 'BUYER' ? v.amount : v.settlementAmount), 0);
    const filtered = status ? views.filter((v) => v.status === status) : views;
    return ok({
      role,
      heldTotal: sumOf(open),
      settleableTotal: sumOf(open.filter((v) => v.status === 'CONFIRMED')),
      ...paginate(filtered, page, size),
    });
  });
}
