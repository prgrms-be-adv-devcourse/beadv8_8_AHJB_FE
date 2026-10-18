import { db, persist } from '../db';
import { fail } from '../errors';
import { ok, route } from '../router';
import { addTransaction, requireMe } from '../services';
import { getPageParams, paginate } from '../utils';
import { toWalletView } from '../views';

export function registerWalletRoutes(): void {
  route('GET', '/api/v1/wallet/me', (ctx) => ok(toWalletView(requireMe(ctx).id)));

  route('GET', '/api/v1/wallet/me/transactions', (ctx) => {
    const me = requireMe(ctx);
    const { page, size } = getPageParams(ctx.params, 20);
    const transactions = db.transactions
      .filter((tx) => tx.memberId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .map((tx) => ({
        transactionId: tx.id,
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        description: tx.description,
        createdAt: tx.createdAt,
      }));
    return ok(paginate(transactions, page, size));
  });

  /** 예치금 충전: 1,000원 단위, 1,000원 ~ 2,000,000원 */
  route('POST', '/api/v1/wallet/me/charge', (ctx) => {
    const me = requireMe(ctx);
    const amount = Number((ctx.body as { amount?: unknown } | null | undefined)?.amount);
    if (!Number.isInteger(amount) || amount < 1000 || amount > 2_000_000 || amount % 1000 !== 0) fail('COMMON001');
    addTransaction(me.id, 'CHARGE', amount, 'CHARGE', null, '예치금 충전 (토스페이먼츠)');
    persist();
    return ok(toWalletView(me.id));
  });
}
