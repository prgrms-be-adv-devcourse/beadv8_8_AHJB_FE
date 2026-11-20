import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, memberApi } from '@/api/endpoints'
import { tokenStore, type SessionProfile } from '@/api/tokenStore'
import { decodeAccessToken } from '@/lib/jwt'
import type { KakaoSignupRequest, LoginRequest, LoginResponse } from '@/types/auth'
import type { Me, MemberSummary } from '@/types/member'

export interface AuthContextValue {
  /** 내 정보. 로그인 안 했거나 불러오는 중이면 null */
  me: Me | null
  /** 토큰이 있고 내 정보도 불러왔을 때 true */
  isLoggedIn: boolean
  /** 토큰은 있는데 내 정보를 불러오는 중 */
  isLoading: boolean
  login: (body: LoginRequest) => Promise<LoginResult>
  /** 카카오 인가 코드로 로그인. 가입 안 된 카카오 계정이면 가입 토큰을 돌려준다 (세션은 만들지 않는다) */
  kakaoLogin: (code: string) => Promise<KakaoLoginOutcome>
  /** 카카오 가입 + 로그인 */
  kakaoSignup: (body: KakaoSignupRequest) => Promise<LoginResult>
  logout: () => Promise<void>
}

/** 로그인 결과. 닉네임·정지 여부는 로그인 직후 불러온 내 정보 기준이다 */
export type LoginResult = LoginResponse & { nickname: string }

export type KakaoLoginOutcome =
  | { status: 'LOGIN'; result: LoginResult }
  | { status: 'SIGNUP_REQUIRED'; signupToken: string; email: string | null; nickname: string | null }

/** 세션을 만드는 응답의 공통 부분 (이메일 로그인·카카오 로그인·카카오 가입) */
type SessionTokens = Pick<LoginResponse, 'accessToken' | 'refreshToken' | 'suspended'>

const AuthContext = createContext<AuthContextValue | null>(null)

/*
 * 내 정보 = 토큰(회원 id) + GET /member/me/summary(닉네임·판매자·정지) + 로그인 때 저장한 이메일.
 * GET /member/me 는 회원 정보 화면용 상세(MemberDetail)라 여기서는 쓰지 않는다.
 */

/** 내 정보 요약 쿼리 키. 재발급으로 토큰이 바뀌어도 같은 회원이면 캐시를 그대로 쓰도록 회원 id 로 잡는다 */
const summaryQueryKey = (memberId: number | null) => ['me', 'summary', memberId]

/** 회원 id + 로그인 이메일 + 내 정보 요약 → Me (partial). 하나라도 없으면 null */
function meFromSummary(
  memberId: number | null,
  profile: SessionProfile | null,
  summary: MemberSummary | undefined,
): Me | null {
  if (memberId === null || !summary) return null
  return {
    memberId,
    uuid: '',
    // 카카오 로그인에서 이메일을 못 가져온 경우 빈 값 (화면에 이메일만 비어 보인다)
    email: profile?.email ?? '',
    nickname: summary.nickname,
    username: '',
    phone: '',
    birthDate: null,
    isSeller: summary.seller,
    accountStatus: summary.suspended ? 'SUSPENDED' : 'ACTIVE',
    warningCount: 0,
    createdAt: '',
    partial: true,
  }
}

/** 로그인 상태 제공. QueryClientProvider 안에 둔다 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => tokenStore.get())
  const [profile, setProfile] = useState(() => tokenStore.getProfile())

  useEffect(
    () =>
      tokenStore.subscribe(() => {
        setToken(tokenStore.get())
        setProfile(tokenStore.getProfile())
      }),
    [],
  )

  const memberId = useMemo(() => decodeAccessToken(token)?.memberId ?? null, [token])

  const summaryQuery = useQuery({
    queryKey: summaryQueryKey(memberId),
    queryFn: memberApi.summary,
    enabled: memberId !== null,
    staleTime: 60 * 1000,
    retry: false,
  })

  const me = useMemo(
    () => (token ? meFromSummary(memberId, profile, summaryQuery.data) : null),
    [token, memberId, profile, summaryQuery.data],
  )

  /** 받은 토큰으로 세션을 만들고 닉네임·정지 여부를 채운다 */
  const establishSession = useCallback(
    async (result: SessionTokens, email: string | null): Promise<LoginResult> => {
      tokenStore.set(result.accessToken, result.refreshToken)
      tokenStore.setProfile({ email })
      // 로그인 응답에는 닉네임이 없어서 닉네임·정지 여부는 방금 불러온 내 정보에서 채운다
      const loggedInId = decodeAccessToken(result.accessToken)?.memberId ?? null
      const summary = await queryClient.fetchQuery({
        queryKey: summaryQueryKey(loggedInId),
        queryFn: memberApi.summary,
      })
      const { nickname, suspended } = summary
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
      return { accessToken: result.accessToken, refreshToken: result.refreshToken, nickname, suspended }
    },
    [queryClient],
  )

  const login = useCallback(
    async (body: LoginRequest) => establishSession(await authApi.login(body), body.email),
    [establishSession],
  )

  const kakaoLogin = useCallback(
    async (code: string): Promise<KakaoLoginOutcome> => {
      const response = await authApi.kakaoLogin({ code })
      if (response.status === 'SIGNUP_REQUIRED')
        return {
          status: 'SIGNUP_REQUIRED',
          signupToken: response.signupToken,
          email: response.email ?? null,
          nickname: response.nickname ?? null,
        }
      const result = await establishSession(response, null)
      // 카카오 로그인 응답에는 이메일이 없어서 내 정보 상세에서 가져온다. 실패해도 로그인은 유지한다
      try {
        const detail = await queryClient.fetchQuery({ queryKey: ['me', 'detail'], queryFn: memberApi.detail })
        tokenStore.setProfile({ email: detail.email })
      } catch {
        /* 이메일 없이 진행 (결제창 이메일 자동 입력·마이페이지 이메일 표시만 빠진다) */
      }
      return { status: 'LOGIN', result }
    },
    [establishSession, queryClient],
  )

  const kakaoSignup = useCallback(
    async (body: KakaoSignupRequest) => establishSession(await authApi.kakaoSignup(body), body.email ?? null),
    [establishSession],
  )

  const logout = useCallback(async () => {
    try {
      if (tokenStore.get()) await authApi.logout(tokenStore.getRefresh() ?? undefined)
    } catch {
      /* 로그아웃 API 실패는 무시하고 토큰을 지운다 */
    } finally {
      tokenStore.clear()
      // 공개 데이터(경매 목록·상품)만 남기고 지운다
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auctions' && query.queryKey[0] !== 'product',
      })
      await queryClient.invalidateQueries()
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      isLoggedIn: !!token && !!me,
      isLoading: !!token && summaryQuery.isLoading,
      login,
      kakaoLogin,
      kakaoSignup,
      logout,
    }),
    [token, me, summaryQuery.isLoading, login, kakaoLogin, kakaoSignup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 로그인 상태 읽기 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider 안에서만 쓸 수 있어요.')
  return context
}
