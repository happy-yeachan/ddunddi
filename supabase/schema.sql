-- 뚠띠뚠띠 v0 스키마
-- Supabase 콘솔 → SQL Editor 에 그대로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto;

-- ── 테이블 ────────────────────────────────────────────────────────────────

-- 하루에 한 레코드. date 가 unique 라 upsert 의 충돌 기준으로 쓴다.
create table if not exists public.dates (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  title       text,
  body        text,                                   -- 메모. 나중에 AI 일기 본문 자리
  body_source text not null default 'human'
              check (body_source in ('human', 'ai', 'edited')),
  place       text,                                   -- v0 입력 UI 없음. 컬럼만 준비
  author      text check (author in ('yeachan', 'daeun')),
  created_at  timestamptz not null default now()
);

create table if not exists public.date_photos (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.dates(id) on delete cascade,
  path       text not null,                           -- Storage 경로
  taken_at   timestamptz,                             -- v0 null. 나중에 EXIF 로 채움
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- 캘린더는 "그 달 범위의 날짜 + 각 날짜의 첫 사진"을 한 번에 읽는다.
create index if not exists dates_date_idx on public.dates (date);
create index if not exists date_photos_date_id_sort_idx on public.date_photos (date_id, sort);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- v0 는 둘만 쓰는 앱이라 RLS 를 끄고 anon key 로 직접 접근한다.
-- 대가: anon key 와 프로젝트 URL 을 아는 사람은 누구나 데이터를 읽고 쓸 수 있다.
-- 의도된 선택이며 README 에도 적어두었다.
alter table public.dates       disable row level security;
alter table public.date_photos disable row level security;

-- ── Storage ───────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('date-photos', 'date-photos', true)
on conflict (id) do update set public = true;

-- storage.objects 는 RLS 를 끌 수 없어(Supabase 가 강제) 정책을 명시해야 한다.
-- 이것 없이는 anon key 업로드가 전부 거부된다.
drop policy if exists "date-photos read"   on storage.objects;
drop policy if exists "date-photos insert" on storage.objects;

create policy "date-photos read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'date-photos');

create policy "date-photos insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'date-photos');

-- 사진 삭제는 v0 범위 밖이라 delete 정책은 넣지 않았다.
-- 나중에 삭제 기능을 붙일 때 같은 모양으로 하나 더 추가하면 된다.
