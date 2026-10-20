import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { paymentApi } from '@/api/endpoints'
import { LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { formatWon } from '@/lib/format'
import { readTossSuccessParams } from '@/lib/toss'
import type { PaymentSummary } from '@/types/payment'
import styles from './CartPage.module.css'

/**
 * /cart/payment/success — 장바구니 결제에서 부족분을 토스 결제창으로 결제하고 돌아오는 곳.
 * 쿼리(paymentKey, orderId=pgOrderId, amount=부족분)를 그대로 POST /payments/confirm 에 넘긴다.
 * 승인되면 토스 승인 → 부족분 충전 → 주문 대금 홀딩까지 한 번에 끝나고, 주문 상태는 결제 완료 이벤트로 바뀐다.
 * 새로고침으로 같은 요청이 다시 가도 백엔드가 멱등 처리한다.
 */
export function PaymentSuccessPage() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const params = readTossSuccessParams(search)
  const started = useRef(false)

  const confirm = useMutation<PaymentSummary, ApiError>({
    mutationFn: () => {
      if (!params) throw new Error('결제 정보가 없어요.')
      return paymentApi.confirmPayment({ pgOrderId: params.orderId, paymentKey: params.paymentKey, amount: params.amount })
    },
    onSuccess: (payment) => {
      toast(`${payment.orderCount}건 결제했어요. 판매자가 발송하면 알려드릴게요.`, {
        tone: 'success',
        action: { label: '구매 주문', to: '/me/orders' },
      })
      // 주문 상태는 결제 완료 이벤트로 바뀌므로 목록·장바구니·지갑을 모두 다시 불러온다
      void queryClient.invalidateQueries()
      navigate('/me/orders', { replace: true })
    },
  })

  // StrictMode 의 이중 실행에서도 승인 요청은 한 번만 보낸다
  useEffect(() => {
    if (started.current || !params) return
    started.current = true
    confirm.mutate()
  }, [])

  const toCart = (
    <LinkButton to="/cart" variant="highlight" size="sm">
      장바구니로 돌아가기
    </LinkButton>
  )

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.title}>주문 결제</h1>
        <DevApiNote ids={['payment.confirm']} />
      </div>

      {!params ? (
        <EmptyState
          icon="alert"
          title="결제 정보가 없어요"
          description="결제창에서 돌아온 주소가 아니에요. 장바구니에서 다시 결제해 주세요."
          action={toCart}
        />
      ) : confirm.isError ? (
        <EmptyState
          icon="alert"
          title="결제를 완료하지 못했어요"
          description={
            <>
              {confirm.error.message}
              {confirm.error.pgMessage ? ` (${confirm.error.pgMessage})` : null}
              <br />
              {confirm.error.retryable
                ? '장바구니에서 다시 결제하기를 누르면 이어서 결제할 수 있어요.'
                : '카드로 결제된 금액이 있다면 자동으로 취소돼요. 장바구니에서 다시 결제해 주세요.'}
            </>
          }
          action={toCart}
        />
      ) : (
        <EmptyState
          icon="cart"
          title="결제를 확인하고 있어요"
          description={`카드 결제 ${formatWon(params.amount)}을 승인하고 주문을 완료하는 중이에요. 잠시만 기다려 주세요.`}
          action={<Spinner label="승인 중" />}
        />
      )}
    </div>
  )
}
