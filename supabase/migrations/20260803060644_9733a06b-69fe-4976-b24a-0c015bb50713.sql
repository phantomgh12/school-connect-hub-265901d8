-- ============ 0. Make hashtag validation fire only when hashtags change ============
DROP TRIGGER IF EXISTS trg_validate_post_hashtags ON public.posts;
CREATE TRIGGER trg_validate_post_hashtags BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_post_hashtags();
CREATE TRIGGER trg_validate_post_hashtags_upd BEFORE UPDATE OF hashtags ON public.posts
  FOR EACH ROW WHEN (NEW.hashtags IS DISTINCT FROM OLD.hashtags)
  EXECUTE FUNCTION public.validate_post_hashtags();

-- ============ 1. Post engagement counters + trending score ============
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score double precision NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_post_trending(_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post_id;
  IF p.id IS NULL THEN RETURN; END IF;
  UPDATE public.posts SET trending_score =
    (p.likes_count * 1.0 + p.comments_count * 2.0 + p.shares_count * 3.0 + p.saves_count * 2.5
      + LEAST(p.views_count, 10000) * 0.05 + LEAST(p.watch_ms / 1000.0, 5000) * 0.02)
    / POWER(GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0, 1) + 2, 1.35)
  WHERE id = _post_id;
END; $$;

CREATE OR REPLACE FUNCTION public.bump_post_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE col text; pid uuid; delta int;
BEGIN
  IF TG_OP = 'INSERT' THEN pid := NEW.post_id; delta := 1; ELSE pid := OLD.post_id; delta := -1; END IF;
  col := TG_ARGV[0];
  EXECUTE format('UPDATE public.posts SET %I = GREATEST(%I + $1, 0) WHERE id = $2', col, col) USING delta, pid;
  PERFORM public.recompute_post_trending(pid);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_likes_count ON public.post_likes;
CREATE TRIGGER trg_likes_count AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('likes_count');

DROP TRIGGER IF EXISTS trg_comments_count ON public.post_comments;
CREATE TRIGGER trg_comments_count AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('comments_count');

DROP TRIGGER IF EXISTS trg_saves_count ON public.post_saves;
CREATE TRIGGER trg_saves_count AFTER INSERT OR DELETE ON public.post_saves
  FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('saves_count');

-- backfill counters and scores
UPDATE public.posts p SET
  likes_count = (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id),
  comments_count = (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id),
  saves_count = (SELECT count(*) FROM public.post_saves s WHERE s.post_id = p.id);

-- ============ 2. Post interactions (watch time / dwell) ============
CREATE TABLE IF NOT EXISTS public.post_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watch_ms integer NOT NULL DEFAULT 0,
  dwell_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_interactions_user ON public.post_interactions(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.post_interactions TO authenticated;
GRANT ALL ON public.post_interactions TO service_role;
ALTER TABLE public.post_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own interactions read" ON public.post_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own interactions write" ON public.post_interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.after_interaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET watch_ms = watch_ms + GREATEST(NEW.watch_ms, 0) WHERE id = NEW.post_id;
  PERFORM public.recompute_post_trending(NEW.post_id);
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_after_interaction ON public.post_interactions;
CREATE TRIGGER trg_after_interaction AFTER INSERT ON public.post_interactions
  FOR EACH ROW EXECUTE FUNCTION public.after_interaction();

-- ============ 3. Interests ============
CREATE TABLE IF NOT EXISTS public.user_interests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, interest)
);
GRANT SELECT, INSERT, DELETE ON public.user_interests TO authenticated;
GRANT ALL ON public.user_interests TO service_role;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interests readable" ON public.user_interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "own interests insert" ON public.user_interests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own interests delete" ON public.user_interests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ 4. Gamification ============
CREATE TABLE IF NOT EXISTS public.user_gamification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  weekly_xp integer NOT NULL DEFAULT 0,
  week_start date NOT NULL DEFAULT date_trunc('week', now())::date,
  last_login_date date,
  theme text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_gamification TO authenticated;
