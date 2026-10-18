import { useSyncExternalStore } from 'react'

/** 'API 표시' 개발 모드 (원본 tA / nA / g0 / rA) */
const STORAGE_KEY = 'jjinmak.devMode'
const listeners = new Set<() => void>()

let devMode = (() => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
})()

/** 개발 모드 켜기/끄기 (원본 g0) */
export function setDevMode(on: boolean) {
  devMode = on
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* 무시 */
  }
  listeners.forEach((listener) => listener())
}

/** 개발 모드 여부 구독 (원본 rA) */
export function useDevMode(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => devMode,
  )
}
