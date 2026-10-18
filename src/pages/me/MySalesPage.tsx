import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/api/endpoints'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { OrderCard } from '@/components/order/OrderCard'
import { SendProductDialog } from '@/components/order/SendProductDialog'
import { Spinner } from '@/components/Spinner'
import type { Order, OrderState } from '@/types/order'
import styles from './MyPage.module.css'

type SalesFilterId = 'all' | 'send' | 'shipping' | 'refund' | 'done'

/** 판매 주문 탭 (원본 up). states 가 없으면 전체 */
const SALES_FILTERS: Array<{ id: SalesFilterId; label: string; states?: OrderState[] }> = [
  { id: 'all', label: '전체' },
  { id: 'send', label: '발송 대기', states: ['PAID'] },
  { id: 'shipping', label: '배송 중 · 배송 완료', states: ['SHIPPING', 'SHIPPED', 'DELIVERY_ERROR'] },
  { id: 'refund', label: '환불 요청', states: ['REFUND_REQUESTED'] },
  { id: 'done', label: '구매확정 · 환불', states: ['CONFIRMED', 'REFUNDED'] },
]

/** /me/sales 판매 주문 (원본 tO) */
export function MySalesPage() {
  const [filterId, setFilterId] = useState<SalesFilterId>('all')
  const [sendTarget, setSendTarget] = useState<Order | null>(null)
  const ordersQuery = useQuery({
    queryKey: ['orders', 'seller'],
    queryFn: () => orderApi.seller({ size: 50 }),
    refetchInterval: 8000,
  })

  const states = SALES_FILTERS.find((filter) => filter.id === filterId)?.states
  const orders = (ordersQuery.data ?? []).filter((order) => !states || states.includes(order.state))
  const countOf = (filter: (typeof SALES_FILTERS)[number]) =>
    (ordersQuery.data ?? []).filter((order) => !filter.states || filter.states.includes(order.state)).length

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>판매 주문</h1>
        <LinkButton to="/me/settlements" variant="outline" size="sm">
          정산 보기
        </LinkButton>
      </div>
      <DevApiNote ids={['order.seller', 'order.send', 'refund.byOrder']} />
      <div className={styles.tabs}>
        {SALES_FILTERS.map((filter) => (
          <Chip key={filter.id} selected={filterId === filter.id} onClick={() => setFilterId(filter.id)}>
            {filter.label} <span className="num">{ordersQuery.data ? countOf(filter) : ''}</span>
          </Chip>
        ))}
      </div>
      {ordersQuery.isLoading ? (
        <Spinner block />
      ) : ordersQuery.isError ? (
        <ErrorState message={ordersQuery.error.message} onRetry={() => ordersQuery.refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="box"
          title="이 목록엔 주문이 없어요"
          description="낙찰자가 결제하면 판매 주문이 생겨요. 결제 후 송장을 등록해 주세요."
        />
      ) : (
        <div className={styles.list}>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} role="seller" onSend={setSendTarget} />
          ))}
        </div>
      )}
      <SendProductDialog order={sendTarget} onClose={() => setSendTarget(null)} />
    </>
  )
}
