-- 운동 포인트: 운동한 날 +10, 주간 운동 목표를 채운 주 +30 (아바타·방 꾸미기에 쓰는 포인트).
-- Supabase SQL Editor에서 실행한다 (schema.sql·user_settings.sql 실행 후). 여러 번 실행해도 안전하다.
-- 실행하지 않아도 앱은 동작한다 — 그때는 포인트 카드가 보이지 않는다.
--
-- 포인트는 클라이언트가 숫자를 정해 넣지 못한다. 앱은 claim_points()만 부르고, 함수가 서버에서 workout_logs(완료한 기록)와
-- 프로필 설정의 주간 목표를 직접 읽어 포인트를 지급한다. 같은 날·같은 주는 unique 제약으로 한 번만 지급된다.
-- (기록 자체는 사용자가 직접 고칠 수 있으므로 가짜 기록으로 모으는 것까지는 막지 못한다 — 포인트 숫자를 마음대로 넣는 것만 막는다.)

create table if not exists public.point_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null,
  ref        text not null,                    -- workout_day: 운동한 날(YYYY-MM-DD) / weekly_goal: 그 주 월요일 / pet_egg: 펫 id / pet_feed: 펫 id:번호
  points     int  not null check (points <> 0),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

-- 종류와 부호: 번 포인트(양수)는 workout_day·weekly_goal, 쓴 포인트(음수)는 pet_egg·pet_feed. 이미 만든 테이블에도 적용되게 매번 다시 건다.
alter table public.point_events drop constraint if exists point_events_kind_check;
alter table public.point_events drop constraint if exists point_events_kind_points_check;
alter table public.point_events
  add constraint point_events_kind_points_check
  check ((kind in ('workout_day', 'weekly_goal') and points > 0) or (kind in ('pet_egg', 'pet_feed') and points < 0));

create index if not exists point_events_user_id_idx on public.point_events (user_id, created_at);

alter table public.point_events enable row level security;

-- 본인 내역만 조회 가능. 추가·수정·삭제는 아래 함수로만 한다(직접 쓰기 권한 없음).
drop policy if exists "own events" on public.point_events;
create policy "own events" on public.point_events
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.point_events from anon, authenticated;
grant select on public.point_events to authenticated;

-- 내부 함수: 기간 안에 "완료한 세트가 있는" 운동한 날 (사용자가 직접 부를 수 없다)
create or replace function public._point_days(p_user uuid, p_from date, p_to date)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select distinct l.date
  from public.workout_logs l
  where l.user_id = p_user
    and l.is_completed
    and l.date between p_from and p_to
    and jsonb_typeof(l.performed_sets) = 'array'
    and exists (
      select 1
      from jsonb_array_elements(l.performed_sets) s
      where (s ->> 'reps') ~ '^[0-9]+(\.[0-9]+)?$' and (s ->> 'reps')::numeric > 0
    )
$$;

revoke all on function public._point_days(uuid, date, date) from public, anon, authenticated;

-- 새로 지급된 포인트 합계를 돌려준다(없으면 0). 최근 14일의 운동한 날과 그 주들의 주간 목표만 본다.
create or replace function public.claim_points()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid       uuid := auth.uid();
  today     date := (now() at time zone 'Asia/Seoul')::date;
  from_day  date := (now() at time zone 'Asia/Seoul')::date - 14;
  goal      int;
  gained    int := 0;
  n         int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 같은 사용자의 포인트 지급·사용을 한 번에 하나씩 처리한다(펫 먹이와 같은 잠금)
  perform pg_advisory_xact_lock(hashtextextended('points:' || uid::text, 0));

  -- 1) 운동한 날 +10
  with ins as (
    insert into public.point_events (user_id, kind, ref, points)
    select uid, 'workout_day', d::text, 10
    from public._point_days(uid, from_day, today + 1) d
    on conflict (user_id, kind, ref) do nothing
    returning points
  )
  select coalesce(sum(points), 0) into n from ins;
  gained := gained + n;

  -- 2) 주간 운동 목표를 채운 주 +30 (주는 월요일 시작, 목표는 프로필 설정의 weeklyGoalDays)
  select case when (settings ->> 'weeklyGoalDays') ~ '^[1-7]$' then (settings ->> 'weeklyGoalDays')::int end
    into goal
  from public.profiles
  where id = uid;

  if goal is not null then
    with weeks as (
      select date_trunc('week', d::timestamp)::date as wk, count(*) as days
      from public._point_days(uid, date_trunc('week', from_day::timestamp)::date, today + 1) d
      group by 1
    ), ins as (
      insert into public.point_events (user_id, kind, ref, points)
      select uid, 'weekly_goal', wk::text, 30
      from weeks
      where days >= goal
      on conflict (user_id, kind, ref) do nothing
      returning points
    )
    select coalesce(sum(points), 0) into n from ins;
    gained := gained + n;
  end if;

  return gained;
