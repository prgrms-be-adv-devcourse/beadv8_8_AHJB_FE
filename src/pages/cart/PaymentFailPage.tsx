import { useSearchParams } from 'react-router-dom'
import { LinkButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { readTossFailParams } from '@/lib/toss'
import styles from './CartPage.module.css'

/**
 * /cart/payment/fail — 장바구니 결제의 토스 결제창에서 결제가 실패하거나 사용자가 취소했을 때 돌아오는 곳.
 * 주문은 결제 대기(WAITING)로 남아 있어 장바구니에서 다시 결제하면 이어진다. 결제 대기 주문·충전 건은 백엔드 스케줄러가 정리한다.
 */
export function PaymentFailPage() {
  const [search] = useSearchParams()
  const { code, message } = readTossFailParams(search)
  const canceledByUser = code === 'PAY_PROCESS_CANCELED'

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
            '결제창을 닫아서 결제가 진행되지 않았어요. 예치금은 빠져나가지 않았고, 장바구니에서 다시 결제할 수 있어요.'
          ) : (
            <>
              {message}
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
