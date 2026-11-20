import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { isRealApi } from '@/api/config'
import { cartApi, paymentApi, walletApi } from '@/api/endpoints'
import { tokenStore } from '@/api/tokenStore'
import { Button, LinkButton } from '@/components/Button'
import { ChargeDialog } from '@/components/ChargeDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Checkbox, Field, Input, RadioCard } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatDateTime, formatPoint, formatRelativeTime, formatWon, parseDigits } from '@/lib/format'
import { PAY_METHOD_LABELS } from '@/lib/labels'
import { useWithProductSummaries } from '@/lib/productSummaries'
import {
  ORDER_PAYMENT_FAIL_PATH,
  ORDER_PAYMENT_SUCCESS_PATH,
  TOSS_USER_CANCEL,
  closeTossPaymentWindow,
  openTossPaymentWindow,
  orderPaymentCompletePath,
  tossErrorCode,
} from '@/lib/toss'
import type { PayMethod } from '@/types/payment'
import styles from './CartPage.module.css'

/** 결제 기한이 이만큼 안 남으면 강조 (6시간) */
const DUE_HOT_MS = 6 * 3600000

const SHORTAGE_MESSAGE = '예치금이 부족해요. 충전한 뒤 다시 결제해 주세요.'

const PAY_METHODS: PayMethod[] = ['DEPOSIT', 'TRANSFER', 'CARD']

/** 포인트 입력이 멈춘 뒤 이만큼 지나면 견적을 다시 받는다 */
const QUOTE_DEBOUNCE_MS = 300

/** value 가 delayMs 동안 바뀌지 않으면 그 값을 돌려준다 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** 결제 요청 결과. PAID = 끝남(orderGroupId 로 결제 완료 화면을 연다), REDIRECTED = 토스 결제창으로 이동 중(이 페이지를 떠난다) */
type PayOutcome = { status: 'PAID'; orderGroupId: number | null } | { status: 'REDIRECTED' }

