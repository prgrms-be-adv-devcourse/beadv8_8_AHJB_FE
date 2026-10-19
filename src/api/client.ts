import type { ApiBody, ApiErrorBody, HttpMethod } from '@/types/common'
import type { LoginResponse } from '@/types/auth'
import { API_BASE_URL, isRealApi, type ApiKey } from './config'
import { tokenStore } from './tokenStore'

/** 백엔드 errorCode / 메시지 / HTTP 상태를 담는 에러 (원본 d0) */
export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** 쿼리 파라미터에 넣을 수 있는 값 */
export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>

/**
 * 쿼리 객체 → URLSearchParams (원본 f0).
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

/** 목업 서버로 보낸다 (원본과 같은 방식: 동적 import) */
async function sendToMock(
  method: HttpMethod,
  path: string,
  params: URLSearchParams,
  body: unknown,
  token: string | null,
): Promise<RawResponse> {
  const { handleMockRequest } = await import('@/mock/server')
  const response = await handleMockRequest({ method, path, params, body, token })
  return { status: response.status, body: response.body as RawResponse['body'] }
}

/** 실제 서버로 보낸다 (의도된 변경 #2) */
async function sendToServer(
  method: HttpMethod,
  path: string,
  params: URLSearchParams,
  body: unknown,
  token: string | null,
): Promise<RawResponse> {
  const queryString = params.toString()
  const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
 * 공통 요청 함수 (원본 La).
 * `apiKey` 가 VITE_REAL_APIS 에 있으면 실제 서버, 아니면 목업 서버로 보낸다.
 * 성공하면 `data` 를, 바디 없는 성공 응답이면 null 을 돌려준다.
 * 실제 서버가 401 을 주면 토큰을 한 번 재발급하고 같은 요청을 다시 보낸다.
 */
export async function request<T>(
  apiKey: ApiKey,
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const params = buildQuery(options.query)
  const real = isRealApi(apiKey)
  const send = real ? sendToServer : sendToMock
  let response = await send(method, path, params, options.body, tokenStore.get())

  // 액세스 토큰 만료(15분) → 재발급 후 한 번만 재시도. auth.* 요청은 재시도하지 않는다.
  if (response.status === 401 && real && !apiKey.startsWith('auth.') && tokenStore.getRefresh()) {
    const refreshed = await refreshSession()
    if (refreshed) response = await send(method, path, params, options.body, tokenStore.get())
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
 * 여러 요청이 동시에 401 을 받아도 재발급은 한 번만 한다 (백엔드 리프레시 토큰은 1회용).
 * 판매자 등록처럼 권한이 바뀐 직후에도 호출해서 새 권한을 토큰에 반영한다.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const refreshToken = tokenStore.getRefresh()
    if (!refreshToken) return false
    try {
      const send = isRealApi('auth.reissue') ? sendToServer : sendToMock
      const response = await send('POST', '/api/v1/auth/reissue', new URLSearchParams(), { refreshToken }, null)
      const result = parseResponse<LoginResponse>(response)
      tokenStore.set(result.accessToken, result.refreshToken)
      tokenStore.setProfile({ nickname: result.nickname, suspended: result.suspended })
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

/** 실패 바디 → ApiError. 401 이면 토큰을 지운다 (원본과 같음) */
function toApiError(body: ApiErrorBody, status: number): ApiError {
  if (status === 401) tokenStore.clear()
  return new ApiError(body.errorCode ?? `HTTP${status}`, body.message ?? DEFAULT_ERROR_MESSAGE, status)
}

/** HTTP 메서드별 단축 함수 (원본 Te). 첫 인자는 registry 키 */
export const http = {
  get: <T>(apiKey: ApiKey, path: string, query?: object) => request<T>(apiKey, 'GET', path, { query }),
  post: <T>(apiKey: ApiKey, path: string, body?: unknown) => request<T>(apiKey, 'POST', path, { body }),
  patch: <T>(apiKey: ApiKey, path: string, body?: unknown) => request<T>(apiKey, 'PATCH', path, { body }),
  put: <T>(apiKey: ApiKey, path: string, body?: unknown) => request<T>(apiKey, 'PUT', path, { body }),
  delete: <T>(apiKey: ApiKey, path: string) => request<T>(apiKey, 'DELETE', path),
}
