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

interface KakaoSignupBody {
  signupToken: string;
  email: string;
  nickname: string;
  username: string;
  phone: string;
  birthDate: string | null;
  address: Partial<MemberAddress>;
}

/**
 * 목업 카카오.
 * 인가 코드 `mock-kakao.<카카오 회원번호>.<난수>` 를 받으면 그 회원번호의 카카오 계정으로 본다 (lib/kakaoAuth.ts 가 만든다).
 * 실제 카카오처럼 인가 코드는 한 번만 쓸 수 있다.
 */
const usedKakaoCodes = new Set<string>();
const SIGNUP_TOKEN_TTL_MS = 10 * 60000;

function kakaoIdFromCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const match = /^mock-kakao\.(\w+)\.\w+$/.exec(code);
  return match ? match[1] : null;
}

/** 가입 토큰 `mock-signup.<카카오 회원번호>.<만료 ms>` */
function parseSignupToken(token: unknown): { kakaoId: string; expiresAt: number } | null {
  if (typeof token !== 'string') return null;
  const match = /^mock-signup\.(\w+)\.(\d+)$/.exec(token);
  return match ? { kakaoId: match[1], expiresAt: Number(match[2]) } : null;
}

/**
 * 목업 카카오 계정의 인증 이메일 (실제는 카카오가 준다. 유효·인증된 이메일만, 아니면 null).
 * 회원번호 접두어로 경우를 나눈다 (lib/kakaoAuth.ts 의 mockKakaoId 주석 참고).
 * - noemail… → null (이메일 미인증 → 사용자가 직접 입력)
 * - dup…     → 시드 회원 이메일 (이미 이메일 회원 → AUTH113)
 * - 그 외    → kakao<회원번호>@kakao.mock
 */
function mockKakaoEmail(kakaoId: string): string | null {
  if (kakaoId.startsWith('noemail')) return null;
  if (kakaoId.startsWith('dup')) return 'demo@jjinmak.kr';
  return `kakao${kakaoId}@kakao.mock`;
}

/**
 * 목업 카카오 닉네임 (실제는 kakao_account.profile.nickname). 회원번호 접두어로 경우를 나눈다.
 * - nonick…    → null (닉네임 미동의)
 * - takennick… → 시드 회원 닉네임 (가입 화면에서 중복 안내)
 * - 그 외      → 카카오<회원번호 끝 4자리>
 */
function mockKakaoNickname(kakaoId: string): string | null {
  if (kakaoId.startsWith('nonick')) return null;
  if (kakaoId.startsWith('takennick')) return '찐막러';
  return `카카오${kakaoId.slice(-4)}`;
}

const mockTokens = (memberId: number) => ({
  accessToken: `mock.${memberId}.${Date.now().toString(36)}`,
  refreshToken: `mock-refresh.${memberId}`,
});

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
    // 카카오로 가입한 회원은 비밀번호가 없어서 이메일 로그인이 안 된다
    if (!member || !member.password) fail('AUTH101');
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

  route('POST', '/api/v1/auth/oauth/kakao', (ctx) => {
    const code = (ctx.body as { code?: unknown } | null | undefined)?.code;
    const kakaoId = kakaoIdFromCode(code);
    if (!kakaoId || usedKakaoCodes.has(code as string)) fail('AUTH108');
    usedKakaoCodes.add(code as string);

    const member = db.members.find((m) => m.kakaoId === kakaoId);
    if (!member) {
      const email = mockKakaoEmail(kakaoId);
      // 인증 이메일이 이미 이메일 회원이면 가입 토큰 없이 거절 (직접 입력 경로는 가입 API 의 MEMBER001 이 검사)
      if (email && db.members.some((m) => m.email === email)) fail('AUTH113');
      return ok({
        status: 'SIGNUP_REQUIRED',
        accessToken: null,
        suspended: null,
        signupToken: `mock-signup.${kakaoId}.${now() + SIGNUP_TOKEN_TTL_MS}`,
        email,
        nickname: mockKakaoNickname(kakaoId),
      });
    }
    if (member.accountStatus === 'BANNED') fail('COMMON102');
    return ok({
      status: 'LOGIN',
      ...mockTokens(member.id),
      suspended: member.accountStatus === 'SUSPENDED',
      signupToken: null,
      email: null,
      nickname: null,
    });
  });

  route('POST', '/api/v1/auth/oauth/kakao/signup', (ctx) => {
    const body = bodyOf<KakaoSignupBody>(ctx);
    const token = parseSignupToken(body.signupToken);
    if (!token) fail('AUTH110');
    if (token.expiresAt < now()) fail('AUTH111');
    if (db.members.some((m) => m.kakaoId === token.kakaoId)) fail('AUTH112');

    // 가입 토큰에 인증 이메일이 있으면 요청 email 은 무시한다. 없으면 요청 email 필수
    const email = mockKakaoEmail(token.kakaoId) ?? body.email;
    if (!EMAIL_PATTERN.test(email ?? '')) fail('COMMON001');
    if (!body.nickname || body.nickname.length > 50 || !body.username || body.username.length > 50) fail('COMMON001');
    if (!PHONE_PATTERN.test(body.phone ?? '')) fail('COMMON001');
    const address = body.address ?? {};
    if (!address.recipient || !PHONE_PATTERN.test(address.recipientPhone ?? '') || !address.zipcode || !address.address)
      fail('COMMON001');
    if (db.members.some((m) => m.email === email)) fail('MEMBER001');
    if (db.members.some((m) => m.nickname === body.nickname)) fail('MEMBER002');

    const id = nextId('members');
    db.members.push({
      id,
      uuid:
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      email: email as string,
      password: '',
      kakaoId: token.kakaoId,
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
    return ok({ ...mockTokens(id), suspended: false }, 201);
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
