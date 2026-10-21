import { apiRegistry, type ApiKey } from './registry'

export type { ApiKey } from './registry'

/** 전환 가능한 모든 API 키 (registry.ts 의 키와 같다) */
export const API_KEYS = Object.keys(apiRegistry) as ApiKey[]

/** 실제 서버 주소. 비어 있으면 같은 출처의 /api 로 보낸다 (Vite proxy / vercel rewrites). */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

function isApiKey(value: string): value is ApiKey {
  return Object.prototype.hasOwnProperty.call(apiRegistry, value)
}

function parseRealApis(raw: string | undefined): ReadonlySet<ApiKey> {
  const keys = new Set<ApiKey>()
  for (const token of (raw ?? '').split(',')) {
    const key = token.trim()
    if (!key) continue
    if (key === '*' || key === 'all') {
      API_KEYS.forEach((k) => keys.add(k))
      continue
    }
    if (isApiKey(key)) keys.add(key)
    else console.warn(`[api] VITE_REAL_APIS 에 모르는 키가 있어요: ${key}`)
  }
  return keys
}

/** VITE_REAL_APIS 로 지정된, 실제 서버로 보낼 API 키 집합 */
export const REAL_APIS: ReadonlySet<ApiKey> = parseRealApis(import.meta.env.VITE_REAL_APIS)

/**
 * 로그인을 실제로 켜면 같이 실제로 가야 하는 API.
 * 실제 토큰을 목업 재발급·로그아웃·내 정보 요약으로 보내면 안 되기 때문에 auth.login 을 따라간다.
 */
const FOLLOWS_LOGIN: ReadonlySet<ApiKey> = new Set<ApiKey>(['auth.reissue', 'auth.logout', 'member.summary'])

/** 이 API 를 실제 서버로 보내는지 (false 면 브라우저 안 목업 서버) */
export function isRealApi(key: ApiKey): boolean {
  if (REAL_APIS.has(key)) return true
  return FOLLOWS_LOGIN.has(key) && REAL_APIS.has('auth.login')
}

/** 실제 서버로 보내는 API 키 목록 (개발자 확인용) */
export function getRealApiKeys(): ApiKey[] {
  return API_KEYS.filter((key) => isRealApi(key))
}

/** 전체 API 의 목업/실제 전환 현황 (개발자 확인용) */
export function getApiModes(): Array<{ key: ApiKey; mode: 'real' | 'mock' }> {
  return API_KEYS.map((key) => ({ key, mode: isRealApi(key) ? 'real' : 'mock' }))
}

if (import.meta.env.DEV && REAL_APIS.size > 0) {
  console.info('[api] 실제 서버로 보내는 API:', getRealApiKeys().join(', '))
}
