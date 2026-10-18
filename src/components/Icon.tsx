import type { ReactNode, SVGProps } from 'react'

/** 아이콘 모양 (원본 k0). 24×24 viewBox, 선 아이콘 */
const ICON_PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-9.2-8.7A5 5 0 0 1 12 6.3a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20Z" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  gavel: (
    <>
      <path d="m14 4 6 6M11 7l6 6M12.5 5.5l-4 4M18.5 11.5l-4 4" />
      <path d="m10.5 11.5-6.5 6.5 2 2 6.5-6.5M4 21h9" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m4 18 5-5 4 4 2.5-2.5L20 19" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.3" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z" />
      <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.75" />
      <circle cx="17" cy="17.5" r="1.75" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4.5h8v4a4 4 0 0 1-8 0v-4Z" />
      <path d="M8 6.5H5a3 3 0 0 0 3 4M16 6.5h3a3 3 0 0 1-3 4M12 12.5v4M8.5 20h7M9.5 16.5h5V20h-5z" />
    </>
  ),
  bolt: <path d="M13 3.5 5.5 13.5H12L11 20.5l7.5-10H12l1-7Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  sparkle: <path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5ZM18.5 15.5c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />,
  cart: (
    <>
      <path d="M3.5 4.5h2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h7.7a1.5 1.5 0 0 0 1.5-1.1l1.4-6.3H6.4" />
      <circle cx="9.5" cy="19.5" r="1.1" />
      <circle cx="17" cy="19.5" r="1.1" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h10.5v3" />
      <path d="M4 7.5v10A2.5 2.5 0 0 0 6.5 20h12a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 18.5 8h-12A2.5 2.5 0 0 1 4 7.5Z" />
      <circle cx="16" cy="14" r="1" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6L12 4Z" />,
  undo: (
    <>
      <path d="M8 8.5H15a4.5 4.5 0 0 1 0 9h-4" />
      <path d="m10.5 5.5-3 3 3 3" />
    </>
  ),
  edit: (
    <>
      <path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5Z" />
      <path d="m12.5 7.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  chat: <path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16.5H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />,
  code: <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  card: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M3.5 10h17M7 14.5h3" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICON_PATHS

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[]

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** px, 기본 16 */
  size?: number
  /** 속을 currentColor 로 채움 (찜 하트 등) */
  filled?: boolean
}

/** SVG 아이콘 (원본 de). 나머지 props 는 svg 에 그대로 (strokeWidth 등으로 덮어쓰기 가능) */
export function Icon({ name, size = 16, filled = false, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {ICON_PATHS[name]}
    </svg>
  )
}
