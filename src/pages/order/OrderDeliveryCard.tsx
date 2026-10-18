import type { UseQueryResult } from '@tanstack/react-query'
import { DevApiNote } from '@/components/DevApiNote'
import { Spinner } from '@/components/Spinner'
import { formatDateTime } from '@/lib/format'
import { CARRIER_LABELS, DELIVERY_CODE_LABELS, DELIVERY_PROGRESS_CODES } from '@/lib/labels'
import type { DeliveryStatus } from '@/types/order'
import styles from './OrderDetailPage.module.css'

interface OrderDeliveryCardProps {
  query: UseQueryResult<DeliveryStatus>
}

/** 주문 상세의 배송 카드 (원본 SO 안). 진행 단계 5개 중 현재 위치를 표시 */
export function OrderDeliveryCard({ query }: OrderDeliveryCardProps) {
  const delivery = query.data
  // DELIVERED 면 전부 완료, 진행 단계에 없는 코드(예외 등)면 -1
  const progressIndex = delivery
    ? delivery.code === 'DELIVERED'
      ? DELIVERY_PROGRESS_CODES.length
      : DELIVERY_PROGRESS_CODES.indexOf(delivery.code)
    : -1

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>배송</h2>
      <DevApiNote ids={['delivery.status']} />
      {query.isLoading ? (
        <Spinner block />
      ) : delivery ? (
        <>
          <p className={`${styles.muted} num`}>
            {delivery.carrier ? CARRIER_LABELS[delivery.carrier] : ''} {delivery.waybill ?? ''} ·{' '}
            {formatDateTime(delivery.updatedAt)} 갱신
          </p>
          <ol className={styles.track}>
            {DELIVERY_PROGRESS_CODES.map((code, index) => (
              <li
                key={code}
                className={index < progressIndex ? styles.trackDone : index === progressIndex ? styles.trackNow : ''}
              >
                <span className={styles.trackDot} />
                <span>{DELIVERY_CODE_LABELS[code]}</span>
              </li>
            ))}
          </ol>
          {progressIndex < 0 ? <p className={styles.muted}>현재 상태: {delivery.message}</p> : null}
        </>
      ) : (
        <p className={styles.muted}>배송 정보를 불러오지 못했어요.</p>
      )}
    </section>
  )
}
