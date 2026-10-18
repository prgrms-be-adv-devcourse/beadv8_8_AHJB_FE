import type { ReactNode } from 'react'
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireSeller } from '@/auth/RequireSeller'
import { AppLayout } from '@/layout/AppLayout'
import { HomePage } from '@/pages/home/HomePage'
import { AuctionListPage } from '@/pages/auctions/AuctionListPage'
import { ProductDetailPage } from '@/pages/product/ProductDetailPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { SellerRegisterPage } from '@/pages/auth/SellerRegisterPage'
import { SellPage } from '@/pages/sell/SellPage'
import { CartPage } from '@/pages/cart/CartPage'
import { OrderDetailPage } from '@/pages/order/OrderDetailPage'
import { MyPageLayout } from '@/pages/me/MyPageLayout'
import { MyBidsPage } from '@/pages/me/MyBidsPage'
import { MyOrdersPage } from '@/pages/me/MyOrdersPage'
import { MyReviewsPage } from '@/pages/me/MyReviewsPage'
import { MyWishesPage } from '@/pages/me/MyWishesPage'
import { MyProductsPage } from '@/pages/me/MyProductsPage'
import { MySalesPage } from '@/pages/me/MySalesPage'
import { MySettlementsPage } from '@/pages/me/MySettlementsPage'
import { MyWalletPage } from '@/pages/me/MyWalletPage'
import { MyProfilePage } from '@/pages/me/MyProfilePage'
import { DevApisPage } from '@/pages/dev/DevApisPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** 로그인 필요 화면으로 감싸기 (원본 wo) */
const requireAuth = (element: ReactNode) => <RequireAuth>{element}</RequireAuth>

/** 라우트 정의 (원본 bb). 원본은 HashRouter, 여기서는 BrowserRouter(의도된 변경 #1) */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/auctions', element: <AuctionListPage /> },
      { path: '/products/:productId', element: <ProductDetailPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
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
          { path: 'profile', element: <MyProfilePage /> },
        ],
      },
      { path: '/dev/apis', element: <DevApisPage /> },
      { path: '/search', element: <Navigate to="/auctions" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
