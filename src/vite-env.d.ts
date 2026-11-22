/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 로컬 개발 서버 proxy 대상 (vite.config.ts 에서만 사용) */
  readonly VITE_DEV_PROXY_TARGET?: string
  /** 토스페이먼츠 클라이언트 키 (payment.chargeRequest 가 실제일 때 결제창에 필요). 로컬은 테스트 키(test_ck_...) */
  readonly VITE_TOSS_CLIENT_KEY?: string
  /** 카카오 REST API 키 (카카오 로그인 인가 요청 client_id). auth.kakaoLogin 이 실제일 때 필요 */
  readonly VITE_KAKAO_REST_API_KEY?: string
  /** 거래 채팅 WebSocket 주소 (STOMP). 비우면 로컬은 같은 출처(Vite proxy), 배포는 wss://api.jjinmak.kro.kr */
  readonly VITE_WS_BASE_URL?: string
  readonly VITE_API_STREAM_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
