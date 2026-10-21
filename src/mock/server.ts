// 브라우저 내 목업 서버 진입점 (원본 handleMockRequest)
import { db } from './db';
import { ERROR_TABLE, MockError } from './errors';
import { registerAllRoutes } from './handlers';
import { routes, type MockResponse } from './router';
import { runTick } from './tick';
import type { MemberRecord } from './types';
import { sleep } from './utils';

registerAllRoutes();

export interface MockRequest {
  method: string;
  path: string;
  params: URLSearchParams;
  body?: unknown;
  token: string | null;
}

/** 비로그인으로도 호출 가능한 GET 경로 (/api/v1/auth/* 는 메서드와 무관하게 공개) */
const PUBLIC_GET_PATTERNS = [
  /^\/api\/v1\/auctions$/,
  /^\/api\/v1\/auctions\/\d+$/,
  /^\/api\/v1\/auctions\/\d+\/bids$/,
  /^\/api\/v1\/products\/upcoming$/,
  /^\/api\/v1\/products\/\d+$/,
  /^\/api\/v1\/products\/\d+\/qnas$/,
];

/** 실제 백엔드 토큰을 받았을 때 매핑할 기본 목업 회원 */
const DEFAULT_MEMBER_EMAIL = 'demo@jjinmak.kr';

const unauthorized = (): MockResponse => ({
  status: 401,
  body: { isSuccess: false, errorCode: 'COMMON002', message: ERROR_TABLE.COMMON002[1] },
});

/** JWT payload 디코드 (서명 검증 없음). 실패 시 null */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * 토큰 → 목업 회원.
 * - `mock.<id>.<ts>` 토큰: 원본과 동일하게 id 로 회원을 찾는다 (없으면 null → 401).
 * - 그 외 토큰(실제 백엔드 로그인 JWT) [의도된 변경 #3]: 원본은 401 이었지만, 실제 인증 + 나머지 API 목업
 *   혼용을 위해 목업 회원으로 매핑한다. JWT payload 의 email/sub/nickname 이 시드 회원의 email·nickname 과
 *   맞으면 그 회원, 아니면 기본 데모 회원(demo@jjinmak.kr).
 */
function resolveMember(token: string | null): MemberRecord | null {
  if (!token) return null;
  if (token.startsWith('mock.')) {
    const memberId = Number(token.split('.')[1]);
    return memberId ? (db.members.find((m) => m.id === memberId) ?? null) : null;
  }
  const payload = decodeJwtPayload(token);
  if (payload) {
    const candidates = ['email', 'sub', 'nickname']
      .map((key) => payload[key])
      .filter((value): value is string => typeof value === 'string' && value !== '');
    for (const value of candidates) {
      const member = db.members.find((m) => m.email === value || m.nickname === value);
      if (member) return member;
    }
  }
  return db.members.find((m) => m.email === DEFAULT_MEMBER_EMAIL) ?? db.members.find((m) => m.id === 1) ?? null;
}

export async function handleMockRequest(req: MockRequest): Promise<{ status: number; body: unknown }> {
  // 네트워크 지연 흉내
  await sleep(90 + Math.random() * 180);
  try {
    runTick();
  } catch (error) {
    console.error('[mock tick]', error);
  }

  const me = resolveMember(req.token);
  if (req.token && !me) return unauthorized();
  const isPublic =
    req.path.startsWith('/api/v1/auth/') ||
    (req.method === 'GET' && PUBLIC_GET_PATTERNS.some((pattern) => pattern.test(req.path)));
  if (!me && !isPublic) return unauthorized();

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = r.pattern.exec(req.path);
    if (!match) continue;
    const pathParams = Object.fromEntries(r.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    try {
      return r.handler({ params: req.params, body: req.body, pathParams, me });
    } catch (error) {
      if (error instanceof MockError)
        return {
          status: error.status,
          body: { isSuccess: false, errorCode: error.code, message: error.message },
        };
      console.error(error);
      return {
        status: 500,
        body: { isSuccess: false, errorCode: 'COMMON004', message: '서버 내부 오류' },
      };
    }
  }

  return {
    status: 404,
    body: {
      isSuccess: false,
      errorCode: 'COMMON001',
      message: `${req.method} ${req.path} 는 없는 API예요.`,
    },
  };
}
