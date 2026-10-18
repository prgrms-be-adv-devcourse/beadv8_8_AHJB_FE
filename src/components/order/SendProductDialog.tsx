import { useState } from 'react'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { Dialog } from '@/components/Dialog'
import { Field, Input, Select } from '@/components/form/Field'
import { CARRIERS, CARRIER_LABELS } from '@/lib/labels'
import type { Carrier, Order } from '@/types/order'
import { useOrderActions } from './useOrderActions'

const WAYBILL_PATTERN = /^[0-9]{9,14}$/

interface SendProductDialogProps {
  /** 있으면 열린다 */
  order: Order | null | undefined
  onClose: () => void
}

/** 송장 등록 모달 (원본 jA). 운송장 번호는 숫자만 9–14자리 */
export function SendProductDialog({ order, onClose }: SendProductDialogProps) {
  const { send } = useOrderActions()
  const [carrier, setCarrier] = useState<Carrier>('CJ')
  const [waybillText, setWaybillText] = useState('')
  const [touched, setTouched] = useState(false)
  const waybill = waybillText.replace(/\D/g, '')
  const error = touched && !WAYBILL_PATTERN.test(waybill) ? '운송장 번호는 숫자 9–14자리예요. (DELIVERY_005)' : null

  return (
    <Dialog
      open={!!order}
      onClose={onClose}
      title="송장 등록"
      description={
        order
          ? `${order.productName ?? `상품 #${order.productId}`} · 등록하면 택배사 웹훅으로 배송 상태가 자동 갱신돼요.`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="highlight"
            loading={send.isPending}
            onClick={() => {
              setTouched(true)
              if (!order || !WAYBILL_PATTERN.test(waybill)) return
              send.mutate(
                { id: order.id, carrier, waybill },
                {
                  onSuccess: () => {
                    setWaybillText('')
                    setTouched(false)
                    onClose()
                  },
                },
              )
            }}
          >
            발송 처리
          </Button>
        </>
      }
    >
      <Field label="택배사">
        {(id) => (
          <Select id={id} value={carrier} onChange={(event) => setCarrier(event.target.value as Carrier)}>
            {CARRIERS.map((key) => (
              <option key={key} value={key}>
                {CARRIER_LABELS[key]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="운송장 번호" error={error} hint="하이픈 없이 숫자만">
        {(id, describedBy) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            inputMode="numeric"
            value={waybillText}
            onChange={(event) => setWaybillText(event.target.value)}
            onBlur={() => setTouched(true)}
            invalid={!!error}
          />
        )}
      </Field>
      <DevApiNote ids={['order.send']} />
    </Dialog>
  )
}