/** 장바구니 (/cart) — 낙찰 상품 결제 */
export function CartPage() {
  const now = useNow()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: cartApi.list, refetchInterval: 15000 })
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me })
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('DEPOSIT')
  const [pointRequested, setPointRequested] = useState(0)
  const items = useWithProductSummaries(cartQuery.data ?? [])

  // 처음 불러왔을 때 전부 선택
  useEffect(() => {
    if (!initialized && cartQuery.data) {
      setSelectedIds(new Set(cartQuery.data.map((item) => item.productId)))
      setInitialized(true)
    }
  }, [cartQuery.data, initialized])

  const selected = items.filter((item) => selectedIds.has(item.productId))
  const priceTotal = selected.reduce((sum, item) => sum + item.winningPrice, 0)
  const deliveryTotal = selected.reduce((sum, item) => sum + item.deliveryFee, 0)
  const payTotal = priceTotal + deliveryTotal
  const balance = walletQuery.data?.balance ?? 0
  const pointBalance = walletQuery.data?.pointBalance ?? 0
  // 포인트는 보유한 만큼, 결제 금액까지만 쓸 수 있다. 선택한 상품이 바뀌어 한도가 줄면 사용액도 따라 줄인다
  const maxPoint = Math.min(pointBalance, payTotal)
  const pointUse = Math.min(pointRequested, maxPoint)
  // 예치금으로 결제하면 모자라는 금액. 결제수단 설명에 쓰려고 어떤 수단을 골랐든 계산한다 (견적은 고른 수단 것만 온다)
  const depositShortage = walletQuery.data ? Math.max(0, payTotal - pointUse - balance) : 0
  const quotedPoint = useDebouncedValue(pointUse, QUOTE_DEBOUNCE_MS)

  // 결제 전 견적: 이 결제수단 · 포인트 사용액이면 무엇으로 얼마씩 나가고 결제창에서 얼마를 결제하는지. 계산은 백엔드가 한다
  const quoteQuery = useQuery({
    queryKey: ['payment', 'quote', payTotal, deliveryTotal, payMethod, quotedPoint],
    queryFn: () =>
      paymentApi.quote({ amount: payTotal, payMethod, pointUseAmount: quotedPoint, deliveryFee: deliveryTotal }),
    enabled: payTotal > 0,
    placeholderData: keepPreviousData,
  })
  const quote = payTotal > 0 ? quoteQuery.data : undefined
  // 화면의 조건과 견적의 조건이 같을 때만 결제할 수 있다 (조건을 바꾼 직후에는 이전 견적이 잠깐 보인다)
  const quoteReady = !!quote && !quoteQuery.isPlaceholderData && quotedPoint === pointUse
  const pgAmount = quote?.pgAmount ?? 0
  const shortage = quote?.shortage ?? 0
  const limitExceeded = !!quote?.chargeLimitExceeded

  // 견적이 거절되면(포인트가 그새 줄었을 때 등) 잔액을 다시 받아 입력 한도를 맞춘다
  useEffect(() => {
    if (quoteQuery.error) void queryClient.invalidateQueries({ queryKey: ['wallet'] })
  }, [quoteQuery.error, queryClient])

  /**
   * 결제하기. 포인트 · 예치금만으로 끝나면 cart.pay 한 번으로 끝난다.
   * 결제창을 거쳐야 하면(예치금 부족분 충전 또는 직접 결제) cart.pay 가 isPaid:false + 결제창 파라미터(data)를 주고,
   * 그 pgMethod · chargeAmount 로 토스 결제창을 띄운다.
   * 결제창에서 돌아오는 /cart/payment/success 가 POST /payments/confirm 으로 승인한다.
   * 결제창이 닫히거나 오류로 끝나면 POST /api/v1/cart 로 주문 그룹을 놓아준다.
   * 목업이면 결제창 없이 바로 승인까지 끝낸다.
   */
  const payMutation = useMutation<PayOutcome, ApiError>({
    mutationFn: async () => {
      const result = await cartApi.pay(
        selected.map((item) => item.productId),
        { paymentMethod: payMethod, pointUseAmount: pointUse },
      )
      if (!result || result.isPaid) return { status: 'PAID', orderGroupId: result?.orderGroupId ?? null }
      if (!result.data) {
        throw new Error('결제창 정보를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      }
      const { pgOrderId, chargeAmount, orderName, paymentId, pgMethod } = result.data
      if (!isRealApi('payment.confirm')) {
        // 목업: 토스 결제창을 거치지 않고 바로 승인
        await paymentApi.confirmPayment({ pgOrderId, paymentKey: `mock_${paymentId}`, amount: chargeAmount })
        return { status: 'PAID', orderGroupId: result.orderGroupId }
      }
      // 확인 모달(<dialog>)이 결제창을 가리므로 먼저 닫는다
      setConfirmOpen(false)
      try {
        await openTossPaymentWindow({
          pgOrderId,
          method: pgMethod,
          amount: chargeAmount,
          orderName,
          customerEmail: tokenStore.getProfile()?.email,
          successPath: ORDER_PAYMENT_SUCCESS_PATH,
          // 결제창에서 실패해 돌아오는 화면이 주문 그룹을 놓아줄 수 있게 id 를 실어 보낸다
          failPath: `${ORDER_PAYMENT_FAIL_PATH}?orderGroupId=${result.orderGroupId}`,
        })
      } catch (error) {
        // 결제창을 닫았거나 결제창이 열리지 못했다. 만들어진 주문 그룹을 바로 놓아준다 (실패해도 백엔드가 나중에 정리한다)
        await cartApi.cancelPayment(result.orderGroupId).catch(() => undefined)
        throw error
      }
      return { status: 'REDIRECTED' }
    },
    onSuccess: (outcome) => {
      setConfirmOpen(false)
      if (outcome.status !== 'PAID') return
      toast(`${selected.length}건 결제했어요. 판매자가 발송하면 알려드릴게요.`, {
        tone: 'success',
        action: { label: '구매 주문', to: '/me/orders' },
      })
      void queryClient.invalidateQueries()
      // 결제 완료 화면에서 무엇으로 얼마씩 냈는지 보여 준다. 주문 그룹 id 를 못 받았으면 구매 주문으로 간다
      navigate(outcome.orderGroupId !== null ? orderPaymentCompletePath(outcome.orderGroupId) : '/me/orders')
    },
    onError: (error) => {
      setConfirmOpen(false)
      // 서버 쪽 잔액 · 포인트 · 장바구니가 바뀌었을 수 있으니(부분 처리) 화면 값을 서버 기준으로 다시 맞춘다
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      void queryClient.invalidateQueries({ queryKey: ['payment', 'quote'] })
      // 결제창을 닫은 건 에러가 아니다
      if (tossErrorCode(error) === TOSS_USER_CANCEL) {
        toast('결제창을 닫았어요. 다시 결제하기를 누르면 이어서 결제할 수 있어요.')
        return
      }
      if (error.code === 'WALLET201') setChargeOpen(true)
      toast(error.code === 'WALLET201' ? SHORTAGE_MESSAGE : error.message, { tone: 'error' })
    },
  })

  // 결제창 → 성공/실패 페이지에서 뒤로가기로 돌아오면(bfcache 복원) 남은 결제창을 닫고 진행 중 상태를 푼다
  const resetPay = useRef(payMutation.reset)
  resetPay.current = payMutation.reset
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      void closeTossPaymentWindow()
      resetPay.current()
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [queryClient])

  const toggle = (productId: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>장바구니</h1>
        <p className={styles.sub}>
          낙찰받은 상품이 담겨요. 낙찰 후 24시간 안에 결제하지 않으면 낙찰이 무효되고 경고(결제 미이행)를 받아요.
        </p>
        <DevApiNote ids={['cart.list', 'product.detail', 'cart.pay', 'cart.cancel', 'wallet.me', 'payment.quote', 'payment.confirm']} />
      </div>

      {cartQuery.isLoading ? (
        <Spinner block />
      ) : cartQuery.isError ? (
        <ErrorState message={cartQuery.error.message} onRetry={() => void cartQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="cart"
          title="결제할 낙찰 상품이 없어요"
          description="경매에서 낙찰받으면 여기에 담겨요. 결제한 상품은 마이페이지 구매 주문에서 볼 수 있어요."
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <LinkButton to="/auctions" variant="solid" size="sm">
                경매 둘러보기
              </LinkButton>
              <LinkButton to="/me/orders" variant="outline" size="sm">
                구매 주문
              </LinkButton>
            </div>
          }
        />
      ) : (
        <div className={styles.layout}>
          <div className={styles.list}>
            <div className={styles.toolbar}>
              <Checkbox
                label={`전체 선택 (${selected.length}/${items.length})`}
                checked={selected.length === items.length}
                onChange={(e) =>
                  setSelectedIds(e.target.checked ? new Set(items.map((item) => item.productId)) : new Set())
                }
              />
            </div>
            {items.map((item) => {
              const remaining = Date.parse(item.paymentDueAt) - now
              const hot = remaining < DUE_HOT_MS
              return (
                <div key={item.id} className={styles.item}>
                  <Checkbox
                    label={<span className="sr-only">{item.productName} 선택</span>}
                    checked={selectedIds.has(item.productId)}
                    onChange={() => toggle(item.productId)}
                  />
                  <Link to={productPath(item.productId)}>
                    <Img src={item.thumbnailUrl ?? null} alt="" />
                  </Link>
                  <div className={styles.itemBody}>
                    <p className={styles.itemTitle}>
                      <Link to={productPath(item.productId)}>{item.productName ?? `상품 #${item.productId}`}</Link>
                    </p>
                    <p className={`${styles.itemMeta} num`}>
                      {formatRelativeTime(item.winAt, now)} 낙찰 · 낙찰가 {formatWon(item.winningPrice)} · 배송비{' '}
                      {item.deliveryFee ? formatWon(item.deliveryFee) : '무료'}
                    </p>
                    <p className={`${styles.itemMeta} num`}>{formatDateTime(item.paymentDueAt)}까지 결제</p>
                  </div>
                  <div className={styles.itemSide}>
                    <span className={`${styles.due} ${hot ? styles.dueHot : ''} num`}>
                      <Icon name="clock" size={12} />
                      {remaining > 0 ? `${formatCountdown(remaining)} 남음` : '기한 지남'}
                    </span>
                    <span className={`${styles.price} num`}>{formatWon(item.winningPrice + item.deliveryFee)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <aside className={styles.summary}>
            <dl className={styles.rows}>
              <dt>선택한 상품</dt>
              <dd className="num">{selected.length}개</dd>
              <dt>낙찰가 합계</dt>
              <dd className="num">{formatWon(priceTotal)}</dd>
              <dt>배송비 합계</dt>
              <dd className="num">{formatWon(deliveryTotal)}</dd>
              <dt className={styles.total}>결제 금액</dt>
              <dd className={`${styles.total} num`}>{formatWon(payTotal)}</dd>
            </dl>
            <Field
              label="포인트 사용"
              hint={
                !walletQuery.data
                  ? undefined
                  : pointBalance > 0
                    ? `보유 ${formatPoint(pointBalance)} · 결제 금액까지 쓸 수 있어요.`
                    : '보유한 포인트가 없어요.'
              }
            >
              {(id, describedBy) => (
                <div className={styles.pointRow}>
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    suffix="P"
                    disabled={!maxPoint}
                    value={pointUse ? pointUse.toLocaleString('ko-KR') : ''}
                    onChange={(e) => setPointRequested(Math.min(parseDigits(e.target.value), maxPoint))}
                  />
                  <Button
                    variant="outline"
                    disabled={!maxPoint || pointUse === maxPoint}
                    onClick={() => setPointRequested(maxPoint)}
                  >
                    전액 사용
                  </Button>
                </div>
              )}
            </Field>
            <fieldset className={styles.methods}>
              <legend className={styles.legend}>결제수단</legend>
              {PAY_METHODS.map((method) => (
                <RadioCard
                  key={method}
                  name="payMethod"
                  value={method}
                  checked={payMethod === method}
                  onChange={setPayMethod}
                  title={PAY_METHOD_LABELS[method]}
                  description={
                    method === 'DEPOSIT'
                      ? `잔액 ${walletQuery.data ? formatWon(balance) : '–'}${depositShortage > 0 ? ` · ${formatWon(depositShortage)} 부족` : ''}`
                      : method === 'TRANSFER'
                        ? '계좌 간편결제'
                        : '포인트 적립 제외'
                  }
                />
              ))}
            </fieldset>
            {quoteQuery.isError ? (
              <p className={styles.notice} role="alert">
                <Icon name="alert" size={14} />
                {quoteQuery.error.message}
              </p>
            ) : (
              <dl className={`${styles.walletBox} ${quote && !quoteReady ? styles.stale : ''}`} aria-busy={!quoteReady}>
                {quote?.pointUseAmount ? (
                  <>
                    <dt>포인트로</dt>
                    <dd className="num">{formatPoint(quote.pointUseAmount)}</dd>
                  </>
                ) : null}
                {payMethod === 'DEPOSIT' ? (
                  <>
                    {quote && (quote.walletUseAmount > 0 || shortage > 0) ? (
                      <>
                        <dt>
                          <Icon name="wallet" size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> 예치금으로
                        </dt>
                        <dd className="num">{formatWon(quote.walletUseAmount)}</dd>
                      </>
                    ) : null}
                    {shortage > 0 ? (
                      <>
                        <dt>계좌이체로 충전</dt>
                        <dd className={`num ${styles.short}`}>{formatWon(pgAmount)}</dd>
                      </>
                    ) : null}
                    <dt>결제 후 예치금</dt>
                    <dd className="num">{quote ? formatWon(quote.balanceAfterPayment) : '–'}</dd>
                  </>
                ) : quote && pgAmount === 0 ? null : (
                  // 포인트로 전액을 내면 결제창을 거치지 않으므로 이 줄을 숨긴다
                  <>
                    <dt>
                      <Icon name="card" size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                      {PAY_METHOD_LABELS[payMethod]}로
                    </dt>
                    <dd className="num">{quote ? formatWon(pgAmount) : '–'}</dd>
                  </>
                )}
                <dt>구매확정 시 적립</dt>
                <dd className={`num ${styles.earn}`}>{quote ? `+${formatPoint(quote.expectedEarnPoint)}` : '–'}</dd>
              </dl>
            )}
            {limitExceeded ? (
              <p className={styles.notice} role="alert">
                <Icon name="alert" size={14} />
                {payMethod === 'DEPOSIT'
                  ? '부족한 금액이 계좌이체로 한 번에 충전할 수 있는 한도를 넘어요. 예치금을 먼저 충전하거나 카드·간편결제를 골라 주세요.'
                  : '계좌이체로 한 번에 결제할 수 있는 한도를 넘어요. 카드·간편결제를 골라 주세요.'}
              </p>
            ) : null}
            <Button
              variant="highlight"
              size="lg"
              fullWidth
              disabled={!selected.length || !quoteReady || limitExceeded}
              onClick={() => setConfirmOpen(true)}
            >
              {formatWon(payTotal)} 결제하기
            </Button>
            {payMethod === 'DEPOSIT' && shortage > 0 ? (
              <Button variant="outline" size="sm" fullWidth onClick={() => setChargeOpen(true)}>
                예치금을 먼저 충전할래요
              </Button>
            ) : null}
            <p className={styles.rule}>
              {/* 최소 충전 금액 때문에 부족분보다 많이 충전될 때만 차액이 어디로 가는지 알린다 */}
              {!limitExceeded && payMethod === 'DEPOSIT' && pgAmount > shortage && shortage > 0
                ? `부족한 금액은 ${formatWon(shortage)}이지만 최소 충전 금액인 ${formatWon(pgAmount)}이 충전되고, 남는 ${formatWon(pgAmount - shortage)}은 예치금에 남아요. `
                : ''}
              결제한 금액은 구매확정 전까지 찐막이 보관해요(에스크로). 구매확정하면 판매자에게, 환불되면 결제한 수단으로
              돌아와요.
            </p>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`${formatWon(payTotal)}을 결제할까요?`}
        confirmLabel="결제"
        loading={payMutation.isPending}
        onConfirm={() => payMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      >
        {/* 무엇으로 얼마가 나가는지만 알린다 */}
        {quote ? (
          <dl className={`${styles.rows} ${styles.confirmRows}`}>
            {quote.pointUseAmount > 0 ? (
              <>
                <dt>포인트</dt>
                <dd className="num">{formatPoint(quote.pointUseAmount)}</dd>
              </>
            ) : null}
            {quote.walletUseAmount > 0 ? (
              <>
                <dt>예치금</dt>
                <dd className="num">{formatWon(quote.walletUseAmount)}</dd>
              </>
            ) : null}
            {pgAmount > 0 ? (
              <>
                <dt>{payMethod === 'DEPOSIT' ? '계좌이체 충전' : PAY_METHOD_LABELS[payMethod]}</dt>
                <dd className="num">{formatWon(pgAmount)}</dd>
              </>
            ) : null}
            {payMethod === 'DEPOSIT' && pgAmount > shortage ? (
              <>
                <dt>충전하고 남는 예치금</dt>
                <dd className="num">{formatWon(pgAmount - shortage)}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </ConfirmDialog>
      <ChargeDialog
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        onCharged={() => void queryClient.invalidateQueries({ queryKey: ['payment', 'quote'] })}
        suggested={shortage || undefined}
        returnTo="/cart"
      />
    </div>
  )
}
