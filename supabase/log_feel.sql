-- 운동 기록의 "체감 난이도"(쉬웠어요 easy / 적당해요 ok / 힘들었어요 hard). Supabase SQL Editor에서 실행하세요. (schema.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 운동 하나를 끝낸 뒤 사용자가 한 번 눌러 고르는 값이다. 점진 과부하 평가(lib/progression.js)가 이 값을 쓴다:
--   hard → 목표를 다 채웠어도 무게를 올리지 않고 유지, easy → 휴식·속도 때문에 유지하려던 판단을 풀어 줌(세트가 무너진 경우는 그대로 유지).
-- 비어 있으면(고르지 않음) 기존 규칙 그대로다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 이 값을 저장하지 않고 넘어가서 운동 기록 저장이 실패하지는 않지만,
-- 체감 난이도가 앱을 다시 열면 사라진다.)
alter table public.workout_logs
  add column if not exists feel text check (feel in ('easy', 'ok', 'hard'));
