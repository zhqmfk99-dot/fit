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

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (user_id = auth.uid());

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert with check (user_id = auth.uid());
