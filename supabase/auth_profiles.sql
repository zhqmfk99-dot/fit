-- 이름 기반 아이디 찾기 / 비밀번호 찾기를 위한 프로필 테이블과 함수.
-- Supabase SQL Editor에서 통째로 실행하세요. (schema.sql 실행 후 추가로 한 번만)

-- 1) 프로필: 가입 시 입력한 이름과 이메일(아이디)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 로그인한 사용자는 본인 프로필만 조회 가능. (이름 검색은 아래 함수로만 가능)
create policy "own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

grant select on public.profiles to authenticated;

-- 2) 가입 시 프로필 자동 생성 (이름은 signUp의 options.data.name 에서 가져옴)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(trim(new.raw_user_meta_data ->> 'name'), ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 사용자도 프로필 행을 만들어 둔다 (이름은 비어 있어 이름 검색에는 안 잡힘)
insert into public.profiles (id, email, name)
select id, email, coalesce(trim(raw_user_meta_data ->> 'name'), '')
from auth.users
on conflict (id) do nothing;

-- 3) 아이디 찾기
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

-- 4) 비밀번호 찾기 본인 확인: 아이디(이메일)와 이름이 모두 일치하는지 (로그인 전에도 호출 가능)
create or replace function public.check_id_name(p_email text, p_name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.email) = lower(trim(p_email))
      and length(trim(p_name)) > 0
      and lower(trim(p.name)) = lower(trim(p_name))
  );
$$;

revoke all on function public.find_ids_by_name(text) from public;
revoke all on function public.check_id_name(text, text) from public;
grant execute on function public.find_ids_by_name(text) to anon, authenticated;
grant execute on function public.check_id_name(text, text) to anon, authenticated;
