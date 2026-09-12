# 뚠띠뚠띠

예찬과 다은 두 사람만 쓰는 개인용 PWA. 날짜별로 사진과 메모를 남기는 캘린더다.

**https://ddunddi.yeachan.cloud**

폰에서 홈 화면에 추가하면 아이콘과 스플래시가 있는 앱처럼 실행된다.
합류하는 사람은 [ONBOARDING.md](./ONBOARDING.md)를 먼저 읽으면 된다.

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Storage) · Vercel

의존성은 최소로 유지한다. 캘린더 UI 라이브러리는 쓰지 않고 `date-fns`로 직접 계산해 그린다.
PWA도 `next-pwa` 없이 `public/manifest.json`과 메타태그로 처리한다.

## 로컬 실행

```bash
npm install
npm run dev
```

`.env.local`을 직접 만들어야 한다. 형식은 `.env.example`에 있다.

| 변수 | 어디서 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면의 Publishable key (예전 이름 anon) |
| `GATE_PASSWORD` | 두 사람이 정하는 공유 비밀번호. 서버에서만 읽는다 |

`GATE_PASSWORD`에 `NEXT_PUBLIC_` 접두사를 붙이면 값이 브라우저 번들에 그대로 박혀
게이트가 의미를 잃는다. 붙이지 않는다.

같은 값 3개를 Vercel → Settings → Environment Variables 에도 넣는다.
`NEXT_PUBLIC_` 둘은 Type을 `Config`로, `GATE_PASSWORD`는 `Secret`으로 지정한다.
환경변수는 **새 배포부터** 적용되므로 값을 바꾸면 Redeploy가 필요하다.

## 배포

`main`에 push하면 Vercel이 자동 배포한다.

**커밋 author 이메일이 본인 GitHub 계정에 등록된 주소여야 한다.**
다르면 Vercel이 `Deployment Blocked`로 막고 빌드조차 시작하지 않는다.

```bash
git config user.email   # GitHub 계정 이메일과 같은지 확인
```

도메인은 Cloudflare DNS에 CNAME 한 줄로 붙어 있다. 프록시는 꺼야 한다(회색 구름).
켜면 Vercel이 소유 확인과 인증서 발급을 하지 못한다.

## 아이콘

```bash
npm run icons
```

`scripts/make-icons.mjs`가 아이콘 4개와 iOS 스플래시 11개를 `public/`에 생성한다.
색과 모양은 스크립트 상단 상수 몇 개로 바꾼다.

이모지를 SVG `<text>`로 올리지 않고 패스로 직접 그린다. `sharp`의 SVG 렌더러가
컬러 이모지 폰트를 지원하지 않아 검은 실루엣으로 래스터화되고, 결과가 머신에 설치된
폰트에 좌우되기 때문이다.

iOS 스플래시는 media 쿼리가 기기와 정확히 맞아야 뜬다. 기기 목록은
`lib/splash-devices.json` 한 곳에 있고 생성 스크립트와 `app/layout.tsx`가 같이 읽는다.
목록에 없는 기기는 흰 화면으로 뜬다. 안드로이드는 manifest로 자동 생성되어 해당 없다.

## 데이터

스키마는 `supabase/schema.sql` 한 파일에 있다. 테이블이 필요하면 그 파일에 적고:

```bash
npm run db:push
```

여러 번 실행해도 안전하다. 전체를 한 트랜잭션으로 돌리므로 절반만 적용되는 상태가 생기지 않는다.
`SUPABASE_DB_URL`이 필요하며 Session pooler 문자열을 쓴다(Direct connection은 IPv6 전용이라 대개
연결되지 않는다). 콘솔 SQL Editor에 직접 붙여넣어도 되지만, 설명 문장이 섞여 들어가기 쉽다.

- `dates` — 하루 한 레코드. `date`가 unique라 upsert의 충돌 기준으로 쓴다
- `date_photos` — `dates`에 종속. `on delete cascade`
- Storage 버킷 `date-photos` — public read

