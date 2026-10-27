-- 아이디 찾기 결과의 이메일을 가려서 돌려주도록 바꾼다. Supabase SQL Editor에서 한 번 실행하세요. (auth_profiles.sql 실행 후) 여러 번 실행해도 안전합니다.
-- 새로 설치하는 경우에는 auth_profiles.sql에 이미 들어 있어서 이 파일이 필요 없습니다.

-- 이메일 일부를 *로 가린다(로그인 화면의 maskId와 같은 규칙): 앞부분이 4자 이하면 첫 글자만, 그보다 길면 앞 2자·뒤 2자만 보이고 도메인은 그대로.
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when position('@' in coalesce(p_email, '')) = 0 then coalesce(p_email, '')
    else
      case
        when length(split_part(p_email, '@', 1)) <= 4
          then left(split_part(p_email, '@', 1), 1) || repeat('*', greatest(length(split_part(p_email, '@', 1)) - 1, 0))
        else left(split_part(p_email, '@', 1), 2) || repeat('*', length(split_part(p_email, '@', 1)) - 4) || right(split_part(p_email, '@', 1), 2)
      end || '@' || split_part(p_email, '@', 2)
  end;
$$;
revoke all on function public.mask_email(text) from public;
-- 아이디 찾기: 이름이 같은 계정의 **가린 이메일** 목록 (로그인 전에도 호출 가능).
-- 전체 이메일을 돌려주면 이름을 하나씩 넣어 보는 것만으로 가입자 이메일을 모을 수 있어서, 일부를 가려서 돌려주고 한 번에 최대 5개만 준다.
create or replace function public.find_ids_by_name(p_name text)
returns table (email text)
language sql
security definer
set search_path = ''
stable
as $$
  select public.mask_email(p.email)
  from public.profiles p
  where length(trim(p_name)) > 0
    and lower(trim(p.name)) = lower(trim(p_name))
  order by p.created_at
  limit 5;
$$;
revoke all on function public.find_ids_by_name(text) from public;
grant execute on function public.find_ids_by_name(text) to anon, authenticated;
