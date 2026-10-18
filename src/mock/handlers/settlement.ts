import { db } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { requireMe } from '../services';
import { getPageParams, paginate } from '../utils';

export function registerSettlementRoutes(): void {
  /** 내 정산 목록 (지급일 최신순), status 필터 선택 */
  route('GET', '/api/v1/settlements', (ctx) => {
    const me = requireMe(ctx);
    const status = ctx.params.get('status');
    const { page, size } = getPageParams(ctx.params, 20);
    const settlements = db.settlements
      .filter((s) => s.sellerId === me.id && (!status || s.status === status))
      .sort((a, b) => b.payoutDate.localeCompare(a.payoutDate) || b.id - a.id)
      .map((s) => ({
        settlementId: s.id,
        productName: s.productName,
        settlementAmount: s.settlementAmount,
        status: s.status,
        payoutDate: s.payoutDate,
      }));
    return ok(paginate(settlements, page, size));
  });

  route('GET', '/api/v1/settlements/:id', (ctx) => {
    const me = requireMe(ctx);
    const settlement = db.settlements.find((s) => s.id === Number(ctx.pathParams.id));
    if (!settlement) fail('SETTLEMENT001');
    if (settlement.sellerId !== me.id) fail('SETTLEMENT002');
    return ok({
      settlementId: settlement.id,
      orderId: settlement.orderId,
      productId: settlement.productId,
      productName: settlement.productName,
      winningPrice: settlement.winningPrice,
      deliveryFee: settlement.deliveryFee,
      feeAmount: settlement.feeAmount,
      settlementAmount: settlement.settlementAmount,
      status: settlement.status,
      confirmedAt: settlement.confirmedAt,
      payoutDate: settlement.payoutDate,
      completedAt: settlement.completedAt,
    });
  });
}
