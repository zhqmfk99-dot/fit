-- 운동 기록의 "건너뜀" 표시. Supabase SQL Editor에서 실행하세요. (schema.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 루틴을 종료하거나 운동을 건너뛰면, 하지 않은 운동 기록은 지우지 않고 skipped = true로 남긴다.
-- 이 표시가 있는 기록은 "아직 할 운동"으로 세지 않아서(메인 메뉴의 운동하기 카드·기록 화면의 시작하기 버튼), 루틴이 "운동 중"으로 남지 않는다.
-- 기록 화면에서 "다시 하기"를 누르면 skipped = false로 돌아간다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 이 값을 저장하지 않고 넘어가서 운동 기록 저장이 실패하지는 않지만,
-- 건너뜀이 앱을 다시 열면 "예정"으로 돌아간다.)
alter table public.workout_logs
  add column if not exists skipped boolean not null default false;