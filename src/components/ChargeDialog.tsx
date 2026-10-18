import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { walletApi } from '@/api/endpoints'
import { formatAmountInput, formatWon, parseDigits } from '@/lib/format'
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

/** 예치금 충전 모달 (원본 yA). 1,000원 이상·1,000원 단위·200만 원 이하 */
export function ChargeDialog({ open, onClose, suggested, onCharged }: ChargeDialogProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [amountText, setAmountText] = useState('')

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

  const charge = useMutation({
    mutationFn: () => walletApi.charge(amount),
    onSuccess: (wallet) => {
      toast(`${formatWon(amount)} 충전했어요. 잔액 ${formatWon(wallet.balance)}`, { tone: 'success' })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onClose()
      onCharged?.()
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  })

  return (
    <Dialog
      open={open}
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
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>목업: 토스페이먼츠 결제창 대신 바로 충전돼요.</p>
      <DevApiNote ids={['wallet.charge']} />
    </Dialog>
  )
}
