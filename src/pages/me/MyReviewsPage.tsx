import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DevApiNote } from '@/components/DevApiNote'
import { Dialog } from '@/components/Dialog'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { Chip, Field, Textarea } from '@/components/form/Field'
import { Icon } from '@/components/Icon'
import { productPath } from '@/components/ProductCard'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useNow } from '@/lib/clock'
import { formatDday, formatDotDate, formatRating, formatRelativeTime, formatWon } from '@/lib/format'
import type { Review, ReviewableOrder } from '@/types/review'
import styles from './MyPage.module.css'

type ReviewTab = 'reviewable' | 'written' | 'received'

const STARS = [1, 2, 3, 4, 5]

/** 읽기 전용 별점 (0.5 단위 부분 채움) (원본 cp) */
function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} aria-label={`5점 만점에 ${value}점`}>
      {STARS.map((star) => {
        const fill = Math.max(0, Math.min(1, value - (star - 1)))
        return (
          <span
            key={star}
            style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}
          >
            <Icon name="star" size={size} style={{ position: 'absolute', color: 'var(--border)' }} />
            <span style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, overflow: 'hidden' }}>
              <Icon name="star" size={size} filled />
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** 별점 입력 (별 하나를 왼쪽/오른쪽 반으로 나눠 0.5 단위) (원본 _I) */
function StarRatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value

  return (
    <div className={styles.starInput}>
      <div className={styles.starBtns} role="radiogroup" aria-label="별점" onMouseLeave={() => setHover(null)}>
        {STARS.map((star) => {
          const fill = Math.max(0, Math.min(1, shown - (star - 1)))
          return (
            <span key={star} className={styles.starBtn}>
              <Icon name="star" size={32} />
              <span className={styles.starFill} style={{ width: `${fill * 100}%` }}>
                <Icon name="star" size={32} filled />
              </span>
              {[star - 0.5, star].map((point, half) => (
                <button
                  key={point}
                  type="button"
                  role="radio"
                  aria-checked={value === point}
                  aria-label={`${point}점`}
                  className={`${styles.starHalf} ${half === 0 ? styles.starHalfL : styles.starHalfR}`}
                  style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
                  onMouseEnter={() => setHover(point)}
                  onFocus={() => setHover(point)}
                  onBlur={() => setHover(null)}
                  onClick={() => onChange(point)}
                />
              ))}
            </span>
          )
        })}
      </div>
      <strong className="num" style={{ fontSize: 18 }}>
        {shown ? shown.toFixed(1) : '-'}
      </strong>
    </div>
  )
}

interface ReviewDialogProps {
  /** 새로 쓸 주문 (있으면 열림) */
  target: ReviewableOrder | null
  /** 고칠 후기 (있으면 열림) */
  editing: Review | null
  onClose: () => void
}

/** 후기 쓰기/수정 모달 (원본 $I) */
function ReviewDialog({ target, editing, onClose }: ReviewDialogProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const open = !!target || !!editing

  useEffect(() => {
    if (open) {
      setRating(editing?.rating ?? 0)
      setContent(editing?.content ?? '')
    }
  }, [open, editing])

  const save = useMutation({
    mutationFn: () =>
      editing
        ? reviewApi.update(editing.reviewId, { rating, content: content.trim() })
        : reviewApi.create({ orderId: target!.orderId, rating, content: content.trim() }),
    onSuccess: () => {
      toast(editing ? '후기를 고쳤어요.' : '후기를 남겼어요. 고마워요!', { tone: 'success' })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['reviewable'] })
      onClose()
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? '후기 수정' : '후기 쓰기'}
      description={
        target
          ? `${target.productName} · 판매자 ${target.sellerNickname}`
          : editing
            ? `${editing.productName} · 판매자 ${editing.targetNickname}`
            : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="highlight"
            disabled={!rating || !content.trim()}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {editing ? '저장' : '후기 남기기'}
          </Button>
        </>
      }
    >
      <StarRatingInput value={rating} onChange={setRating} />
      <Field label="후기" hint={`${content.length}/1000 · 상품 상태, 포장, 응답 속도를 알려 주세요.`}>
        {(id, describedBy) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            rows={5}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
      </Field>
      <DevApiNote ids={editing ? ['review.update'] : ['review.create']} />
    </Dialog>
  )
}

const linkButtonStyle = {
  border: 0,
  background: 'none',
  cursor: 'pointer',
  textDecoration: 'underline',
} as const

