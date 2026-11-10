-- 루틴 날짜 변경의 "원래 날짜" 표시: 세션을 다른 날짜로 옮기면 옮긴 기록에 비워진 날짜를 남겨서, 앱을 다시 열 때(자정이 지난 뒤 등) 그 날짜에 예정 기록이 다시 생기지 않게 한다.
-- Supabase SQL Editor에서 실행한다 (schema.sql 실행 후). 여러 번 실행해도 안전하고 기존 기록은 빈 목록이 된다.
-- 실행하지 않아도 앱은 동작한다 — 그때는 날짜를 바꿔도 앱을 다시 열면 원래 날짜에 같은 운동이 다시 생길 수 있고, 날짜 변경 창에 안내가 뜬다.

alter table public.workout_logs
  add column if not exists moved_from date[] not null default '{}';
