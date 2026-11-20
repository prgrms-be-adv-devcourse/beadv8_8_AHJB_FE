import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { formatWon } from '@/lib/format'
import type { AuctionSummary } from '@/types/auction'
import styles from './HeroBanner.module.css'

/** 자동으로 넘어가는 간격 */
const AUTOPLAY_MS = 6000

interface Slide {
  key: string
  tone: 'brand' | 'drop' | 'sell'
  label: string
  title: ReactNode
  desc: string
  cta: { to: string; label: string }
  visual: ReactNode
}

interface HeroBannerProps {
  /** 입찰 수 1위 진행 중 경매 (없으면 첫 장 오른쪽에 아이콘) */
  featured: AuctionSummary | undefined
}

/**
 * 홈 상단 배너 (KREAM·번개장터 메인 배너 참고)
 * - 슬라이드 3장: 서비스 소개(오른쪽은 인기 1위 경매 카드, 없으면 아이콘) · 스페셜 경매 · 판매 유도
 * - 6초마다 넘어가고, 마우스를 올리거나 포커스가 있으면 멈춘다. 모바일은 손가락으로 넘긴다(scroll-snap)
 */
export function HeroBanner({ featured }: HeroBannerProps) {
  const intro: Slide = {
    key: 'intro',
    tone: 'brand',
    label: '게임 전문 거래 플랫폼',
    title: (
      <>
        그 시절 추억의 게임부터
        <br />
        귀한 한정판까지
      </>
    ),
    desc: '게임만 모아 사고, 팔고, 경매해요. 찾던 그 게임, 찐막에서 만나요.',
    cta: { to: '/auctions', label: '경매 둘러보기' },
    // 진행 중 경매가 있으면 인기 1위 카드, 없으면 아이콘
    visual: featured ? <HotCard item={featured} /> : <IconArt icon="gavel" />,
  }

  const slides: Slide[] = [
    intro,
    {
      key: 'drop',
      tone: 'drop',
      label: '스페셜 경매 · 드롭',
      title: (
        <>
          시간이 갈수록
          <br />
          값이 내려가요
        </>
      ),
      desc: '원하는 가격이 되면 가장 먼저 누른 한 명만 가져가요.',
      cta: { to: '/drops', label: '스페셜 경매 보기' },
      visual: <DropArt />,
    },
    {
      key: 'sell',
      tone: 'sell',
      label: '판매하기',
      title: (
        <>
          서랍 속 게임기,
          <br />
          경매로 값을 정해요
        </>
      ),
      desc: '사진과 시작가만 정하면 경매가 열려요.',
      cta: { to: '/sell', label: '판매하기' },
      visual: <IconArt icon="tag" />,
    },
  ]

  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = (next: number) => {
    const track = trackRef.current
    if (!track) return
    const target = (next + slides.length) % slides.length
    track.scrollTo({ left: track.clientWidth * target, behavior: 'smooth' })
  }

  // 스크롤 위치 → 현재 슬라이드 (손가락으로 넘긴 경우 포함)
  const handleScroll = () => {
    const track = trackRef.current
    if (!track) return
    setIndex(Math.round(track.scrollLeft / track.clientWidth))
  }

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (paused || reduce) return
    const timer = window.setTimeout(() => goTo(index + 1), AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused])

  return (
    <section
      className={styles.banner}
      aria-roledescription="carousel"
      aria-label="주요 소식"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div ref={trackRef} className={styles.track} onScroll={handleScroll}>
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.key}
            className={`${styles.slide} ${styles[slide.tone]}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} / ${slides.length}`}
            aria-hidden={slideIndex !== index}
          >
            <div className={styles.copy}>
              <p className={styles.label}>{slide.label}</p>
              <h2 className={styles.title}>{slide.title}</h2>
              <p className={`${styles.desc} num`}>{slide.desc}</p>
              <Link to={slide.cta.to} className={styles.cta} tabIndex={slideIndex === index ? 0 : -1}>
                {slide.cta.label}
                <Icon name="chevronRight" size={16} />
              </Link>
            </div>
            <div className={styles.visual}>{slide.visual}</div>
          </div>
        ))}
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.arrow} onClick={() => goTo(index - 1)} aria-label="이전 배너">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className={`${styles.counter} num`}>
          {index + 1} / {slides.length}
        </span>
        <button type="button" className={styles.arrow} onClick={() => goTo(index + 1)} aria-label="다음 배너">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </section>
  )
}

/** 첫 장 오른쪽: 입찰 수 1위 경매 */
function HotCard({ item }: { item: AuctionSummary }) {
  return (
    <Link to={productPath(item.productId)} className={styles.hotCard} tabIndex={-1}>
      <Img src={item.thumbnailUrl} alt={item.productName} className={styles.hotImage} />
      <div className={styles.hotInfo}>
        <p className={styles.hotTag}>인기 경매 · 입찰 {item.bidCount}회</p>
        <p className={styles.hotName}>{item.productName}</p>
        <p className={`${styles.hotPrice} num`}>
          <span>현재가</span>
          {formatWon(item.currentPrice)}
        </p>
      </div>
    </Link>
  )
}

/** 2번 슬라이드: 계단처럼 내려가는 가격 막대 */
function DropArt() {
  return (
    <div className={styles.dropArt} aria-hidden="true">
      {[100, 82, 64, 46, 30].map((height, barIndex) => (
        <span key={height} className={styles.dropBar} style={{ height: `${height}%`, animationDelay: `${barIndex * 80}ms` }} />
      ))}
      <Icon name="bolt" size={28} />
    </div>
  )
}

/** 아이콘 하나를 크게 그린 장식 */
function IconArt({ icon }: { icon: 'gavel' | 'tag' }) {
  return (
    <div className={styles.iconArt} aria-hidden="true">
      <Icon name={icon} size={88} />
    </div>
  )
}