end;
$$;

revoke all on function public.claim_points() from public, anon;
grant execute on function public.claim_points() to authenticated;

-- ======================================================================
-- 펫 키우기: 알 → 아기 → 청소년 → 다 자란 단계. 포인트로 먹이를 주면 경험치(1P = 1)가 오른다.
-- 종류는 부화할 때 서버가 무작위로 정한다. 가격·단계 기준은 앱(src/lib/pet.js)과 같아야 한다.
--   부화 20 · 청소년 80 · 다 자람 200 / 첫 알은 무료, 이후 알은 50P / 키우는 펫은 한 마리(다 키우면 도감으로)
-- ======================================================================

create table if not exists public.pets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species      text check (species in ('chick', 'dragon', 'cat', 'fish')),  -- 부화 전에는 null
  xp           int  not null default 0 check (xp between 0 and 200),
  created_at   timestamptz not null default now(),
  hatched_at   timestamptz,
  completed_at timestamptz
);

-- 키우는 중인 펫(completed_at이 비어 있는 행)은 사용자마다 하나만
create unique index if not exists pets_one_active_idx on public.pets (user_id) where completed_at is null;

alter table public.pets enable row level security;

drop policy if exists "own pets" on public.pets;
create policy "own pets" on public.pets
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.pets from anon, authenticated;
grant select on public.pets to authenticated;

-- 새 알 받기: 첫 알은 무료, 이후는 50P. 키우는 펫이 있으면 거부한다.
create or replace function public.pet_adopt()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  cost    int;
  balance int;
  pid     uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('points:' || uid::text, 0));

  if exists (select 1 from public.pets where user_id = uid and completed_at is null) then
    raise exception 'already_has_pet' using errcode = 'P0001';
  end if;

  cost := case when exists (select 1 from public.pets where user_id = uid) then 50 else 0 end;
  if cost > 0 then
    select coalesce(sum(points), 0) into balance from public.point_events where user_id = uid;
    if balance < cost then
      raise exception 'not_enough_points' using errcode = 'P0001';
    end if;
  end if;

  insert into public.pets (user_id) values (uid) returning id into pid;
  if cost > 0 then
    insert into public.point_events (user_id, kind, ref, points) values (uid, 'pet_egg', pid::text, -cost);
  end if;
  return pid;
end;
$$;

-- 먹이 주기: p_amount(1~50)만큼 포인트를 써서 경험치를 올린다. 다 자라는 데 필요한 양까지만 쓰고 넘치는 포인트는 쓰지 않는다.
create or replace function public.pet_feed(p_amount int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  pet     public.pets;
  amt     int;
  balance int;
  new_xp  int;
  kinds   text[] := array['chick', 'dragon', 'cat', 'fish'];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 50 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('points:' || uid::text, 0));

  select * into pet from public.pets where user_id = uid and completed_at is null;
  if not found then
    raise exception 'no_pet' using errcode = 'P0001';
  end if;

  amt := least(p_amount, 200 - pet.xp);
  select coalesce(sum(points), 0) into balance from public.point_events where user_id = uid;
  if balance < amt then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;

  insert into public.point_events (user_id, kind, ref, points)
  values (uid, 'pet_feed', pet.id::text || ':' || gen_random_uuid()::text, -amt);

  new_xp := pet.xp + amt;
  update public.pets
  set xp = new_xp,
      species = coalesce(species, case when new_xp >= 20 then kinds[1 + floor(random() * 4)::int] end),
      hatched_at = coalesce(hatched_at, case when new_xp >= 20 then now() end),
      completed_at = case when new_xp >= 200 then now() end
  where id = pet.id;
end;
$$;

revoke all on function public.pet_adopt() from public, anon;
revoke all on function public.pet_feed(int) from public, anon;
grant execute on function public.pet_adopt() to authenticated;
grant execute on function public.pet_feed(int) to authenticated;

-- 내가 쓸 수 있는 포인트(번 것 − 쓴 것). 내역이 많아져도(조회 1000행 제한) 앱이 정확한 잔액을 알도록 서버에서 합친다. 본인 행만 합산된다(RLS).
create or replace function public.point_balance()
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(points), 0)::int from public.point_events
$$;

revoke all on function public.point_balance() from public, anon;
grant execute on function public.point_balance() to authenticated;