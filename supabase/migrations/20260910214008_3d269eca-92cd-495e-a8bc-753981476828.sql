-- Host-agnostic auth: move all sign-up / sign-in server logic into the database
-- so the app no longer needs a private server key at the hosting layer.

CREATE TABLE IF NOT EXISTS public.auth_secrets (
  id int PRIMARY KEY DEFAULT 1,
  hmac_secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.auth_secrets (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.auth_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_secrets FROM anon, authenticated;
GRANT ALL ON public.auth_secrets TO service_role;

-- ---------------------------------------------------------------- challenge

CREATE OR REPLACE FUNCTION public.auth_new_challenge()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE s text; n text; t bigint;
BEGIN
  SELECT hmac_secret INTO s FROM public.auth_secrets WHERE id = 1;
  n := replace(gen_random_uuid()::text, '-', '');
  t := (extract(epoch from now()) * 1000)::bigint;
  RETURN jsonb_build_object(
    'nonce', n, 'ts', t,
    'sig', encode(extensions.hmac(n || '.' || t::text, s, 'sha256'), 'hex')
  );
END $$;

CREATE OR REPLACE FUNCTION public.auth_assert_human(
  _nonce text, _ts bigint, _sig text, _solution text, _elapsed_ms int, _honeypot text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE s text; expect text; h text;
BEGIN
  IF coalesce(btrim(_honeypot), '') <> '' THEN
    RAISE EXCEPTION 'Blocked: automated request detected.';
  END IF;
  IF coalesce(_elapsed_ms, 0) < 3500 THEN
    RAISE EXCEPTION 'That was too fast — please take a moment and try again.';
  END IF;
  SELECT hmac_secret INTO s FROM public.auth_secrets WHERE id = 1;
  expect := encode(extensions.hmac(_nonce || '.' || _ts::text, s, 'sha256'), 'hex');
  IF expect IS DISTINCT FROM _sig THEN RAISE EXCEPTION 'Invalid security check.'; END IF;
  IF (extract(epoch from now()) * 1000)::bigint - _ts > 600000 THEN
    RAISE EXCEPTION 'Security check expired — please retry.';
  END IF;
  h := encode(extensions.digest(_nonce || ':' || _solution, 'sha256'), 'hex');
  IF left(h, 4) <> '0000' THEN RAISE EXCEPTION 'Security check failed.'; END IF;
END $$;

-- ----------------------------------------------------------------- throttle

CREATE OR REPLACE FUNCTION public.auth_assert_not_throttled(_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fails int;
BEGIN
  SELECT count(*) INTO fails FROM public.auth_events
   WHERE username_key = _key AND success = false AND kind IN ('signin', 'recover')
     AND created_at > now() - interval '15 minutes';
  IF fails >= 6 THEN
    RAISE EXCEPTION 'Too many failed attempts on this account. Please wait 15 minutes.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auth_log_event(
  _kind text, _success boolean, _username text DEFAULT NULL, _detail text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.auth_events (kind, success, username_key, user_id, detail)
  VALUES (left(coalesce(_kind, 'unknown'), 32), coalesce(_success, false),
          nullif(lower(btrim(_username)), ''), auth.uid(), left(_detail, 300));
END $$;

-- -------------------------------------------------------- username checking

CREATE OR REPLACE FUNCTION public.auth_username_status(_u text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  k := lower(btrim(coalesce(_u, '')));
  IF k !~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', '3–24 characters: letters, numbers, dots or underscores.');
  END IF;
  IF public.is_username_blocked(k) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'That name isn''t allowed on SchoolConnect.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = k) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'That username is already taken.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'reason', '');
END $$;

-- Pre-flight before the account is created, so no orphan accounts are made.
CREATE OR REPLACE FUNCTION public.auth_precheck_signup(
  _username text, _full_name text, _dob date, _age int,
  _nonce text, _ts bigint, _sig text, _solution text, _elapsed_ms int, _honeypot text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; st jsonb; derived int; recent int;
BEGIN
  PERFORM public.auth_assert_human(_nonce, _ts, _sig, _solution, _elapsed_ms, _honeypot);
  k := lower(btrim(coalesce(_username, '')));
  st := public.auth_username_status(k);
  IF NOT (st->>'ok')::boolean THEN RAISE EXCEPTION '%', st->>'reason'; END IF;

  IF btrim(coalesce(_full_name, '')) !~ '^[A-Za-z][A-Za-z'' .-]*[A-Za-z]$'
     OR length(btrim(_full_name)) < 3 OR length(btrim(_full_name)) > 60 THEN
    RAISE EXCEPTION 'Use your real name (letters only).';
  END IF;
  IF public.is_username_blocked(btrim(_full_name)) THEN
    RAISE EXCEPTION 'That name isn''t allowed on SchoolConnect.';
  END IF;

  IF _dob IS NULL THEN RAISE EXCEPTION 'Enter a valid date of birth.'; END IF;
  derived := extract(year from age(_dob))::int;
  IF abs(derived - coalesce(_age, -99)) > 1 THEN
    RAISE EXCEPTION 'Your age does not match your date of birth.';
  END IF;
  IF derived < 13 THEN RAISE EXCEPTION 'SchoolConnect is for students aged 13 and above.'; END IF;
  IF derived > 100 THEN RAISE EXCEPTION 'Enter a valid date of birth.'; END IF;

  SELECT count(*) INTO recent FROM public.auth_events
   WHERE kind = 'signup' AND success = true AND created_at > now() - interval '10 minutes';
  IF recent >= 40 THEN RAISE EXCEPTION 'Sign-ups are busy right now. Please retry shortly.'; END IF;

  RETURN jsonb_build_object('ok', true, 'age', derived);
END $$;

-- Runs as the freshly created account: saves the profile + security answers.
CREATE OR REPLACE FUNCTION public.auth_complete_signup(
  _username text, _full_name text, _dob date, _age int, _answers jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; k text; derived int; n_answers int; n_distinct int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in.'; END IF;
  k := lower(btrim(coalesce(_username, '')));

  IF k !~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$' OR public.is_username_blocked(k) THEN
    RAISE EXCEPTION 'That name isn''t allowed on SchoolConnect.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = k AND id <> uid) THEN
    RAISE EXCEPTION 'That username is already taken.';
  END IF;
  IF public.is_username_blocked(btrim(coalesce(_full_name, ''))) THEN
    RAISE EXCEPTION 'That name isn''t allowed on SchoolConnect.';
  END IF;

  IF _dob IS NULL THEN RAISE EXCEPTION 'Enter a valid date of birth.'; END IF;
  derived := extract(year from age(_dob))::int;
  IF derived < 13 OR derived > 100 OR abs(derived - coalesce(_age, -99)) > 1 THEN
    RAISE EXCEPTION 'Your age does not match your date of birth.';
  END IF;

  SELECT count(*), count(DISTINCT lower(btrim(value)))
    INTO n_answers, n_distinct
    FROM jsonb_each_text(coalesce(_answers, '{}'::jsonb))
   WHERE length(btrim(value)) >= 2;
  IF n_answers < 7 THEN RAISE EXCEPTION 'Please answer all 7 security questions.'; END IF;
  IF n_distinct < 7 THEN RAISE EXCEPTION 'Each security answer must be different.'; END IF;

  INSERT INTO public.profiles (id, username, full_name, age, date_of_birth, age_verified)
  VALUES (uid, k, btrim(_full_name), derived, _dob, true)
  ON CONFLICT (id) DO UPDATE
    SET username = excluded.username, full_name = excluded.full_name,
        age = excluded.age, date_of_birth = excluded.date_of_birth, age_verified = true;

  PERFORM public.set_security_answers(uid, _answers);
  PERFORM public.auth_log_event('signup', true, k, NULL);
  RETURN jsonb_build_object('ok', true);
END $$;

-- Resolves a username to its internal login address (bot + lockout checked).
CREATE OR REPLACE FUNCTION public.auth_signin_lookup(
  _username text, _nonce text, _ts bigint, _sig text, _solution text,
  _elapsed_ms int, _honeypot text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; p record; mail text;
BEGIN
  PERFORM public.auth_assert_human(_nonce, _ts, _sig, _solution, _elapsed_ms, _honeypot);
  k := lower(btrim(coalesce(_username, '')));
  PERFORM public.auth_assert_not_throttled(k);

  SELECT id, banned, suspended_until INTO p FROM public.profiles WHERE lower(username) = k;
  IF NOT FOUND THEN
    PERFORM public.auth_log_event('signin', false, k, 'no such user');
    RAISE EXCEPTION 'Incorrect username or password.';
  END IF;
  IF coalesce(p.banned, false) THEN RAISE EXCEPTION 'This account has been permanently disabled.'; END IF;
  IF p.suspended_until IS NOT NULL AND p.suspended_until > now() THEN
    RAISE EXCEPTION 'This account is temporarily suspended.';
  END IF;

  SELECT u.email INTO mail FROM auth.users u WHERE u.id = p.id;
  RETURN jsonb_build_object(
    'email', coalesce(mail, regexp_replace(k, '[^a-z0-9._]', '', 'g') || '@users.schoolconnect.app'),
    'userId', p.id
  );
END $$;

-- Which security questions to ask during recovery (decoys when unknown user).
CREATE OR REPLACE FUNCTION public.auth_recovery_questions(
  _username text, _nonce text, _ts bigint, _sig text, _solution text,
  _elapsed_ms int, _honeypot text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; pid uuid; idx int[];
BEGIN
  PERFORM public.auth_assert_human(_nonce, _ts, _sig, _solution, _elapsed_ms, _honeypot);
  k := lower(btrim(coalesce(_username, '')));
  PERFORM public.auth_assert_not_throttled(k);
  SELECT id INTO pid FROM public.profiles WHERE lower(username) = k;
  IF pid IS NOT NULL THEN
    SELECT array_agg(q ORDER BY q) INTO idx FROM (
      SELECT q_index q FROM public.security_answers WHERE user_id = pid ORDER BY random() LIMIT 3
    ) s;
  END IF;
  IF idx IS NULL OR array_length(idx, 1) < 3 THEN idx := ARRAY[0, 2, 4]; END IF;
  RETURN jsonb_build_object('indexes', idx);
END $$;

GRANT EXECUTE ON FUNCTION public.auth_new_challenge() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_username_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_precheck_signup(text, text, date, int, text, bigint, text, text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_complete_signup(text, text, date, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_signin_lookup(text, text, bigint, text, text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_recovery_questions(text, text, bigint, text, text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_log_event(text, boolean, text, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_assert_human(text, bigint, text, text, int, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_assert_not_throttled(text) FROM anon, authenticated;