import { useSyncExternalStore } from 'react'

/**
 * 서버 시각 기준 "지금" (원본 Zo / Uo / Dn / Ux).
 * 구독자가 있는 동안만 1초마다 갱신된다.
 */
let now = Date.now()
/** 서버 시각 − 브라우저 시각 (ms) */
let offset = 0
const listeners = new Set<() => void>()
let timer: number | undefined

function startTicking() {
  if (timer === undefined) {
    timer = window.setInterval(() => {
      now = Date.now() + offset
      listeners.forEach((listener) => listener())
    }, 1000)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) now = Date.now() + offset
  startTicking()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}

/** 서버가 알려준 시각(ISO 문자열)으로 시계를 맞춘다 (원본 Ux) */
export function syncServerTime(serverTime: string) {
  offset = Date.parse(serverTime) - Date.now()
  now = Date.now() + offset
}

/** 1초마다 바뀌는 서버 기준 현재 시각(ms) (원본 Dn) */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now)
}
