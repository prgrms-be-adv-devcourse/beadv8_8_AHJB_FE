import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, memberApi } from '@/api/endpoints'
import { tokenStore } from '@/api/tokenStore'
import type { LoginRequest, LoginResponse } from '@/types/auth'
import type { Me } from '@/types/member'

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

/** 로그인 상태 제공 (원본 h0). QueryClientProvider 안에 둔다 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => tokenStore.get())

  useEffect(() => tokenStore.subscribe(() => setToken(tokenStore.get())), [])

  const meQuery = useQuery({
    queryKey: ['me', token],
    queryFn: memberApi.me,
    enabled: !!token,
    staleTime: 60 * 1000,
    retry: false,
  })

  const login = useCallback(
    async (body: LoginRequest) => {
      const result = await authApi.login(body)
      tokenStore.set(result.accessToken, result.refreshToken)
      await queryClient.fetchQuery({ queryKey: ['me', result.accessToken], queryFn: memberApi.me })
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
      return result
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
      me: token ? (meQuery.data ?? null) : null,
      isLoggedIn: !!token && !!meQuery.data,
      isLoading: !!token && meQuery.isLoading,
      login,
      logout,
    }),
    [token, meQuery.data, meQuery.isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 로그인 상태 읽기 (원본 yn) */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider 안에서만 쓸 수 있어요.')
  return context
}
