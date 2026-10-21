import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auctionApi, cartApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { LinkButton } from '@/components/Button';
import { DevApiNote } from '@/components/DevApiNote';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { useNow } from '@/lib/clock';
import { formatCountdown } from '@/lib/format';
import {
  CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
} from '@/lib/labels';
import { FeaturedAuction } from './FeaturedAuction';
import { HeroFallback } from './HeroFallback';
import { CATEGORY_ART, TRADE_STEPS } from './homeContent';
import styles from './HomePage.module.css';

/** 홈 / (원본 kS) */
export function HomePage() {
  const now = useNow();
  const { isLoggedIn } = useAuth();

  const endingQuery = useQuery({
    queryKey: ['auctions', 'home', 'ending'],
    queryFn: () =>
      auctionApi.list({ status: 'IN_PROGRESS', sort: 'ENDING_SOON', size: 5 }),
    refetchInterval: 10_000,
  });
  const hotQuery = useQuery({
    queryKey: ['auctions', 'home', 'hot'],
    queryFn: () =>
      auctionApi.list({ status: 'IN_PROGRESS', sort: 'MOST_BIDS', size: 10 }),
    refetchInterval: 15_000,
  });
  const soonQuery = useQuery({
    queryKey: ['auctions', 'home', 'soon'],
    // 곧 시작은 경매 생성 전이라 상품 API (시작 임박순)
    queryFn: () => auctionApi.listByTab({ status: 'SCHEDULED', size: 5 }),
  });
  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.list,
    enabled: isLoggedIn,
  });

  // 입찰 1위는 히어로에, 2~6위는 '입찰이 몰리는 경매' 섹션에
  const featured = hotQuery.data?.content[0];
  const hotItems = hotQuery.data?.content.slice(1, 6) ?? [];
  const cartItems = cartQuery.data ?? [];
  const earliestDueAt = cartItems.length
    ? Math.min(...cartItems.map((item) => Date.parse(item.paymentDueAt)))
    : null;

  return (
    <div className={`container ${styles.page}`}>
      <section className={styles.heroWrap}>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>고전 게임기 · 게임팩 · 한정판 경매</p>
            <h1 className={styles.heroTitle}>진짜 마지막으로 산다, 찐막.</h1>
            <p className={styles.heroDesc}>
              시세가 애매한 물건일수록 입찰로 값을 정해요. 미개봉 한정판부터
              서랍 속 게임보이까지.
            </p>
            <div className={styles.heroActions}>
              <LinkButton to="/auctions" variant="highlight" size="lg">
                진행 중 경매 보기
              </LinkButton>
              <LinkButton
                to="/sell"
                variant="outline"
                size="lg"
                className={styles.heroGhost}
              >
                경매 올리기
              </LinkButton>
            </div>
          </div>
          {hotQuery.isLoading ? (
            <div className={styles.featuredSkeleton} />
          ) : featured ? (
            <FeaturedAuction item={featured} now={now} />
          ) : (
            // 진행 중 경매 0건이거나 목록 조회 실패
            <HeroFallback />
          )}
        </div>
      </section>

      {cartItems.length && earliestDueAt ? (
        <Link to="/cart" className={styles.cartBanner}>
          <Icon name="cart" size={18} />
          <span>
            낙찰받은 상품 <strong className="num">{cartItems.length}개</strong>
            가 결제를 기다려요 ·{' '}
            <strong className="num">
              {formatCountdown(earliestDueAt - now)}
            </strong>{' '}
            안에 결제하지 않으면 낙찰이 무효돼요.
          </span>
          <span className={styles.cartBannerGo}>
            결제하기 <Icon name="chevronRight" size={14} />
          </span>
        </Link>
      ) : null}

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
        <DevApiNote ids={['auction.list']} className={styles.note} />
        <div className="grid-products">
          {endingQuery.isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))
            : endingQuery.data?.content.map((item) => (
                <ProductCard key={item.productId} item={item} />
              ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>카테고리</h2>
        </div>
        <div className={styles.categories}>
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/auctions?category=${category}`}
              className={styles.category}
            >
              <Img
                src={CATEGORY_ART[category]}
                alt=""
                className={styles.categoryArt}
              />
              <span className={styles.categoryName}>
                {CATEGORY_LABELS[category]}
              </span>
              <span className={styles.categoryDesc}>
                {CATEGORY_DESCRIPTIONS[category]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {soonQuery.data?.content.length ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>곧 시작해요</h2>
            <Link to="/auctions?status=SCHEDULED" className={styles.more}>
              전체 보기 <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          <p className={styles.sectionDesc}>
            등록 후 1시간 동안은 판매자가 내용을 고칠 수 있어요. 그 시간이
            지나면 경매가 자동으로 열려요.
          </p>
          <div className="grid-products">
            {soonQuery.data.content.map((item) => (
              <ProductCard key={item.productId} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>입찰이 몰리는 경매</h2>
          <Link to="/auctions?sort=MOST_BIDS" className={styles.more}>
            전체 보기 <Icon name="chevronRight" size={14} />
          </Link>
        </div>
        <div className="grid-products">
          {hotQuery.isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))
            : hotItems.map((item) => (
                <ProductCard key={item.productId} item={item} />
              ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.steps}>
          <h2 className={styles.stepsTitle}>찐막에서 거래는 이렇게 흘러가요</h2>
          <ol className={styles.stepList}>
            {TRADE_STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepIcon}>
                  <Icon name={step.icon} size={20} />
                </span>
                <span className={styles.stepNo}>0{index + 1}</span>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepDesc}>{step.desc}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
