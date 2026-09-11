CREATE OR REPLACE FUNCTION public.auth_reset_password(
  _username text,
  _answers jsonb,
  _new_password text,
  _nonce text,
  _ts bigint,
  _sig text,
  _solution text,
  _elapsed_ms integer,
  _honeypot text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _key text := lower(btrim(_username));
  _uid uuid;
  _matched integer;
BEGIN
  PERFORM public.auth_assert_human(_nonce, _ts, _sig, _solution, _elapsed_ms, _honeypot);
  PERFORM public.auth_assert_not_throttled(_key);

  IF length(coalesce(_new_password, '')) < 10 THEN
    RAISE EXCEPTION 'Your new password must be at least 10 characters.';
  END IF;
  IF position(_key in lower(_new_password)) > 0 THEN
    RAISE EXCEPTION 'Your password cannot contain your username.';
  END IF;

  SELECT id INTO _uid FROM public.profiles WHERE username = _key;
  IF _uid IS NULL THEN
    PERFORM public.auth_log_event('recover', false, _key, 'no such user');
    RAISE EXCEPTION 'Those answers do not match our records.';
  END IF;

  SELECT public.verify_security_answers(_uid, _answers) INTO _matched;
  IF coalesce(_matched, 0) < 3 THEN
    PERFORM public.auth_log_event('recover', false, _key, 'answers mismatch');
    RAISE EXCEPTION 'Those answers do not match our records.';
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = _uid;

  DELETE FROM auth.sessions WHERE user_id = _uid;
  DELETE FROM auth.refresh_tokens WHERE user_id = _uid::text;

  PERFORM public.auth_log_event('recover', true, _key, NULL);

  RETURN jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = _uid));
END;
$$;

REVOKE ALL ON FUNCTION public.auth_reset_password(text, jsonb, text, text, bigint, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_reset_password(text, jsonb, text, text, bigint, text, text, integer, text) TO anon, authenticated;