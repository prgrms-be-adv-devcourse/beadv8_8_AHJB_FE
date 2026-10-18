import { db, nextId, persist } from '../db';
import { fail } from '../errors';
import { bodyOf, noContent, ok, route } from '../router';
import { walletOf } from '../services';
import type { MemberAddress } from '../types';
import { formatLocalDateTime as ldt, now } from '../utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^01[0-9]{8,9}$/;

interface SignupBody {
  email: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
  username: string;
  phone: string;
  birthDate: string | null;
  address: Partial<MemberAddress>;
}

interface LoginBody {
  email: string;
  password: string;
}

export function registerAuthRoutes(): void {
  route('POST', '/api/v1/auth/signup', (ctx) => {
    const body = bodyOf<SignupBody>(ctx);
    if (!EMAIL_PATTERN.test(body.email ?? '') || !body.password || body.password !== body.passwordConfirm)
      fail('COMMON001');
    if (!body.nickname || !body.username || !PHONE_PATTERN.test(body.phone ?? '')) fail('COMMON001');
    const address = body.address ?? {};
    if (!address.recipient || !PHONE_PATTERN.test(address.recipientPhone ?? '') || !address.zipcode || !address.address)
      fail('COMMON001');
    if (db.members.some((m) => m.email === body.email)) fail('MEMBER001');
    if (db.members.some((m) => m.nickname === body.nickname)) fail('MEMBER002');

    const id = nextId('members');
    db.members.push({
      id,
      uuid:
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      email: body.email as string,
      password: body.password,
      nickname: body.nickname,
      username: body.username,
      phone: body.phone as string,
      birthDate: body.birthDate ?? null,
      address: address as MemberAddress,
      seller: null,
      accountStatus: 'ACTIVE',
      failedLogins: 0,
      lockedUntil: null,
      baseRating: { sum: 0, count: 0 },
      createdAt: ldt(),
    });
    walletOf(id);
    persist();
    return noContent(201);
  });

  route('POST', '/api/v1/auth/login', (ctx) => {
    const body = ctx.body as Partial<LoginBody> | null | undefined;
    const member = db.members.find((m) => m.email === body?.email);
    if (!member) fail('AUTH101');
    if (member.accountStatus === 'BANNED') fail('AUTH102');
    if (member.lockedUntil && member.lockedUntil > now()) fail('AUTH103');
    if (member.password !== body?.password) {
      // 5회 실패 시 15분 잠금
      member.failedLogins += 1;
      if (member.failedLogins >= 5) {
        member.lockedUntil = now() + 15 * 60000;
        member.failedLogins = 0;
      }
      persist();
      fail('AUTH101');
    }
    member.failedLogins = 0;
    member.lockedUntil = null;
    persist();
    return ok({
      accessToken: `mock.${member.id}.${Date.now().toString(36)}`,
      refreshToken: `mock-refresh.${member.id}`,
      nickname: member.nickname,
      suspended: member.accountStatus === 'SUSPENDED',
    });
  });

  route('POST', '/api/v1/auth/logout', () => noContent(204));

  route('POST', '/api/v1/auth/reissue', (ctx) => {
    const body = ctx.body as { refreshToken?: string } | null | undefined;
    const memberId = Number(String(body?.refreshToken ?? '').split('.')[1]);
    const member = db.members.find((m) => m.id === memberId);
    if (!member) fail('AUTH104');
    return ok({
      accessToken: `mock.${member.id}.${Date.now().toString(36)}`,
      refreshToken: `mock-refresh.${member.id}`,
      nickname: member.nickname,
      suspended: false,
    });
  });

  route('GET', '/api/v1/auth/email-availability', ({ params }) =>
    ok({ available: !db.members.some((m) => m.email === params.get('email')) }),
  );

  route('GET', '/api/v1/auth/nickname-availability', ({ params }) =>
    ok({ available: !db.members.some((m) => m.nickname === params.get('nickname')) }),
  );
}
