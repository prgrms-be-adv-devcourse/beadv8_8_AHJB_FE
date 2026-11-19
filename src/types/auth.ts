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
  /** 목업만 준다. 실제 서버는 리프레시 토큰을 HttpOnly 쿠키로 준다 */
  refreshToken?: string
  /** 목업만 준다. 실제 서버 응답에는 없으니 로그인 후 닉네임은 AuthProvider 의 login 결과를 쓴다 */
  nickname?: string
  suspended: boolean
}

export interface AvailabilityResponse {
  available: boolean
}

/** POST /api/v1/auth/oauth/kakao 요청. code = 카카오 인가 코드 */
export interface KakaoLoginRequest {
  code: string
}

/** 카카오 로그인 결과. 가입된 계정이면 LOGIN, 처음이면 SIGNUP_REQUIRED */
export type KakaoLoginResponse =
  | {
      status: 'LOGIN'
      accessToken: string
      suspended: boolean
      signupToken: null
      /** LOGIN 에서는 항상 null */
      email: null
      /** 목업만 준다 */
      refreshToken?: string
    }
  | {
      status: 'SIGNUP_REQUIRED'
      accessToken: null
      suspended: null
      /** 10분 유효. 메모리에만 보관한다 (lib/kakaoAuth.ts) */
      signupToken: string
      /**
       * 카카오가 유효·인증한 이메일. 있으면 가입 토큰에도 담겨 있어서 가입 때 BE 가 이 값으로 가입시킨다(요청 email 무시).
       * 미인증·만료 등으로 없으면 null → 사용자가 직접 입력한다.
       */
      email: string | null
    }

/** POST /api/v1/auth/oauth/kakao/signup 요청. 비밀번호가 없는 것 말고는 일반 가입과 같다 */
export interface KakaoSignupRequest {
  signupToken: string
  /** 로그인 응답에 email 이 있었으면 BE 가 무시한다(보내도 됨). null 이었으면 필수 */
  email?: string
  nickname: string
  username: string
  /** 숫자만 (01012345678) */
  phone: string
  birthDate?: string
  address: MemberAddress
}

/** 카카오 가입 응답 (201). 가입과 동시에 로그인된다 */
export interface KakaoSignupResponse {
  accessToken: string
  suspended: boolean
  /** 목업만 준다 */
  refreshToken?: string
}
