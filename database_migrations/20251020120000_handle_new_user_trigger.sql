-- Creates an automatic profile bootstrapper for newly created Supabase auth users.
-- The function ensures every entry in auth.users has a corresponding row in public.user_profiles
-- with a sensible default username, email, and role.

set check_function_bodies = off;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unknown_role_id integer;
  derived_username text;
begin
  select roleid
    into unknown_role_id
    from public.role
   where lower(rolename) = 'unknown'
   order by roleid
   limit 1;

  if unknown_role_id is null then
    unknown_role_id := 1;
  end if;

  derived_username := coalesce(
    nullif((new.raw_user_meta_data ->> 'username'), ''),
    case
      when new.email is not null and new.email <> '' then split_part(new.email, '@', 1)
      when new.phone is not null and new.phone <> '' then regexp_replace(new.phone, '[^0-9]', '', 'g')
      else 'user'
    end
  );

  insert into public.user_profiles (userid, email, username, roleid, parent_of_userid)
  values (new.id, new.email, derived_username, unknown_role_id, null)
  on conflict (userid) do update
    set
      email = excluded.email,
      username = case
        when user_profiles.username is null
          or user_profiles.username = ''
          or user_profiles.username = split_part(coalesce(user_profiles.email, ''), '@', 1)
          then excluded.username
        else user_profiles.username
      end,
      roleid = coalesce(user_profiles.roleid, excluded.roleid),
      updated_at = timezone('utc', now());

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists handle_new_user on auth.users;

create trigger handle_new_user
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Optional backfill to ensure legacy users have a profile row.
with unknown_role as (
  select coalesce(
    (select roleid from public.role where lower(rolename) = 'unknown' order by roleid limit 1),
    1
  ) as roleid
)
insert into public.user_profiles (userid, email, username, roleid, parent_of_userid)
select
  u.id,
  u.email,
  coalesce(
    nullif((u.raw_user_meta_data ->> 'username'), ''),
    case
      when u.email is not null and u.email <> '' then split_part(u.email, '@', 1)
      when u.phone is not null and u.phone <> '' then regexp_replace(u.phone, '[^0-9]', '', 'g')
      else 'user'
    end
  ) as username,
  unknown_role.roleid,
  null
from auth.users u
cross join unknown_role
left join public.user_profiles up on up.userid = u.id
where up.userid is null;
