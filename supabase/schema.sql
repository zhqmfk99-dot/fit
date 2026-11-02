-- Supabase SQL Editor에서 통째로 실행하세요. 여러 번 실행해도 안전합니다(이미 있는 테이블·데이터는 그대로 둡니다).
-- 모든 테이블은 user_id 기준 RLS로 "본인 데이터만" 접근 가능하게 한다.

-- 1) 운동 마스터 리스트 (exerciseCatalog)
create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  muscles    text[] not null default '{}',
  equipment  text,
  created_at timestamptz not null default now()
);

-- 2) 루틴 (routines) — 루틴 안 운동 목록은 jsonb로 보관
--    exercises 예: [{"exercise":"스쿼트","sets":5,"reps":5,"weight":80,"restSeconds":90,"linkedToNext":false}]
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  is_active   boolean not null default true,
  repeat_days text[] not null default '{}',
  exercises   jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

-- 3) 운동 기록 (workoutLogs) — 세트별 실제 수행값은 jsonb
--    performed_sets 예: [{"reps":5,"weight":80,"durationSeconds":null,"restBeforeSeconds":null}]
create table if not exists public.workout_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id    uuid,  -- routines.id (FK 없음: 클라이언트가 루틴/기록을 따로 저장하므로 순서 의존을 피함)
  date          date not null,
  exercise      text not null,
  target_sets   int,
  target_reps   int,
  target_weight numeric,
  rest_seconds  int,
  linked_to_next boolean not null default false,
  performed_sets jsonb not null default '[]',
  fatigue       int check (fatigue between 0 and 5),
  is_completed  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists workout_logs_user_id_date_idx on public.workout_logs (user_id, date);
create index if not exists exercises_user_id_idx on public.exercises (user_id);
create index if not exists routines_user_id_idx on public.routines (user_id);

-- RLS: 켜기
alter table public.exercises    enable row level security;
alter table public.routines     enable row level security;
alter table public.workout_logs enable row level security;

-- RLS: 로그인한 본인 행만 조회/추가/수정/삭제
drop policy if exists "own rows" on public.exercises;
create policy "own rows" on public.exercises
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.routines;
create policy "own rows" on public.routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows" on public.workout_logs;
create policy "own rows" on public.workout_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 권한: "Automatically expose new tables"를 껐으므로 로그인 사용자(authenticated)에게만 명시적으로 부여.
-- anon(비로그인)에게는 아무 권한도 주지 않는다.
grant select, insert, update, delete on public.exercises, public.routines, public.workout_logs to authenticated;

