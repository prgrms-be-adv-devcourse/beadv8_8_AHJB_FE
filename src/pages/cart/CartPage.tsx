import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { isRealApi } from '@/api/config'
import { cartApi, paymentApi, walletApi } from '@/api/endpoints'
import { tokenStore } from '@/api/tokenStore'
import { Button, LinkButton } from '@/components/Button'
import { ChargeDialog } from '@/components/ChargeDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Checkbox } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Img } from '@/components/Img'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatCountdown, formatDateTime, formatRelativeTime, formatWon } from '@/lib/format'
import {
  ORDER_PAYMENT_FAIL_PATH,
  ORDER_PAYMENT_SUCCESS_PATH,
  TOSS_USER_CANCEL,
  closeTossPaymentWindow,
  openTossPaymentWindow,
  tossErrorCode,
} from '@/lib/toss'
import styles from './CartPage.module.css'

/** 결제 기한이 이만큼 안 남으면 강조 (6시간) */
const DUE_HOT_MS = 6 * 3600000

const SHORTAGE_MESSAGE = '예치금이 부족해요. 충전한 뒤 다시 결제해 주세요.'

/** 결제 요청 결과. PAID = 끝남, REDIRECTED = 토스 결제창으로 이동 중(이 페이지를 떠난다) */
type PayOutcome = 'PAID' | 'REDIRECTED'

/** 장바구니 (/cart, 원본 wC) — 낙찰 상품 결제 */
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
  const items = cartQuery.data ?? []

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

  // 결제 전 견적: 예치금에서 얼마, 카드로 얼마 나가는지. 응답 전에는 잔액으로 직접 계산한 값을 쓴다
  const quoteQuery = useQuery({
    queryKey: ['payment', 'quote', payTotal],
    queryFn: () => paymentApi.quote(payTotal),
    enabled: payTotal > 0,
  })
  const shortage = quoteQuery.data?.shortage ?? Math.max(0, payTotal - balance)
  const walletUse = quoteQuery.data?.walletUseAmount ?? payTotal - shortage

  /**
   * 결제하기. 예치금이 충분하면 cart.pay 한 번으로 끝난다.
   * 부족하면 cart.pay 가 isPaid:false + 결제창 파라미터(data)를 주고, 그걸로 토스 결제창을 띄운다.
   * 결제창에서 돌아오는 /cart/payment/success 가 POST /payments/confirm 으로 승인한다.
   * 목업이면 결제창 없이 바로 승인까지 끝낸다.
   */
  const payMutation = useMutation<PayOutcome, ApiError>({
    mutationFn: async () => {
      const result = await cartApi.pay(selected.map((item) => item.productId))
      if (!result || result.isPaid) return 'PAID'
      if (!result.data) {
        throw new Error('결제창 정보를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      }
      const { pgOrderId, chargeAmount, orderName, paymentId } = result.data
      if (!isRealApi('payment.confirm')) {
        // 목업: 토스 결제창을 거치지 않고 바로 승인
        await paymentApi.confirmPayment({ pgOrderId, paymentKey: `mock_${paymentId}`, amount: chargeAmount })
        return 'PAID'
      }
      // 확인 모달(<dialog>)이 결제창을 가리므로 먼저 닫는다
      setConfirmOpen(false)
      await openTossPaymentWindow({
        pgOrderId,
        amount: chargeAmount,
        orderName,
        customerEmail: tokenStore.getProfile()?.email,
        successPath: ORDER_PAYMENT_SUCCESS_PATH,
        failPath: ORDER_PAYMENT_FAIL_PATH,
      })
      return 'REDIRECTED'
    },
    onSuccess: (outcome) => {
      setConfirmOpen(false)
      if (outcome !== 'PAID') return
      toast(`${selected.length}건 결제했어요. 판매자가 발송하면 알려드릴게요.`, {
        tone: 'success',
        action: { label: '구매 주문', to: '/me/orders' },
      })
      void queryClient.invalidateQueries()
      navigate('/me/orders')
    },
    onError: (error) => {
      setConfirmOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      // 결제창을 닫은 건 에러가 아니다. 만들어진 주문은 다시 결제하기로 이어가거나 1시간 뒤 정리된다
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
        <DevApiNote ids={['cart.list', 'cart.pay', 'wallet.me', 'payment.quote', 'payment.confirm']} />
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
            <dl className={styles.walletBox}>
              <dt>
                <Icon name="wallet" size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> 예치금 잔액
              </dt>
              <dd className="num">{walletQuery.data ? formatWon(balance) : '–'}</dd>
              {shortage ? (
                <>
                  <dt>예치금으로</dt>
                  <dd className="num">{formatWon(walletUse)}</dd>
                  <dt>
                    <Icon name="card" size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> 카드로
                  </dt>
                  <dd className={`num ${styles.short}`}>{formatWon(shortage)}</dd>
                </>
              ) : (
                <>
                  <dt>결제 후 잔액</dt>
                  <dd className="num">{formatWon(balance - payTotal)}</dd>
                </>
              )}
            </dl>
            <Button
              variant="highlight"
              size="lg"
              fullWidth
              disabled={!selected.length}
              onClick={() => setConfirmOpen(true)}
            >
              {formatWon(payTotal)} 결제하기
            </Button>
            {shortage ? (
              <Button variant="outline" size="sm" fullWidth onClick={() => setChargeOpen(true)}>
                예치금을 먼저 충전할래요
              </Button>
            ) : null}
            <p className={styles.rule}>
              {shortage
                ? '부족한 금액은 토스페이먼츠 결제창에서 카드로 결제돼요. 예치금과 카드 결제분을 합쳐 결제가 완료돼요. '
                : ''}
              결제한 금액은 구매확정 전까지 찐막이 보관해요(에스크로). 구매확정하면 판매자에게, 환불되면 내 지갑으로
              돌아와요.
            </p>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={shortage ? `${formatWon(payTotal)}을 결제할까요?` : `${formatWon(payTotal)}을 예치금으로 결제할까요?`}
        confirmLabel={shortage ? '결제창 열기' : '결제하기'}
        loading={payMutation.isPending}
        onConfirm={() => payMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      >
        {shortage ? (
          <>
            {selected.length}개 상품 · 예치금 {formatWon(walletUse)} + 카드 {formatWon(shortage)}
            <br />
            토스페이먼츠 결제창에서 부족한 {formatWon(shortage)}만 카드로 결제하면 주문이 완료돼요.
          </>
        ) : (
          <>
            {selected.length}개 상품 · 결제 후 잔액 {formatWon(balance - payTotal)}
          </>
        )}
        <br />
        상품마다 주문이 하나씩 만들어지고, 판매자가 송장을 등록하면 배송이 시작돼요.
      </ConfirmDialog>
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} suggested={shortage || undefined} />
    </div>
  )
}
