-- 신체 기록 테이블. Supabase SQL Editor에서 통째로 실행하세요. (profile_fields.sql 실행 후 한 번만)
-- 날짜당 한 건: 같은 날짜에 다시 저장하면 그 날짜의 기록을 덮어쓴다.

create table public.body_records (
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

create index on public.body_records (user_id, date);

alter table public.body_records enable row level security;

create policy "own rows" on public.body_records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.body_records to authenticated;
