import type { MemberAddress } from './member'

export interface SignupRequest {
  email: string
  password: string
  passwordConfirm: string
  nickname: string
  username: string
  /** 숫자만 (01012345678) */
  phone: string
  birthDate?: string
  address: MemberAddress
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  /** 목업만 준다. 실제 서버 응답에는 없으니 로그인 후 닉네임은 AuthProvider 의 login 결과를 쓴다 */
  nickname?: string
  suspended: boolean
}

export interface AvailabilityResponse {
  available: boolean
}
