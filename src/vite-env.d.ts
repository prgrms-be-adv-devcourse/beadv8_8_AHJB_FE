/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 실제 API 서버 주소. 비우면 같은 출처의 /api (Vite proxy / vercel rewrites) */
  readonly VITE_API_BASE_URL?: string
  /** 실제 서버로 보낼 API 키 목록 (쉼표 구분, 예: auth.login,auction.detail). 비우면 전부 목업 */
  readonly VITE_REAL_APIS?: string
  /** 로컬 개발 서버 proxy 대상 (vite.config.ts 에서만 사용) */
  readonly VITE_DEV_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
