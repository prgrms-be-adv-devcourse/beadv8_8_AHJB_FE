/** 원 단위 금액. null·undefined 면 '-' (원본 ie). 예: 12,000원 */
export function formatWon(amount: number | null | undefined): string {
  return amount == null ? '-' : `${amount.toLocaleString('ko-KR')}원`
}

/** 문자열에서 숫자만 뽑아 number 로 (원본 ur). 숫자가 없으면 0 */
export function parseDigits(value: string): number {
  const digits = value.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : 0
}

/** 금액 입력칸 표시용: 숫자만 남기고 천 단위 쉼표 (원본 Di). 0 이면 '' */
export function formatAmountInput(value: string): string {
  const amount = parseDigits(value)
  return amount ? amount.toLocaleString('ko-KR') : ''
}

/** 두 자리 0 채움 (원본 Un) */
export const pad2 = (value: number | string) => String(value).padStart(2, '0')

/**
 * 남은 시간(ms) → 'HH:MM:SS', 하루 이상이면 'N일 HH:MM' (원본 bn).
 * 0 이하면 '00:00:00'
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return days > 0
    ? `${days}일 ${pad2(hours)}:${pad2(minutes)}`
    : `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

/** 요일 (원본 aA) */
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 'M.D (요일) HH:mm' (원본 vn) */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value)
  return `${date.getMonth() + 1}.${date.getDate()} (${WEEKDAYS[date.getDay()]}) ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 'M.D HH:mm' (원본 Jo) */
export function formatShortDateTime(value: string | number | Date): string {
  const date = new Date(value)
  return `${date.getMonth() + 1}.${date.getDate()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** '방금' / 'N분 전' / 'N시간 전' / 'N일 전'(7일 미만) / 'YYYY.M.D' (원본 Fi) */
export function formatRelativeTime(value: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(value))
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  const date = new Date(value)
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`
}

/** <input type="datetime-local"> 값 'YYYY-MM-DDTHH:mm' (원본 zx) */
export function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 'YYYY-MM-DD'(로컬 자정으로 해석) 또는 ISO 문자열 → Date */
function parseDateLike(value: string): Date {
  return value.length <= 10 ? new Date(`${value}T00:00:00`) : new Date(value)
}

/** 'M월 D일 (요일)' (원본 Io) */
export function formatKoreanDate(value: string): string {
  const date = parseDateLike(value)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`
}

/** 'YYYY.M.D' (원본 Va) */
export function formatDotDate(value: string): string {
  const date = parseDateLike(value)
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`
}

/** 날짜 기준 D-day: 'D-day' / 'D-3' / 'D+2' (원본 Oo) */
export function formatDday(value: string, now: number = Date.now()): string {
  const target = parseDateLike(value)
  const today = new Date(now)
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((targetDay - todayDay) / 86400000)
  return diffDays === 0 ? 'D-day' : diffDays > 0 ? `D-${diffDays}` : `D+${-diffDays}`
}

/** 전화번호 입력 표시: 숫자만 최대 11자리 → '010-1234-5678' 형태 (원본 zo) */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`
}

/** 평점 소수 한 자리. null 이면 '-' (원본 lA) */
export function formatRating(rating: number | null | undefined): string {
  return rating == null ? '-' : rating.toFixed(1)
}
