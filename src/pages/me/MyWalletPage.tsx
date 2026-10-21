import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '@/api/client'
import { paymentApi, walletApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ChargeDialog } from '@/components/ChargeDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip } from '@/components/form/Field'
import { Pagination } from '@/components/Pagination'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { formatDateTime, formatWon } from '@/lib/format'
import {
  CHARGE_PURPOSE_LABELS,
  CHARGE_STATUS_LABELS,
  HIDDEN_LEDGER_TYPES,
  WALLET_ACCOUNT_LABELS,
  WITHDRAWAL_STATUS_LABELS,
  describeLedgerEntry,
} from '@/lib/labels'
import type { Tone } from '@/lib/status'
import type { ChargeStatus, ChargeSummary } from '@/types/payment'
import type { Withdrawal, WithdrawalStatus } from '@/types/wallet'
import styles from './MyPage.module.css'

/** 내역 한 페이지 크기 */
const PAGE_SIZE = 10

/** 카드 아래 내역 탭. 기본은 충전 내역 */
type HistoryTab = 'charges' | 'withdrawals' | 'ledger'
const HISTORY_TABS: Array<{ id: HistoryTab; label: string }> = [
  { id: 'charges', label: '충전 내역' },
  { id: 'withdrawals', label: '출금 내역' },
  { id: 'ledger', label: '예치금 내역' },
]

