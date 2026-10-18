/**
 * 목업 상품 사진. 상품 imageUrls 의 'photo:<이름>' 을 실제 URL 로 바꾼다 (원본 Px / iA / Cx).
 */
const modules = import.meta.glob<string>('../assets/photos/*.webp', {
  eager: true,
  import: 'default',
})

/** 사진 이름(파일명에서 .webp 뺀 것) → URL (원본 iA) */
export const PHOTO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]),
)

/** 'photo:<이름>' 이면 번들 사진 URL(없으면 null), 아니면 그대로, 비었으면 null (원본 Cx) */
export function resolvePhotoUrl(src: string | null | undefined): string | null {
  if (!src) return null
  return src.startsWith('photo:') ? (PHOTO_URLS[src.slice(6)] ?? null) : src
}

/** 사진 출처 표기 (원본 _m, 푸터) */
export const PHOTO_CREDITS = [
  { who: 'Evan-Amos', license: '퍼블릭 도메인', note: '대부분의 제품 사진' },
  { who: 'Evan-Amos', license: 'CC BY-SA 3.0', note: '드림캐스트 본체 세트' },
  {
    who: 'Thiemo Schuff',
    license: 'CC BY-SA 3.0 DE',
    note: '게임보이 어드밴스 SP NES 에디션',
  },
]
