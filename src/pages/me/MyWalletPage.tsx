import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { walletApi } from '@/api/endpoints'
import { Button } from '@/components/Button'
import { ChargeDialog } from '@/components/ChargeDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { formatWon } from '@/lib/format'
import styles from './MyPage.module.css'

/** /me/wallet 예치금 (원본 sO) */
export function MyWalletPage() {
  const [chargeOpen, setChargeOpen] = useState(false)
  const walletQuery = useQuery({ queryKey: ['wallet'], queryFn: walletApi.me })
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
      <DevApiNote ids={['wallet.me', 'wallet.holdings', 'payment.chargeRequest', 'payment.chargeConfirm']} />

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

      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} />
    </>
  )
}
