import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { paymentApi, walletApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ChargeDialog } from '@/components/ChargeDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { formatDateTime, formatWon } from '@/lib/format'
import { CHARGE_PURPOSE_LABELS, CHARGE_STATUS_LABELS } from '@/lib/labels'
import type { Tone } from '@/lib/status'
import type { ChargeStatus, ChargeSummary } from '@/types/payment'
import styles from './MyPage.module.css'

/** 충전 내역 한 페이지 크기 */
const PAGE_SIZE = 10

/** 충전 상태별 배지 색 */
const CHARGE_TONES: Record<ChargeStatus, Tone> = {
  REQUESTED: 'scheduled',
  CHARGED: 'live',
  USED: 'neutral',
  CANCELED: 'ended',
  ABORTED: 'ended',
}

/** /me/wallet 예치금 (원본 sO) */
export function MyWalletPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [chargeOpen, setChargeOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<ChargeSummary | null>(null)
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me })
  const chargesQuery = useQuery({
    queryKey: ['wallet', 'charges', page],
    queryFn: () => paymentApi.charges({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const balance = walletQuery.data?.balance ?? 0

  /** 충전 취소: 예치금에서 충전액을 빼고 토스 결제를 취소한다. 잔액이 충전액보다 적으면 백엔드가 거절한다 */
  const cancel = useMutation<ChargeSummary, ApiError, number>({
    mutationFn: (chargeId) => paymentApi.cancelCharge(chargeId),
    onSuccess: (charge) => {
      toast(`${formatWon(charge.amount)} 충전을 취소했어요. 결제하신 카드로 환불돼요.`, { tone: 'success' })
      setCancelTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
    onError: (error) => {
      toast(error.pgMessage ? `${error.message} (${error.pgMessage})` : error.message, { tone: 'error' })
      setCancelTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
  // 에스크로 보관 중 금액은 홀딩 합계(heldTotal)만 필요해서 1건만 받는다
  const holdingsQuery = useQuery({
    queryKey: ['wallet', 'holdings', 'BUYER'],
    queryFn: () => walletApi.holdings({ role: 'BUYER', size: 1 }),
  })

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>예치금</h1>
      </div>
      <p className={styles.headSub}>
        입찰한 경매가 낙찰되면 예치금으로 결제해요. 결제 금액은 구매확정 전까지 찐막이 보관(에스크로)해요.
      </p>
      <DevApiNote
        ids={['wallet.me', 'wallet.holdings', 'payment.chargeRequest', 'payment.chargeConfirm', 'payment.charges', 'payment.chargeCancel']}
      />

      <div className={styles.summaryCards}>
        <div className={`${styles.sumCard} ${styles.sumCardDark}`}>
          <span className={styles.sumLabel}>사용 가능한 예치금</span>
          <span className={`${styles.sumValue} num`}>
            {walletQuery.data ? formatWon(walletQuery.data.balance) : '–'}
          </span>
          {walletQuery.data && walletQuery.data.settlementBalance > 0 && (
            <span className={styles.sumSub}>
              정산금 {formatWon(walletQuery.data.settlementBalance)} 별도 보관 (결제에는 쓰이지 않아요)
            </span>
          )}
          <div className={styles.sumActions}>
            <Button variant="highlight" size="sm" onClick={() => setChargeOpen(true)}>
              충전하기
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="출금 API 준비 중"
              style={{ background: 'transparent', color: 'var(--white)', borderColor: '#ffffff59' }}
            >
              출금 (준비 중)
            </Button>
          </div>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>에스크로 보관 중</span>
          <span className={`${styles.sumValue} num`}>
            {holdingsQuery.data ? formatWon(holdingsQuery.data.heldTotal) : '–'}
          </span>
          <span className={styles.sumSub}>결제했지만 아직 판매자에게 정산되지 않은 금액</span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>결제 방식</span>
          <span className={styles.sumValue} style={{ fontSize: 16, lineHeight: '22px' }}>
            토스페이먼츠로 충전
          </span>
          <span className={styles.sumSub}>카드 · 계좌이체 · 간편결제</span>
        </div>
      </div>

      <p className={styles.sectionTitle}>충전 내역</p>
      {chargesQuery.isLoading ? (
        <Spinner block />
      ) : chargesQuery.isError ? (
        <ErrorState message={chargesQuery.error.message} onRetry={() => void chargesQuery.refetch()} />
      ) : chargesQuery.data?.content.length ? (
        <div className={styles.list}>
          {chargesQuery.data.content.map((charge) => {
            const canCancel = charge.cancelable && balance >= charge.amount
            return (
              <div key={charge.chargeId} className={styles.row} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    <Badge tone={CHARGE_TONES[charge.status]}>{CHARGE_STATUS_LABELS[charge.status]}</Badge>
                    <span className={`${styles.rowMeta} num`}>{formatDateTime(charge.approvedAt ?? charge.requestedAt)}</span>
                  </div>
                  <p className={styles.rowTitle}>
                    {CHARGE_PURPOSE_LABELS[charge.purpose]}
                    {charge.method ? ` · ${charge.method}` : ''}
                  </p>
                  <p className={styles.rowMeta}>
                    {charge.status === 'ABORTED' && charge.failureMessage
                      ? charge.failureMessage
                      : charge.status === 'CHARGED' && charge.usedAmount > 0
                        ? `${formatWon(charge.usedAmount)} 사용 · 일부 사용된 충전은 취소할 수 없어요`
                        : charge.status === 'CHARGED' && !canCancel && charge.cancelable
                          ? '잔액이 충전액보다 적어 지금은 취소할 수 없어요'
                          : charge.status === 'REQUESTED'
                            ? '결제창에서 결제가 끝나지 않았어요. 40분 뒤 자동으로 정리돼요'
                            : null}
                    {charge.receiptUrl ? (
                      <>
                        {' '}
                        <a href={charge.receiptUrl} target="_blank" rel="noreferrer">
                          영수증
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <span className={`${styles.amount} num ${charge.status === 'CHARGED' ? styles.plus : ''}`}>
                    {charge.status === 'CANCELED' ? '−' : '+'}
                    {formatWon(charge.amount)}
                  </span>
                  {canCancel ? (
                    <Button variant="outline" size="sm" onClick={() => setCancelTarget(charge)}>
                      충전 취소
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon="wallet" title="아직 충전 내역이 없어요" description="충전하면 여기부터 기록돼요." />
      )}
      <Pagination
        page={page}
        totalPages={Math.ceil((chargesQuery.data?.totalElements ?? 0) / PAGE_SIZE)}
        onChange={setPage}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title={cancelTarget ? `${formatWon(cancelTarget.amount)} 충전을 취소할까요?` : ''}
        confirmLabel="충전 취소"
        confirmVariant="outline"
        loading={cancel.isPending}
        onConfirm={() => cancelTarget && cancel.mutate(cancelTarget.chargeId)}
        onClose={() => setCancelTarget(null)}
      >
        예치금에서 {cancelTarget ? formatWon(cancelTarget.amount) : ''}이 빠지고, 결제하신 카드로 환불돼요.
        <br />
        취소 후 잔액 {cancelTarget ? formatWon(balance - cancelTarget.amount) : ''}
      </ConfirmDialog>
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} />
    </>
  )
}
