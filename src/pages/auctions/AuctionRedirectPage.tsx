import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { auctionApi } from '@/api/endpoints'
import { ErrorState } from '@/components/EmptyState'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'

/** /auctions/:auctionId → 상품 상세. 알림·푸시 링크는 경매 id 로 온다 */
export function AuctionRedirectPage() {
  const auctionId = Number(useParams().auctionId)
  const query = useQuery({ queryKey: ['auction', auctionId], queryFn: () => auctionApi.detail(auctionId) })
  if (query.isLoading) return <Spinner block />
  if (query.isError || !query.data) {
    return <ErrorState message={query.error?.message ?? '경매를 찾을 수 없어요.'} onRetry={() => query.refetch()} />
  }
  return <Navigate to={productPath(query.data.auction.productId)} replace />
}