GRANT ALL ON public.user_gamification TO service_role;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gamification readable" ON public.user_gamification FOR SELECT TO authenticated USING (true);
CREATE POLICY "own gamification insert" ON public.user_gamification FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own gamification update" ON public.user_gamification FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_gam_updated BEFORE UPDATE ON public.user_gamification FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.achievements (
  key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  xp integer NOT NULL DEFAULT 50,
  icon text NOT NULL DEFAULT 'trophy',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "admins manage achievements" ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.achievements (key, title, description, xp, icon) VALUES
  ('first_post', 'First Words', 'Published your first post', 50, 'pen'),
  ('streak_7', 'Week Warrior', 'Logged in 7 days in a row', 100, 'flame'),
  ('streak_30', 'Unstoppable', 'Logged in 30 days in a row', 400, 'flame'),
  ('friends_10', 'Social Starter', 'Made 10 friends', 100, 'users'),
  ('friends_50', 'Campus Famous', 'Made 50 friends', 350, 'users'),
  ('likes_100', 'Crowd Pleaser', 'Earned 100 likes', 200, 'heart'),
  ('invite_5', 'Recruiter', 'Invited 5 students who joined', 150, 'user-plus'),
  ('invite_50', 'Ambassador', 'Invited 50 students who joined', 1000, 'award'),
  ('verified', 'Verified', 'Earned the verified badge', 300, 'badge-check'),
  ('level_10', 'Level 10', 'Reached level 10', 250, 'trophy')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL REFERENCES public.achievements(key) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_key)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements earned readable" ON public.user_achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "own achievement insert" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.award_xp(_amount integer, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.user_gamification; new_xp int; new_level int; wk date := date_trunc('week', now())::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO g FROM public.user_gamification WHERE user_id = auth.uid();
  new_xp := GREATEST(g.xp + COALESCE(_amount, 0), 0);
  new_level := GREATEST(1, FLOOR(SQRT(new_xp / 100.0))::int + 1);
  UPDATE public.user_gamification SET
    xp = new_xp, level = new_level,
    weekly_xp = CASE WHEN g.week_start = wk THEN g.weekly_xp + COALESCE(_amount, 0) ELSE COALESCE(_amount, 0) END,
    week_start = wk
  WHERE user_id = auth.uid();
  IF new_level >= 10 THEN
    INSERT INTO public.user_achievements (user_id, achievement_key) VALUES (auth.uid(), 'level_10') ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('xp', new_xp, 'level', new_level, 'leveled_up', new_level > g.level);
END; $$;

CREATE OR REPLACE FUNCTION public.touch_streak()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.user_gamification; today date := (now() AT TIME ZONE 'UTC')::date; nd int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO g FROM public.user_gamification WHERE user_id = auth.uid();
  IF g.last_login_date = today THEN
    RETURN jsonb_build_object('streak', g.streak_days, 'xp', g.xp, 'level', g.level, 'claimed', false);
  END IF;
  IF g.last_login_date = today - 1 THEN nd := g.streak_days + 1; ELSE nd := 1; END IF;
  UPDATE public.user_gamification SET streak_days = nd, longest_streak = GREATEST(longest_streak, nd), last_login_date = today
    WHERE user_id = auth.uid();
  PERFORM public.award_xp(10 + LEAST(nd, 10) * 2, 'daily_login');
  IF nd >= 7 THEN INSERT INTO public.user_achievements (user_id, achievement_key) VALUES (auth.uid(), 'streak_7') ON CONFLICT DO NOTHING; END IF;
  IF nd >= 30 THEN INSERT INTO public.user_achievements (user_id, achievement_key) VALUES (auth.uid(), 'streak_30') ON CONFLICT DO NOTHING; END IF;
  SELECT * INTO g FROM public.user_gamification WHERE user_id = auth.uid();
  RETURN jsonb_build_object('streak', g.streak_days, 'xp', g.xp, 'level', g.level, 'claimed', true);
END; $$;

