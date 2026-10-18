import { Outlet, ScrollRestoration } from 'react-router-dom'
import { DevModeToggle } from '@/components/DevApiNote'
import { ToastProvider } from '@/components/Toast'
import { Footer } from './Footer'
import { Header } from './Header'

/** 공통 레이아웃 (원본 nj): 헤더 · 본문 · 푸터 · API 표시 토글 · 스크롤 복원 */
export function AppLayout() {
  return (
    <ToastProvider>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <DevModeToggle />
      <ScrollRestoration />
    </ToastProvider>
  )
}
