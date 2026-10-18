import type { MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { wishApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import type { WishToggleResponse } from '@/types/product'
import { Icon } from './Icon'
import { useToast } from './Toast'
import styles from './WishButton.module.css'

/** 내가 찜한 상품 id 집합 (최근 50개 기준) (원본 AA). queryKey ['wishes','ids'] */
export function useWishedProductIds(): Set<number> {
  const { isLoggedIn } = useAuth()
  const query = useQuery({
    queryKey: ['wishes', 'ids'],
    queryFn: () => wishApi.list({ size: 50 }),
    enabled: isLoggedIn,
    staleTime: 60000,
  })
  return new Set((query.data?.wishes ?? []).map((wish) => wish.productId))
}

/**
 * 찜 토글 mutation (원본 Aj). wished=true 면 해제, false 면 추가.
 * 성공하면 ['wishes'] 무효화 + ['product', productId] 캐시의 wished/wishCount 갱신.
 */
export function useToggleWish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, wished }: { productId: number; wished: boolean }) =>
      wished ? wishApi.remove(productId) : wishApi.add(productId),
    onSuccess: (result: WishToggleResponse) => {
      queryClient.invalidateQueries({ queryKey: ['wishes'] })
      queryClient.setQueryData(['product', result.productId], (data: unknown) =>
        data && typeof data === 'object' ? { ...data, wished: result.wished, wishCount: result.wishCount } : data,
      )
    },
  })
}

interface WishButtonProps {
  productId: number
  /** 카드 위 작은 하트 버튼 */
  compact?: boolean
  /** 하트 옆 숫자 (compact 가 아닐 때) */
  count?: number
  /** 알고 있으면 넘긴다. 없으면 useWishedProductIds 로 판단 */
  wished?: boolean
  disabled?: boolean
}

/** 찜 버튼 (원본 Dd). 로그인 안 했으면 로그인 화면으로 */
export function WishButton({ productId, compact, count, wished, disabled }: WishButtonProps) {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const wishedIds = useWishedProductIds()
  const toggleWish = useToggleWish()
  const isWished = wished ?? wishedIds.has(productId)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    toggleWish.mutate(
      { productId, wished: isWished },
      {
        onSuccess: (result) =>
          toast(
            result.wished ? '찜 목록에 담았어요.' : '찜을 해제했어요.',
            result.wished ? { action: { label: '찜 목록', to: '/me/wishes' } } : undefined,
          ),
        onError: (error) => toast(error.message, { tone: 'error' }),
      },
    )
  }

  const label = isWished ? '찜 해제' : '찜하기'

  return compact ? (
    <button
      type="button"
      className={`${styles.compact} ${isWished ? styles.on : ''}`}
      onClick={handleClick}
      aria-pressed={isWished}
      aria-label={label}
      disabled={disabled || toggleWish.isPending}
    >
      <Icon name="heart" size={16} filled={isWished} />
    </button>
  ) : (
    <button
      type="button"
      className={`${styles.full} ${isWished ? styles.on : ''}`}
      onClick={handleClick}
      aria-pressed={isWished}
      aria-label={label}
      disabled={disabled || toggleWish.isPending}
    >
      <Icon name="heart" size={18} filled={isWished} />
      {count !== undefined ? <span className="num">{count}</span> : null}
    </button>
  )
}
