/** 백엔드 JWT 의 payload (JwtTokenProvider: sub = 회원 id, auth = 쉼표로 이은 권한 목록) */
export interface AccessTokenClaims {
  memberId: number | null
  authorities: string[]
  /** 만료 시각 (ms). 없으면 null */
  expiresAt: number | null
}

/**
 * 서명 검증 없이 payload 만 읽는다. 화면 표시용으로만 쓰고, 권한 판단은 서버가 한다.
 * JWT 가 아니면(목업 토큰 등) null.
 */
export function decodeAccessToken(token: string | null): AccessTokenClaims | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    const payload = JSON.parse(json) as { sub?: string; auth?: string; exp?: number }
    const memberId = payload.sub !== undefined && /^\d+$/.test(payload.sub) ? Number(payload.sub) : null
    return {
      memberId,
      authorities: payload.auth ? payload.auth.split(',').map((a) => a.trim()).filter(Boolean) : [],
      expiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : null,
    }
  } catch {
    return null
  }
}
