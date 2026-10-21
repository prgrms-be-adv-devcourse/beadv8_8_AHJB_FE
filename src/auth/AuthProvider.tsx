import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isRealApi } from '@/api/config'
import { authApi, memberApi } from '@/api/endpoints'
import { tokenStore, type SessionProfile } from '@/api/tokenStore'
import { decodeAccessToken } from '@/lib/jwt'
import type { LoginRequest, LoginResponse } from '@/types/auth'
import type { Me, MemberSummary } from '@/types/member'

export interface AuthContextValue {
  /** 내 정보. 로그인 안 했거나 불러오는 중이면 null */
  me: Me | null
  /** 토큰이 있고 내 정보도 불러왔을 때 true */
  isLoggedIn: boolean
  /** 토큰은 있는데 내 정보를 불러오는 중 */
  isLoading: boolean
  login: (body: LoginRequest) => Promise<LoginResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * 내 정보를 어디서 가져올지.
 * - 로그인이 목업이면: 목업 GET /member/me (원본 방식)
 * - 로그인이 실제면: 토큰(회원 id) + GET /member/me/summary(닉네임·판매자·정지) + 로그인 때 저장한 이메일로 만든다.
 *   실제 GET /member/me 는 회원 정보 화면용 상세(MemberDetail)라 여기서는 쓰지 않는다.
 */
const USE_TOKEN_PROFILE = isRealApi('auth.login')

/** 내 정보 요약 쿼리 키. 재발급으로 토큰이 바뀌어도 같은 회원이면 캐시를 그대로 쓰도록 회원 id 로 잡는다 */
const summaryQueryKey = (memberId: number | null) => ['me', 'summary', memberId]

/** 회원 id + 로그인 이메일 + 내 정보 요약 → Me (partial). 하나라도 없으면 null */
function meFromSummary(
  memberId: number | null,
  profile: SessionProfile | null,
  summary: MemberSummary | undefined,
): Me | null {
  if (memberId === null || !profile || !summary) return null
  return {
    memberId,
    uuid: '',
    email: profile.email,
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

/** 로그인 상태 제공 (원본 h0). QueryClientProvider 안에 둔다 */
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

  const meQuery = useQuery({
    queryKey: ['me', token],
    queryFn: memberApi.me,
    enabled: !!token && !USE_TOKEN_PROFILE,
    staleTime: 60 * 1000,
    retry: false,
  })

  const memberId = useMemo(() => decodeAccessToken(token)?.memberId ?? null, [token])

  const summaryQuery = useQuery({
    queryKey: summaryQueryKey(memberId),
    queryFn: memberApi.summary,
    enabled: USE_TOKEN_PROFILE && memberId !== null,
    staleTime: 60 * 1000,
    retry: false,
  })

  const summaryMe = useMemo(
    () => (USE_TOKEN_PROFILE && token ? meFromSummary(memberId, profile, summaryQuery.data) : null),
    [token, memberId, profile, summaryQuery.data],
  )
  const me = USE_TOKEN_PROFILE ? summaryMe : token ? (meQuery.data ?? null) : null

  const login = useCallback(
    async (body: LoginRequest) => {
      const result = await authApi.login(body)
      tokenStore.set(result.accessToken, result.refreshToken)
      tokenStore.setProfile({ email: body.email })
      let nickname = result.nickname
      let suspended = result.suspended
      if (USE_TOKEN_PROFILE) {
        // 실제 로그인 응답에는 닉네임·정지 여부가 없어서 요약에서 채운다
        const loggedInId = decodeAccessToken(result.accessToken)?.memberId ?? null
        const summary = await queryClient.fetchQuery({ queryKey: summaryQueryKey(loggedInId), queryFn: memberApi.summary })
        nickname = summary.nickname
        suspended = summary.suspended
      } else {
        await queryClient.fetchQuery({ queryKey: ['me', result.accessToken], queryFn: memberApi.me })
      }
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
      return { ...result, nickname, suspended }
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      const refreshToken = tokenStore.getRefresh()
      if (refreshToken) await authApi.logout(refreshToken)
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
      isLoading: !!token && (USE_TOKEN_PROFILE ? summaryQuery.isLoading : meQuery.isLoading),
      login,
      logout,
    }),
    [token, me, summaryQuery.isLoading, meQuery.isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 로그인 상태 읽기 (원본 yn) */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider 안에서만 쓸 수 있어요.')
  return context
}
