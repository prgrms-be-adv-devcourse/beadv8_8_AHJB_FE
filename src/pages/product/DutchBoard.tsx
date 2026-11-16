import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { auctionApi } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { Button, LinkButton } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatDateTime, formatWon } from '@/lib/format'
import { dropPercent, formatInterval, formatShortCountdown } from '@/pages/drops/dutch'
import type { DutchAuctionDetail } from '@/types/auction'
import type { ProductDetail } from '@/types/product'
import styles from './BidBoard.module.css'
import pageStyles from './ProductDetailPage.module.css'

interface DutchBoardProps {
  data: DutchAuctionDetail
  product: ProductDetail
}

/** 하향식 경매 박스 (상품 상세에서 입찰 박스 자리) */
export function DutchBoard({ data, product }: DutchBoardProps) {
  const auction = data.auction
  const now = useNow()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { isLoggedIn } = useAuth()
  const [confirmPrice, setConfirmPrice] = useState<number | null>(null)
  const [bought, setBought] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['auction', auction.auctionId] })

  // 다음 하락 시각이 지났는데 아직 재조회 전이면 다음 가격을 먼저 보여 준다
  const dropped = !!auction.nextDropAt && Date.parse(auction.nextDropAt) <= now
  const price = dropped && auction.nextPrice !== null ? auction.nextPrice : auction.currentPrice
  const untilDrop = auction.nextDropAt ? Date.parse(auction.nextDropAt) - now : 0
  const shippingText = product.shipping.fee ? formatWon(product.shipping.fee) : '무료'

  const buyMutation = useMutation({
    mutationFn: (expectedPrice: number) => auctionApi.dutchBuy(auction.auctionId, expectedPrice),
    onSuccess: (result) => {
      setConfirmPrice(null)
      setBought(true)
      toast(`${formatWon(result.winningPrice)}에 구매했어요! 24시간 안에 결제해 주세요.`, { tone: 'success' })
      void refresh()
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error) => {
      setConfirmPrice(null)
      toast(error.message, { tone: 'error' })
      if (error instanceof ApiError && (error.code === 'AUCTION013' || error.code === 'AUCTION014')) void refresh()
    },
  })

  const askBuy = () => {
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
      return
    }
    if (price !== null) setConfirmPrice(price)
  }

  if (auction.status !== 'IN_PROGRESS') {
    return (
      <>
        <div className={styles.board}>
          <div className={`${styles.timer} ${styles.timerDone}`}>
            <span className={styles.boardLabel}>드롭 타임</span>
            <span className={`${styles.timerValue} num`}>{auction.status === 'FAILED' ? '유찰' : '판매 완료'}</span>
            <span className={`${styles.boardSub} num`}>{formatDateTime(auction.startAt)} 시작</span>
          </div>
          <div className={styles.current}>
            <span className={styles.boardLabel}>{auction.status === 'FAILED' ? '시작가' : '판매가'}</span>
            <span className={`${styles.currentValue} num`}>
              {formatWon(auction.status === 'FAILED' ? auction.startPrice : auction.winningPrice)}
            </span>
            <span className={styles.boardSub}>&nbsp;</span>
          </div>
        </div>
        {bought ? (
          <LinkButton to="/cart" variant="highlight" size="lg" fullWidth>
            장바구니에서 결제하기
          </LinkButton>
        ) : (
          <div className={`${pageStyles.notice} ${pageStyles.noticeMuted}`}>
            <Icon name="info" size={16} />
            <span>
              {auction.status === 'FAILED'
                ? '최저가까지 내려갔지만 구매한 사람이 없었어요.'
                : '다른 회원이 먼저 구매했어요. 다음 드롭을 기다려 주세요.'}
            </span>
          </div>
        )}
        <DevApiNote ids={['auction.detail']} />
      </>
    )
  }

  return (
    <>
      <div className={styles.board} aria-live="polite">
        <div className={`${styles.timer} ${auction.isLastPrice ? styles.timerHot : ''}`}>
          <span className={styles.boardLabel}>{auction.isLastPrice ? '마지막 가격' : '다음 하락까지'}</span>
          <span className={`${styles.timerValue} num`}>
            {auction.isLastPrice ? '곧 종료' : formatShortCountdown(untilDrop)}
          </span>
          <span className={`${styles.boardSub} num`}>
            {auction.isLastPrice || auction.nextPrice === null
              ? '더 내려가지 않아요'
              : `${formatWon(dropped ? auction.nextPrice - auction.dropAmount : auction.nextPrice)}로 내려가요`}
          </span>
        </div>
        <div className={styles.current}>
          <span className={styles.boardLabel}>지금 가격</span>
          <span className={`${styles.currentValue} num`}>{formatWon(price)}</span>
          <span className={`${styles.boardSub} num`}>
            시작가 대비 -{dropPercent({ startPrice: auction.startPrice, currentPrice: price })}%
          </span>
        </div>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>시작가</dt>
          <dd className="num">{formatWon(auction.startPrice)}</dd>
        </div>
        <div>
          <dt>하락</dt>
          <dd className="num">
            {formatInterval(auction.dropIntervalSec)}마다 {formatWon(auction.dropAmount)}
          </dd>
        </div>
        <div>
          <dt>배송비</dt>
          <dd className="num">{shippingText}</dd>
        </div>
      </dl>

      {data.me.isSeller ? (
        <div className={`${pageStyles.notice} ${pageStyles.noticeInfo}`}>
          <Icon name="info" size={16} />
          <span>운영자가 연 드롭이에요. 판매 계정은 구매할 수 없어요.</span>
        </div>
      ) : (
        <Button variant="highlight" size="lg" fullWidth onClick={askBuy} disabled={price === null}>
          {formatWon(price)}에 지금 구매
        </Button>
      )}
      <p className={styles.bidHelp}>
        가장 먼저 구매한 한 명만 가져가요. 구매하면 장바구니에 담기고 24시간 안에 결제해야 해요.
      </p>
      <DevApiNote ids={['auction.detail', 'auction.dutchBuy']} />

      <ConfirmDialog
        open={confirmPrice !== null}
        title={`${formatWon(confirmPrice)}에 구매할까요?`}
        confirmLabel="구매"
        loading={buyMutation.isPending}
        onConfirm={() => confirmPrice !== null && buyMutation.mutate(confirmPrice)}
        onClose={() => setConfirmPrice(null)}
      >
        누르는 사이에 가격이 내려가면 내려간 가격으로 구매돼요. 이미 팔렸으면 구매되지 않아요. 배송비({shippingText})는
        따로 결제해요.
      </ConfirmDialog>
    </>
  )
}
