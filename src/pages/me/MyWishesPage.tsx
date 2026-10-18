import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { wishApi } from '@/api/endpoints'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import cardStyles from '@/components/ProductCard.module.css'
import { Spinner } from '@/components/Spinner'
import { WishButton } from '@/components/WishButton'
import { formatRelativeTime, formatWon } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/labels'
import styles from './MyPage.module.css'

/** /me/wishes 찜 (원본 iO). 카드는 ProductCard 스타일을 빌려 직접 그린다 */
export function MyWishesPage() {
  const wishesQuery = useQuery({
    queryKey: ['wishes', 'page'],
    queryFn: () => wishApi.list({ size: 50 }),
  })

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>찜</h1>
      </div>
      <DevApiNote ids={['wish.list', 'wish.remove']} />
      {wishesQuery.isLoading ? (
        <Spinner block />
      ) : wishesQuery.isError ? (
        <ErrorState message={wishesQuery.error.message} onRetry={() => wishesQuery.refetch()} />
      ) : wishesQuery.data?.wishes.length ? (
        <div className="grid-products grid-products--narrow">
          {wishesQuery.data.wishes.map((wish) => (
            <article key={wish.productId} className={cardStyles.card}>
              <Link to={productPath(wish.productId)} className={cardStyles.link}>
                <div className={cardStyles.media}>
                  <Img src={wish.thumbnailUrl ?? null} alt={wish.productName} className={cardStyles.image} />
                </div>
                <div className={cardStyles.body}>
                  <h3 className={cardStyles.title}>{wish.productName}</h3>
                  <p className={cardStyles.meta}>
                    {CATEGORY_LABELS[wish.category]} · {formatRelativeTime(wish.wishedAt)} 찜
                  </p>
                  <div className={cardStyles.priceRow}>
                    <span className={cardStyles.priceLabel}>시작가</span>
                    <span className={`${cardStyles.price} num`}>{formatWon(wish.startPrice)}</span>
                    <span className={`${cardStyles.bids} num`}>찜 {wish.wishCount}</span>
                  </div>
                </div>
              </Link>
              <div className={cardStyles.fav}>
                <WishButton productId={wish.productId} compact wished />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="heart"
          title="찜한 경매가 없어요"
          description="하트를 누르면 여기에 모여요."
          action={
            <LinkButton to="/auctions" variant="outline" size="sm">
              경매 둘러보기
            </LinkButton>
          }
        />
      )}
    </>
  )
}
