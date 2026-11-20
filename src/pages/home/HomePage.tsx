import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auctionApi, cartApi, recommendApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Icon } from '@/components/Icon'
import { ErrorState } from '@/components/EmptyState'
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard'
import { RecommendSection } from '@/components/RecommendSection'
import { useNow } from '@/lib/clock'
import { formatCountdown } from '@/lib/format'
import { HeroBanner } from './HeroBanner'
import styles from './HomePage.module.css'

/** 마감 임박 섹션 기준 (1시간) */
const ENDING_SOON_MS = 60 * 60 * 1000

/** 홈 / : 배너 · 결제 대기 배너 · 추천(로그인) · 인기 · 마감 임박 · 신규 */
export function HomePage() {
  const now = useNow()
  const { isLoggedIn } = useAuth()

  // 마감 임박: 마감 순 20개를 받아 1시간 안에 끝나는 것만 (백엔드에 시간 조건이 생기면 옮긴다)
  const endingQuery = useQuery({
    queryKey: ['auctions', 'home', 'ending'],
    queryFn: () => auctionApi.list({ status: 'IN_PROGRESS', sort: 'ENDING_SOON', size: 20 }),
    refetchInterval: 10_000,
  })
  const newestQuery = useQuery({
    queryKey: ['auctions', 'home', 'newest'],
    queryFn: () => auctionApi.list({ status: 'IN_PROGRESS', sort: 'NEWEST', size: 6 }),
  })
  const hotQuery = useQuery({
    queryKey: ['auctions', 'home', 'hot'],
    queryFn: () => auctionApi.list({ status: 'IN_PROGRESS', sort: 'MOST_BIDS', size: 1 }),
    refetchInterval: 15_000,
  })
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: cartApi.list, enabled: isLoggedIn })
  const popularQuery = useQuery({ queryKey: ['recommend', 'popular'], queryFn: recommendApi.popular })
  const forMeQuery = useQuery({ queryKey: ['recommend', 'me'], queryFn: recommendApi.me, enabled: isLoggedIn })

  // 입찰 1위는 배너 첫 장에
  const featured = hotQuery.data?.content[0]
  const endingSoon = (endingQuery.data?.content ?? [])
    .filter((item) => item.endAt && Date.parse(item.endAt) - now > 0 && Date.parse(item.endAt) - now <= ENDING_SOON_MS)
    .slice(0, 6)
  const cartItems = cartQuery.data ?? []
  const earliestDueAt = cartItems.length
    ? Math.min(...cartItems.map((item) => Date.parse(item.paymentDueAt)))
    : null

  return (
    <div className={`container ${styles.page}`}>
      <HeroBanner featured={featured} />

      {cartItems.length && earliestDueAt ? (
        <Link to="/cart" className={styles.cartBanner}>
          <Icon name="cart" size={18} />
          <span>
            낙찰받은 상품 <strong className="num">{cartItems.length}개</strong>가 결제를 기다려요 ·{' '}
            <strong className="num">{formatCountdown(earliestDueAt - now)}</strong> 안에 결제하지 않으면
            낙찰이 무효돼요.
          </span>
          <span className={styles.cartBannerGo}>
            결제하기 <Icon name="chevronRight" size={14} />
          </span>
        </Link>
      ) : null}

      {isLoggedIn ? (
        <div className={styles.section}>
          <RecommendSection
            title="추천 경매"
            description="찜하고 입찰한 상품과 비슷한 경매예요."
            items={forMeQuery.data}
            loading={forMeQuery.isLoading}
          />
        </div>
      ) : null}

      <div className={styles.section}>
        <RecommendSection title="인기 경매" items={popularQuery.data} loading={popularQuery.isLoading} />
      </div>

      {endingQuery.isLoading || endingSoon.length ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.liveDot} aria-hidden="true" />
              마감 임박
            </h2>
            <Link to="/auctions?sort=ENDING_SOON" className={styles.more}>
              전체 보기 <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          <p className={styles.sectionDesc}>1시간 안에 끝나는 경매예요.</p>
          <div className="grid-products grid-products--row">
            {endingQuery.isLoading
              ? Array.from({ length: 6 }, (_, index) => <ProductCardSkeleton key={index} />)
              : endingSoon.map((item) => <ProductCard key={item.productId} item={item} />)}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>신규 경매</h2>
          <Link to="/auctions?sort=NEWEST" className={styles.more}>
            전체 보기 <Icon name="chevronRight" size={14} />
          </Link>
        </div>
        {newestQuery.isError ? (
          <ErrorState message={newestQuery.error.message} onRetry={() => newestQuery.refetch()} />
        ) : (
          <div className="grid-products grid-products--row">
            {newestQuery.isLoading
              ? Array.from({ length: 6 }, (_, index) => <ProductCardSkeleton key={index} />)
              : newestQuery.data?.content.map((item) => <ProductCard key={item.productId} item={item} />)}
          </div>
        )}
      </section>
    </div>
  )
}
