-- ⚠ 자동으로 만든 파일입니다. 직접 고치지 마세요(`npm run sql:build`가 다시 만듭니다).
--
-- Supabase SQL Editor에 이 파일 내용을 통째로 붙여넣어 실행하세요.
-- 새로 설치할 때도, 이미 쓰고 있는 DB를 최신으로 맞출 때도 이 파일 하나면 됩니다.
-- 모든 문장이 여러 번 실행해도 안전하게 되어 있어서(없을 때만 만들고, 기존 데이터는 그대로 둡니다) 새 SQL이 추가될 때마다 다시 실행하면 됩니다.
-- 아래 파일들이 이 순서로 들어 있습니다: schema.sql → auth_profiles.sql → profile_fields.sql → body_records.sql → seed_exercises.sql → log_kcal.sql → ai_usage.sql → user_settings.sql → unilateral.sql → log_skipped.sql → log_feel.sql → exercise_note.sql → auth_rate_limit.sql
--
-- 앱을 배포하기 **전에** 실행하세요(새 칼럼이 없는 상태에서 새 앱이 저장하면 일부 기능이 실패하거나 값이 유지되지 않습니다).

-- ======================================================================
-- schema.sql
-- ======================================================================

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

-- ======================================================================
-- auth_profiles.sql
-- ======================================================================

-- 이름 기반 아이디 찾기 / 비밀번호 찾기를 위한 프로필 테이블과 함수.
-- Supabase SQL Editor에서 통째로 실행하세요. (schema.sql 실행 후) 여러 번 실행해도 안전합니다.

-- 1) 프로필: 가입 시 입력한 이름과 이메일(아이디)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 로그인한 사용자는 본인 프로필만 조회 가능. (이름 검색은 아래 함수로만 가능)
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

grant select on public.profiles to authenticated;

-- 2) 가입 시 프로필 자동 생성 (이름은 signUp의 options.data.name 에서 가져옴)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(trim(new.raw_user_meta_data ->> 'name'), ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 사용자도 프로필 행을 만들어 둔다 (이름은 비어 있어 이름 검색에는 안 잡힘)
insert into public.profiles (id, email, name)
select id, email, coalesce(trim(raw_user_meta_data ->> 'name'), '')
from auth.users
on conflict (id) do nothing;

-- 3) 아이디 찾기
-- 이메일 일부를 *로 가린다(로그인 화면의 maskId와 같은 규칙): 앞부분이 4자 이하면 첫 글자만, 그보다 길면 앞 2자·뒤 2자만 보이고 도메인은 그대로.
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when position('@' in coalesce(p_email, '')) = 0 then coalesce(p_email, '')
    else
      case
        when length(split_part(p_email, '@', 1)) <= 4
          then left(split_part(p_email, '@', 1), 1) || repeat('*', greatest(length(split_part(p_email, '@', 1)) - 1, 0))
        else left(split_part(p_email, '@', 1), 2) || repeat('*', length(split_part(p_email, '@', 1)) - 4) || right(split_part(p_email, '@', 1), 2)
      end || '@' || split_part(p_email, '@', 2)
  end;
$$;
revoke all on function public.mask_email(text) from public;
-- 아이디 찾기: 이름이 같은 계정의 **가린 이메일** 목록 (로그인 전에도 호출 가능).
-- 전체 이메일을 돌려주면 이름을 하나씩 넣어 보는 것만으로 가입자 이메일을 모을 수 있어서, 일부를 가려서 돌려주고 한 번에 최대 5개만 준다.
create or replace function public.find_ids_by_name(p_name text)
returns table (email text)
language sql
security definer
set search_path = ''
stable
as $$
  select public.mask_email(p.email)
  from public.profiles p
  where length(trim(p_name)) > 0
    and lower(trim(p.name)) = lower(trim(p_name))
  order by p.created_at
  limit 5;
$$;

-- 4) 비밀번호 찾기 본인 확인: 아이디(이메일)와 이름이 모두 일치하는지 (로그인 전에도 호출 가능)
create or replace function public.check_id_name(p_email text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.email) = lower(trim(p_email))
      and length(trim(p_name)) > 0
      and lower(trim(p.name)) = lower(trim(p_name))
  );
$$;

revoke all on function public.find_ids_by_name(text) from public;
revoke all on function public.check_id_name(text, text) from public;
grant execute on function public.find_ids_by_name(text) to anon, authenticated;
grant execute on function public.check_id_name(text, text) to anon, authenticated;

-- ======================================================================
-- profile_fields.sql
-- ======================================================================

-- "내 정보" 모달과 회원 탈퇴를 위한 추가 설정.
-- Supabase SQL Editor에서 통째로 실행하세요. (auth_profiles.sql 실행 후) 여러 번 실행해도 안전합니다.

-- 1) 프로필 항목 추가 (BMI는 저장하지 않고 화면에서 키/몸무게로 계산)
alter table public.profiles
  add column if not exists gender    text,
  add column if not exists age       int  check (age between 1 and 120),
  add column if not exists height_cm numeric check (height_cm between 50 and 250),
  add column if not exists weight_kg numeric check (weight_kg between 10 and 500);

-- 2) 본인 프로필의 이름/성별/나이/키/몸무게만 수정 가능. (id, email은 수정 불가)
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant update (name, gender, age, height_cm, weight_kg) on public.profiles to authenticated;

