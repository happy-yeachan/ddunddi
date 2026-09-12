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

-- 가볍게 서로에게 신호를 남기는 찌르기 기록
create table if not exists public.pokes (
  id         uuid primary key default gen_random_uuid(),
  sender     text not null check (sender in ('yeachan', 'daeun')),
  recipient  text not null check (recipient in ('yeachan', 'daeun')),
  created_at timestamptz not null default now()
);

create index if not exists pokes_created_at_idx on public.pokes (created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- 둘만 쓰는 앱이라 anon key 로 전부 읽고 쓴다.
--
-- RLS 를 끄는 대신 켜두고 전권 정책을 준다. 효과는 같지만 Supabase 는
-- RLS 해제를 권장하지 않아 대시보드에서 다시 켜질 여지가 있고,
-- 정책으로 적어두면 "누구나 접근 가능"이라는 의도가 코드에 남는다.
--
-- 대가: anon key 와 프로젝트 URL 을 아는 사람은 누구나 데이터를 읽고 쓸 수 있다.
-- anon key 는 브라우저 번들에 들어가므로 사실상 공개된 값이다. README 참고.
alter table public.dates       enable row level security;
alter table public.date_photos enable row level security;
alter table public.pokes       enable row level security;

drop policy if exists "dates anon all"       on public.dates;
drop policy if exists "date_photos anon all" on public.date_photos;
drop policy if exists "pokes anon all"       on public.pokes;

create policy "dates anon all"
  on public.dates for all
  to anon, authenticated
  using (true) with check (true);

create policy "date_photos anon all"
  on public.date_photos for all
  to anon, authenticated
  using (true) with check (true);

create policy "pokes anon all"
  on public.pokes for all
  to anon, authenticated
  using (true) with check (true);

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
