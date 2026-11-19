import { isRealApi } from '@/api/config'

/**
 * 카카오 로그인 (인가 코드 방식).
 *
 * 1. startKakaoLogin(): state 를 만들어 sessionStorage 에 두고 카카오 인가 화면으로 보낸다.
 * 2. 카카오 → /oauth/kakao/callback?code&state (KakaoCallbackPage)
 *    consumeKakaoState() 로 state 를 확인한 뒤 code 를 백엔드(POST /api/v1/auth/oauth/kakao)로 보낸다.
 * 3. 처음 로그인이면 받은 가입 토큰을 setPendingKakaoSignup() 으로 메모리에만 두고 /signup/kakao 로 보낸다.
 *
 * 목업일 때(auth.kakaoLogin 이 VITE_REAL_APIS 에 없을 때)는 카카오에 가지 않고
 * 바로 콜백으로 가짜 인가 코드를 넘긴다 (mock/handlers/auth.ts).
 */

/** 카카오 콘솔과 백엔드 설정에 등록된 값과 글자 하나까지 같아야 한다 */
export const KAKAO_CALLBACK_PATH = '/oauth/kakao/callback'

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize'
const STATE_KEY = 'jjinmak.kakaoOAuth'
/** 인가 화면에 머무를 수 있는 시간. 지나면 state 를 버린다 */
const STATE_TTL_MS = 10 * 60 * 1000

/**
 * 목업 카카오 계정 회원번호. 같은 브라우저에서는 늘 같은 카카오 계정으로 본다 (처음엔 가입, 다음부턴 로그인).
 * 다른 경우를 보려면 개발자 도구에서 이 값을 바꾼다 (mock/handlers/auth.ts mockKakaoEmail):
 *   localStorage.setItem('jjinmak.mockKakaoId', 'noemail1') → 이메일 없음 (직접 입력)
 *   localStorage.setItem('jjinmak.mockKakaoId', 'dup1')     → 이미 이메일 회원 (AUTH113)
 */
const MOCK_KAKAO_ID_KEY = 'jjinmak.mockKakaoId'

interface SavedState {
  state: string
  /** 로그인 후 돌아갈 경로 */
  redirect: string
  createdAt: number
}

export function kakaoRedirectUri(): string {
  return `${window.location.origin}${KAKAO_CALLBACK_PATH}`
}

function randomToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 외부 사이트로 튕기는 오픈 리다이렉트를 막는다. 앱 안 경로(/로 시작, //는 제외)만 허용 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function mockKakaoId(): string {
  try {
    const saved = window.localStorage.getItem(MOCK_KAKAO_ID_KEY)
    if (saved) return saved
    const created = String(Date.now())
    window.localStorage.setItem(MOCK_KAKAO_ID_KEY, created)
    return created
  } catch {
    return 'demo'
  }
}

/**
 * 카카오 로그인을 시작한다 (현재 페이지를 떠난다).
 * sessionStorage 를 쓸 수 없으면 state 를 검증할 수 없으니 시작하지 않고 에러를 던진다.
 */
export function startKakaoLogin(redirect: string = '/'): void {
  const state = randomToken()
  const saved: SavedState = { state, redirect: safeRedirect(redirect), createdAt: Date.now() }
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(saved))
  } catch {
    throw new Error('브라우저 저장소를 쓸 수 없어서 카카오 로그인을 시작하지 못했어요. 시크릿 모드라면 일반 창에서 시도해 주세요.')
  }

  if (!isRealApi('auth.kakaoLogin')) {
    const code = `mock-kakao.${mockKakaoId()}.${randomToken()}`
    window.location.assign(`${KAKAO_CALLBACK_PATH}?code=${code}&state=${state}`)
    return
  }

  const clientId = import.meta.env.VITE_KAKAO_REST_API_KEY
  if (!clientId) {
    window.sessionStorage.removeItem(STATE_KEY)
    throw new Error('VITE_KAKAO_REST_API_KEY 가 설정되지 않았어요.')
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: kakaoRedirectUri(),
    response_type: 'code',
    state,
  })
  window.location.assign(`${KAKAO_AUTHORIZE_URL}?${params.toString()}`)
}

/**
 * 콜백에서 받은 state 를 저장해 둔 값과 비교하고 지운다 (한 번만 쓸 수 있다).
 * 맞으면 로그인 후 돌아갈 경로를, 다르거나 없거나 만료면 null 을 준다.
 */
export function consumeKakaoState(state: string | null): { redirect: string } | null {
  let saved: SavedState | null = null
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY)
    window.sessionStorage.removeItem(STATE_KEY)
    saved = raw ? (JSON.parse(raw) as SavedState) : null
  } catch {
    return null
  }
  if (!saved || !state || saved.state !== state) return null
  if (Date.now() - saved.createdAt > STATE_TTL_MS) return null
  return { redirect: safeRedirect(saved.redirect) }
}

/**
 * 카카오 가입 대기 정보. 가입 토큰은 메모리에만 둔다 (새로고침하면 사라지고, 카카오 로그인부터 다시 한다).
 * history.state / sessionStorage 에 두면 새로고침·뒤로가기 후에도 남기 때문에 쓰지 않는다.
 */
export interface PendingKakaoSignup {
  signupToken: string
  /** 카카오 인증 이메일. 있으면 가입 화면에서 이메일 칸을 채우고 잠근다 */
  email: string | null
  redirect: string
}

let pendingSignup: PendingKakaoSignup | null = null

export function setPendingKakaoSignup(value: PendingKakaoSignup): void {
  pendingSignup = value
}

export function getPendingKakaoSignup(): PendingKakaoSignup | null {
  return pendingSignup
}

export function clearPendingKakaoSignup(): void {
  pendingSignup = null
}
