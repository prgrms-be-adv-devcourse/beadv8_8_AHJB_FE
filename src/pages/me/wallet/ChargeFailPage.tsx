import { useSearchParams } from 'react-router-dom'
import { LinkButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { readReturnTo, readTossFailParams } from '@/lib/toss'
import styles from '../MyPage.module.css'

/**
 * /me/wallet/charge/fail — 토스 결제창에서 결제가 실패하거나 사용자가 취소했을 때 돌아오는 곳.
 * 백엔드에 남은 REQUESTED 충전 건은 스케줄러가 정리하므로 여기서 따로 할 일은 없다.
 */
export function ChargeFailPage() {
  const [search] = useSearchParams()
  const { code, message } = readTossFailParams(search)
  const returnTo = readReturnTo(search, '/me/wallet')
  const canceledByUser = code === 'PAY_PROCESS_CANCELED'

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>예치금 충전</h1>
      </div>

      <EmptyState
        icon="alert"
        title={canceledByUser ? '충전을 취소했어요' : '충전하지 못했어요'}
        description={
          canceledByUser ? (
            '결제창을 닫아서 충전이 진행되지 않았어요. 예치금은 바뀌지 않았어요.'
          ) : (
            <>
              {message}
              <br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>오류 코드 {code}</span>
            </>
          )
        }
        action={
          <LinkButton to={returnTo} variant="highlight" size="sm">
            {returnTo === '/cart' ? '장바구니로 돌아가기' : '예치금으로 돌아가기'}
          </LinkButton>
        }
      />
    </>
  )
}
