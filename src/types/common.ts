/** 백엔드 공통 성공 응답 */
export interface ApiSuccessBody<T> {
  isSuccess: true
  message: string
  data: T
}

/**
 * 백엔드 공통 실패 응답.
 * 결제·지갑 API 는 여기에 retryable / pgCode / pgMessage 를 더해 준다 (백엔드 PaymentErrorResponse). 다른 도메인은 없다.
 */
export interface ApiErrorBody {
  isSuccess: false
  errorCode: string
  message: string
  /** 사용자가 "다시 시도" 로 해결할 수 있는 실패인지 (결제 API 전용) */
  retryable?: boolean
  /** 토스가 돌려준 실패 코드 (PG 에러일 때만) */
  pgCode?: string | null
  /** 토스가 돌려준 실패 메시지 (PG 에러일 때만) */
  pgMessage?: string | null
}

export type ApiBody<T = unknown> = ApiSuccessBody<T> | ApiErrorBody

/** 목업 서버 / 백엔드 공통 페이지 응답 (content + hasNext) */
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface PageParams {
  page?: number
  size?: number
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
