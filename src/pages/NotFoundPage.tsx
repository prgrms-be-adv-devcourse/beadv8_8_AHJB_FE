import { LinkButton } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

/** 없는 경로 (원본 aO) */
export function NotFoundPage() {
  return (
    <div className="container">
      <EmptyState
        icon="search"
        title="없는 페이지예요"
        description="주소가 바뀌었거나 삭제된 경매일 수 있어요."
        action={
          <LinkButton to="/" variant="solid" size="sm">
            홈으로
          </LinkButton>
        }
      />
    </div>
  )
}
