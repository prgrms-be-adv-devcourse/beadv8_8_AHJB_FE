import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { settlementApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { DevApiNote } from '@/components/DevApiNote'
import { Dialog } from '@/components/Dialog'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { Pagination } from '@/components/Pagination'
import { Spinner } from '@/components/Spinner'
import { Stepper } from '@/components/Stepper'
import { useNow } from '@/lib/clock'
import { formatDateTime, formatDday, formatKoreanDate, formatWon } from '@/lib/format'
import { SETTLEMENT_STATUS_META } from '@/lib/status'
import type { SettlementStatus } from '@/types/settlement'
import styles from './MyPage.module.css'

/** 정산 목록 한 페이지 크기 (원본 dp) */
const PAGE_SIZE = 10

const STATUS_TABS: Array<SettlementStatus | undefined> = [undefined, 'PENDING', 'COMPLETED']

/** /me/settlements 정산 (원본 nO) */
export function MySettlementsPage() {
  const now = useNow()
  const [status, setStatus] = useState<SettlementStatus | undefined>(undefined)
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['settlements', 'list', status, page],
    queryFn: () => settlementApi.list({ status, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  // 요약 카드용: 상태 구분 없이 최대 50건
  const allQuery = useQuery({
    queryKey: ['settlements', 'all'],
    queryFn: () => settlementApi.list({ size: 50 }),
  })
  const pending = (allQuery.data?.content ?? []).filter((item) => item.status === 'PENDING')
  const completed = (allQuery.data?.content ?? []).filter((item) => item.status === 'COMPLETED')
  const nextPayoutDate = pending.map((item) => item.payoutDate).sort()[0]
  const nextPayoutAmount = pending
    .filter((item) => item.payoutDate === nextPayoutDate)
    .reduce((sum, item) => sum + item.settlementAmount, 0)

  const detail = useQuery({
    queryKey: ['settlements', 'detail', detailId],
    queryFn: () => settlementApi.detail(detailId as number),
    enabled: !!detailId,
  }).data

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>정산</h1>
      </div>
      <p className={styles.headSub}>
        구매확정된 판매 대금은 확정한 달의 다음 달 15일에 지갑으로 들어와요. 수수료는 낙찰가의 10%, 배송비는 전액
        정산돼요.
      </p>
      <DevApiNote ids={['settlement.list', 'settlement.detail']} />

      <div className={styles.summaryCards}>
        <div className={`${styles.sumCard} ${styles.sumCardDark}`}>
          <span className={styles.sumLabel}>다음 지급 {nextPayoutDate ? `· ${formatKoreanDate(nextPayoutDate)}` : ''}</span>
          <span className={`${styles.sumValue} num`}>{formatWon(nextPayoutAmount)}</span>
          <span className={`${styles.sumSub} num`}>
            {nextPayoutDate
              ? `${formatDday(nextPayoutDate, now)} · ${pending.filter((item) => item.payoutDate === nextPayoutDate).length}건`
              : '예정된 지급이 없어요'}
          </span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>정산 예정 전체</span>
          <span className={`${styles.sumValue} num`}>
            {formatWon(pending.reduce((sum, item) => sum + item.settlementAmount, 0))}
          </span>
          <span className={`${styles.sumSub} num`}>{pending.length}건</span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>지금까지 정산 완료</span>
          <span className={`${styles.sumValue} num`}>
            {formatWon(completed.reduce((sum, item) => sum + item.settlementAmount, 0))}
          </span>
          <span className={`${styles.sumSub} num`}>
            {completed.length}건 · <Link to="/me/wallet">지갑에서 보기</Link>
          </span>
        </div>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Chip
            key={tab ?? 'all'}
            selected={status === tab}
            onClick={() => {
              setStatus(tab)
              setPage(0)
            }}
          >
            {tab ? SETTLEMENT_STATUS_META[tab].label : '전체'}
          </Chip>
        ))}
      </div>

      {listQuery.isLoading ? (
        <Spinner block />
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error.message} onRetry={() => listQuery.refetch()} />
      ) : listQuery.data?.content.length ? (
        <div className={styles.list}>
          {listQuery.data.content.map((item) => (
            <button
              key={item.settlementId}
              type="button"
              className={`${styles.row} ${styles.rowLink}`}
              style={{
                display: 'grid',
                width: '100%',
                border: 0,
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                gridTemplateColumns: 'minmax(0,1fr) auto',
              }}
              onClick={() => setDetailId(item.settlementId)}
            >
              <div className={styles.rowBody}>
                <div className={styles.rowTop}>
                  <Badge tone={SETTLEMENT_STATUS_META[item.status].tone}>
                    {SETTLEMENT_STATUS_META[item.status].label}
                  </Badge>
                  <span className={`${styles.rowMeta} num`}>정산서 {item.settlementId}</span>
                </div>
                <p className={styles.rowTitle}>{item.productName}</p>
                <p className={`${styles.rowMeta} num`}>
                  지급일 {formatKoreanDate(item.payoutDate)}{' '}
                  {item.status === 'PENDING' ? `· ${formatDday(item.payoutDate, now)}` : ''}
                </p>
              </div>
              <div className={styles.rowSide}>
                <span className={`${styles.amount} num`}>{formatWon(item.settlementAmount)}</span>
                <span className={styles.rowMeta}>
                  상세 <Icon name="chevronRight" size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="receipt"
          title="정산 내역이 없어요"
          description="판매한 상품이 구매확정되면 정산서가 만들어져요."
        />
      )}
      <Pagination
        page={page}
        totalPages={Math.ceil((listQuery.data?.totalElements ?? 0) / PAGE_SIZE)}
        onChange={setPage}
      />

      <Dialog
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title="정산서"
        description={detail ? detail.productName : undefined}
      >
        {detail ? (
          <>
            <Stepper
              steps={['구매확정', '정산 예정', '지급 완료']}
              current={detail.status === 'COMPLETED' ? 3 : 1}
              tone={detail.status === 'COMPLETED' ? 'muted' : 'teal'}
            />
            <dl className={styles.breakdown}>
              <dt>낙찰가</dt>
              <dd className="num">{formatWon(detail.winningPrice)}</dd>
              <dt>플랫폼 수수료 (10%)</dt>
              <dd className={`num ${styles.minus}`}>−{formatWon(detail.feeAmount)}</dd>
              <dt>배송비 (구매자 부담분)</dt>
              <dd className={`num ${styles.plus}`}>+{formatWon(detail.deliveryFee)}</dd>
              <dt className={styles.breakdownTotal}>정산 금액</dt>
              <dd className={`${styles.breakdownTotal} num`}>{formatWon(detail.settlementAmount)}</dd>
            </dl>
            <dl className={styles.breakdown}>
              <dt>구매확정</dt>
              <dd className="num">{formatDateTime(detail.confirmedAt)}</dd>
              <dt>지급일</dt>
              <dd className="num">
                {formatKoreanDate(detail.payoutDate)} 03:00{' '}
                {detail.status === 'PENDING' ? `(${formatDday(detail.payoutDate, now)})` : ''}
              </dd>
              <dt>지급 완료</dt>
              <dd className="num">{detail.completedAt ? formatDateTime(detail.completedAt) : '-'}</dd>
              <dt>주문</dt>
              <dd>
                <Link to={`/orders/${detail.orderId}?as=seller`} onClick={() => setDetailId(null)}>
                  주문 {detail.orderId} 보기
                </Link>
              </dd>
            </dl>
          </>
        ) : (
          <Spinner block />
        )}
      </Dialog>
    </>
  )
}
