# 뚠띠뚠띠 — 합류 안내

예찬·다은 두 사람만 쓰는 개인용 PWA. 날짜별로 사진과 메모를 남기는 캘린더다.
완성도보다 **지금 폰에서 쓸 수 있는가**가 기준이다.

- 배포: https://ddunddi.yeachan.cloud
- 저장소: https://github.com/happy-yeachan/ddunddi (private)

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · Vercel

의존성은 최소로 유지한다. 캘린더 UI 라이브러리는 쓰지 않고 `date-fns`로 직접 계산해 그린다.

## 로컬 실행

```bash
git clone https://github.com/happy-yeachan/ddunddi.git
cd ddunddi
npm install
npm run dev
```

`.env.local`을 직접 만들어야 한다. 형식은 `.env.example`에 있고, **실제 값은 예찬에게 직접 받는다.**
이 문서에도, 저장소에도 값은 없다.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GATE_PASSWORD=
```

## 배포

`main`에 push하면 Vercel이 자동 배포한다. 별도 명령 없음.

**커밋 author 이메일이 본인 GitHub 계정에 등록된 주소여야 한다.**
안 맞으면 Vercel이 `Deployment Blocked`로 막고 빌드조차 시작하지 않는다. 한 번 겪은 함정이다.

```bash
git config user.email  # GitHub 계정 이메일과 같은지 확인
```

## 데이터

테이블 두 개(`dates`, `date_photos`)와 Storage 버킷 하나(`date-photos`). 정의는 `supabase/schema.sql`에 있고
Supabase 콘솔 SQL Editor에서 실행한다. 여러 번 실행해도 안전하다.

**RLS를 꺼두었다.** 둘만 쓰는 전제로 v0에서 의도적으로 택한 구조이고,
프로젝트 URL과 anon 키를 아는 사람은 이 앱의 비밀번호와 무관하게 데이터에 접근할 수 있다.
비밀번호 게이트는 우연한 접근을 막는 문일 뿐 보안 경계가 아니다.

## v0 범위

여기까지만 만든다. 좋은 아이디어가 떠올라도 범위 밖이면 만들지 말고 목록으로만 남긴다.

1. 배포 + 커스텀 도메인 — **완료**
2. PWA (홈 화면 추가, 아이콘, 스플래시) — **완료**
3. Supabase 스키마 — **완료**
4. 비밀번호 게이트 + 예찬/다은 선택 — **완료**
5. 월 캘린더 그리드 (데이터 연결 없이 껍데기)
6. 날짜 상세 시트 — 사진 다중 업로드, 메모 저장
7. 캘린더 셀 배경에 사진 썸네일
8. README

**만들지 않는 것:** 로그인·회원가입·소셜인증, AI 일기, 콕 찌르기, 소개 페이지, 카카오톡 연동.
스키마와 폴더 구조만 나중에 붙일 수 있게 열어둔다.

## 파일 구조

```
app/
  page.tsx            게이트 (비밀번호 → 이름 선택 → /calendar)
  calendar/page.tsx   캘린더 (5단계에서 채움)
  api/gate/route.ts   비밀번호 검증 — 서버에서만 비교한다
lib/
  supabase.ts         anon 클라이언트
  me.ts               localStorage 키와 사람 목록
scripts/make-icons.mjs  아이콘·스플래시 PNG 생성 (`npm run icons`)
supabase/schema.sql
```

## 같이 작업할 때

한 저장소를 둘이 만지므로 충돌을 피할 규칙이 필요하다.

- **단계 단위로 나눠 잡는다.** 같은 단계를 동시에 건드리지 않는다
- 작업 전 `git pull --rebase`
- 큰 변경은 `feature/<이름>` 브랜치에서 하고 `main`으로 합친다
- 무엇을 잡았는지 서로 먼저 말한다

## 톤

- 파일 수를 최소로. 과도한 추상화·래퍼·유틸 레이어를 만들지 않는다
- 주석은 왜 그렇게 했는지가 필요한 곳에만
- 막히면 혼자 우회하지 말고 물어본다
