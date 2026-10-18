// 목업 라우터: 경로 패턴 등록과 응답 헬퍼
import type { MemberRecord } from './types';

export interface MockResponse {
  status: number;
  body: unknown;
}

export interface HandlerContext {
  params: URLSearchParams;
  body: unknown;
  pathParams: Record<string, string>;
  /** 토큰으로 확인된 회원 (비로그인 = null) */
  me: MemberRecord | null;
}

export type Handler = (ctx: HandlerContext) => MockResponse;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** 등록 순서대로 매칭한다 (예: /products/me 가 /products/:id 보다 먼저) */
export const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler): void {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:(\w+)/g, (_match, key: string) => {
        keys.push(key);
        return '([^/]+)';
      }) +
      '$',
  );
  routes.push({ method, pattern, keys, handler });
}

/** 성공 응답 `{ isSuccess, message, data }` */
export const ok = (data: unknown, status = 200, message = '요청이 성공적으로 처리되었습니다.'): MockResponse => ({
  status,
  body: { isSuccess: true, message, data },
});

/** 바디 없는 응답 (201/204) */
export const noContent = (status: number): MockResponse => ({ status, body: null });

/** 요청 바디를 느슨한 객체로 본다 (원본은 검증 없이 필드에 접근) */
export const bodyOf = <T>(ctx: HandlerContext): Partial<T> => (ctx.body ?? {}) as Partial<T>;
