# 협업 작업 규칙

- 개발 전에 `ONBOARDING.md`와 `README.md`를 읽고 현재 구현과 작업 범위를 확인한다.
- 작업 전 브랜치와 미커밋 변경을 확인하고 `git pull --rebase`로 최신 변경을 반영한다. 기존 작업을 덮어쓰거나 버리지 않는다.
- 큰 기능은 `feature/<이름>` 브랜치에서 개발한다.
- 푸시 직전에도 반드시 pull을 수행한다. pull 전후 커밋과 diff를 확인하여 다른 협업자의 작업이 추가되었는지 확인하고, 해당 변경과 현재 작업을 통합한다.
- 충돌이 있으면 양쪽 작업 의도를 확인하여 해결하고, 통합 후 타입 검사와 빌드 등 변경에 맞는 검증을 수행한 뒤 푸시한다. 원격이 다시 변경되면 이 절차를 반복한다.
- 강제 푸시로 협업자의 커밋을 덮어쓰지 않는다. `main` 푸시는 Vercel 자동 배포로 이어진다.
- 환경변수 실제 값은 커밋하거나 로그에 출력하지 않는다.

## 커밋 메시지

다른 사람의 코드를 깨는 변경은 커밋 메시지 맨 끝에 `BREAKING:` 줄로 남긴다.
상대는 이 줄만 보고도 무엇이 바뀌었는지 알 수 있어야 한다. 커밋 메시지가
두 에이전트 사이에서 자동으로 전달되는 유일한 경로다.

한 줄에 하나씩, `파일 — 무엇이 어떻게` 형태로 적는다.

```
feat: 날짜별 메모를 각자 남기고 누가 썼는지 구분

(왜 그렇게 했는지 본문)

BREAKING: lib/records.ts — saveMemo 삭제. ensureDate + addNote 로 대체
BREAKING: loadDate 반환값에 notes 추가
BREAKING: supabase/schema.sql 변경 — npm run db:push 필요
```

무엇이 `BREAKING:` 인가:

- 함수·타입의 삭제, 이름 변경, 시그니처 변경
- 반환값이나 props 의 모양 변경
- `supabase/schema.sql` 변경 (상대도 `npm run db:push` 를 돌려야 한다)
- 환경변수 추가나 이름 변경
- 라우트 경로나 화면 흐름 변경

pull 후에는 새로 들어온 커밋 메시지에서 `BREAKING:` 을 먼저 확인한다.

```bash
# pull 로 새로 들어온 것만
git log HEAD@{1}..HEAD --format='%h %s%n%b' | grep '^BREAKING:'

# 최근 20개에서 찾기
git log -20 --format='%h %s%n%b' | grep '^BREAKING:'
```
