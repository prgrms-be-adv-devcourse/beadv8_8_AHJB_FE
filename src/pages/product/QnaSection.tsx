import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qnaApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/Button'
import { DevApiNote } from '@/components/DevApiNote'
import { Textarea } from '@/components/form/Field'
import { useToast } from '@/components/Toast'
import { formatRelativeTime } from '@/lib/format'
import type { QnaCreateRequest } from '@/types/product'
import pageStyles from './ProductDetailPage.module.css'
import styles from './QnaSection.module.css'

/** 질문·답글 최대 글자 수 (원본 Ju) */
const MAX_LENGTH = 1000

interface QnaSectionProps {
  productId: number
  /** 내 상품이면 질문 대신 답글을 단다 */
  isMine: boolean
}

/** 실시간 Q&A (원본 jP). 5초마다 새로고침 */
export function QnaSection({ productId, isMine }: QnaSectionProps) {
  const { me, isLoggedIn } = useAuth()
  const location = useLocation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [reply, setReply] = useState('')

  const qnasQuery = useQuery({
    queryKey: ['qnas', productId],
    queryFn: () => qnaApi.list(productId, { size: 30 }),
    refetchInterval: 5000,
  })

  const invalidateQnas = () => queryClient.invalidateQueries({ queryKey: ['qnas', productId] })

  const createMutation = useMutation({
    mutationFn: (body: QnaCreateRequest) => qnaApi.create(productId, body),
    onSuccess: (_created, body) => {
      if (body.parentId) {
        setReply('')
        setReplyingTo(null)
        toast('답글을 달았어요.', { tone: 'success' })
      } else {
        setQuestion('')
        toast('질문을 남겼어요. 판매자가 답하면 여기에 보여요.', { tone: 'success' })
      }
      invalidateQnas()
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  const removeMutation = useMutation({
    mutationFn: (qnaId: number) => qnaApi.remove(qnaId),
    onSuccess: () => {
      toast('삭제했어요.')
      invalidateQnas()
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  })

  const handleAsk = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (question.trim()) createMutation.mutate({ content: question.trim() })
  }

  const qnas = qnasQuery.data?.qnas ?? []

  return (
    <section className={pageStyles.section} aria-labelledby="qna-title">
      <h2 id="qna-title" className={pageStyles.sectionTitle}>
        실시간 Q&A <span className={`${pageStyles.sectionCount} num`}>{qnas.length}</span>
      </h2>
      <DevApiNote ids={['qna.list', 'qna.create', 'qna.delete']} />

      {isLoggedIn ? (
        isMine ? (
          <p className={styles.login}>내 상품이에요. 질문에 답글을 달면 모든 구매자가 볼 수 있어요.</p>
        ) : (
          <form className={styles.form} onSubmit={handleAsk}>
            <label htmlFor="qna-input" className="sr-only">
              질문
            </label>
            <Textarea
              id="qna-input"
              rows={3}
              maxLength={MAX_LENGTH}
              placeholder="구성품, 동작 상태, 묶음배송 등 궁금한 걸 물어보세요. 연락처는 남기지 마세요."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className={styles.formFoot}>
              <span className={`${styles.counter} num`}>
                {question.length}/{MAX_LENGTH}
              </span>
              <Button
                type="submit"
                size="sm"
                variant="solid"
                disabled={!question.trim()}
                loading={createMutation.isPending && !replyingTo}
              >
                질문하기
              </Button>
            </div>
          </form>
        )
      ) : (
        <p className={styles.login}>
          <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>로그인</Link>하면 판매자에게 질문할 수
          있어요.
        </p>
      )}

      {qnas.length === 0 ? (
        <p className={styles.empty}>아직 질문이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {qnas.map((qna) => (
            <li key={qna.qnaId} className={styles.item}>
              <div className={styles.qRow}>
                <p className={styles.q}>
                  <span className={styles.mark}>Q</span>
                  {qna.isDeleted ? <span className={styles.deleted}>삭제된 질문이에요.</span> : qna.content}
                </p>
                {!qna.isDeleted && me?.memberId === qna.writerId ? (
                  <span className={styles.tools}>
                    <button type="button" className={styles.tool} onClick={() => removeMutation.mutate(qna.qnaId)}>
                      삭제
                    </button>
                  </span>
                ) : null}
              </div>
              <p className={styles.meta}>
                {qna.writerNickname} · {formatRelativeTime(qna.createdAt)}
              </p>

              {qna.replies.length ? (
                <div className={styles.replies}>
                  {qna.replies.map((answer) => (
                    <div key={answer.qnaId} className={styles.a}>
                      <span className={styles.aHead}>
                        <span className={`${styles.mark} ${styles.markA}`}>A</span>
                        {answer.writerNickname}
                        {answer.isSeller ? <span className={styles.sellerTag}>판매자</span> : null}
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                          {formatRelativeTime(answer.createdAt)}
                        </span>
                        {!answer.isDeleted && me?.memberId === answer.writerId ? (
                          <span className={styles.tools}>
                            <button
                              type="button"
                              className={styles.tool}
                              onClick={() => removeMutation.mutate(answer.qnaId)}
                            >
                              삭제
                            </button>
                          </span>
                        ) : null}
                      </span>
                      <span>
                        {answer.isDeleted ? <span className={styles.deleted}>삭제된 답글이에요.</span> : answer.content}
                      </span>
                    </div>
                  ))}
                </div>
              ) : qna.isDeleted ? null : (
                <p className={styles.waiting}>판매자 답변을 기다리고 있어요.</p>
              )}

              {isMine && !qna.isDeleted ? (
                replyingTo === qna.qnaId ? (
                  <form
                    className={styles.replyForm}
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (reply.trim()) createMutation.mutate({ content: reply.trim(), parentId: qna.qnaId })
                    }}
                  >
                    <Textarea
                      rows={2}
                      maxLength={MAX_LENGTH}
                      autoFocus
                      placeholder="답글을 입력해 주세요."
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      aria-label="답글"
                    />
                    <div className={styles.formFoot}>
                      <button type="button" className={styles.tool} onClick={() => setReplyingTo(null)}>
                        취소
                      </button>
                      <Button
                        type="submit"
                        size="sm"
                        variant="solid"
                        disabled={!reply.trim()}
                        loading={createMutation.isPending}
                      >
                        답글 달기
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.replyForm}>
                    <button
                      type="button"
                      className={styles.tool}
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setReplyingTo(qna.qnaId)}
                    >
                      판매자로 답글 달기
                    </button>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
