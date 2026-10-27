-- 운동 리스트의 "한쪽씩 하는 운동" 표시. Supabase SQL Editor에서 실행하세요. (seed_exercises.sql 실행 후) 여러 번 실행해도 안전합니다.
--
-- 한쪽씩 하는 운동(불가리안 스플릿 스쿼트, 원암 덤벨 로우 등)은 횟수를 **한쪽 기준**으로 적고, 앱이 볼륨·칼로리를 셀 때 양쪽(×2)으로 계산한다.
-- 이 SQL은 앱을 배포하기 **전에** 실행하는 것이 맞다. (칼럼이 없을 때는 앱이 이 표시를 저장하지 않고 넘어가서 운동 저장이 실패하지는 않지만, 표시가 유지되지 않는다)

-- 1) 칼럼 추가
alter table public.exercises
  add column if not exists unilateral boolean not null default false;

-- 2) 기본 운동 중 한쪽씩 하는 운동에 표시한다. 같은 이름의 운동이 있는 모든 사용자에게 적용된다.
--    (번갈아 하며 전체 횟수로 세는 운동 — 워킹 런지, 러시안 트위스트, 번갈아 하는 덤벨 컬 등 — 은 넣지 않았다. 필요하면 운동 리스트에서 직접 표시하세요.)
update public.exercises
set unilateral = true
where unilateral = false
  and name in (
    '덤벨 로우', '런지', '불가리안 스플릿 스쿼트', '스텝업', '리버스 런지', '사이드 런지',
    '컨센트레이션 컬', '트라이셉스 킥백', '케이블 킥백', '케이블 레터럴 레이즈',
    '사이드 플랭크', '케이블 우드초퍼', '팔로프 프레스', '불가리안백 런지'
  );

-- 3) 앞으로 가입하는 사용자에게도 같은 표시를 한다 (seed_exercises.sql의 트리거 함수를 표시까지 하도록 바꾼다).
--    ※ seed_exercises.sql을 나중에 다시 실행하면 이 함수가 원래대로 돌아가니, 그 뒤에는 이 파일도 다시 실행하세요.
create or replace function public.seed_exercises_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_exercises(new.id);
  update public.exercises
  set unilateral = true
  where user_id = new.id
    and name in (
      '덤벨 로우', '런지', '불가리안 스플릿 스쿼트', '스텝업', '리버스 런지', '사이드 런지',
      '컨센트레이션 컬', '트라이셉스 킥백', '케이블 킥백', '케이블 레터럴 레이즈',
      '사이드 플랭크', '케이블 우드초퍼', '팔로프 프레스', '불가리안백 런지'
    );
  return new;
end;
$$;
