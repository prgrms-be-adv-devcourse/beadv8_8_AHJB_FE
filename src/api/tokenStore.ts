const ACCESS_TOKEN_KEY = 'jjinmak.accessToken'
const REFRESH_TOKEN_KEY = 'jjinmak.refreshToken'

type TokenKey = typeof ACCESS_TOKEN_KEY | typeof REFRESH_TOKEN_KEY

const listeners = new Set<() => void>()

/** localStorage 를 못 쓰는 환경(사파리 프라이빗 등)을 위한 메모리 사본 */
const memory: Record<TokenKey, string | null> = {
  [ACCESS_TOKEN_KEY]: null,
  [REFRESH_TOKEN_KEY]: null,
}

function read(key: TokenKey): string | null {
  if (memory[key]) return memory[key]
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: TokenKey, value: string | null) {
  memory[key] = value
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* 저장 실패는 무시 (메모리 사본으로 동작) */
  }
}

const PROFILE_KEY = 'jjinmak.sessionProfile'

/** 로그인 때 입력한 이메일. 백엔드에 이메일을 돌려주는 API 가 없어서 저장해 둔다 */
export interface SessionProfile {
  email: string
}

let memoryProfile: SessionProfile | null = null

function readProfile(): SessionProfile | null {
  if (memoryProfile) return memoryProfile
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as SessionProfile) : null
  } catch {
    return null
  }
}

function writeProfile(profile: SessionProfile | null) {
  memoryProfile = profile
  try {
    if (profile === null) window.localStorage.removeItem(PROFILE_KEY)
    else window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    /* 저장 실패는 무시 */
  }
}

/** 액세스·리프레시 토큰 저장소 (원본 vs) */
export const tokenStore = {
  get(): string | null {
    return read(ACCESS_TOKEN_KEY)
  },
  getRefresh(): string | null {
    return read(REFRESH_TOKEN_KEY)
  },
  /** refreshToken 을 생략하면 기존 값을 유지한다 */
  set(accessToken: string, refreshToken?: string) {
    write(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken !== undefined) write(REFRESH_TOKEN_KEY, refreshToken)
    listeners.forEach((listener) => listener())
  },
  /** 토큰이 있었을 때만 구독자에게 알린다 */
  clear() {
    const hadToken = this.get() !== null
    write(ACCESS_TOKEN_KEY, null)
    write(REFRESH_TOKEN_KEY, null)
    writeProfile(null)
    if (hadToken) listeners.forEach((listener) => listener())
  },
  /** 로그인 때 저장한 정보 (member/me 없이 내 정보를 만들 때 사용) */
  getProfile(): SessionProfile | null {
    return readProfile()
  },
  setProfile(profile: SessionProfile) {
    writeProfile(profile)
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
