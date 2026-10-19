# 찐막 프론트엔드

레트로 게임 경매 서비스 **찐막**의 웹 프론트엔드입니다.

- 배포 주소: https://jjinmak.kro.kr (main에 머지하면 Vercel이 자동 배포, PR마다 미리보기 주소와 빌드 결과가 달려요)
- 기술 스택: React 18, TypeScript, Vite, React Router, TanStack Query
- API 목록: [docs/API_GUIDE.md](docs/API_GUIDE.md) (백엔드 도메인별 전환 키·화면·구현 상태)

## 지금 상태

```
화면(src/pages) → API 함수(src/api/endpoints.ts) → 공통 요청 함수(src/api/client.ts)
                                                     ├─ 목업이면 → src/mock (브라우저 안 가짜 서버)
                                                     └─ 실제이면 → /api/... → 백엔드
```

- 화면과 API 함수는 다 만들어져 있고, **모든 API가 목업**으로 동작해요. 배포 사이트도 목업이에요.
- API마다 **전환 키**(`auction.detail` 같은 이름)가 있어요. 키를 켜면 그 API만 실제 백엔드로 가요.
- 공통 요청 함수가 토큰 헤더를 붙이고, 응답 `{ isSuccess, message, data }`에서 `data`만 꺼내고, 401이면 토큰을 재발급해서 다시 요청해요.

## 진행 방식

```
1단계 (각자)  로컬 백엔드 + 로컬 프론트로 내 도메인 API를 붙여 보고
              응답에 맞게 프론트 로직을 고쳐서 PR → 머지
              (배포 사이트는 계속 목업이라 언제 머지해도 안전)

2단계 (한 번) 모든 도메인 로직이 머지되면 프론트 담당이 .env.production을 바꿔
              실제 API로 한꺼번에 배포
```

팀원은 **로직만** 올려요. `.env.development.local`은 git에 안 올라가고, `.env.production`은 건드리지 않아요.

## 1단계: 로컬에서 내 도메인 연동하기

### ① 백엔드 띄우기 (백엔드 레포)

```bash
docker compose -f docker-compose.local.yaml up -d
./gradlew bootRun --args='--spring.profiles.active=local'
```

평소 백엔드 개발할 때와 같아요. EC2 서버가 꺼져 있어도 상관없어요.

### ② 프론트 띄우기 (이 레포)

Node.js 20 이상이 필요해요.

```bash
npm install
npm run dev      # http://localhost:5173 (/api 요청은 localhost:8080으로 전달돼요)
```

이대로면 전부 목업이에요. 체험용 계정(비밀번호 `jjinmak1234!`)으로 화면을 먼저 둘러봐도 돼요.

### ③ 내 API 켜기

[docs/API_GUIDE.md](docs/API_GUIDE.md)에서 내 도메인의 전환 키를 찾아, 프로젝트 루트에 `.env.development.local` 파일을 만들고 **한 줄**만 적어요.

```
VITE_REAL_APIS=auth.login,product.detail,auction.detail,auction.bid
```

- `auth.login`은 **항상** 같이 켜요. 실제 API는 실제 로그인 토큰이 필요해요. (재발급·로그아웃은 자동으로 따라가요)
- 로그인은 회원가입 화면에서 만든 **로컬 DB 계정**으로 해요. 체험용 계정은 목업 전용이에요.
- 앞 도메인 데이터가 필요하면 그 키도 같이 켜고, 화면이나 Swagger(`localhost:8080/swagger-ui/index.html`)로 데이터를 먼저 만들어요. (예: 경매는 상품을 등록해야 생기고, `product.detail`의 `auctionId`로 조회해요)
- 파일을 고친 뒤에는 `npm run dev`를 **다시 실행**해요. `/dev/apis` 화면에서 키가 "실제"로 바뀌었는지 볼 수 있어요.

### ④ 화면에서 확인하고 로직 고치기

- 개발자도구(F12) → Network 탭에서 내 요청이 200인지 봐요. (목업은 Network 탭에 안 보여요)
- Response의 `data`를 `src/types/<도메인>.ts` 타입과 비교해요.
- 다르면 둘 중 하나로 맞춰요. 화면 코드는 가능하면 그대로 둬요.
  - 백엔드 DTO를 프론트 타입에 맞추기
  - `src/api/endpoints.ts`에서 경로를 고치거나 응답을 변환하기
- 백엔드에 아직 없는 API는 목업으로 두고 PR에 적어요.

### ⑤ PR 올리기

- `npm run build`가 통과하는지 확인해요 (타입 검사 포함).
- 고친 코드(타입·`endpoints.ts`·화면)만 올려요. `.env.production`은 건드리지 않아요.
- PR에 Vercel 빌드 결과(✅/❌)와 미리보기 주소가 달려요. ❌면 머지할 수 없어요.
- 백엔드 구현 상태가 바뀌었으면 `docs/API_GUIDE.md` 표도 같이 고쳐요.

> 서버 DB로 확인하고 싶을 때만 `.env.development.local`에 `VITE_DEV_PROXY_TARGET=http://15.165.93.37:8080`을 추가해요. 기본은 로컬 백엔드예요.

`VITE_DEV_PROXY_TARGET=http://15.165.93.37:8080` 이것도 -> Https로 바뀔예정이라 일단 로컬로 작업해주세요

## 2단계: 한꺼번에 배포 (프론트 담당)