/** /me/reviews 후기 (작성 가능 · 쓴 후기 · 받은 후기) (원본 eO) */
export function MyReviewsPage() {
  const { me } = useAuth()
  const now = useNow()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<ReviewTab>('reviewable')
  const [writeTarget, setWriteTarget] = useState<ReviewableOrder | null>(null)
  const [editTarget, setEditTarget] = useState<Review | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)

  const reviewableQuery = useQuery({ queryKey: ['reviewable'], queryFn: reviewApi.reviewable })
  const writtenQuery = useQuery({
    queryKey: ['reviews', 'written'],
    queryFn: () => reviewApi.written({ size: 50 }),
  })
  const receivedQuery = useQuery({
    queryKey: ['reviews', 'received'],
    queryFn: () => reviewApi.received({ size: 50 }),
  })

  const remove = useMutation({
    mutationFn: (reviewId: number) => reviewApi.remove(reviewId),
    onSuccess: () => {
      toast('후기를 지웠어요. 지운 주문엔 다시 쓸 수 없어요.')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  const received = receivedQuery.data?.reviews ?? []
  const averageRating = received.length
    ? received.reduce((sum, review) => sum + review.rating, 0) / received.length
    : null
  const activeQuery: {
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => unknown
  } = tab === 'reviewable' ? reviewableQuery : tab === 'written' ? writtenQuery : receivedQuery
  const reviews = tab === 'written' ? writtenQuery.data?.reviews : received

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>후기</h1>
      </div>
      <DevApiNote
        ids={
          tab === 'reviewable'
            ? ['review.reviewable', 'review.create']
            : tab === 'written'
              ? ['review.written', 'review.update', 'review.delete']
              : ['review.received']
        }
      />
      <div className={styles.tabs}>
        <Chip selected={tab === 'reviewable'} onClick={() => setTab('reviewable')}>
          작성 가능 <span className="num">{reviewableQuery.data?.length ?? ''}</span>
        </Chip>
        <Chip selected={tab === 'written'} onClick={() => setTab('written')}>
          쓴 후기 <span className="num">{writtenQuery.data?.reviews.length ?? ''}</span>
        </Chip>
        <Chip selected={tab === 'received'} onClick={() => setTab('received')}>
          받은 후기 <span className="num">{received.length || ''}</span>
        </Chip>
      </div>

      {activeQuery.isLoading ? (
        <Spinner block />
      ) : activeQuery.isError ? (
        <ErrorState message={activeQuery.error?.message} onRetry={() => activeQuery.refetch()} />
      ) : tab === 'reviewable' ? (
        reviewableQuery.data?.length ? (
          <div className={styles.list}>
            {reviewableQuery.data.map((order) => (
              <div key={order.orderId} className={styles.row} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div className={styles.rowBody}>
                  <p className={styles.rowTitle}>
                    <Link to={productPath(order.productId)}>{order.productName}</Link>
                  </p>
                  <p className={`${styles.rowMeta} num`}>
                    판매자 {order.sellerNickname} · 낙찰가 {formatWon(order.winningPrice)} ·{' '}
                    {formatDotDate(order.confirmedAt)} 구매확정
                  </p>
                  <p className={`${styles.hint} ${styles.hintHot}`}>
                    {formatDotDate(order.reviewDeadline)}까지 ({formatDday(order.reviewDeadline, now)})
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <Button size="sm" variant="highlight" onClick={() => setWriteTarget(order)}>
                    후기 쓰기
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="star"
            title="후기를 쓸 주문이 없어요"
            description="구매확정한 주문은 30일 안에 후기를 남길 수 있어요."
          />
        )
      ) : (
        <>
          {tab === 'received' && averageRating !== null ? (
            <div className={styles.sumCard} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <span className={`${styles.sumValue} num`}>{formatRating(averageRating)}</span>
              <StarRating value={averageRating} size={18} />
              <span className={styles.sumSub}>받은 후기 {received.length}개 · 판매자 카드에 보여요</span>
            </div>
          ) : null}
          {reviews?.length ? (
            <div className={styles.list}>
              {reviews.map((review) => (
                <div key={review.reviewId} className={styles.reviewItem}>
                  <div className={styles.reviewHead}>
                    <StarRating value={review.rating} />
                    <strong className="num" style={{ color: 'var(--text)' }}>
                      {review.rating.toFixed(1)}
                    </strong>
                    <span>
                      {tab === 'written' ? `판매자 ${review.targetNickname}` : `구매자 ${review.writerNickname}`}
                    </span>
                    <span>· {formatRelativeTime(review.createdAt, now)}</span>
                    {review.writerId === me?.memberId ? (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
                        <button
                          type="button"
                          className={styles.rowMeta}
                          style={linkButtonStyle}
                          onClick={() => setEditTarget(review)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className={styles.rowMeta}
                          style={linkButtonStyle}
                          onClick={() => setDeleteTarget(review)}
                        >
                          삭제
                        </button>
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.reviewBody}>{review.content}</p>
                  <p className={styles.rowMeta}>
                    <Link to={productPath(review.productId)}>{review.productName}</Link>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="star" title={tab === 'written' ? '쓴 후기가 없어요' : '받은 후기가 없어요'} />
          )}
        </>
      )}

      <ReviewDialog
        target={writeTarget}
        editing={editTarget}
        onClose={() => {
          setWriteTarget(null)
          setEditTarget(null)
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="후기를 지울까요?"
        confirmLabel="삭제"
        confirmVariant="solid"
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.reviewId)}
        onClose={() => setDeleteTarget(null)}
      >
        지운 뒤에는 같은 주문에 후기를 다시 쓸 수 없어요.
      </ConfirmDialog>
    </>
  )
}
