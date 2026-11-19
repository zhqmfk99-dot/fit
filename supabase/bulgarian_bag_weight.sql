-- 불가리안백 운동의 무게를 1kg 단위로 맞춘다: 0.5kg 단위로 남아 있는 목표 무게를 정수 kg로 "내림"한다. (예: 12.5 → 12)
-- 대상: ① 루틴(routines.exercises)의 불가리안백 운동 무게 ② 모든 기록(완료·지난 기록 포함)의 목표 무게(workout_logs.target_weight)
--       ③ 모든 기록의 세트별 수행 무게(performed_sets[].weight)
-- 주의: 이미 한 기록도 바뀌므로 과거 최고 무게·볼륨 통계가 달라진다. 저장된 소모 칼로리(kcal)는 다시 계산되지 않는다(앱 설정의 "과거 기록 다시 계산"으로 갱신).
-- 불가리안백 운동은 운동 리스트(exercises)에서 장비가 '불가리안백'인 이름으로 찾는다(사용자별).
-- Supabase SQL Editor에서 실행한다. 여러 번 실행해도 안전하다(이미 정수면 바뀌지 않음).

-- ① 루틴: exercises jsonb 배열 안에서 불가리안백 운동의 소수 무게만 내림
update public.routines r
set exercises = (
  select jsonb_agg(
    case
      when (e.item->>'exercise') in (
             select x.name from public.exercises x
             where x.user_id = r.user_id and x.equipment = '불가리안백')
           and coalesce(e.item->>'weight', '') ~ '^[0-9]+(\.[0-9]+)?$'
           and (e.item->>'weight')::numeric <> floor((e.item->>'weight')::numeric)
      then jsonb_set(e.item, '{weight}', to_jsonb(floor((e.item->>'weight')::numeric)))
      else e.item
    end
    order by e.ord)
  from jsonb_array_elements(r.exercises) with ordinality as e(item, ord)
)
where jsonb_typeof(r.exercises) = 'array'
  and jsonb_array_length(r.exercises) > 0
  and exists (
    select 1
    from jsonb_array_elements(r.exercises) as e(item)
    where (e.item->>'exercise') in (
            select x.name from public.exercises x
            where x.user_id = r.user_id and x.equipment = '불가리안백')
      and coalesce(e.item->>'weight', '') ~ '^[0-9]+(\.[0-9]+)?$'
      and (e.item->>'weight')::numeric <> floor((e.item->>'weight')::numeric)
  );

-- ② 모든 기록의 목표 무게
update public.workout_logs l
set target_weight = floor(l.target_weight)
where l.target_weight is not null
  and l.target_weight <> floor(l.target_weight)
  and l.exercise in (
    select x.name from public.exercises x
    where x.user_id = l.user_id and x.equipment = '불가리안백');

-- ③ 모든 기록의 세트별 수행 무게 (세트의 다른 값은 그대로 두고 weight만 내림)
update public.workout_logs l
set performed_sets = (
  select jsonb_agg(
    case
      when coalesce(s.item->>'weight', '') ~ '^[0-9]+(\.[0-9]+)?$'
           and (s.item->>'weight')::numeric <> floor((s.item->>'weight')::numeric)
      then jsonb_set(s.item, '{weight}', to_jsonb(floor((s.item->>'weight')::numeric)))
      else s.item
    end
    order by s.ord)
  from jsonb_array_elements(l.performed_sets) with ordinality as s(item, ord)
)
where jsonb_typeof(l.performed_sets) = 'array'
  and jsonb_array_length(l.performed_sets) > 0
  and l.exercise in (
    select x.name from public.exercises x
    where x.user_id = l.user_id and x.equipment = '불가리안백')
  and exists (
    select 1 from jsonb_array_elements(l.performed_sets) as s(item)
    where coalesce(s.item->>'weight', '') ~ '^[0-9]+(\.[0-9]+)?$'
      and (s.item->>'weight')::numeric <> floor((s.item->>'weight')::numeric));

-- (실행 전에 어떤 행이 바뀌는지 보고 싶으면 아래 조회를 먼저 실행한다)
-- select l.date, l.exercise, l.is_completed, l.target_weight, l.performed_sets
-- from public.workout_logs l
-- where l.exercise in (select x.name from public.exercises x where x.user_id = l.user_id and x.equipment = '불가리안백')
--   and (l.target_weight <> floor(l.target_weight) or l.performed_sets::text ~ '"weight": ?[0-9]+\.[0-9]*[1-9]');
