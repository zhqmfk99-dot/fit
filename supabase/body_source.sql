-- 신체 기록의 "측정 기기" 표시: 집 체중계('home', 기본) / 보건소·체육관 인바디 같은 정밀 측정('precise').
-- Supabase SQL Editor에서 실행한다 (body_records.sql 실행 후). 여러 번 실행해도 안전하고 기존 기록은 모두 'home'이 된다.
-- 실행하지 않아도 앱은 동작한다 — 그때는 측정 기기 표시가 저장되지 않는다(앱을 다시 열면 사라지고, 입력 창에 안내가 뜬다).
--
-- 기계마다 체지방률·근육량 값이 다르게 나와서, 정밀 측정 기록은 "지금 값·추세·목표 진행" 계산에서 빼고 그래프·기록에만 따로 표시한다(앱 로직).

alter table public.body_records
  add column if not exists source text not null default 'home';

alter table public.body_records drop constraint if exists body_records_source_check;
alter table public.body_records
  add constraint body_records_source_check check (source in ('home', 'precise'));