RLS는 켜두고 anon에 전권 정책을 준다. 끄는 것과 접근 범위는 같지만, Supabase는 RLS 해제를
권장하지 않아 대시보드에서 다시 켜질 여지가 있고, 정책으로 적어두면 의도가 코드에 남는다.

`storage.objects`는 Supabase가 RLS를 강제해 아예 끌 수 없다. 버킷 정책을 명시하지 않으면
anon 키 업로드가 전부 거부되므로 `schema.sql`에 select/insert 정책이 함께 있다.

### 보안에 대해

**모든 테이블에 anon 전권 정책이 걸려 있다. 프로젝트 URL과 anon 키를 아는 사람은
이 앱의 비밀번호와 무관하게 데이터를 읽고 쓸 수 있다.** anon 키는 브라우저 번들에
들어가므로 사실상 공개된 값이다. 둘만 쓰는 전제로 v0에서 의도적으로 택한 구조다.

비밀번호 게이트는 주소를 우연히 아는 사람의 접근을 막는 문일 뿐 보안 경계가 아니다.
남에게 보여줄 사진이나 글이 아니라면 이 구조를 먼저 바꾸는 게 맞다.

## 구조

```
app/
  layout.tsx            메타데이터 · PWA 메타태그 · iOS 스플래시 링크
  page.tsx              게이트 (비밀번호 → 이름 선택 → /calendar)
  api/gate/route.ts     비밀번호 검증. 서버에서만 비교한다
  (app)/
    layout.tsx          게이트 검사 + 하단 탭바 (3탭이 공유)
    calendar/page.tsx   월 캘린더
    us/page.tsx         준비 중
    poke/page.tsx       준비 중
lib/
  supabase.ts           anon 클라이언트, photoUrl()
  me.ts                 localStorage 키와 사람 목록
  splash-devices.json   iOS 스플래시 기기 목록
scripts/make-icons.mjs
supabase/schema.sql
```

## v0 진행 상황

| | 단계 | 상태 |
|---|---|---|
| 1 | 배포 + 커스텀 도메인 | 완료 |
| 2 | PWA 셸 (아이콘·스플래시·standalone) | 완료 |
| 3 | Supabase 스키마 | 완료 |
| 4 | 비밀번호 게이트 + 이름 선택 | 완료 |
| 5 | 월 캘린더 그리드 | 완료 |
| 6 | 날짜 상세 시트 — 사진 업로드, 메모 저장 | 진행 중 |
| 7 | 캘린더 셀 썸네일 | 예정 |

## 다음에 붙이면 좋을 것

v0 범위 밖이라 의도적으로 미뤘다. 스키마와 구조는 열어두었다.

**이미 자리만 잡아둔 것**
- `dates.title` — 컬럼만 있고 입력 UI가 없다
- `dates.place` — 같음
- `dates.body_source` — `'ai'`, `'edited'`를 받을 준비만 되어 있다
- `date_photos.taken_at` — EXIF에서 촬영 시각을 읽어 채우면 된다
- `date_photos.sort` — 사진 순서 바꾸기

**기능**
- 사진 삭제 — Storage에 delete 정책을 넣지 않아 앱에서 지울 수 없다.
  콘솔에서만 가능하다. `schema.sql`의 insert 정책과 같은 모양으로 하나 더 추가하면 된다
- 업로드 실패 시 재시도
- AI 일기 — 사진과 메모로 그날 글을 생성
- 콕 찌르기 — 푸시 알림
- 소개 페이지, 카카오톡 연동

**구조**
- 전권 정책을 걷어내고 제대로 된 인증과 사용자별 정책을 붙이기 (위 보안 항목 참고)
- 오프라인 캐시 (service worker)
- iOS 스플래시 기기 목록 확장 — 목록에 없는 기기는 흰 화면으로 뜬다
