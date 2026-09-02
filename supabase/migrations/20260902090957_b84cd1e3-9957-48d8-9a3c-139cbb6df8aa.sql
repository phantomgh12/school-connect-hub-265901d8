
create extension if not exists pgcrypto;

-- fix duplicate usernames before enforcing uniqueness
with d as (
  select id, username, row_number() over (partition by lower(username) order by created_at) rn
  from public.profiles where username is not null
)
update public.profiles p set username = p.username || '_' || substr(p.id::text,1,4)
from d where d.id = p.id and d.rn > 1;

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles
  add column if not exists age smallint,
  add column if not exists age_verified boolean not null default false,
  add column if not exists security_setup boolean not null default false;

-- ---------- blocked username patterns ----------
create table if not exists public.blocked_username_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,
  kind text not null default 'contains' check (kind in ('exact','contains','regex')),
  reason text,
  created_at timestamptz not null default now(),
  unique (pattern, kind)
);
grant select on public.blocked_username_patterns to authenticated;
grant all on public.blocked_username_patterns to service_role;
alter table public.blocked_username_patterns enable row level security;
create policy "anyone signed in can read blocklist"
  on public.blocked_username_patterns for select to authenticated using (true);

insert into public.blocked_username_patterns (pattern, kind, reason) values
  ('ai','exact','reserved'),('a.i','exact','reserved'),('ai_slop','contains','spam'),
  ('aislop','contains','spam'),('slop','contains','spam'),
  ('chatgpt','contains','impersonation'),('openai','contains','impersonation'),
  ('gpt','contains','impersonation'),('gemini','contains','impersonation'),
  ('claude','contains','impersonation'),('grok','contains','impersonation'),
  ('bot','contains','automation'),('crawler','contains','automation'),
  ('spider','contains','automation'),('scraper','contains','automation'),
  ('test','contains','placeholder'),('testing','contains','placeholder'),
  ('demo','contains','placeholder'),('sample','contains','placeholder'),
  ('asdf','contains','placeholder'),('qwerty','contains','placeholder'),
  ('null','exact','placeholder'),('undefined','exact','placeholder'),
  ('anonymous','contains','placeholder'),('unknown','exact','placeholder'),
  ('user','exact','placeholder'),('username','exact','placeholder'),
  ('guest','contains','placeholder'),('temp','contains','placeholder'),
  ('admin','contains','staff impersonation'),('administrator','contains','staff impersonation'),
  ('moderator','contains','staff impersonation'),('mod','exact','staff impersonation'),
  ('root','exact','staff impersonation'),('sysadmin','contains','staff impersonation'),
  ('staff','contains','staff impersonation'),('support','contains','staff impersonation'),
  ('helpdesk','contains','staff impersonation'),('official','contains','staff impersonation'),
  ('schoolconnect','contains','brand'),('ghschoolhub','contains','brand'),
  ('lovable','contains','brand'),('supabase','contains','brand'),
  ('system','contains','staff impersonation'),('security','contains','staff impersonation'),
  ('verify','contains','phishing'),('verification','contains','phishing'),
  ('nigger','contains','hate'),('nigga','contains','hate'),('faggot','contains','hate'),
  ('rape','contains','abuse'),('nazi','contains','hate'),('hitler','contains','hate'),
  ('porn','contains','adult'),('sex','contains','adult'),('nude','contains','adult'),
  ('fuck','contains','profanity'),('shit','contains','profanity'),('bitch','contains','profanity'),
  ('cunt','contains','profanity'),('dick','contains','profanity')
on conflict do nothing;

create or replace function public.normalize_username(_u text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(lower(coalesce(_u,'')), '[^a-z0-9]', '', 'g')
$$;

create or replace function public.is_username_blocked(_u text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare n text; hit boolean;
begin
  n := public.normalize_username(_u);
  if n = '' then return true; end if;
  select exists (
    select 1 from public.blocked_username_patterns b
    where (b.kind = 'exact'    and n = public.normalize_username(b.pattern))
       or (b.kind = 'contains' and position(public.normalize_username(b.pattern) in n) > 0)
       or (b.kind = 'regex'    and n ~ b.pattern)
  ) into hit;
  return hit;
end $$;

create or replace function public.username_available(_u text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(_u)))
$$;
grant execute on function public.username_available(text) to anon, authenticated, service_role;
grant execute on function public.is_username_blocked(text) to anon, authenticated, service_role;

-- ---------- security answers (hashed, never readable) ----------
create table if not exists public.security_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  q_index smallint not null check (q_index between 0 and 20),
  answer_hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, q_index)
);
grant all on public.security_answers to service_role;
alter table public.security_answers enable row level security;
-- intentionally NO policies for anon/authenticated: hashes are unreadable by clients

create or replace function public.set_security_answers(_user_id uuid, _answers jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare k text; v text; c integer := 0;
begin
  delete from public.security_answers where user_id = _user_id;
  for k, v in select key, value::text from jsonb_each_text(_answers) loop
    if length(btrim(v)) < 2 then continue; end if;
    insert into public.security_answers (user_id, q_index, answer_hash)
    values (_user_id, k::smallint, crypt(lower(btrim(v)), gen_salt('bf', 10)))
    on conflict (user_id, q_index) do update set answer_hash = excluded.answer_hash;
    c := c + 1;
  end loop;
  update public.profiles set security_setup = (c >= 7) where id = _user_id;
  return c;
end $$;
revoke all on function public.set_security_answers(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_security_answers(uuid, jsonb) to service_role;

create or replace function public.verify_security_answers(_user_id uuid, _answers jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare k text; v text; ok integer := 0; h text;
begin
  for k, v in select key, value::text from jsonb_each_text(_answers) loop
    select answer_hash into h from public.security_answers
      where user_id = _user_id and q_index = k::smallint;
    if h is not null and h = crypt(lower(btrim(v)), h) then ok := ok + 1; end if;
  end loop;
  return ok;
end $$;
revoke all on function public.verify_security_answers(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.verify_security_answers(uuid, jsonb) to service_role;

-- ---------- auth event log / lockouts ----------
create table if not exists public.auth_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  username_key text,
  ip_hash text,
  kind text not null,
  success boolean not null default false,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists auth_events_lookup on public.auth_events (username_key, created_at desc);
create index if not exists auth_events_ip on public.auth_events (ip_hash, created_at desc);
grant select on public.auth_events to authenticated;
grant all on public.auth_events to service_role;
alter table public.auth_events enable row level security;
create policy "users read own auth events"
  on public.auth_events for select to authenticated using (auth.uid() = user_id);

create or replace function public.auth_throttle_state(_username_key text, _ip_hash text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_fails', (select count(*) from public.auth_events
       where username_key = _username_key and success = false
         and kind in ('signin','recover') and created_at > now() - interval '15 minutes'),
    'ip_fails', (select count(*) from public.auth_events
       where ip_hash = _ip_hash and success = false
         and created_at > now() - interval '15 minutes'),
    'ip_signups', (select count(*) from public.auth_events
       where ip_hash = _ip_hash and kind = 'signup' and success = true
         and created_at > now() - interval '24 hours')
  )
$$;
revoke all on function public.auth_throttle_state(text, text) from public, anon, authenticated;
grant execute on function public.auth_throttle_state(text, text) to service_role;
