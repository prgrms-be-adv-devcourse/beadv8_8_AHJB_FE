/** 백엔드 공통 성공 응답 */
export interface ApiSuccessBody<T> {
  isSuccess: true
  message: string
  data: T
}

/** 백엔드 공통 실패 응답 */
export interface ApiErrorBody {
  isSuccess: false
  errorCode: string
  message: string
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
