import { db, persist } from '../db';
import { fail } from '../errors';
import { bodyOf, noContent, ok, route } from '../router';
import { requireMe } from '../services';
import type { SellerAccount } from '../types';

export function registerMemberRoutes(): void {
  route('GET', '/api/v1/member/me', (ctx) => {
    const me = requireMe(ctx);
    return ok({
      memberId: me.id,
      uuid: me.uuid,
      email: me.email,
      nickname: me.nickname,
      username: me.username,
      phone: me.phone,
      birthDate: me.birthDate,
      isSeller: !!me.seller,
      accountStatus: me.accountStatus,
      warningCount: db.warnings.filter((w) => w.memberId === me.id).length,
      address: me.address,
      seller: me.seller
        ? {
            bank: me.seller.bank,
            accountNumberMasked: `${me.seller.accountNumber.slice(0, 4)}****${me.seller.accountNumber.slice(-3)}`,
            accountHolder: me.seller.accountHolder,
          }
        : null,
      createdAt: me.createdAt,
    });
  });

  route('GET', '/api/v1/member/me/summary', (ctx) => {
    const me = requireMe(ctx);
    return ok({
      nickname: me.nickname,
      seller: !!me.seller,
      suspended: me.accountStatus === 'SUSPENDED',
    });
  });

  route('GET', '/api/v1/member/me/warnings', (ctx) => {
    const me = requireMe(ctx);
    return ok(
      db.warnings
        .filter((w) => w.memberId === me.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((w) => ({
          warningId: w.id,
          reason: w.reason,
          orderId: w.orderId,
          createdAt: w.createdAt,
        })),
    );
  });

  route('POST', '/api/v1/member/me/seller', (ctx) => {
    const me = requireMe(ctx);
    const body = bodyOf<SellerAccount>(ctx);
    if (!body.bank || !/^[0-9]{10,16}$/.test(body.accountNumber ?? '') || !body.accountHolder) fail('COMMON001');
    if (me.seller) fail('MEMBER003');
    me.seller = {
      bank: body.bank,
      accountNumber: body.accountNumber as string,
      accountHolder: body.accountHolder,
    };
    persist();
    return noContent(201);
  });
}
