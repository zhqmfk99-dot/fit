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