-- ============ 5. School events + RSVPs ============
CREATE TABLE IF NOT EXISTS public.school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_slug text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_school ON public.school_events(school_slug, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_events TO authenticated;
GRANT ALL ON public.school_events TO service_role;
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events readable" ON public.school_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "create own events" ON public.school_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "manage own events" ON public.school_events FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')) WITH CHECK (true);
CREATE POLICY "delete own events" ON public.school_events FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.school_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id uuid NOT NULL REFERENCES public.school_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsvps readable" ON public.event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "own rsvp insert" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rsvp delete" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ 6. School polls ============
CREATE TABLE IF NOT EXISTS public.school_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_slug text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_polls TO authenticated;
GRANT ALL ON public.school_polls TO service_role;
ALTER TABLE public.school_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls readable" ON public.school_polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "create own polls" ON public.school_polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "delete own polls" ON public.school_polls FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id uuid NOT NULL REFERENCES public.school_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll votes readable" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own vote insert" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vote update" ON public.poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ 7. Anonymous confessions with moderation ============
CREATE TABLE IF NOT EXISTS public.confessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_slug text,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  risk_score integer NOT NULL DEFAULT 0,
  flagged_terms text[] NOT NULL DEFAULT '{}',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_confessions_status ON public.confessions(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.confessions TO authenticated;
GRANT ALL ON public.confessions TO service_role;
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved confessions readable" ON public.confessions FOR SELECT TO authenticated
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "submit own confession" ON public.confessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "moderators review confessions" ON public.confessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) WITH CHECK (true);
CREATE TRIGGER trg_conf_updated BEFORE UPDATE ON public.confessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.moderate_confession()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bad text[] := ARRAY['fuck','shit','bitch','nigg','cunt','whore','slut','rape','kill yourself','kys','retard','faggot'];
        w text; found text[] := '{}'; score int := 0; recent int; caps numeric;
BEGIN
  IF length(btrim(NEW.content)) < 10 THEN RAISE EXCEPTION 'Confession is too short'; END IF;
  IF length(NEW.content) > 1000 THEN RAISE EXCEPTION 'Confession is too long'; END IF;

  SELECT count(*) INTO recent FROM public.confessions
    WHERE author_id = NEW.author_id AND created_at > now() - interval '1 hour';
  IF recent >= 3 THEN RAISE EXCEPTION 'You are posting too fast. Try again later.'; END IF;

  FOREACH w IN ARRAY bad LOOP
    IF position(w in lower(NEW.content)) > 0 THEN found := found || w; score := score + 35; END IF;
  END LOOP;

  caps := (length(regexp_replace(NEW.content, '[^A-Z]', '', 'g'))::numeric / GREATEST(length(NEW.content), 1));
  IF caps > 0.6 THEN score := score + 15; END IF;
  IF NEW.content ~* '(http|www\.)' THEN score := score + 20; END IF;
  IF NEW.content ~ '(.)\1{6,}' THEN score := score + 15; END IF;
  IF NEW.content ~* '@[a-z0-9_]+' AND array_length(found, 1) IS NOT NULL THEN score := score + 30; END IF;

  NEW.flagged_terms := found;
  NEW.risk_score := LEAST(score, 100);
  IF NEW.risk_score >= 70 THEN NEW.status := 'rejected'; ELSE NEW.status := 'pending'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_moderate_confession ON public.confessions;
CREATE TRIGGER trg_moderate_confession BEFORE INSERT ON public.confessions
  FOR EACH ROW EXECUTE FUNCTION public.moderate_confession();

-- ============ 8. Weekly challenges ============
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  goal integer NOT NULL DEFAULT 1,
  xp_reward integer NOT NULL DEFAULT 100,
  kind text NOT NULL DEFAULT 'posts',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable" ON public.challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage challenges" ON public.challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.challenges (title, description, goal, xp_reward, kind) VALUES
  ('Share 3 posts', 'Post three times this week', 3, 150, 'posts'),
  ('Make 2 new friends', 'Get two friend requests accepted', 2, 120, 'friends'),
  ('Comment 5 times', 'Support classmates with five comments', 5, 100, 'comments'),
  ('Invite a classmate', 'Get one invite confirmed', 1, 200, 'invites');

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.challenge_progress TO authenticated;
GRANT ALL ON public.challenge_progress TO service_role;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress read" ON public.challenge_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own progress insert" ON public.challenge_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.challenge_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.confessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;