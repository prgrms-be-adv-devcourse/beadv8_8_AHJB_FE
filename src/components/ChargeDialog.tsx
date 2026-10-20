import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isRealApi } from '@/api/config'
import { paymentApi } from '@/api/endpoints'
import { tokenStore } from '@/api/tokenStore'
import { formatAmountInput, formatWon, parseDigits } from '@/lib/format'
import { TOSS_USER_CANCEL, closeTossPaymentWindow, openTossPaymentWindow, tossErrorCode } from '@/lib/toss'
import type { ChargeSummary } from '@/types/payment'
import { Button } from './Button'
import { DevApiNote } from './DevApiNote'
import { Dialog } from './Dialog'
import { Chip, Field, Input } from './form/Field'
import { useToast } from './Toast'

/** 빠른 금액 추가 칩 (원본 $P) */
const QUICK_AMOUNTS = [10000, 50000, 100000, 300000]

interface ChargeDialogProps {
  open: boolean
  onClose: () => void
  /** 모자란 금액. 있으면 1,000원 단위로 올려 미리 채운다 */
  suggested?: number
  onCharged?: () => void
}

/**
 * 예치금 충전 모달 (원본 yA). 1,000원 이상·1,000원 단위·200만 원 이하.
 *
 * 실제: 충전 요청(POST /payments/charges) → 토스 결제창 → successUrl(/me/wallet/charge/success)에서 승인.
 *       결제창으로 페이지가 이동하므로 이 컴포넌트에서 끝나지 않는다.
 * 목업: 결제창 없이 충전 요청 → 바로 승인(POST /payments/charges/confirm)까지 끝낸다.
 */
export function ChargeDialog({ open, onClose, suggested, onCharged }: ChargeDialogProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [amountText, setAmountText] = useState('')
  // 토스 결제창이 떠 있는 동안 true. 이 모달은 <dialog>.showModal() 로 최상위 레이어에 떠서 결제창을 가리기 때문에
  // 결제창을 여는 동안은 닫아 두고, 사용자가 결제창을 닫으면 입력값을 그대로 둔 채 다시 연다.
  const [tossOpen, setTossOpen] = useState(false)
  const mock = !isRealApi('payment.chargeRequest')

  useEffect(() => {
    if (open) setAmountText(suggested ? (Math.ceil(suggested / 1000) * 1000).toLocaleString('ko-KR') : '')
  }, [open, suggested])

  const amount = parseDigits(amountText)
  const error = amount
    ? amount < 1000
      ? '1,000원 이상 충전할 수 있어요.'
      : amount % 1000 !== 0
        ? '1,000원 단위로 충전해 주세요.'
        : amount > 2000000
          ? '한 번에 200만 원까지 충전할 수 있어요.'
          : null
    : null

  const charge = useMutation<ChargeSummary | null, Error>({
    mutationFn: async () => {
      const requested = await paymentApi.requestCharge(amount)
      if (mock) {
        // 목업: 토스 결제창을 거치지 않고 바로 승인
        return paymentApi.confirmCharge({
          pgOrderId: requested.pgOrderId,
          paymentKey: `mock_${requested.chargeId}`,
          amount: requested.amount,
        })
      }
      // 실제: 결제창으로 이동. 성공하면 successUrl 로 페이지가 바뀌어 여기로 돌아오지 않는다
      setTossOpen(true)
      try {
        await openTossPaymentWindow({
          pgOrderId: requested.pgOrderId,
          amount: requested.amount,
          orderName: requested.orderName,
          customerEmail: tokenStore.getProfile()?.email,
        })
      } finally {
        // 결제창이 닫혔다(취소·오류). 금액 입력 모달을 다시 보여 준다
        setTossOpen(false)
      }
      return null
    },
    onSuccess: (confirmed) => {
      if (!confirmed) return
      toast(`${formatWon(confirmed.amount)} 충전했어요.`, { tone: 'success' })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onClose()
      onCharged?.()
    },
    onError: (err) => {
      // 사용자가 결제창을 닫은 건 에러가 아니다. 백엔드에 남은 REQUESTED 충전은 스케줄러가 정리한다
      if (tossErrorCode(err) === TOSS_USER_CANCEL) return
      toast(err.message, { tone: 'error' })
    },
  })

  // 결제창 → 성공/실패 페이지로 갔다가 뒤로가기로 돌아오면(bfcache 복원) 이 컴포넌트는 "결제창 열림·요청 진행 중" 상태 그대로 살아난다.
  // 남아 있는 결제창을 닫고 진행 중 표시를 풀어서 금액 입력 모달로 되돌린다.
  const resetCharge = useRef(charge.reset)
  resetCharge.current = charge.reset
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      void closeTossPaymentWindow()
      setTossOpen(false)
      resetCharge.current()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  return (
    <Dialog
      open={open && !tossOpen}
      onClose={onClose}
      title="예치금 충전"
      description="입찰·결제는 예치금으로만 해요. 카드·계좌이체로 충전하면 바로 쓸 수 있어요."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="highlight"
            disabled={!amount || !!error}
            loading={charge.isPending}
            onClick={() => charge.mutate()}
          >
            {amount ? `${formatWon(amount)} 충전하기` : '충전하기'}
          </Button>
        </>
      }
    >
      <Field
        label="충전 금액"
        error={error}
        hint={suggested ? `결제하려면 ${formatWon(suggested)}이 더 필요해요.` : '1,000원 단위'}
      >
        {(id, describedBy) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            inputSize="lg"
            inputMode="numeric"
            suffix="원"
            autoFocus
            value={amountText}
            onChange={(event) => setAmountText(formatAmountInput(event.target.value))}
            invalid={!!error}
          />
        )}
      </Field>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_AMOUNTS.map((quick) => (
          <Chip key={quick} selected={false} onClick={() => setAmountText((amount + quick).toLocaleString('ko-KR'))}>
            +{(quick / 10000).toLocaleString('ko-KR')}만
          </Chip>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {mock ? '목업: 토스페이먼츠 결제창 대신 바로 충전돼요.' : '충전하기를 누르면 토스페이먼츠 결제창으로 이동해요.'}
      </p>
      <DevApiNote ids={['payment.chargeRequest', 'payment.chargeConfirm']} />
    </Dialog>
  )
}
