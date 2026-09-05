CREATE OR REPLACE FUNCTION public.set_security_answers(_user_id uuid, _answers jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare k text; v text; c integer := 0;
begin
  delete from public.security_answers where user_id = _user_id;
  for k, v in select key, value::text from jsonb_each_text(_answers) loop
    if length(btrim(v)) < 2 then continue; end if;
    insert into public.security_answers (user_id, q_index, answer_hash)
    values (_user_id, k::smallint, extensions.crypt(lower(btrim(v)), extensions.gen_salt('bf', 10)))
    on conflict (user_id, q_index) do update set answer_hash = excluded.answer_hash;
    c := c + 1;
  end loop;
  update public.profiles set security_setup = (c >= 7) where id = _user_id;
  return c;
end $$;

CREATE OR REPLACE FUNCTION public.verify_security_answers(_user_id uuid, _answers jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare k text; v text; ok integer := 0; h text;
begin
  for k, v in select key, value::text from jsonb_each_text(_answers) loop
    select answer_hash into h from public.security_answers
      where user_id = _user_id and q_index = k::smallint;
    if h is not null and h = extensions.crypt(lower(btrim(v)), h) then ok := ok + 1; end if;
  end loop;
  return ok;
end $$;

REVOKE ALL ON FUNCTION public.set_security_answers(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_security_answers(uuid, jsonb) FROM PUBLIC, anon, authenticated;