import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cartApi } from '@/api/endpoints'
import { LinkButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { readTossFailParams } from '@/lib/toss'
import styles from './CartPage.module.css'

/**
 * /cart/payment/fail — 장바구니 결제의 토스 결제창에서 결제가 실패하거나 사용자가 취소했을 때 돌아오는 곳.
 * 여기로는 토스가 준 실패 코드만 온다 (우리 백엔드의 승인 실패는 /cart/payment/success 가 안내한다).
 * 결제창 단계에서는 포인트 · 예치금이 아직 움직이지 않았다.
 * orderGroupId 쿼리가 있으면 POST /api/v1/cart 로 주문 그룹을 바로 놓아준다. 다시 결제하면 새 주문 그룹으로 시작한다.
 */
export function PaymentFailPage() {
  const [search] = useSearchParams()
  const { code, message } = readTossFailParams(search)
  const canceledByUser = code === 'PAY_PROCESS_CANCELED'
  const orderGroupId = Number(search.get('orderGroupId'))
  const cancelStarted = useRef(false)

  useEffect(() => {
    if (cancelStarted.current || !orderGroupId) return
    cancelStarted.current = true
    void cartApi.cancelPayment(orderGroupId).catch(() => undefined)
  }, [orderGroupId])

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>주문 결제</h1>
      </div>

      <EmptyState
        icon="alert"
        title={canceledByUser ? '결제를 취소했어요' : '결제하지 못했어요'}
        description={
          canceledByUser ? (
            '결제창을 닫아서 결제가 진행되지 않았어요. 포인트와 예치금은 빠져나가지 않았고, 장바구니에서 다시 결제할 수 있어요.'
          ) : (
            <>
              {message}
              <br />
              포인트와 예치금은 빠져나가지 않았어요. 장바구니에서 결제수단을 바꿔 다시 결제할 수 있어요.
              <br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>오류 코드 {code}</span>
            </>
          )
        }
        action={
          <LinkButton to="/cart" variant="highlight" size="sm">
            장바구니로 돌아가기
          </LinkButton>
        }
      />
    </div>
  )
}
