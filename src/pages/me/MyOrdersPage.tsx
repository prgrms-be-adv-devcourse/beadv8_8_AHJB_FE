import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/api/endpoints'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { OrderCard } from '@/components/order/OrderCard'
import { ORDER_FILTERS, type OrderFilterId } from '@/components/order/constants'
import { Spinner } from '@/components/Spinner'
import styles from './MyPage.module.css'

type OrderFilter = (typeof ORDER_FILTERS)[number]

/** 구매 주문 /me/orders (원본 KI) */
export function MyOrdersPage() {
  const [filterId, setFilterId] = useState<OrderFilterId>('all')
  const ordersQuery = useQuery({
    queryKey: ['orders', 'winner'],
    queryFn: () => orderApi.winner({ size: 50 }),
    refetchInterval: 10000,
  })

  const states = ORDER_FILTERS.find((filter) => filter.id === filterId)!.states
  const visibleOrders = (ordersQuery.data ?? []).filter((order) => !states || states.includes(order.state))
  const countOf = (filter: OrderFilter) =>
    (ordersQuery.data ?? []).filter((order) => !filter.states || filter.states.includes(order.state)).length

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>구매 주문</h1>
        <LinkButton to="/cart" variant="outline" size="sm">
          장바구니
        </LinkButton>
      </div>
      <DevApiNote ids={['order.winner']} />
      <div className={styles.tabs}>
        {ORDER_FILTERS.map((filter) => (
          <Chip key={filter.id} selected={filterId === filter.id} onClick={() => setFilterId(filter.id)}>
            {filter.label} <span className="num">{ordersQuery.data ? countOf(filter) : ''}</span>
          </Chip>
        ))}
      </div>
      {ordersQuery.isLoading ? (
        <Spinner block />
      ) : ordersQuery.isError ? (
        <ErrorState message={ordersQuery.error.message} onRetry={() => ordersQuery.refetch()} />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          icon="truck"
          title="이 목록엔 주문이 없어요"
          description="장바구니에서 낙찰 상품을 결제하면 주문이 만들어져요."
        />
      ) : (
        <div className={styles.list}>
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} role="buyer" />
          ))}
        </div>
      )}
    </>
  )
}