-- 3) 회원 탈퇴: 로그인한 본인 계정을 삭제한다.
--    profiles, exercises, routines, workout_logs 는 auth.users 삭제 시 함께 삭제된다(on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ======================================================================
-- body_records.sql
-- ======================================================================

-- 신체 기록 테이블. Supabase SQL Editor에서 통째로 실행하세요. (profile_fields.sql 실행 후) 여러 번 실행해도 안전합니다.
-- 날짜당 한 건: 같은 날짜에 다시 저장하면 그 날짜의 기록을 덮어쓴다.

create table if not exists public.body_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date                date not null,
  height_cm           numeric check (height_cm between 50 and 250),
  weight_kg           numeric check (weight_kg between 10 and 500),
  bmi                 numeric,
  bone_mass_kg        numeric,
  body_fat_pct        numeric,
  muscle_mass_kg      numeric,
  muscle_pct          numeric,
  protein_pct         numeric,
  water_pct           numeric,
  skeletal_muscle_kg  numeric,
  bmr                 numeric,
  created_at          timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists body_records_user_id_date_idx on public.body_records (user_id, date);

alter table public.body_records enable row level security;

drop policy if exists "own rows" on public.body_records;
create policy "own rows" on public.body_records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.body_records to authenticated;

-- ======================================================================
-- seed_exercises.sql
-- ======================================================================

-- 운동 리스트 기본 데이터(120개)와 동작 패턴·운동 유형·태그 칼럼. Supabase SQL Editor에서 통째로 실행하세요. (schema.sql 실행 후)
-- 여러 번 실행해도 안전합니다.
--
-- [부위] 주동근 + 주요 보조근만 넣었다. 앱은 한 운동에 등록된 부위 전부에 같은 피로도를 반영하므로 미미한 안정화 근육까지 넣으면 인체도가 부정확해진다.
--        부위 값은 앱이 지원하는 17개 슬러그(src/lib/muscleMap.js)만 쓴다. 측면 어깨는 별도 부위가 없어 front-deltoids('어깨')로 둔다.
-- [동작 패턴] 밀기/당기기/스쿼트/힌지/런지/코어/기타. 상체 고립 운동은 푸시/풀 분할 기준(삼두·어깨 레이즈=밀기, 이두·후면 어깨=당기기).
-- [운동 유형] 복합관절/단관절. 아이소메트릭 코어 운동(플랭크 등)은 복합관절로 분류했다.
-- [태그] 같은 운동의 다른 이름(별칭·영문명·줄임말). 일반적으로 쓰이는 명칭 위주이며 모든 별칭을 망라한 것은 아니다.
-- [근거] 일반적으로 알려진 운동 해부학·프로그래밍 분류를 기준으로 하고, 일부는 Wikipedia 'List of weight training exercises'의
--        근육 분류와 교차 확인했다. 운동마다 ExRx.net·ACE 자료로 하나씩 대조한 것은 아니므로, 틀린 항목은 운동 리스트 화면에서 수정할 수 있다.
--
-- [안전장치] 같은 이름의 운동이 이미 있으면 새로 만들지 않는다. 이미 있는 운동은 동작 패턴·유형이 비어 있을 때,
--            태그가 비어 있을 때만 채운다(사용자가 직접 고친 값은 덮어쓰지 않는다).

-- 1) 칼럼 추가
alter table public.exercises
  add column if not exists movement_pattern text check (movement_pattern in ('밀기', '당기기', '스쿼트', '힌지', '런지', '코어', '기타')),
  add column if not exists exercise_type    text check (exercise_type in ('복합관절', '단관절')),
  add column if not exists tags             text[] not null default '{}';

