-- "내 정보" 모달과 회원 탈퇴를 위한 추가 설정.
-- Supabase SQL Editor에서 통째로 실행하세요. (auth_profiles.sql 실행 후 한 번만)

-- 1) 프로필 항목 추가 (BMI는 저장하지 않고 화면에서 키/몸무게로 계산)
alter table public.profiles
  add column if not exists gender    text,
  add column if not exists age       int  check (age between 1 and 120),
  add column if not exists height_cm numeric check (height_cm between 50 and 250),
  add column if not exists weight_kg numeric check (weight_kg between 10 and 500);

-- 2) 본인 프로필의 이름/성별/나이/키/몸무게만 수정 가능. (id, email은 수정 불가)
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
