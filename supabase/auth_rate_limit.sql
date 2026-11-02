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
