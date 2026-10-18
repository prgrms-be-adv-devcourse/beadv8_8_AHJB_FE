import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { useAuth } from './AuthProvider'

/** 로그인해야 볼 수 있는 화면. 아니면 /login?redirect=현재경로 (원본 $p) */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <Spinner block />
  if (!isLoggedIn) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <>{children}</>
}
