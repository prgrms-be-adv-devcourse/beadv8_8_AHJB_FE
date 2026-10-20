import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { auctionApi, productApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Button, LinkButton } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { Icon } from '@/components/Icon'
import { Input } from '@/components/form/Field'
import { useToast } from '@/components/Toast'
import { BID_INCREMENT_TIERS, bidIncrementOf, validateBid } from '@/lib/auction'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatDateTime, formatWon, parseDigits } from '@/lib/format'
import { DURATION_LABELS, FAILURE_REASON_LABELS } from '@/lib/labels'
import type { AuctionDetail } from '@/types/auction'
import type { ProductDetail } from '@/types/product'
import pageStyles from './ProductDetailPage.module.css'
import styles from './BidBoard.module.css'

/** 마감 5분 전 연장 구간 (원본 HN) */
const EXTENSION_WINDOW_MS = 300 * 1000

/** 입력칸에 넣을 최소 입찰가 문자열. 종료된 경매는 minBidPrice 가 null 일 수 있음 (의도된 변경 #4) */
function minBidText(minBidPrice: number | null): string {
  return minBidPrice?.toLocaleString('ko-KR') ?? ''
}

/* ------------------------------------------------------------------ */
/* 경매 시작 전 보드 (원본 UN)                                          */
/* ------------------------------------------------------------------ */

