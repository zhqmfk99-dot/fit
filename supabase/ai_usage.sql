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