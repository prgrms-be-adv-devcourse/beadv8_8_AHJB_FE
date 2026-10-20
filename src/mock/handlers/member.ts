import { db, persist } from '../db';
import { fail } from '../errors';
import { bodyOf, noContent, ok, route } from '../router';
import { requireMe } from '../services';
import type { SellerAccount } from '../types';

export function registerMemberRoutes(): void {
  // 목업 로그인용 내 정보(Me) + 회원 정보 화면용 상세(MemberDetail) 필드를 같이 준다
  route('GET', '/api/v1/member/me', (ctx) => {
    const me = requireMe(ctx);
    const address = me.address;
    return ok({
      addressAlias: address?.alias ?? null,
      address: address ? [address.address, address.addressDetail].filter(Boolean).join(' ') : null,
      signUpDate: me.createdAt.slice(0, 10),
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

  route('GET', '/api/v1/member/me/seller', (ctx) => {
    const me = requireMe(ctx);
    if (!me.seller) return ok(null);
    return ok({
      bank: me.seller.bank,
      accountNumberMasked: `${'*'.repeat(me.seller.accountNumber.length - 4)}${me.seller.accountNumber.slice(-4)}`,
      accountHolder: me.seller.accountHolder,
      registeredAt: me.createdAt.slice(0, 10),
    });
  });

  route('GET', '/api/v1/member/me/warnings', (ctx) => {
    const me = requireMe(ctx);
    const warnings = db.warnings
      .filter((w) => w.memberId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((w) => ({
        warningId: w.id,
        reason: w.reason,
        orderId: w.orderId,
        createdAt: w.createdAt,
      }));
    return ok({
      accountStatus: me.accountStatus,
      warningCount: warnings.length,
      suspendedUntil: null,
      warnings,
    });
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
