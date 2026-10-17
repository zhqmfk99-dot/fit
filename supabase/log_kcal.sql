-- 운동 기록(workout_logs)에 소모 칼로리(kcal)를 저장하는 칼럼. Supabase SQL Editor에서 실행하세요.
-- ※ 앱을 배포하기 "전에" 실행해야 합니다. 이 칼럼이 없는 상태에서 새 앱이 운동 기록을 저장하면 저장이 실패합니다.
-- 여러 번 실행해도 안전합니다.
--
-- 값은 운동을 완료하거나 수정할 때 앱이 계산해서 넣습니다 (시간 기반 MET + 강도 보정 추정치, src/lib/calories.js).
-- 이미 있는 완료 기록은 앱을 열 때 체중을 알 수 있으면 자동으로 채워집니다.

alter table public.workout_logs
  add column if not exists kcal numeric check (kcal is null or kcal >= 0);
