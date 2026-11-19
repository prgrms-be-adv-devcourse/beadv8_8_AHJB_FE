import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { paymentApi } from '@/api/endpoints'
import { Button, LinkButton } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState } from '@/components/EmptyState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { formatWon } from '@/lib/format'
import { orderPaymentCompletePath, readTossSuccessParams } from '@/lib/toss'
import type { PaymentSummary } from '@/types/payment'
import styles from './CartPage.module.css'

/**
 * 승인 실패 코드별 추가 안내. 여기 있는 코드는 토스 승인 전에 거절되거나(돈이 움직이지 않음) 백엔드가 결제를 이미 취소한 경우다.
 * 없는 코드는 retryable 여부로 안내한다
 */
const FAILURE_GUIDES: Record<string, string> = {
  PAYMENT013: '결제 기한이 지났거나 주문이 정리된 결제예요. 결제된 금액은 없어요.',
  CHARGE012: '결제수단이나 포인트 사용액을 바꿔 다시 결제를 요청하면 이전 결제창은 쓸 수 없어요. 결제된 금액은 없어요.',
  WALLET204: '결제창에 있는 동안 포인트가 줄었어요. 결제된 금액은 없고, 장바구니에서 포인트 사용액을 다시 정해 결제할 수 있어요.',
  WALLET201: '결제창에 있는 동안 예치금이 줄었어요. 결제된 금액은 없고, 장바구니에서 다시 결제하면 부족한 금액을 다시 계산해요.',
  CHARGE009: '장바구니에서 다시 결제하기를 눌러 계좌이체로 결제해 주세요.',
}

/** 같은 결제를 처리하는 중이라 잠시 뒤 같은 요청을 다시 보내면 되는 실패 */
const IN_PROGRESS_CODE = 'PAYMENT014'

/**
 * /cart/payment/success — 장바구니 결제에서 토스 결제창(예치금 부족분 충전 또는 직접 결제)을 거치고 돌아오는 곳.
 * 쿼리(paymentKey, orderId=pgOrderId, amount=결제창 금액)를 그대로 POST /payments/confirm 에 넘긴다.
 * 승인되면 토스 승인 → (부족분 충전) → 주문 대금 홀딩까지 한 번에 끝나고, 주문 상태는 결제 완료 이벤트로 바뀐다.
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
    // 승인이 실패해도 토스 승인·충전까지는 됐을 수 있으니 잔액은 서버 기준으로 다시 불러온다
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['payment', 'quote'] })
    },
    onSuccess: (payment) => {
      toast(`${payment.orderCount}건 결제했어요. 판매자가 발송하면 알려드릴게요.`, {
        tone: 'success',
        action: { label: '구매 주문', to: '/me/orders' },
      })
      // 주문 상태는 결제 완료 이벤트로 바뀌므로 목록·장바구니·지갑을 모두 다시 불러온다
      void queryClient.invalidateQueries()
      navigate(orderPaymentCompletePath(payment.orderGroupId), { replace: true })
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
              {confirm.error.code === IN_PROGRESS_CODE
                ? '같은 결제가 처리되는 중이에요. 잠시 뒤 다시 확인을 눌러 주세요.'
                : (FAILURE_GUIDES[confirm.error.code] ??
                  (confirm.error.retryable
                    ? '장바구니에서 다시 결제하기를 누르면 이어서 결제할 수 있어요.'
                    : '결제된 금액이 있다면 자동으로 취소돼요. 장바구니에서 다시 결제해 주세요.'))}
            </>
          }
          action={
            confirm.error.code === IN_PROGRESS_CODE ? (
              <Button variant="highlight" size="sm" onClick={() => confirm.mutate()}>
                다시 확인
              </Button>
            ) : (
              toCart
            )
          }
        />
      ) : (
        <EmptyState
          icon="cart"
          title="결제를 확인하고 있어요"
          description={`결제 ${formatWon(params.amount)}을 승인하고 주문을 완료하는 중이에요. 잠시만 기다려 주세요.`}
          action={<Spinner label="승인 중" />}
        />
      )}
    </div>
  )
}
