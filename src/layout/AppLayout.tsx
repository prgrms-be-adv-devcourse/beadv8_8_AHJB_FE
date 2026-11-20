import { Outlet, ScrollRestoration } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { BottomTabBar } from './BottomTabBar'
import { Footer } from './Footer'
import { Header } from './Header'

/** 공통 레이아웃: 헤더 · 본문 · 푸터 · 모바일 하단 탭바 · 스크롤 복원 */
export function AppLayout() {
  return (
    <ToastProvider>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <BottomTabBar />
      <ScrollRestoration />
    </ToastProvider>
  )
}