-- 2) 기본 운동 지급 함수
create or replace function public.seed_default_exercises(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with v(name, muscles, equipment, movement_pattern, exercise_type, tags) as (
    values
    ('벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '바벨', '밀기', '복합관절', array['벤치', '바벨 벤치프레스', 'Bench Press', 'BP']::text[]),
    ('인클라인 벤치프레스', array['chest', 'front-deltoids', 'triceps']::text[], '바벨', '밀기', '복합관절', array['인클라인 벤치', 'Incline Bench Press']::text[]),
    ('스미스머신 벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '스미스머신', '밀기', '복합관절', array['스미스 벤치', 'Smith Bench Press']::text[]),
    ('덤벨 벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '덤벨', '밀기', '복합관절', array['덤벨 프레스', 'DB 벤치프레스', 'Dumbbell Bench Press']::text[]),
    ('인클라인 덤벨 프레스', array['chest', 'front-deltoids', 'triceps']::text[], '덤벨', '밀기', '복합관절', array['인클라인 덤벨 벤치', 'Incline Dumbbell Press']::text[]),
    ('덤벨 플라이', array['chest', 'front-deltoids']::text[], '덤벨', '밀기', '단관절', array['체스트 플라이', 'Dumbbell Fly']::text[]),
    ('체스트 프레스 머신', array['chest', 'triceps', 'front-deltoids']::text[], '머신', '밀기', '복합관절', array['머신 체스트 프레스', 'Chest Press Machine']::text[]),
    ('펙덱 플라이', array['chest', 'front-deltoids']::text[], '머신', '밀기', '단관절', array['펙덱', '팩덱', '버터플라이', 'Pec Deck']::text[]),
    ('케이블 크로스오버', array['chest', 'front-deltoids']::text[], '케이블', '밀기', '단관절', array['크로스오버', 'Cable Crossover']::text[]),
    ('푸시업', array['chest', 'triceps', 'front-deltoids']::text[], '맨몸', '밀기', '복합관절', array['팔굽혀펴기', '푸쉬업', 'Push-up']::text[]),
    ('딥스', array['chest', 'triceps', 'front-deltoids']::text[], '맨몸', '밀기', '복합관절', array['딥', '평행봉 딥스', 'Dips']::text[]),
    ('데드리프트', array['lower-back', 'hamstring', 'gluteal', 'trapezius']::text[], '바벨', '힌지', '복합관절', array['데드', '컨벤셔널 데드리프트', 'Deadlift']::text[]),
    ('루마니안 데드리프트', array['hamstring', 'gluteal', 'lower-back']::text[], '바벨', '힌지', '복합관절', array['RDL', '루마니안 데드', 'Romanian Deadlift']::text[]),
    ('바벨 로우', array['upper-back', 'lower-back', 'biceps', 'back-deltoids']::text[], '바벨', '당기기', '복합관절', array['벤트오버 로우', '벤트오버 바벨 로우', 'Barbell Row', 'Bent-over Row']::text[]),
    ('덤벨 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '덤벨', '당기기', '복합관절', array['원암 덤벨 로우', 'Dumbbell Row', 'One-arm Row']::text[]),
    ('시티드 케이블 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '케이블', '당기기', '복합관절', array['케이블 로우', '시티드 로우', 'Seated Cable Row']::text[]),
    ('랫풀다운', array['upper-back', 'biceps']::text[], '케이블', '당기기', '복합관절', array['랫 풀다운', '랫풀', 'Lat Pulldown']::text[]),
    ('풀업', array['upper-back', 'biceps']::text[], '맨몸', '당기기', '복합관절', array['턱걸이', '풀 업', 'Pull-up']::text[]),
    ('친업', array['upper-back', 'biceps']::text[], '맨몸', '당기기', '복합관절', array['친 업', '언더그립 턱걸이', 'Chin-up']::text[]),
    ('하이퍼익스텐션', array['lower-back', 'gluteal', 'hamstring']::text[], '맨몸', '힌지', '단관절', array['백 익스텐션', '로만체어', 'Back Extension', 'Hyperextension']::text[]),
    ('슈러그', array['trapezius']::text[], '덤벨', '당기기', '단관절', array['덤벨 슈러그', 'Shrug']::text[]),
    ('오버헤드프레스', array['front-deltoids', 'triceps']::text[], '바벨', '밀기', '복합관절', array['OHP', '밀리터리 프레스', '숄더프레스', 'Overhead Press', 'Military Press']::text[]),
    ('덤벨 숄더프레스', array['front-deltoids', 'triceps']::text[], '덤벨', '밀기', '복합관절', array['DB 숄더프레스', 'Dumbbell Shoulder Press']::text[]),
    ('아놀드 프레스', array['front-deltoids', 'triceps']::text[], '덤벨', '밀기', '복합관절', array['Arnold Press']::text[]),
    ('머신 숄더프레스', array['front-deltoids', 'triceps']::text[], '머신', '밀기', '복합관절', array['숄더프레스 머신', 'Shoulder Press Machine']::text[]),
    ('사이드 레터럴 레이즈', array['front-deltoids']::text[], '덤벨', '밀기', '단관절', array['사레레', '레터럴 레이즈', '측면 레이즈', 'Lateral Raise']::text[]),
    ('프론트 레이즈', array['front-deltoids']::text[], '덤벨', '밀기', '단관절', array['Front Raise']::text[]),
    ('벤트오버 레터럴 레이즈', array['back-deltoids', 'upper-back']::text[], '덤벨', '당기기', '단관절', array['리어 델트 레이즈', '후면 레이즈', 'Rear Delt Raise']::text[]),
    ('리버스 펙덱', array['back-deltoids', 'upper-back']::text[], '머신', '당기기', '단관절', array['리어 델트 플라이', 'Reverse Pec Deck', 'Rear Delt Fly']::text[]),
    ('페이스 풀', array['back-deltoids', 'upper-back', 'trapezius']::text[], '케이블', '당기기', '복합관절', array['Face Pull']::text[]),
    ('바벨 컬', array['biceps', 'forearm']::text[], '바벨', '당기기', '단관절', array['바벨컬', 'Barbell Curl']::text[]),
    ('덤벨 컬', array['biceps', 'forearm']::text[], '덤벨', '당기기', '단관절', array['덤벨컬', 'Dumbbell Curl']::text[]),
    ('해머 컬', array['biceps', 'forearm']::text[], '덤벨', '당기기', '단관절', array['해머컬', 'Hammer Curl']::text[]),
    ('케이블 푸시다운', array['triceps']::text[], '케이블', '밀기', '단관절', array['푸시다운', '트라이셉스 푸시다운', 'Triceps Pushdown']::text[]),
    ('라잉 트라이셉스 익스텐션', array['triceps']::text[], '바벨', '밀기', '단관절', array['스컬크러셔', '라잉 익스텐션', 'Skull Crusher']::text[]),
    ('오버헤드 트라이셉스 익스텐션', array['triceps']::text[], '덤벨', '밀기', '단관절', array['오버헤드 익스텐션', '프렌치 프레스', 'French Press']::text[]),
    ('클로즈그립 벤치프레스', array['triceps', 'chest', 'front-deltoids']::text[], '바벨', '밀기', '복합관절', array['클로즈 그립 벤치', 'Close-grip Bench Press', 'CGBP']::text[]),
    ('리스트 컬', array['forearm']::text[], '바벨', '당기기', '단관절', array['손목 컬', 'Wrist Curl']::text[]),
    ('스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '바벨', '스쿼트', '복합관절', array['백스쿼트', '바벨 스쿼트', 'Back Squat', 'Squat']::text[]),
    ('프론트 스쿼트', array['quadriceps', 'gluteal']::text[], '바벨', '스쿼트', '복합관절', array['Front Squat']::text[]),
    ('스미스머신 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '스미스머신', '스쿼트', '복합관절', array['스미스 스쿼트', 'Smith Squat']::text[]),
    ('고블릿 스쿼트', array['quadriceps', 'gluteal']::text[], '덤벨', '스쿼트', '복합관절', array['Goblet Squat']::text[]),
    ('레그프레스', array['quadriceps', 'gluteal', 'hamstring']::text[], '머신', '스쿼트', '복합관절', array['레그 프레스', 'Leg Press']::text[]),
    ('레그 익스텐션', array['quadriceps']::text[], '머신', '스쿼트', '단관절', array['레그익스텐션', 'Leg Extension']::text[]),
    ('레그 컬', array['hamstring']::text[], '머신', '힌지', '단관절', array['레그컬', '라잉 레그 컬', '시티드 레그 컬', '햄스트링 컬', 'Leg Curl']::text[]),
    ('런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['Lunge']::text[]),
    ('불가리안 스플릿 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['불가리안 스쿼트', 'Bulgarian Split Squat', 'BSS']::text[]),
    ('힙 쓰러스트', array['gluteal', 'hamstring']::text[], '바벨', '힌지', '복합관절', array['힙쓰러스트', '힙 스러스트', 'Hip Thrust']::text[]),
    ('힙 어브덕션', array['abductors', 'gluteal']::text[], '머신', '기타', '단관절', array['어브덕터', '외전 머신', 'Hip Abduction']::text[]),
    ('힙 어덕션', array['adductor']::text[], '머신', '기타', '단관절', array['어덕터', '내전 머신', 'Hip Adduction']::text[]),
    ('카프 레이즈', array['calves']::text[], '머신', '기타', '단관절', array['종아리 레이즈', 'Calf Raise']::text[]),
    ('플랭크', array['abs', 'obliques']::text[], '맨몸', '코어', '복합관절', array['Plank']::text[]),
    ('크런치', array['abs']::text[], '맨몸', '코어', '단관절', array['복근 운동', 'Crunch']::text[]),
    ('레그 레이즈', array['abs']::text[], '맨몸', '코어', '단관절', array['누워서 다리 들기', 'Leg Raise']::text[]),
    ('행잉 레그 레이즈', array['abs', 'obliques']::text[], '맨몸', '코어', '단관절', array['매달려 다리 들기', 'Hanging Leg Raise']::text[]),
    ('케이블 크런치', array['abs']::text[], '케이블', '코어', '단관절', array['로프 크런치', 'Cable Crunch']::text[]),
    ('러시안 트위스트', array['obliques', 'abs']::text[], '맨몸', '코어', '단관절', array['Russian Twist']::text[]),
    ('사이드 플랭크', array['obliques']::text[], '맨몸', '코어', '복합관절', array['Side Plank']::text[]),
    ('디클라인 벤치프레스', array['chest', 'triceps', 'front-deltoids']::text[], '바벨', '밀기', '복합관절', array['디클라인 벤치', 'Decline Bench Press']::text[]),
    ('스미스머신 인클라인 프레스', array['chest', 'front-deltoids', 'triceps']::text[], '스미스머신', '밀기', '복합관절', array['스미스 인클라인', 'Smith Incline Press']::text[]),
    ('인클라인 체스트 프레스 머신', array['chest', 'front-deltoids', 'triceps']::text[], '머신', '밀기', '복합관절', array['인클라인 머신 프레스', 'Incline Chest Press Machine']::text[]),
    ('케이블 체스트 프레스', array['chest', 'triceps', 'front-deltoids']::text[], '케이블', '밀기', '복합관절', array['Cable Chest Press']::text[]),
    ('케이블 플라이', array['chest', 'front-deltoids']::text[], '케이블', '밀기', '단관절', array['케이블 체스트 플라이', 'Cable Fly']::text[]),
    ('덤벨 풀오버', array['chest', 'upper-back', 'triceps']::text[], '덤벨', '당기기', '단관절', array['풀오버', 'Pullover']::text[]),
    ('다이아몬드 푸시업', array['triceps', 'chest', 'front-deltoids']::text[], '맨몸', '밀기', '복합관절', array['클로즈 푸시업', 'Diamond Push-up']::text[]),
    ('디클라인 푸시업', array['chest', 'front-deltoids', 'triceps']::text[], '맨몸', '밀기', '복합관절', array['Decline Push-up']::text[]),
    ('스티프레그 데드리프트', array['hamstring', 'gluteal', 'lower-back']::text[], '바벨', '힌지', '복합관절', array['스티프 데드', 'Stiff-leg Deadlift', 'SLDL']::text[]),
    ('덤벨 루마니안 데드리프트', array['hamstring', 'gluteal', 'lower-back']::text[], '덤벨', '힌지', '복합관절', array['덤벨 RDL', 'Dumbbell Romanian Deadlift']::text[]),
    ('트랩바 데드리프트', array['quadriceps', 'gluteal', 'hamstring', 'lower-back', 'trapezius']::text[], '바벨', '힌지', '복합관절', array['헥스바 데드리프트', 'Trap Bar Deadlift', 'Hex Bar Deadlift']::text[]),
    ('스모 데드리프트', array['gluteal', 'adductor', 'quadriceps', 'hamstring']::text[], '바벨', '힌지', '복합관절', array['스모 데드', 'Sumo Deadlift']::text[]),
    ('굿모닝', array['hamstring', 'lower-back', 'gluteal']::text[], '바벨', '힌지', '복합관절', array['바벨 굿모닝', 'Good Morning']::text[]),
    ('티바 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '바벨', '당기기', '복합관절', array['T바 로우', 'T-bar Row']::text[]),
    ('스미스머신 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '스미스머신', '당기기', '복합관절', array['스미스 로우', 'Smith Row']::text[]),
    ('시티드 머신 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '머신', '당기기', '복합관절', array['머신 로우', 'Seated Row Machine']::text[]),
    ('인버티드 로우', array['upper-back', 'biceps', 'back-deltoids']::text[], '맨몸', '당기기', '복합관절', array['바디웨이트 로우', '호주식 턱걸이', 'Inverted Row']::text[]),
    ('와이드그립 랫풀다운', array['upper-back', 'biceps', 'back-deltoids']::text[], '케이블', '당기기', '복합관절', array['와이드 랫풀다운', 'Wide-grip Lat Pulldown']::text[]),
    ('스트레이트암 풀다운', array['upper-back']::text[], '케이블', '당기기', '단관절', array['스트레이트 암 풀다운', 'Straight-arm Pulldown']::text[]),
    ('어시스티드 풀업', array['upper-back', 'biceps']::text[], '머신', '당기기', '복합관절', array['어시스트 턱걸이', 'Assisted Pull-up']::text[]),
    ('업라이트 로우', array['trapezius', 'front-deltoids']::text[], '바벨', '당기기', '복합관절', array['Upright Row']::text[]),
    ('스미스머신 숄더프레스', array['front-deltoids', 'triceps']::text[], '스미스머신', '밀기', '복합관절', array['스미스 숄더프레스', 'Smith Shoulder Press']::text[]),
    ('케이블 레터럴 레이즈', array['front-deltoids']::text[], '케이블', '밀기', '단관절', array['Cable Lateral Raise']::text[]),
    ('밴드 풀 어파트', array['back-deltoids', 'upper-back', 'trapezius']::text[], '밴드', '당기기', '단관절', array['풀어파트', 'Band Pull-apart']::text[]),
    ('프리처 컬', array['biceps']::text[], '덤벨', '당기기', '단관절', array['프리쳐 컬', 'Preacher Curl']::text[]),
    ('EZ바 컬', array['biceps', 'forearm']::text[], '바벨', '당기기', '단관절', array['이지바 컬', 'EZ컬', 'EZ Bar Curl']::text[]),
    ('인클라인 덤벨 컬', array['biceps']::text[], '덤벨', '당기기', '단관절', array['Incline Dumbbell Curl']::text[]),
    ('컨센트레이션 컬', array['biceps']::text[], '덤벨', '당기기', '단관절', array['Concentration Curl']::text[]),
    ('케이블 컬', array['biceps', 'forearm']::text[], '케이블', '당기기', '단관절', array['Cable Curl']::text[]),
    ('밴드 컬', array['biceps']::text[], '밴드', '당기기', '단관절', array['Band Curl']::text[]),
    ('리버스 컬', array['forearm', 'biceps']::text[], '바벨', '당기기', '단관절', array['Reverse Curl']::text[]),
    ('트라이셉스 킥백', array['triceps']::text[], '덤벨', '밀기', '단관절', array['킥백', 'Triceps Kickback']::text[]),
    ('케이블 오버헤드 트라이셉스 익스텐션', array['triceps']::text[], '케이블', '밀기', '단관절', array['케이블 오버헤드 익스텐션']::text[]),
    ('밴드 푸시다운', array['triceps']::text[], '밴드', '밀기', '단관절', array['Band Pushdown']::text[]),
    ('벤치 딥스', array['triceps', 'front-deltoids', 'chest']::text[], '벤치', '밀기', '복합관절', array['벤치 딥', 'Bench Dips']::text[]),
    ('바디웨이트 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '맨몸', '스쿼트', '복합관절', array['맨몸 스쿼트', '에어 스쿼트', 'Bodyweight Squat']::text[]),
    ('핵 스쿼트', array['quadriceps', 'gluteal']::text[], '머신', '스쿼트', '복합관절', array['핵스쿼트', 'Hack Squat']::text[]),
    ('월싯', array['quadriceps']::text[], '맨몸', '스쿼트', '복합관절', array['Wall Sit']::text[]),
    ('스텝업', array['quadriceps', 'gluteal']::text[], '덤벨', '런지', '복합관절', array['Step-up']::text[]),
    ('리버스 런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['후방 런지', 'Reverse Lunge']::text[]),
    ('워킹 런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '덤벨', '런지', '복합관절', array['Walking Lunge']::text[]),
    ('사이드 런지', array['adductor', 'quadriceps', 'gluteal']::text[], '덤벨', '런지', '복합관절', array['측면 런지', 'Side Lunge']::text[]),
    ('글루트 브릿지', array['gluteal', 'hamstring']::text[], '맨몸', '힌지', '복합관절', array['힙 브릿지', 'Glute Bridge']::text[]),
    ('케이블 킥백', array['gluteal']::text[], '케이블', '힌지', '단관절', array['글루트 킥백', 'Cable Kickback']::text[]),
    ('케틀벨 스윙', array['gluteal', 'hamstring', 'lower-back']::text[], '기타', '힌지', '복합관절', array['KB 스윙', 'Kettlebell Swing']::text[]),
    ('시티드 카프 레이즈', array['calves']::text[], '머신', '기타', '단관절', array['Seated Calf Raise']::text[]),
    ('스탠딩 카프 레이즈', array['calves']::text[], '맨몸', '기타', '단관절', array['Standing Calf Raise']::text[]),
    ('싯업', array['abs']::text[], '맨몸', '코어', '단관절', array['윗몸일으키기', 'Sit-up']::text[]),
    ('바이시클 크런치', array['abs', 'obliques']::text[], '맨몸', '코어', '단관절', array['Bicycle Crunch']::text[]),
    ('데드버그', array['abs']::text[], '맨몸', '코어', '복합관절', array['Dead Bug']::text[]),
    ('AB 롤아웃', array['abs']::text[], '기타', '코어', '복합관절', array['앱 롤러', '복근 롤러', 'AB 휠', 'Ab Wheel']::text[]),
    ('케이블 우드초퍼', array['obliques', 'abs']::text[], '케이블', '코어', '복합관절', array['우드초퍼', 'Wood Chop']::text[]),
    ('팔로프 프레스', array['obliques', 'abs']::text[], '케이블', '코어', '복합관절', array['Pallof Press']::text[]),
    ('불가리안백 스윙', array['gluteal', 'hamstring', 'lower-back']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 스윙', 'Bulgarian Bag Swing']::text[]),
    ('불가리안백 스윙 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '불가리안백', '스쿼트', '복합관절', array['Swing Squat', 'Bulgarian Bag Swing Squat']::text[]),
    ('불가리안백 스핀', array['front-deltoids', 'obliques', 'abs', 'forearm']::text[], '불가리안백', '코어', '복합관절', array['불가리안 백 스핀', 'Bulgarian Bag Spin']::text[]),
    ('불가리안백 클린', array['quadriceps', 'gluteal', 'hamstring', 'upper-back']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 클린', 'Bulgarian Bag Clean']::text[]),
    ('불가리안백 스내치', array['gluteal', 'hamstring', 'upper-back', 'front-deltoids']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 스내치', 'Bulgarian Bag Snatch']::text[]),
    ('불가리안백 스쿼트', array['quadriceps', 'gluteal', 'hamstring']::text[], '불가리안백', '스쿼트', '복합관절', array['불가리안 백 스쿼트', 'Bulgarian Bag Squat']::text[]),
    ('불가리안백 런지', array['quadriceps', 'gluteal', 'hamstring']::text[], '불가리안백', '런지', '복합관절', array['불가리안 백 런지', 'Bulgarian Bag Lunge']::text[]),
    ('불가리안백 굿모닝', array['hamstring', 'lower-back', 'gluteal']::text[], '불가리안백', '힌지', '복합관절', array['불가리안 백 굿모닝', 'Bulgarian Bag Good Morning']::text[]),
    ('불가리안백 러시안 트위스트', array['obliques', 'abs']::text[], '불가리안백', '코어', '단관절', array['불가리안 백 러시안 트위스트', 'Bulgarian Bag Russian Twist']::text[])
  ),
  filled as (
    update public.exercises e
    set movement_pattern = coalesce(e.movement_pattern, v.movement_pattern),
        exercise_type    = coalesce(e.exercise_type, v.exercise_type),
        tags             = case when e.tags = '{}' then v.tags else e.tags end
    from v
    where e.user_id = p_user and e.name = v.name
    returning e.id
  )
  insert into public.exercises (user_id, name, muscles, equipment, movement_pattern, exercise_type, tags)
  select p_user, v.name, v.muscles, v.equipment, v.movement_pattern, v.exercise_type, v.tags
  from v
  where not exists (
    select 1 from public.exercises e where e.user_id = p_user and e.name = v.name
  );
$$;

-- 클라이언트(브라우저)에서는 호출할 수 없게 막는다. 아래 트리거와 이 SQL 실행 때만 쓰인다.
revoke all on function public.seed_default_exercises(uuid) from public;

-- 3) 이미 가입한 모든 사용자에게 채운다
select public.seed_default_exercises(id) from auth.users;

-- 4) 앞으로 가입하는 사용자에게도 자동으로 채운다 (profiles 행이 만들어질 때)
create or replace function public.seed_exercises_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_exercises(new.id);
  return new;
end;
$$;

drop trigger if exists on_profile_created_seed_exercises on public.profiles;
create trigger on_profile_created_seed_exercises
  after insert on public.profiles
  for each row execute function public.seed_exercises_for_new_user();

-- 신규 가입자에게 자동으로 넣고 싶지 않다면 아래 줄의 주석을 풀어 트리거만 제거하세요.
-- drop trigger if exists on_profile_created_seed_exercises on public.profiles;

-- ======================================================================
-- log_kcal.sql
-- ======================================================================

-- 운동 기록(workout_logs)에 소모 칼로리(kcal)를 저장하는 칼럼. Supabase SQL Editor에서 실행하세요.
-- ※ 앱을 배포하기 "전에" 실행해야 합니다. 이 칼럼이 없는 상태에서 새 앱이 운동 기록을 저장하면 저장이 실패합니다.
-- 여러 번 실행해도 안전합니다.
--
-- 값은 운동을 완료하거나 수정할 때 앱이 계산해서 넣습니다 (시간 기반 MET + 강도 보정 추정치, src/lib/calories.js).
-- 이미 있는 완료 기록은 앱을 열 때 체중을 알 수 있으면 자동으로 채워집니다.

alter table public.workout_logs
  add column if not exists kcal numeric check (kcal is null or kcal >= 0);

-- ======================================================================
-- ai_usage.sql
-- ======================================================================

-- AI 기능(Gemini) 호출 기록 — 서버 함수(api/generate-routine.js)가 사용자별 하루 호출 한도를 세는 데 쓴다.
-- 사용자는 자기 행을 읽고 추가만 할 수 있고, 수정·삭제는 할 수 없다(한도를 초기화하지 못하게).
-- Supabase SQL Editor에서 한 번 실행한다. AI 기능을 배포하기 전에 실행해야 한다(없으면 AI 호출이 거부된다).

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

-- 로그인한 사용자가 API로 자기 행을 읽고 추가할 수 있게 권한을 명시한다(수정·삭제는 일부러 주지 않음).
-- 새 테이블이 API에 자동으로 열리지 않는 프로젝트에서는 이 줄이 없으면 "permission denied"가 난다. 여러 번 실행해도 안전하다.
grant select, insert on public.ai_usage to authenticated;

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (user_id = auth.uid());

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert with check (user_id = auth.uid());
-- ── 한도 확인 + 기록을 한 번에(원자적으로) ────────────────────────────
-- 서버 함수(api/generate-routine.js)가 "조회 → 기록"을 따로 하면, 동시에 여러 요청을 보냈을 때 모두 한도 안으로 보여 한도를 넘겨 호출할 수 있다.
-- 이 함수는 사용자·종류별 잠금(advisory lock)을 잡고 최근 24시간 사용 횟수를 확인한 뒤 한도 안일 때만 한 줄을 기록한다.
--   반환: 이번 호출 뒤 남은 횟수(0 이상). 한도를 넘었으면 -1(기록하지 않음).
-- 호출한 사용자의 권한으로 실행되므로(security invoker) 위의 행 수준 보안 정책이 그대로 적용된다.
create or replace function public.consume_ai_usage(p_kind text, p_limit integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_kind is null or length(p_kind) = 0 or length(p_kind) > 20 or p_limit is null or p_limit < 0 then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;

  -- 같은 사용자·종류의 호출이 동시에 와도 한 번에 하나씩만 아래를 실행한다(트랜잭션이 끝나면 자동으로 풀림)
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_kind, 0));

  select count(*) into v_count
  from public.ai_usage
  where user_id = v_user and kind = p_kind and created_at >= now() - interval '24 hours';

  if v_count >= p_limit then
    return -1;
  end if;

  insert into public.ai_usage (user_id, kind) values (v_user, p_kind);
  return p_limit - v_count - 1;
end;
$$;

revoke all on function public.consume_ai_usage(text, integer) from public, anon;
grant execute on function public.consume_ai_usage(text, integer) to authenticated;

-- ======================================================================
-- user_settings.sql
-- ======================================================================

-- 앱 설정(테마·기본 휴식 시간·화면 꺼짐 방지·점진 과부하 자동 적용·AI 개인화 기본값)을 계정에 저장한다.
-- 기기를 바꿔도 같은 설정이 유지된다. Supabase SQL Editor에서 한 번 실행한다. (profile_fields.sql 실행 후)
-- 실행하지 않아도 앱은 동작한다 — 그때는 설정이 이 기기에만 저장된다.

alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- 설정은 JSON 객체여야 하고 너무 커지지 않게 제한한다
alter table public.profiles drop constraint if exists profiles_settings_valid;
alter table public.profiles
  add constraint profiles_settings_valid
  check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 4096);

-- 본인 프로필의 settings만 수정 가능 (update 정책은 profile_fields.sql에서 이미 만들어 둠)
grant update (settings) on public.profiles to authenticated;

-- ======================================================================
-- unilateral.sql
-- ======================================================================

-- 운동 리스트의 "한쪽씩 하는 운동" 표시. Supabase SQL Editor에서 실행하세요. (seed_exercises.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 한쪽씩 하는 운동(불가리안 스플릿 스쿼트, 원암 덤벨 로우 등)은 횟수를 **한쪽 기준**으로 적고, 앱이 볼륨·칼로리를 셀 때 양쪽(×2)으로 계산한다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 이 표시를 저장하지 않고 넘어가서 운동 저장이 실패하지는 않지만, 표시가 유지되지 않는다)

-- 1) 칼럼 추가
alter table public.exercises
  add column if not exists unilateral boolean not null default false;

-- 2) 기본 운동 중 한쪽씩 하는 운동에 표시한다. 같은 이름의 운동이 있는 모든 사용자에게 적용된다.
--    (번갈아 하며 전체 횟수로 세는 운동 — 워킹 런지, 러시안 트위스트, 번갈아 하는 덤벨 컬 등 — 은 넣지 않았다. 필요하면 운동 리스트에서 직접 표시하세요.)
update public.exercises
set unilateral = true
where unilateral = false
  and name in (
    '덤벨 로우', '런지', '불가리안 스플릿 스쿼트', '스텝업', '리버스 런지', '사이드 런지',
    '컨센트레이션 컬', '트라이셉스 킥백', '케이블 킥백', '케이블 레터럴 레이즈',
    '사이드 플랭크', '케이블 우드초퍼', '팔로프 프레스', '불가리안백 런지'
  );

-- 3) 앞으로 가입하는 사용자에게도 같은 표시를 한다 (seed_exercises.sql의 트리거 함수를 표시까지 하도록 바꾼다).
--    ※ seed_exercises.sql을 나중에 다시 실행하면 이 함수가 원래대로 돌아가니, 그 뒤에는 이 파일도 다시 실행하세요.
create or replace function public.seed_exercises_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_exercises(new.id);
  update public.exercises
  set unilateral = true
  where user_id = new.id
    and name in (
      '덤벨 로우', '런지', '불가리안 스플릿 스쿼트', '스텝업', '리버스 런지', '사이드 런지',
      '컨센트레이션 컬', '트라이셉스 킥백', '케이블 킥백', '케이블 레터럴 레이즈',
      '사이드 플랭크', '케이블 우드초퍼', '팔로프 프레스', '불가리안백 런지'
    );
  return new;
end;
$$;

-- ======================================================================
-- log_skipped.sql
-- ======================================================================

-- 운동 기록의 "건너뜀" 표시. Supabase SQL Editor에서 실행하세요. (schema.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 루틴을 종료하거나 운동을 건너뛰면, 하지 않은 운동 기록은 지우지 않고 skipped = true로 남긴다.
-- 이 표시가 있는 기록은 "아직 할 운동"으로 세지 않아서(메인 메뉴의 운동하기 카드·기록 화면의 시작하기 버튼), 루틴이 "운동 중"으로 남지 않는다.
-- 기록 화면에서 "다시 하기"를 누르면 skipped = false로 돌아간다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 이 값을 저장하지 않고 넘어가서 운동 기록 저장이 실패하지는 않지만,
-- 건너뜀이 앱을 다시 열면 "예정"으로 돌아간다.)
alter table public.workout_logs
  add column if not exists skipped boolean not null default false;

-- ======================================================================
-- log_feel.sql
-- ======================================================================

-- 운동 기록의 "체감 난이도"(쉬웠어요 easy / 적당해요 ok / 힘들었어요 hard). Supabase SQL Editor에서 실행하세요. (schema.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 운동 하나를 끝낸 뒤 사용자가 한 번 눌러 고르는 값이다. 점진 과부하 평가(lib/progression.js)가 이 값을 쓴다:
--   hard → 목표를 다 채웠어도 무게를 올리지 않고 유지, easy → 휴식·속도 때문에 유지하려던 판단을 풀어 줌(세트가 무너진 경우는 그대로 유지).
-- 비어 있으면(고르지 않음) 기존 규칙 그대로다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 이 값을 저장하지 않고 넘어가서 운동 기록 저장이 실패하지는 않지만,
-- 체감 난이도가 앱을 다시 열면 사라진다.)
alter table public.workout_logs
  add column if not exists feel text check (feel in ('easy', 'ok', 'hard'));

-- ======================================================================
-- exercise_note.sql
-- ======================================================================

-- 운동 리스트의 "메모"(기구 세팅·자세 포인트 등). Supabase SQL Editor에서 실행하세요. (schema.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 운동마다 자유롭게 적는 짧은 글(앱에서 300자까지)이다. 예: "벤치 높이 3, 시트 4 · 어깨뼈 모으고 내리기".
-- 운동 시작 화면(PWA)과 운동 상세 창에 보여 준다. AI(Gemini)로는 보내지 않는다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 메모를 저장 요청에서 빼서 운동 저장이 실패하지는 않지만,
-- 메모가 유지되지 않고 운동 등록·수정 폼에 안내가 뜬다.)
alter table public.exercises
  add column if not exists note text;

-- ======================================================================
-- auth_rate_limit.sql
-- ======================================================================

-- 아이디 찾기·비밀번호 찾기 본인 확인의 요청 횟수 제한. Supabase SQL Editor에서 실행하세요. 여러 번 실행해도 안전합니다.
-- 실행 순서: auth_profiles.sql → (기존 설치는 mask_find_ids.sql) → 이 파일. auth_profiles.sql을 다시 실행했다면 이 파일도 다시 실행하세요(함수가 원래대로 돌아갑니다).
--
-- 두 함수(find_ids_by_name, check_id_name)는 로그인 전에도 호출할 수 있어서, 이름·이메일을 하나씩 넣어 보며 가입자를 캐낼 수 있다.
-- 호출마다 기록하고 10분 안에 **같은 접속자(IP)에서 10번, 전체에서 200번**이 넘으면 'rate_limited' 오류로 막는다(앱이 안내 문구로 바꿔 보여 준다).
--   · 접속자는 요청 헤더의 cf-connecting-ip → x-real-ip → x-forwarded-for의 마지막 값 순으로 정한다(없으면 'unknown' 한 묶음).
--     맨 앞 x-forwarded-for 값은 접속자가 마음대로 적을 수 있어서 쓰지 않는다. 그래도 헤더를 속일 수 있는 구성이라면 IP별 제한은 우회될 수 있고,
--     그때도 전체 제한(200번/10분)이 마지막 방어선이다 — 대신 누군가 전체 제한을 채워 두면 다른 사람도 10분간 못 쓴다(아이디·비밀번호 찾기만, 로그인은 영향 없음).
--   · 막힌 호출은 기록하지 않는다. 하루 지난 기록은 호출할 때 지운다. 기록 테이블은 앱(anon·로그인 사용자)이 직접 읽거나 쓸 수 없다.
-- 이 SQL을 실행하지 않으면 제한이 없는 예전 함수가 그대로 동작한다.

do $$
begin
  if to_regprocedure('public.mask_email(text)') is null then
    raise exception 'mask_find_ids.sql(또는 auth_profiles.sql)을 먼저 실행하세요.';
  end if;
end $$;

create table if not exists public.auth_lookup_attempts (
  id bigserial primary key,
  kind text not null,
  bucket text not null,
  at timestamptz not null default now()
);
create index if not exists auth_lookup_attempts_kind_idx on public.auth_lookup_attempts (kind, bucket, at);
create index if not exists auth_lookup_attempts_at_idx on public.auth_lookup_attempts (at);
alter table public.auth_lookup_attempts enable row level security; -- 정책이 없으니 일반 역할은 접근할 수 없다
revoke all on public.auth_lookup_attempts from public, anon, authenticated;
revoke all on sequence public.auth_lookup_attempts_id_seq from public, anon, authenticated;

-- 횟수 확인 + 기록(같은 종류는 잠금으로 한 번에 하나씩 처리해서 동시에 보내도 한도를 넘지 못한다). 한도를 넘으면 'rate_limited'.
create or replace function public.auth_lookup_guard(p_kind text, p_ip_limit int, p_global_limit int, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json;
  parts text[];
  ip text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    headers := null;
  end;
  parts := string_to_array(coalesce(headers->>'x-forwarded-for', ''), ',');
  ip := left(
    coalesce(
      nullif(trim(headers->>'cf-connecting-ip'), ''),
      nullif(trim(headers->>'x-real-ip'), ''),
      nullif(trim(parts[array_length(parts, 1)]), ''),
      'unknown'
    ),
    64
  );

  perform pg_advisory_xact_lock(hashtext('auth_lookup:' || p_kind));
  delete from public.auth_lookup_attempts where at < now() - interval '1 day';

  if (select count(*) from public.auth_lookup_attempts where kind = p_kind and bucket = ip and at > now() - p_window) >= p_ip_limit
     or (select count(*) from public.auth_lookup_attempts where kind = p_kind and at > now() - p_window) >= p_global_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.auth_lookup_attempts (kind, bucket) values (p_kind, ip);
end;
$$;
revoke all on function public.auth_lookup_guard(text, int, int, interval) from public, anon, authenticated;

-- 아이디 찾기: 이름이 같은 계정의 가린 이메일(최대 5개) — 호출마다 횟수 확인
create or replace function public.find_ids_by_name(p_name text)
returns table (email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.auth_lookup_guard('find_id', 10, 200, interval '10 minutes');
  return query
    select public.mask_email(p.email)
    from public.profiles p
    where length(trim(p_name)) > 0
      and lower(trim(p.name)) = lower(trim(p_name))
    order by p.created_at
    limit 5;
end;
$$;

-- 비밀번호 찾기 본인 확인: 아이디(이메일)와 이름이 모두 일치하는지 — 호출마다 횟수 확인
create or replace function public.check_id_name(p_email text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.auth_lookup_guard('check_id', 10, 200, interval '10 minutes');
  return exists (
    select 1
    from public.profiles p
    where lower(p.email) = lower(trim(p_email))
      and length(trim(p_name)) > 0
      and lower(trim(p.name)) = lower(trim(p_name))
  );
end;
$$;

revoke all on function public.find_ids_by_name(text) from public;
revoke all on function public.check_id_name(text, text) from public;
grant execute on function public.find_ids_by_name(text) to anon, authenticated;
grant execute on function public.check_id_name(text, text) to anon, authenticated;
