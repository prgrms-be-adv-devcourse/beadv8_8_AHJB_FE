# 찐막 프론트엔드

레트로 게임 경매 서비스 **찐막**의 웹 프론트엔드입니다. Claude로 만든 와이어프레임(빌드 결과물)을 TypeScript 소스로 다시 만든 프로젝트예요.

- **기술 스택**: React 18, TypeScript, Vite 6, React Router 6, TanStack Query 5, CSS Modules
- **배포**: Vercel (push하면 자동 배포)
- **백엔드 연결**: `/api/*` 요청을 Vite proxy(로컬)와 Vercel rewrites(배포)가 백엔드로 전달해요. 그래서 CORS 설정이 필요 없어요.
- **목업 서버**: 백엔드가 없어도 모든 화면이 동작하도록 브라우저 안에 가짜 서버(`src/mock`)가 들어 있어요. API마다 목업으로 보낼지 실제 서버로 보낼지 고를 수 있어요.

## 실행

Node.js 20 이상이 필요해요.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 타입 검사 + 빌드 (dist/)
npm run preview    # 빌드 결과 확인
```

체험용 계정: 로그인 화면의 "체험용 계정" 버튼으로 로그인해요. 비밀번호는 `jjinmak1234!`이에요.
- `demo@jjinmak.kr`: 구매자 + 판매자
- `buyer@jjinmak.kr`: 판매자 등록 전 구매자

목업 데이터는 브라우저 localStorage에 저장돼요. 푸터의 초기화 버튼을 누르면 처음 상태로 돌아가요.

## 폴더 구조

```
src/
  api/          client.ts(공통 요청 함수), config.ts(목업/실제 전환), endpoints.ts(도메인별 API), registry.ts(API 구현 현황표)
  types/        도메인별 응답 타입
  auth/         로그인 상태, RequireAuth, RequireSeller
  components/   공통 UI (Button, Dialog, ProductCard, order/* 등)
  layout/       Header, Footer, AppLayout
  lib/          서버 시계, 포맷, 라벨, 상태, 입찰 단위, 정산 수수료
  mock/         목업 서버 (db, seed, handlers/도메인별)
  pages/        화면 (home, auctions, product, auth, sell, cart, order, me, dev)
  router.tsx    라우트 정의
```

## 목업 → 실제 API 전환 (각 도메인 담당자)

1. `src/api/registry.ts`에서 내 API의 키를 찾아요. 예: `auction.detail`, `auction.bid`
2. 환경변수 `VITE_REAL_APIS`에 그 키를 쉼표로 이어서 추가해요.
   - 로컬에서만 해 보기: `.env.development.local` 파일을 만들어서 적어요 (git에 안 올라가요).
     ```
     VITE_REAL_APIS=auth.login,auth.reissue,member.me,auction.detail
     ```
   - 배포에 반영하기: `.env.production`의 `VITE_REAL_APIS`에 추가하고 PR을 올려요.
   - `VITE_REAL_APIS=*`로 두면 전부 실제 서버로 가요.
3. 화면에서 확인해요. 응답 필드가 목업과 다르면 화면이 깨지니까, `src/types/*`와 목업 응답(`src/mock/handlers/*`)을 기준으로 백엔드 응답을 맞춰 주세요.
4. `/dev/apis` 화면의 "연결" 열에서 어떤 API가 실제/목업인지 볼 수 있어요.

**전환 순서**: 회원·인증 → 상품 → 경매 → 장바구니 → 주문·결제 → 배송·정산·환불·리뷰. 앞 단계 데이터가 실제 DB에 있어야 다음 단계를 확인할 수 있어요 (예: 실제 상품이 있어야 실제 경매가 생겨요). 로컬에서 테스트할 때는 앞 단계 API까지 함께 켜거나, Swagger로 데이터를 먼저 만들어 두세요.

실제 로그인 토큰을 목업 API에 보내도 목업 서버가 받아 줘요. 토큰에 들어 있는 이메일이 체험용 계정과 같으면 그 회원으로, 아니면 `demo@jjinmak.kr`로 처리해요. 그래서 인증만 실제로 바꾸고 나머지는 목업으로 둘 수 있어요.

## 백엔드 연결 설정

| 환경 | 요청 경로 | 전달 |
|---|---|---|
| 로컬 | `/api/...` | `vite.config.ts`의 proxy → `VITE_DEV_PROXY_TARGET` (기본 `http://localhost:8080`) |
| 배포 | `/api/...` | `vercel.json`의 rewrites → `http://15.165.93.37:8080` |

- 로컬 백엔드 없이 개발 서버에 붙이려면 `.env.development.local`에 `VITE_DEV_PROXY_TARGET=http://15.165.93.37:8080`을 적어요.
- 공통 요청 함수가 `Authorization: Bearer <accessToken>` 헤더를 붙이고, 응답 `{ isSuccess, message, data }`에서 `data`를 꺼내요. 바디가 없는 응답(201·204)도 처리해요.
- **백엔드에 HTTPS 도메인이 생기면**: Vercel 환경변수 `VITE_API_BASE_URL=https://api.도메인`을 설정하고 `vercel.json`의 `/api` 규칙을 지워요. 이때 백엔드 CORS에 Vercel 주소를 허용해야 해요.

## Vercel 배포

1. Vercel에서 이 레포를 Import해요 (Framework: Vite, Build: `npm run build`, Output: `dist`).
2. 별도 환경변수 없이 배포하면 목업 상태로 동작해요.
3. `vercel.json`에 백엔드 전달(`/api/*`)과 SPA 경로 처리(모든 경로 → `index.html`)가 들어 있어요.

## 와이어프레임과 다른 점

1. 주소 방식: HashRouter(`/#/auctions`) → BrowserRouter(`/auctions`)
2. 공통 요청 함수: 항상 목업 → API별 목업/실제 전환
3. 목업 서버: 실제 로그인 토큰(JWT)도 허용
4. 경매 상세: 종료된 경매에서 `minBidPrice`가 null이어도 화면이 깨지지 않음
5. 입찰 내역 "더 보기": `size`를 키우는 방식 → page를 이어 붙이는 방식 (백엔드 size 최대 50 대응)
6. `/dev/apis`: API마다 실제/목업 표시 열 추가
