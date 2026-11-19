import type { ReactNode } from 'react'
import { Navigate, createBrowserRouter, useParams, type RouteObject } from 'react-router-dom'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireSeller } from '@/auth/RequireSeller'
import { AppLayout } from '@/layout/AppLayout'
import { HomePage } from '@/pages/home/HomePage'
import { AuctionListPage } from '@/pages/auctions/AuctionListPage'
import { ProductDetailPage } from '@/pages/product/ProductDetailPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { KakaoCallbackPage } from '@/pages/auth/KakaoCallbackPage'
import { SellerRegisterPage } from '@/pages/auth/SellerRegisterPage'
import { SellPage } from '@/pages/sell/SellPage'
import { CartPage } from '@/pages/cart/CartPage'
import { PaymentSuccessPage } from '@/pages/cart/PaymentSuccessPage'
import { PaymentFailPage } from '@/pages/cart/PaymentFailPage'
import { OrderDetailPage } from '@/pages/order/OrderDetailPage'
import { MyPageLayout } from '@/pages/me/MyPageLayout'
import { MyBidsPage } from '@/pages/me/MyBidsPage'
import { MyOrdersPage } from '@/pages/me/MyOrdersPage'
import { MyReviewsPage } from '@/pages/me/MyReviewsPage'
import { MyWishesPage } from '@/pages/me/MyWishesPage'
import { MyProductsPage } from '@/pages/me/MyProductsPage'
import { MySalesPage } from '@/pages/me/MySalesPage'
import { MySettlementsPage } from '@/pages/me/MySettlementsPage'
import { ChatRoomPage } from '@/pages/chat/ChatRoomPage'
import { MyWalletPage } from '@/pages/me/MyWalletPage'
import { ChargeSuccessPage } from '@/pages/me/wallet/ChargeSuccessPage'
import { ChargeFailPage } from '@/pages/me/wallet/ChargeFailPage'
import { MyProfilePage } from '@/pages/me/MyProfilePage'
import { DevApisPage } from '@/pages/dev/DevApisPage'
import { AuctionRedirectPage } from '@/pages/auctions/AuctionRedirectPage'
import { DropsPage } from '@/pages/drops/DropsPage'
import { SearchPage } from '@/pages/search/SearchPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { MyNotificationSettingsPage } from '@/pages/me/MyNotificationSettingsPage'
import { ChatListPage } from '@/pages/chat/ChatListPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** /seller/orders/:orderId → /orders/:orderId */
function SellerOrderRedirect() {
  const { orderId } = useParams()
  return <Navigate to={`/orders/${orderId}`} replace />
}

/** 로그인 필요 화면으로 감싸기 */
const requireAuth = (element: ReactNode) => <RequireAuth>{element}</RequireAuth>

/** 라우트 정의 (BrowserRouter) */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/auctions', element: <AuctionListPage /> },
      { path: '/auctions/:auctionId', element: <AuctionRedirectPage /> },
      { path: '/drops', element: <DropsPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/notifications', element: requireAuth(<NotificationsPage />) },
      { path: '/chats', element: requireAuth(<ChatListPage />) },
      { path: '/chats/:roomId', element: requireAuth(<ChatRoomPage />) },
      // 알림 서버의 임시 푸시 링크 경로 → 실제 화면 (PushLinkResolver 를 맞추면 지운다)
      { path: '/mypage', element: <Navigate to="/me" replace /> },
      { path: '/seller/settlements', element: <Navigate to="/me/settlements" replace /> },
      { path: '/seller/orders/:orderId', element: <SellerOrderRedirect /> },
      { path: '/products/:productId', element: <ProductDetailPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      // key: /signup 과 같은 컴포넌트라 경로가 바뀔 때 입력 상태를 새로 만든다
      { path: '/signup/kakao', element: <SignupPage key="kakao" mode="kakao" /> },
      // 카카오 콘솔·백엔드에 등록된 Redirect URI 와 같아야 한다 (lib/kakaoAuth.ts KAKAO_CALLBACK_PATH)
      { path: '/oauth/kakao/callback', element: <KakaoCallbackPage /> },
      { path: '/seller/register', element: requireAuth(<SellerRegisterPage />) },
      {
        path: '/sell',
        element: (
          <RequireSeller>
            <SellPage />
          </RequireSeller>
        ),
      },
      {
        path: '/sell/:productId/edit',
        element: (
          <RequireSeller>
            <SellPage />
          </RequireSeller>
        ),
      },
      { path: '/cart', element: requireAuth(<CartPage />) },
      // 장바구니 결제의 토스 결제창 successUrl / failUrl (lib/toss.ts 의 ORDER_PAYMENT_*_PATH 와 같아야 한다)
      { path: '/cart/payment/success', element: requireAuth(<PaymentSuccessPage />) },
      { path: '/cart/payment/fail', element: requireAuth(<PaymentFailPage />) },
      { path: '/orders/:orderId', element: requireAuth(<OrderDetailPage />) },
      {
        path: '/me',
        element: requireAuth(<MyPageLayout />),
        children: [
          { index: true, element: <Navigate to="/me/orders" replace /> },
          { path: 'bids', element: <MyBidsPage /> },
          { path: 'orders', element: <MyOrdersPage /> },
          { path: 'reviews', element: <MyReviewsPage /> },
          { path: 'wishes', element: <MyWishesPage /> },
          { path: 'products', element: <MyProductsPage /> },
          { path: 'sales', element: <MySalesPage /> },
          { path: 'settlements', element: <MySettlementsPage /> },
          { path: 'wallet', element: <MyWalletPage /> },
          // 토스 결제창 successUrl / failUrl (lib/toss.ts 의 CHARGE_SUCCESS_PATH / CHARGE_FAIL_PATH 와 같아야 한다)
          { path: 'wallet/charge/success', element: <ChargeSuccessPage /> },
          { path: 'wallet/charge/fail', element: <ChargeFailPage /> },
          { path: 'profile', element: <MyProfilePage /> },
          { path: 'notifications', element: <MyNotificationSettingsPage /> },
        ],
      },
      { path: '/dev/apis', element: <DevApisPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
