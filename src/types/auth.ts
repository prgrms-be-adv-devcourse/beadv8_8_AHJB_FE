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
  nickname: string
  suspended: boolean
}

export interface AvailabilityResponse {
  available: boolean
}
