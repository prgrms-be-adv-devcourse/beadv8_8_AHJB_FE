import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { RequireAuth } from './RequireAuth'

/**
 * 판매자만 볼 수 있는 화면 (원본 Jm).
 * 로그인했는데 판매자가 아니면 /seller/register?redirect=현재경로, 그 밖에는 RequireAuth 와 같다.
 */
export function RequireSeller({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const location = useLocation()
  if (me && !me.isSeller) {
    return <Navigate to={`/seller/register?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <RequireAuth>{children}</RequireAuth>
}
