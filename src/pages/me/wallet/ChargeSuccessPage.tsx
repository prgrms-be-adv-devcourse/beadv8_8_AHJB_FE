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
import { readReturnTo, readTossSuccessParams } from '@/lib/toss'
import type { ChargeSummary } from '@/types/payment'
import styles from '../MyPage.module.css'

/**
 * /me/wallet/charge/success — 토스 결제창에서 결제를 마치고 돌아오는 곳.
 * 쿼리(paymentKey, orderId, amount)를 그대로 백엔드 승인 API 에 넘기고, 성공하면 예치금 화면으로 돌아간다.
 * 새로고침으로 같은 요청이 다시 가도 백엔드가 멱등 처리한다.
 */
export function ChargeSuccessPage() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const params = readTossSuccessParams(search)
  // 장바구니에서 충전을 시작했으면 /cart 로, 아니면 예치금 화면으로 돌아간다
  const returnTo = readReturnTo(search, '/me/wallet')
  const started = useRef(false)

  const confirm = useMutation<ChargeSummary, ApiError>({
    mutationFn: () => {
      if (!params) throw new Error('결제 정보가 없어요.')
      return paymentApi.confirmCharge({ pgOrderId: params.orderId, paymentKey: params.paymentKey, amount: params.amount })
    },
    // 승인이 실패해도 토스 승인·충전까지는 됐을 수 있으니 잔액은 서버 기준으로 다시 불러온다
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
    onSuccess: (charge) => {
      toast(`${formatWon(charge.amount)} 충전했어요.`, { tone: 'success' })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      navigate(returnTo, { replace: true })
    },
  })

  // StrictMode 의 이중 실행에서도 승인 요청은 한 번만 보낸다
  useEffect(() => {
    if (started.current || !params) return
    started.current = true
    confirm.mutate()
  }, [])

  const backButton = (
    <LinkButton to={returnTo} variant="highlight" size="sm">
      {returnTo === '/cart' ? '장바구니로 돌아가기' : '예치금으로 돌아가기'}
    </LinkButton>
  )

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>예치금 충전</h1>
      </div>
      <DevApiNote ids={['payment.chargeConfirm']} />

      {!params ? (
        <EmptyState
          icon="alert"
          title="결제 정보가 없어요"
          description="결제창에서 돌아온 주소가 아니에요. 예치금 화면에서 다시 충전해 주세요."
          action={backButton}
        />
      ) : confirm.isError ? (
        <EmptyState
          icon="alert"
          title="충전을 완료하지 못했어요"
          description={
            <>
              {confirm.error.message}
              {confirm.error.pgMessage ? ` (${confirm.error.pgMessage})` : null}
              <br />
              {confirm.error.retryable
                ? '다시 충전하면 해결할 수 있어요.'
                : '결제된 금액이 있다면 카드사로 자동 취소돼요.'}
            </>
          }
          action={backButton}
        />
      ) : (
        <EmptyState
          icon="wallet"
          title="충전을 확인하고 있어요"
          description={`${formatWon(params.amount)} 결제를 승인하는 중이에요. 잠시만 기다려 주세요.`}
          action={<Spinner label="승인 중" />}
        />
      )}
    </>
  )
}
