import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { walletApi } from '@/api/endpoints'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ChargeDialog } from '@/components/ChargeDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { Spinner } from '@/components/Spinner'
import { formatDateTime, formatWon } from '@/lib/format'
import { TRANSACTION_TYPE_LABELS } from '@/lib/labels'
import type { Tone } from '@/lib/status'
import type { TransactionType } from '@/types/wallet'
import styles from './MyPage.module.css'

/** 거래 내역 한 페이지 크기 (원본 fp) */
const PAGE_SIZE = 15

/** 거래 유형별 배지 색 (원본 rO) */
const TRANSACTION_TONES: Record<TransactionType, Tone> = {
  CHARGE: 'live',
  HOLD_PAY: 'neutral',
  SETTLEMENT_RECEIVE: 'won',
  REFUND_RECEIVE: 'scheduled',
  CHARGE_CANCEL: 'ended',
  REVERSAL: 'ended',
}

/** /me/wallet 예치금 (원본 sO) */
export function MyWalletPage() {
  const [page, setPage] = useState(0)
  const [chargeOpen, setChargeOpen] = useState(false)
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me })
  const txQuery = useQuery({
    queryKey: ['wallet', 'tx', page],
    queryFn: () => walletApi.transactions({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>예치금</h1>
      </div>
      <p className={styles.headSub}>
        입찰한 경매가 낙찰되면 예치금으로 결제해요. 결제 금액은 구매확정 전까지 찐막이 보관(에스크로)해요.
      </p>
      <DevApiNote ids={['wallet.me', 'wallet.transactions', 'wallet.charge']} />

      <div className={styles.summaryCards}>
        <div className={`${styles.sumCard} ${styles.sumCardDark}`}>
          <span className={styles.sumLabel}>사용 가능한 예치금</span>
          <span className={`${styles.sumValue} num`}>
            {walletQuery.data ? formatWon(walletQuery.data.balance) : '–'}
          </span>
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
            {walletQuery.data ? formatWon(walletQuery.data.heldAmount) : '–'}
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

      <p className={styles.sectionTitle}>입출금 내역</p>
      {txQuery.isLoading ? (
        <Spinner block />
      ) : txQuery.isError ? (
        <ErrorState message={txQuery.error.message} onRetry={() => txQuery.refetch()} />
      ) : txQuery.data?.content.length ? (
        <div className={styles.list}>
          {txQuery.data.content.map((tx) => (
            <div key={tx.transactionId} className={styles.row} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div className={styles.rowBody}>
                <div className={styles.rowTop}>
                  <Badge tone={TRANSACTION_TONES[tx.type] ?? 'neutral'}>{TRANSACTION_TYPE_LABELS[tx.type]}</Badge>
                  <span className={`${styles.rowMeta} num`}>{formatDateTime(tx.createdAt)}</span>
                </div>
                <p className={styles.rowTitle}>{tx.description}</p>
              </div>
              <div className={styles.rowSide}>
                <span className={`${styles.amount} num ${tx.amount > 0 ? styles.plus : ''}`}>
                  {tx.amount > 0 ? '+' : '−'}
                  {formatWon(Math.abs(tx.amount))}
                </span>
                <span className={`${styles.rowMeta} num`}>잔액 {formatWon(tx.balanceAfter)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="wallet" title="아직 내역이 없어요" description="충전하면 여기부터 기록돼요." />
      )}
      <Pagination
        page={page}
        totalPages={Math.ceil((txQuery.data?.totalElements ?? 0) / PAGE_SIZE)}
        onChange={setPage}
      />
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} />
    </>
  )
}