export function ScheduledAuctionBoard({ product }: { product: ProductDetail }) {
  const now = useNow()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const untilStart = Date.parse(product.auctionScheduledAt) - now

  const removeMutation = useMutation({
    mutationFn: () => productApi.remove(product.productId),
    onSuccess: () => {
      toast('상품을 삭제했어요.', { tone: 'success' })
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
      navigate('/me/products')
    },
    onError: (error) => {
      setConfirmOpen(false)
      toast(error.message, { tone: 'error' })
    },
  })

  const terms = product.auctionTerms

  return (
    <>
      <div className={styles.board}>
        <div className={`${styles.timer} ${styles.timerSoon}`}>
          <span className={styles.boardLabel}>경매 시작까지</span>
          <span className={`${styles.timerValue} num`}>{untilStart > 0 ? formatCountdown(untilStart) : '곧 시작'}</span>
          <span className={`${styles.boardSub} num`}>{formatDateTime(product.auctionScheduledAt)} 자동 시작</span>
        </div>
        <div className={styles.current}>
          <span className={styles.boardLabel}>시작가</span>
          <span className={`${styles.currentValue} num`}>{formatWon(terms.startingPrice)}</span>
          <span className={styles.boardSub}>진행 기간 {DURATION_LABELS[terms.duration]}</span>
        </div>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>즉시낙찰가</dt>
          <dd className="num">{terms.instantWinPrice ? formatWon(terms.instantWinPrice) : '없음'}</dd>
        </div>
        <div>
          <dt>첫 호가 단위</dt>
          <dd className="num">{formatWon(bidIncrementOf(terms.startingPrice))}</dd>
        </div>
        <div>
          <dt>배송비</dt>
          <dd className="num">{product.shipping.fee ? formatWon(product.shipping.fee) : '무료'}</dd>
        </div>
        <div>
          <dt>묶음배송</dt>
          <dd>{product.shipping.bundleAllowed ? '가능' : '불가'}</dd>
        </div>
      </dl>

      {product.isMine ? (
        <>
          <div className={`${pageStyles.notice} ${pageStyles.noticeInfo}`}>
            <Icon name="info" size={16} />
            <span>
              등록 후 1시간 동안만 수정·삭제할 수 있어요.{' '}
              <strong className="num">{untilStart > 0 ? formatCountdown(untilStart) : '0:00'}</strong> 뒤엔 경매가
              자동으로 열리고 더는 고칠 수 없어요(PRODUCT008).
            </span>
          </div>
          <div className={styles.ownerActions}>
            <Button variant="outline" size="lg" onClick={() => setConfirmOpen(true)} disabled={untilStart <= 0}>
              <Icon name="trash" size={16} /> 삭제
            </Button>
            {/* 원본도 aria-disabled 만 주고 링크 이동은 막지 않음 */}
            <LinkButton
              to={`/sell/${product.productId}/edit`}
              variant="solid"
              size="lg"
              aria-disabled={untilStart <= 0}
            >
              <Icon name="edit" size={16} /> 수정하기
            </LinkButton>
          </div>
          <DevApiNote ids={['product.update', 'product.delete']} />
        </>
      ) : (
        <div className={`${pageStyles.notice} ${pageStyles.noticeMuted}`}>
          <Icon name="clock" size={16} />
          <span>아직 경매 전이에요. 찜해 두면 마이페이지 찜 목록에서 다시 찾을 수 있어요.</span>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="이 상품을 삭제할까요?"
        confirmLabel="삭제하기"
        confirmVariant="solid"
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      >
        삭제하면 되돌릴 수 없어요. 경매가 시작된 뒤에는 삭제할 수 없어요.
      </ConfirmDialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 진행 중 / 종료된 경매 입찰 박스 (원본 zN)                              */
/* ------------------------------------------------------------------ */

interface AuctionBidBoxProps {
  data: AuctionDetail
  product: ProductDetail
  /** 내가 이 경매에 입찰한 적이 있는지 (밀렸을 때 안내용) */
  hasMyBid: boolean
}

type PendingConfirm = 'bid' | 'instant' | null

export function AuctionBidBox({ data, product, hasMyBid }: AuctionBidBoxProps) {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const now = useNow()

  const auction = data.auction
  const me = data.me
  const minBidPrice = auction.minBidPrice
  const isLive = auction.status === 'IN_PROGRESS'
  const remaining = isLive ? Date.parse(auction.endAt) - now : 0
  const inExtensionWindow = isLive && remaining > 0 && remaining <= EXTENSION_WINDOW_MS
  const isHot = isLive && remaining < 3600 * 1000

  const [bidInput, setBidInput] = useState(minBidText(minBidPrice))
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)

  // 최소 입찰가가 바뀌면(다른 사람 입찰) 손대지 않았거나 최소 미만인 입력을 새 최소값으로
  useEffect(() => {
    if (!touched || parseDigits(bidInput) < (minBidPrice ?? 0)) setBidInput(minBidText(minBidPrice))
  }, [minBidPrice])

  // 현재가가 바뀌면 깜빡임 + 내가 최고 입찰자였다가 밀렸으면 토스트
  const lastSeen = useRef({ price: auction.currentPrice, top: me.isHighestBidder })
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (lastSeen.current.price !== auction.currentPrice) {
      setFlash(true)
      const timer = window.setTimeout(() => setFlash(false), 1200)
      if (lastSeen.current.top && !me.isHighestBidder && isLive) {
        toast(`다른 회원이 더 높게 입찰했어요. 현재가 ${formatWon(auction.currentPrice)}`, { tone: 'error' })
      }
      lastSeen.current = { price: auction.currentPrice, top: me.isHighestBidder }
      return () => window.clearTimeout(timer)
    }
    lastSeen.current = { price: auction.currentPrice, top: me.isHighestBidder }
  }, [auction.currentPrice, me.isHighestBidder, isLive, toast])

  const invalidateAfterBid = () => {
    queryClient.invalidateQueries({ queryKey: ['auction', auction.auctionId] })
    queryClient.invalidateQueries({ queryKey: ['auctions'] })
    queryClient.invalidateQueries({ queryKey: ['cart'] })
  }

  const bidMutation = useMutation({
    mutationFn: (bidPrice: number) => auctionApi.bid(auction.auctionId, bidPrice),
    onSuccess: (result) => {
      setPendingConfirm(null)
      setTouched(false)
      invalidateAfterBid()
      if (result.isInstantWin) {
        toast('즉시낙찰가 이상이라 바로 낙찰됐어요! 24시간 안에 결제해 주세요.', {
          tone: 'success',
          action: { label: '장바구니', to: '/cart' },
        })
      } else {
        toast(
          result.isExtended
            ? `${formatWon(result.bidPrice)} 입찰 완료 · 마감 5분 전이라 종료가 5분 늘었어요.`
            : `${formatWon(result.bidPrice)}에 입찰했어요. 현재 최고 입찰자예요.`,
          { tone: 'success' },
        )
      }
    },
    onError: (error) => {
      setPendingConfirm(null)
      setServerError(error.message)
      invalidateAfterBid()
    },
  })

  const instantWinMutation = useMutation({
    mutationFn: () => auctionApi.instantWin(auction.auctionId),
    onSuccess: () => {
      setPendingConfirm(null)
      invalidateAfterBid()
      toast('즉시낙찰했어요! 장바구니에서 24시간 안에 결제해 주세요.', {
        tone: 'success',
        action: { label: '장바구니', to: '/cart' },
      })
    },
    onError: (error) => {
      setPendingConfirm(null)
      toast(error.message, { tone: 'error' })
      invalidateAfterBid()
    },
  })

  // 진행 중이 아니면 백엔드가 null 을 주므로 현재가 기준 단위로 대신 표시
  const increment = auction.bidIncrement ?? bidIncrementOf(auction.currentPrice)
  const bidPrice = parseDigits(bidInput)
  // 원본은 4번째 인자로 bidCount 를 넘기지만 검사 함수가 쓰지 않음
  const validationError = touched ? validateBid(bidPrice, auction.currentPrice, minBidPrice ?? 0) : null
  const bidError = serverError ?? validationError
  const reachesInstantWin = !!auction.instantWinPrice && bidPrice >= auction.instantWinPrice
  const instantWinTotal = (auction.instantWinPrice ?? 0) + product.shipping.fee

  /** 로그인 안 했으면 로그인 화면으로 보내고 false */
  const ensureLoggedIn = () => {
    if (isLoggedIn) return true
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
    return false
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ensureLoggedIn()) return
    setTouched(true)
    setServerError(null)
    const error = validateBid(bidPrice, auction.currentPrice, minBidPrice ?? 0)
    if (error && !reachesInstantWin) {
      setServerError(error)
      return
    }
    setPendingConfirm('bid')
  }

  const pickAmount = (amount: number) => {
    setTouched(true)
    setServerError(null)
    setBidInput(amount.toLocaleString('ko-KR'))
  }

  const canBid = isLive && remaining > 0 && !me.isSeller && !me.isHighestBidder
  const activeTierIndex = BID_INCREMENT_TIERS.findIndex(
    (tier, i) =>
      auction.currentPrice >= tier.from &&
      (i === BID_INCREMENT_TIERS.length - 1 || auction.currentPrice < BID_INCREMENT_TIERS[i + 1].from),
  )

  /* ---------- 종료된 경매 ---------- */
  if (!isLive) {
    const iWon = me.isHighestBidder && auction.status !== 'FAILED'
    return (
      <>
        <div className={styles.board}>
          <div className={`${styles.timer} ${styles.timerDone}`}>
            <span className={styles.boardLabel}>경매 종료</span>
            <span className={`${styles.timerValue}`}>
              {auction.status === 'FAILED' ? FAILURE_REASON_LABELS[auction.failureReason ?? 'NO_BID'] : '낙찰'}
            </span>
            <span className={`${styles.boardSub} num`}>{formatDateTime(auction.endAt)}</span>
          </div>
          <div className={styles.current}>
            <span className={styles.boardLabel}>{auction.winningPrice ? '낙찰가' : '시작가'}</span>
            <span className={`${styles.currentValue} num`}>{formatWon(auction.winningPrice ?? auction.startPrice)}</span>
            <span className={`${styles.boardSub} num`}>입찰 {auction.bidCount}회</span>
          </div>
        </div>
        {iWon && auction.status === 'WON' ? (
          <>
            <div className={`${pageStyles.notice} ${pageStyles.noticeWon}`}>
              <Icon name="trophy" size={16} />
              <span>
                낙찰받았어요! 장바구니에서 24시간 안에 예치금으로 결제해야 해요. 지나면 낙찰이 무효되고 경고가 쌓여요.
              </span>
            </div>
            <LinkButton to="/cart" variant="highlight" size="lg" fullWidth>
              장바구니에서 결제하기
            </LinkButton>
          </>
        ) : iWon ? (
          <div className={`${pageStyles.notice} ${pageStyles.noticeGood}`}>
            <Icon name="check" size={16} />
            <span>
              낙찰받아 결제까지 끝난 상품이에요. <Link to="/me/orders">구매 주문</Link>에서 배송을 확인하세요.
            </span>
          </div>
        ) : me.isSeller ? (
          <SellerEndedPanel data={data} product={product} />
        ) : (
          <div className={`${pageStyles.notice} ${pageStyles.noticeMuted}`}>
            <Icon name="info" size={16} />
            <span>
              {auction.status === 'FAILED'
                ? auction.failureReason === 'NO_BID'
                  ? '입찰 없이 끝났어요(유찰). 판매자가 다음 회차를 열 수 있어요.'
                  : auction.failureReason === 'UNPAID'
                    ? '낙찰자가 24시간 안에 결제하지 않아 낙찰이 무효됐어요. 판매자가 다음 회차를 열 수 있어요.'
                    : '환불로 거래가 취소됐어요.'
                : '끝난 경매예요. 비슷한 상품을 찾아보세요.'}
            </span>
          </div>
        )}
      </>
    )
  }

  /* ---------- 진행 중 ---------- */
  const shippingText = product.shipping.fee ? formatWon(product.shipping.fee) : '무료'
  const confirmPrice = reachesInstantWin ? (auction.instantWinPrice ?? 0) : bidPrice

  return (
    <>
      <div className={styles.board} aria-live="polite">
        <div className={`${styles.timer} ${isHot ? styles.timerHot : ''}`}>
          <span className={styles.boardLabel}>{inExtensionWindow ? '연장 구간 · 남은 시간' : '남은 시간'}</span>
          <span className={`${styles.timerValue} num`}>{remaining > 0 ? formatCountdown(remaining) : '마감 처리 중'}</span>
          <span className={`${styles.boardSub} num`}>{formatDateTime(auction.endAt)} 종료</span>
        </div>
        <div className={`${styles.current} ${flash ? styles.flash : ''}`}>
          <span className={styles.boardLabel}>{auction.bidCount ? '현재가' : '시작가'}</span>
          <span className={`${styles.currentValue} num`}>{formatWon(auction.currentPrice)}</span>
          <span className={`${styles.boardSub} num`}>입찰 {auction.bidCount}회</span>
        </div>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>최소 입찰가</dt>
          <dd className="num">{formatWon(minBidPrice)}</dd>
        </div>
        <div>
          <dt>호가 단위</dt>
          <dd className="num">{formatWon(increment)}</dd>
        </div>
        <div>
          <dt>시작가</dt>
          <dd className="num">{formatWon(auction.startPrice)}</dd>
        </div>
        <div>
          <dt>배송비</dt>
          <dd className="num">{shippingText}</dd>
        </div>
      </dl>

      {me.isSeller ? (
        <div className={`${pageStyles.notice} ${pageStyles.noticeInfo}`}>
          <Icon name="info" size={16} />
          <span>
            내 경매예요. 판매자는 자기 경매에 입찰할 수 없어요(AUCTION004). 질문이 오면 아래 Q&A에서 답글을 달아 주세요.
          </span>
        </div>
      ) : me.isHighestBidder ? (
        <div className={`${pageStyles.notice} ${pageStyles.noticeGood}`}>
          <Icon name="check" size={16} />
          <span>지금 최고 입찰자예요. 다른 회원이 더 높게 입찰하기 전에는 다시 입찰할 수 없어요(AUCTION005).</span>
        </div>
      ) : hasMyBid ? (
        <div className={`${pageStyles.notice} ${pageStyles.noticeWarn}`}>
          <Icon name="alert" size={16} />
          <span>다른 회원이 더 높게 입찰했어요. 다시 입찰하려면 {formatWon(minBidPrice)} 이상으로 올려 주세요.</span>
        </div>
      ) : inExtensionWindow ? (
        <div className={`${pageStyles.notice} ${pageStyles.noticeWarn}`}>
          <Icon name="clock" size={16} />
          <span>마감 5분 전이에요. 지금 입찰하면 종료 시각이 입찰 시점부터 5분 뒤로 늘어나요.</span>
        </div>
      ) : null}

      {me.isSeller ? null : (
        <form className={styles.bidForm} onSubmit={handleSubmit} noValidate>
          <label htmlFor="bid-input" className={styles.bidLabel}>
            입찰가
          </label>
          <Input
            id="bid-input"
            inputSize="lg"
            inputMode="numeric"
            suffix="원"
            value={bidInput}
            invalid={!!bidError && !reachesInstantWin}
            aria-describedby="bid-help"
            disabled={!canBid}
            onChange={(event) => {
              setTouched(true)
              setServerError(null)
              const digits = parseDigits(event.target.value)
              setBidInput(digits ? digits.toLocaleString('ko-KR') : '')
            }}
          />
          <div className={styles.quick}>
            <button type="button" onClick={() => pickAmount(minBidPrice ?? 0)} disabled={!canBid}>
              최소
            </button>
            {[1, 3, 5].map((times) => (
              <button
                key={times}
                type="button"
                onClick={() => pickAmount((minBidPrice ?? 0) + increment * times)}
                disabled={!canBid}
              >
                +{(increment * times).toLocaleString('ko-KR')}
              </button>
            ))}
          </div>
          <div className={styles.tiers} aria-label="호가 단위표">
            {BID_INCREMENT_TIERS.map((tier, i) => (
              <span key={tier.from} className={i === activeTierIndex ? styles.tierOn : ''}>
                <span>{tier.from ? `${(tier.from / 10000).toLocaleString('ko-KR')}만~` : '1만 미만'}</span>
                <span className="num">{tier.unit.toLocaleString('ko-KR')}</span>
              </span>
            ))}
          </div>
          {bidError && !reachesInstantWin ? (
            <p id="bid-help" className={styles.bidError} role="alert">
              {bidError}
            </p>
          ) : (
            <p id="bid-help" className={styles.bidHelp}>
              {reachesInstantWin ? (
                <>
                  즉시낙찰가(<strong className="num">{formatWon(auction.instantWinPrice)}</strong>) 이상이에요. 입찰하면{' '}
                  <strong>즉시낙찰가로 바로 낙찰</strong>돼요.
                </>
              ) : (
                <>
                  현재가에 <strong className="num">{formatWon(increment)}</strong> 단위로 올려요. 낙찰되면 낙찰가 +
                  배송비를 24시간 안에 예치금으로 결제해요.
                </>
              )}
            </p>
          )}
          <Button
            type="submit"
            variant="highlight"
            size="lg"
            fullWidth
            // 최소 입찰가 미만·단위 불일치도 비활성 (즉시낙찰가 이상이면 허용). 비로그인은 눌러서 로그인으로
            disabled={
              isLive &&
              (me.isHighestBidder || remaining <= 0 || (isLoggedIn && !!validationError && !reachesInstantWin))
            }
            loading={bidMutation.isPending}
          >
            {isLoggedIn
              ? me.isHighestBidder
                ? '최고 입찰 중'
                : `${formatWon(bidPrice || minBidPrice)} 입찰하기`
              : '로그인하고 입찰하기'}
          </Button>
          <DevApiNote ids={['auction.bid']} />
        </form>
      )}

      {auction.instantWinPrice && !me.isSeller ? (
        <div className={styles.instant}>
          <span className={styles.instantText}>
            <span>기다리지 않고 바로 사기</span>
            <strong className="num">즉시낙찰 {formatWon(auction.instantWinPrice)}</strong>
          </span>
          <Button
            variant="solid"
            onClick={() => ensureLoggedIn() && setPendingConfirm('instant')}
            disabled={remaining <= 0}
            loading={instantWinMutation.isPending}
          >
            <Icon name="bolt" size={14} /> 즉시낙찰
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingConfirm === 'bid'}
        title={
          reachesInstantWin
            ? `${formatWon(auction.instantWinPrice)}에 즉시낙찰할까요?`
            : `${formatWon(bidPrice)}에 입찰할까요?`
        }
        confirmLabel={reachesInstantWin ? '즉시낙찰' : '입찰하기'}
        loading={bidMutation.isPending}
        onConfirm={() => bidMutation.mutate(bidPrice)}
        onClose={() => setPendingConfirm(null)}
      >
        <dl className={styles.summary}>
          <dt>{reachesInstantWin ? '낙찰가' : '입찰가'}</dt>
          <dd className="num">{formatWon(confirmPrice)}</dd>
          <dt>배송비</dt>
          <dd className="num">{shippingText}</dd>
          <dt>낙찰 시 결제 금액</dt>
          <dd className={`${styles.total} num`}>{formatWon(confirmPrice + product.shipping.fee)}</dd>
        </dl>
        <p style={{ marginTop: 12 }}>
          입찰은 취소할 수 없어요. 낙찰되면 24시간 안에 예치금으로 결제하지 않을 경우 낙찰이 무효되고 경고를 받아요.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingConfirm === 'instant'}
        title={`${formatWon(auction.instantWinPrice)}에 즉시낙찰할까요?`}
        confirmLabel="즉시낙찰"
        loading={instantWinMutation.isPending}
        onConfirm={() => instantWinMutation.mutate()}
        onClose={() => setPendingConfirm(null)}
      >
        경매가 바로 끝나고 장바구니에 담겨요. 배송비 {shippingText} 포함{' '}
        <strong style={{ color: 'var(--text)' }}>{formatWon(instantWinTotal)}</strong>을 24시간 안에 결제해 주세요.
        <DevApiNote ids={['auction.instantWin']} />
      </ConfirmDialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 판매자용 종료 패널: 유찰·낙찰 무효면 다음 회차 열기 (원본 QN)            */
/* ------------------------------------------------------------------ */

function SellerEndedPanel({ data, product }: { data: AuctionDetail; product: ProductDetail }) {
  const auction = data.auction
  const toast = useToast()
  const queryClient = useQueryClient()

  const reopenMutation = useMutation({
    mutationFn: () => productApi.reopen(product.productId),
    onSuccess: (result) => {
      toast(`${result.round}회차 경매를 열었어요.`, { tone: 'success' })
      queryClient.invalidateQueries({ queryKey: ['product', product.productId] })
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  if (auction.status === 'FAILED' && auction.failureReason !== 'REFUNDED') {
    return (
      <>
        <div className={`${pageStyles.notice} ${pageStyles.noticeMuted}`}>
          <Icon name="info" size={16} />
          <span>
            {auction.failureReason === 'NO_BID'
              ? '입찰 없이 끝났어요(유찰).'
              : '낙찰자가 결제하지 않아 낙찰이 무효됐어요.'}{' '}
            같은 조건으로 다음 회차를 열 수 있어요.
          </span>
        </div>
        <Button
          variant="highlight"
          size="lg"
          fullWidth
          loading={reopenMutation.isPending}
          onClick={() => reopenMutation.mutate()}
        >
          {product.round + 1}회차 경매 열기
        </Button>
        <DevApiNote ids={['auction.reopen']} />
      </>
    )
  }

  return (
    <div className={`${pageStyles.notice} ${pageStyles.noticeGood}`}>
      <Icon name="check" size={16} />
      <span>
        {auction.status === 'WON'
          ? '낙찰됐어요. 구매자가 24시간 안에 결제하면 판매 주문이 생겨요.'
          : '판매된 경매예요.'}{' '}
        <Link to="/me/sales">판매 주문</Link>에서 진행 상황을 볼 수 있어요.
      </span>
    </div>
  )
}