/** 출금 상태별 배지 색 */
const WITHDRAWAL_TONES: Record<WithdrawalStatus, Tone> = {
  REQUESTED: 'scheduled',
  COMPLETED: 'ended',
  FAILED: 'ended',
}

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
  const { me } = useAuth()
  const isSeller = !!me?.isSeller
  const [chargeOpen, setChargeOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [tab, setTab] = useState<HistoryTab>('charges')
  const [page, setPage] = useState(0)
  const [withdrawalPage, setWithdrawalPage] = useState(0)
  const [ledgerPage, setLedgerPage] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<ChargeSummary | null>(null)
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me })
  // 판매자: 받을 예정 금액(정산 전 홀딩 합계). 합계만 필요해서 1건만 받는다
  const sellerHoldingsQuery = useQuery({
    queryKey: ['wallet', 'holdings', 'SELLER'],
    queryFn: () => walletApi.holdings({ role: 'SELLER', size: 1 }),
    enabled: isSeller,
  })
  const withdrawalsQuery = useQuery({
    queryKey: ['wallet', 'withdrawals', withdrawalPage],
    queryFn: () => walletApi.withdrawals({ page: withdrawalPage, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: tab === 'withdrawals',
  })
  // 예치금 내역: 원장을 은행 입출금 내역처럼. 수수료·시스템 지갑 전용 유형은 화면에서 숨긴다
  const ledgerQuery = useQuery({
    queryKey: ['wallet', 'ledger', ledgerPage],
    queryFn: () => walletApi.ledger({ page: ledgerPage, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: tab === 'ledger',
  })
  const chargesQuery = useQuery({
    queryKey: ['wallet', 'charges', page],
    queryFn: () => paymentApi.charges({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const balance = walletQuery.data?.balance ?? 0
  // 결제창만 열고 나온 건(REQUESTED)은 사용자에겐 "충전"이 아니므로 숨긴다. 백엔드 스케줄러가 알아서 정리한다
  const visibleCharges = chargesQuery.data?.content.filter((c) => c.status !== 'REQUESTED') ?? []
  /** 출금하면 이전 충전을 취소할 수 없게 되므로, 지금 취소할 수 있는 충전 건 수를 모달에서 알려 준다 */
  const cancelableCount = chargesQuery.data?.content.filter((c) => c.cancelable && balance >= c.amount).length ?? 0

  /** 예치금 전액 출금(명목상). 실제 송금은 없고 잔액이 0 이 되며 출금 내역에 남는다 */
  const withdraw = useMutation<Withdrawal, ApiError>({
    mutationFn: () => walletApi.withdraw(),
    onSuccess: (w) => {
      toast(`${formatWon(w.amount)}을 등록 계좌로 출금했어요.`, { tone: 'success' })
      setWithdrawOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
    onError: (error) => {
      toast(error.message, { tone: 'error' })
      setWithdrawOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })

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

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>예치금</h1>
      </div>
      <DevApiNote
        ids={[
          'wallet.me',
          'wallet.holdings',
          'wallet.ledger',
          'wallet.withdraw',
          'wallet.withdrawals',
          'payment.chargeRequest',
          'payment.chargeConfirm',
          'payment.charges',
          'payment.chargeCancel',
        ]}
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
              disabled={!walletQuery.data || balance <= 0}
              title={balance <= 0 ? '출금할 예치금이 없어요' : '예치금 전액을 등록 계좌로 출금해요'}
              style={{ background: 'transparent', color: 'var(--white)', borderColor: '#ffffff59' }}
              onClick={() => setWithdrawOpen(true)}
            >
              출금
            </Button>
          </div>
        </div>
        {isSeller ? (
          <div className={styles.sumCard}>
            <span className={styles.sumLabel}>정산 예정 금액</span>
            <span className={`${styles.sumValue} num`}>
              {sellerHoldingsQuery.data ? formatWon(sellerHoldingsQuery.data.heldTotal) : '–'}
            </span>
            <span className={styles.sumSub}>
              판매한 주문의 수수료 제외 금액
              {sellerHoldingsQuery.data && sellerHoldingsQuery.data.settleableTotal > 0
                ? ` · 구매확정 완료 ${formatWon(sellerHoldingsQuery.data.settleableTotal)}`
                : ''}
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.tabs} style={{ marginTop: 'var(--space-20)' }}>
        {HISTORY_TABS.map((t) => (
          <Chip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      {tab === 'charges' ? (
        <>
          {chargesQuery.isLoading ? (
            <Spinner block />
          ) : chargesQuery.isError ? (
            <ErrorState message={chargesQuery.error.message} onRetry={() => void chargesQuery.refetch()} />
          ) : visibleCharges.length ? (
            <div className={styles.list}>
              {visibleCharges.map((charge) => {
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
        </>
      ) : tab === 'withdrawals' ? (
        <>
          {withdrawalsQuery.isLoading ? (
            <Spinner block />
          ) : withdrawalsQuery.isError ? (
            <ErrorState message={withdrawalsQuery.error.message} onRetry={() => void withdrawalsQuery.refetch()} />
          ) : withdrawalsQuery.data?.content.length ? (
            <div className={styles.list}>
              {withdrawalsQuery.data.content.map((w) => (
                <div key={w.withdrawalId} className={styles.row} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <div className={styles.rowBody}>
                    <div className={styles.rowTop}>
                      <Badge tone={WITHDRAWAL_TONES[w.status]}>{WITHDRAWAL_STATUS_LABELS[w.status]}</Badge>
                      <span className={`${styles.rowMeta} num`}>{formatDateTime(w.completedAt ?? w.requestedAt)}</span>
                    </div>
                    <p className={styles.rowTitle}>예치금 전액 출금 · 등록 계좌</p>
                    {w.status === 'FAILED' && w.failureReason ? <p className={styles.rowMeta}>{w.failureReason}</p> : null}
                  </div>
                  <div className={styles.rowSide}>
                    <span className={`${styles.amount} num`}>−{formatWon(w.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
      ) : (
            <EmptyState icon="wallet" title="아직 출금 내역이 없어요" description="출금하면 여기부터 기록돼요." />
          )}
          <Pagination
            page={withdrawalPage}
            totalPages={Math.ceil((withdrawalsQuery.data?.totalElements ?? 0) / PAGE_SIZE)}
            onChange={setWithdrawalPage}
          />
        </>
      ) : (
        <>
          {ledgerQuery.isLoading ? (
            <Spinner block />
          ) : ledgerQuery.isError ? (
            <ErrorState message={ledgerQuery.error.message} onRetry={() => void ledgerQuery.refetch()} />
          ) : ledgerQuery.data?.content.some((tx) => !HIDDEN_LEDGER_TYPES.has(tx.type)) ? (
            <div className={styles.list}>
              {ledgerQuery.data.content
                .filter((tx) => !HIDDEN_LEDGER_TYPES.has(tx.type))
                .map((tx) => (
                  <div key={tx.id} className={styles.row} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                    <div className={styles.rowBody}>
                      <div className={styles.rowTop}>
                        <Badge tone={tx.amount > 0 ? 'live' : 'neutral'}>{tx.amount > 0 ? '입금' : '출금'}</Badge>
                        <span className={`${styles.rowMeta} num`}>{formatDateTime(tx.createdAt)}</span>
                      </div>
                      <p className={styles.rowTitle}>
                        {describeLedgerEntry(tx)}
                        {tx.referenceType === 'ORDER' && tx.referenceId != null ? (
                          <>
                            {' · '}
                            <Link to={`/orders/${tx.referenceId}`}>주문 #{tx.referenceId}</Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className={styles.rowSide}>
                      <span className={`${styles.amount} num ${tx.amount > 0 ? styles.plus : ''}`}>
                        {tx.amount > 0 ? '+' : '−'}
                        {formatWon(Math.abs(tx.amount))}
                      </span>
                      <span className={`${styles.rowMeta} num`}>
                        {tx.account === 'SETTLEMENT' ? `${WALLET_ACCOUNT_LABELS.SETTLEMENT} 잔액` : '잔액'}{' '}
                        {formatWon(tx.balanceAfter)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
      ) : (
            <EmptyState icon="wallet" title="아직 예치금 내역이 없어요" description="충전·결제·환불이 생기면 여기부터 기록돼요." />
          )}
          <Pagination
            page={ledgerPage}
            totalPages={Math.ceil((ledgerQuery.data?.totalElements ?? 0) / PAGE_SIZE)}
            onChange={setLedgerPage}
          />
        </>
      )}

      <ConfirmDialog
        open={withdrawOpen}
        title={`${formatWon(balance)}을 출금할까요?`}
        confirmLabel="출금하기"
        loading={withdraw.isPending}
        onConfirm={() => withdraw.mutate()}
        onClose={() => setWithdrawOpen(false)}
      >
        예치금 전액이 등록하신 계좌로 출금되고 잔액이 0원이 돼요. 정산금은 출금되지 않아요.
        {cancelableCount > 0 ? (
          <>
            <br />
            <strong>취소할 수 있는 충전 {cancelableCount}건이 있어요.</strong> 출금하면 이전 충전은 더 이상 취소할 수 없으니,
            카드 환불을 원하시면 먼저 충전 취소를 해 주세요.
          </>
        ) : null}
      </ConfirmDialog>
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
