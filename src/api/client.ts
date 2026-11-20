import type { ApiBody, ApiErrorBody, HttpMethod } from '@/types/common'
import type { LoginResponse } from '@/types/auth'
import { tokenStore } from './tokenStore'
import { toUserMessage } from './errorMessages'

/** 결제·지갑 API 가 실패 응답에 더해 주는 정보 (백엔드 PaymentErrorResponse). 다른 도메인 응답에는 없다 */
export interface PaymentErrorInfo {
  /** true 면 "다시 시도" 로 해결 가능, false 면 재시도해도 같은 결과 */
  retryable?: boolean
  pgCode?: string | null
  pgMessage?: string | null
}

/** 백엔드 errorCode / 메시지 / HTTP 상태를 담는 에러 */
export class ApiError extends Error {
  code: string
  status: number
  /** 결제·지갑 API 전용. 다른 API 에서는 항상 undefined */
  retryable?: boolean
  pgCode?: string | null
  pgMessage?: string | null

  constructor(code: string, message: string, status: number, payment?: PaymentErrorInfo) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    if (payment) {
      this.retryable = payment.retryable
      this.pgCode = payment.pgCode
      this.pgMessage = payment.pgMessage
    }
  }
}

/** 쿼리 파라미터에 넣을 수 있는 값 */
export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>

/**
 * 쿼리 객체 → URLSearchParams.
 * null·undefined·''·false 는 빼고, 배열은 쉼표로 이어 붙인다(빈 배열은 뺀다).
 */
export function buildQuery(query?: object): URLSearchParams {
  const params = new URLSearchParams()
  if (!query) return params
  for (const [key, value] of Object.entries(query) as Array<[string, QueryValue]>) {
    if (value == null || value === '' || value === false) continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  return params
}

interface RequestOptions {
  query?: object
  body?: unknown
}

interface RawResponse {
  status: number
  /** 바디가 없으면 null */
  body: ApiBody | Record<string, unknown> | null
}

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했어요.'

/** 서버로 보낸다 */
async function sendToServer(
  method: HttpMethod,
  path: string,
  params: URLSearchParams,
  body: unknown,
  token: string | null,
): Promise<RawResponse> {
  const queryString = params.toString()
  // 항상 같은 출처의 /api 로 보낸다. 로컬은 Vite proxy, 배포는 vercel.json rewrites 가 게이트웨이로 전달한다.
  // API 도메인을 직접 호출하면 리프레시 쿠키(SameSite=Strict)가 붙지 않는다.
  const url = `${path}${queryString ? `?${queryString}` : ''}`
  const isFormData = body instanceof FormData
  const headers: Record<string, string> = { Accept: 'application/json' }
  // FormData 는 브라우저가 boundary 를 포함한 multipart Content-Type 을 직접 붙인다.
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('NETWORK', '서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 0)
  }

  // 201·204 등 바디가 없는 응답은 null 로 처리한다.
  if (response.status === 204 || response.status === 205) {
    return { status: response.status, body: null }
  }
  const text = await response.text()
  if (!text.trim()) return { status: response.status, body: null }
  try {
    return { status: response.status, body: JSON.parse(text) as RawResponse['body'] }
  } catch {
    // JSON 이 아닌 응답(HTML 에러 페이지 등)은 바디 없음으로 본다.
    return { status: response.status, body: null }
  }
}

function isEnvelope(body: object): body is ApiBody {
  return typeof (body as { isSuccess?: unknown }).isSuccess === 'boolean'
}

/**
 * 공통 요청 함수.
 * 성공하면 `data` 를, 바디 없는 성공 응답이면 null 을 돌려준다.
 * 401 이면 토큰을 한 번 재발급하고 같은 요청을 다시 보낸다.
 */
export async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const params = buildQuery(options.query)
  let response = await sendToServer(method, path, params, options.body, tokenStore.get())

  // 액세스 토큰 만료(15분) → 재발급 후 한 번만 재시도. 인증 API(/api/v1/auth/**)는 재시도하지 않는다.
  if (response.status === 401 && !path.startsWith('/api/v1/auth/') && tokenStore.get()) {
    const refreshed = await refreshSession()
    if (refreshed) response = await sendToServer(method, path, params, options.body, tokenStore.get())
  }

  return parseResponse<T>(response)
}

function parseResponse<T>(response: RawResponse): T {
  const { status, body } = response

  if (body === null) {
    if (status < 400) return null as T
    throw toApiError({ isSuccess: false, errorCode: `HTTP${status}`, message: DEFAULT_ERROR_MESSAGE }, status)
  }

  if (!isEnvelope(body)) {
    // 공통 응답 형식이 아닌 바디 (예: Spring 기본 에러). 성공이면 그대로 돌려준다.
    if (status < 400) return body as T
    const message = typeof body.message === 'string' ? body.message : DEFAULT_ERROR_MESSAGE
    throw toApiError({ isSuccess: false, errorCode: `HTTP${status}`, message }, status)
  }

  if (!body.isSuccess) throw toApiError(body, status)
  return body.data as T
}

let refreshing: Promise<boolean> | null = null

/**
 * 리프레시 토큰으로 새 토큰을 받는다 (POST /api/v1/auth/reissue).
 * 서버가 HttpOnly 쿠키의 리프레시 토큰을 읽으므로 바디 없이 보낸다.
 * 여러 요청이 동시에 401 을 받아도 재발급은 한 번만 한다 (백엔드 리프레시 토큰은 1회용).
 * 판매자 등록처럼 권한이 바뀐 직후에도 호출해서 새 권한을 토큰에 반영한다.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const response = await sendToServer('POST', '/api/v1/auth/reissue', new URLSearchParams(), undefined, null)
      const result = parseResponse<LoginResponse>(response)
      tokenStore.set(result.accessToken, result.refreshToken)
      return true
    } catch {
      tokenStore.clear()
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** 실패 바디 → ApiError. 401 이면 토큰을 지운다 */
function toApiError(body: ApiErrorBody, status: number): ApiError {
  if (status === 401) tokenStore.clear()
  const payment: PaymentErrorInfo | undefined =
    typeof body.retryable === 'boolean'
      ? { retryable: body.retryable, pgCode: body.pgCode ?? null, pgMessage: body.pgMessage ?? null }
      : undefined
  const code = body.errorCode ?? `HTTP${status}`
  return new ApiError(code, toUserMessage(code, status, body.message ?? DEFAULT_ERROR_MESSAGE), status, payment)
}

/** HTTP 메서드별 단축 함수 */
export const http = {
  get: <T>(path: string, query?: object) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
