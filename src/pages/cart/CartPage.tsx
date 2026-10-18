import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { cartApi, walletApi } from '@/api/endpoints'
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
import styles from './CartPage.module.css'

/** 결제 기한이 이만큼 안 남으면 강조 (6시간) */
const DUE_HOT_MS = 6 * 3600000

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
  const shortage = Math.max(0, payTotal - balance)

  const payMutation = useMutation<null, ApiError>({
    mutationFn: () => cartApi.pay(selected.map((item) => item.productId)),
    onSuccess: () => {
      setConfirmOpen(false)
      toast(`${selected.length}건 결제했어요. 판매자가 발송하면 알려드릴게요.`, {
        tone: 'success',
        action: { label: '구매 주문', to: '/me/orders' },
      })
      void queryClient.invalidateQueries()
      navigate('/me/orders')
    },
    onError: (error) => {
      setConfirmOpen(false)
      if (error.code === 'WALLET201') setChargeOpen(true)
      toast(error.code === 'WALLET201' ? '예치금이 부족해요. 충전한 뒤 다시 결제해 주세요.' : error.message, {
        tone: 'error',
      })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

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
        <DevApiNote ids={['cart.list', 'cart.pay', 'wallet.me']} />
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
              <dt>결제 후 잔액</dt>
              <dd className={`num ${shortage ? styles.short : ''}`}>
                {shortage ? `${formatWon(shortage)} 부족` : formatWon(balance - payTotal)}
              </dd>
            </dl>
            {shortage ? (
              <Button variant="highlight" size="lg" fullWidth onClick={() => setChargeOpen(true)}>
                {formatWon(shortage)} 충전하고 결제하기
              </Button>
            ) : (
              <Button
                variant="highlight"
                size="lg"
                fullWidth
                disabled={!selected.length}
                onClick={() => setConfirmOpen(true)}
              >
                {formatWon(payTotal)} 결제하기
              </Button>
            )}
            <p className={styles.rule}>
              결제한 금액은 구매확정 전까지 찐막이 보관해요(에스크로). 구매확정하면 판매자에게, 환불되면 내 지갑으로
              돌아와요.
            </p>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`${formatWon(payTotal)}을 예치금으로 결제할까요?`}
        confirmLabel="결제하기"
        loading={payMutation.isPending}
        onConfirm={() => payMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      >
        {selected.length}개 상품 · 결제 후 잔액 {formatWon(balance - payTotal)}
        <br />
        상품마다 주문이 하나씩 만들어지고, 판매자가 송장을 등록하면 배송이 시작돼요.
      </ConfirmDialog>
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} suggested={shortage || undefined} />
    </div>
  )
}
