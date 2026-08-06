-- badge + shop metadata
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS criteria_kind text,
  ADD COLUMN IF NOT EXISTS criteria_value integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coin_reward integer NOT NULL DEFAULT 0;

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS unlock_badge text;

ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS equipped_sticker text,
  ADD COLUMN IF NOT EXISTS equipped_effect text,
  ADD COLUMN IF NOT EXISTS equipped_title text,
  ADD COLUMN IF NOT EXISTS equipped_chat_theme text,
  ADD COLUMN IF NOT EXISTS house_slug text;

-- houses / teams
CREATE TABLE IF NOT EXISTS public.houses (
  slug text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  color text NOT NULL,
  motto text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.houses TO anon, authenticated;
GRANT ALL ON public.houses TO service_role;
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "houses readable" ON public.houses;
CREATE POLICY "houses readable" ON public.houses FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage houses" ON public.houses;
CREATE POLICY "admins manage houses" ON public.houses TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- coin gifts
CREATE TABLE IF NOT EXISTS public.gift_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  price integer NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gift_catalog TO anon, authenticated;
GRANT ALL ON public.gift_catalog TO service_role;
ALTER TABLE public.gift_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gift catalog readable" ON public.gift_catalog;
CREATE POLICY "gift catalog readable" ON public.gift_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage gift catalog" ON public.gift_catalog;
CREATE POLICY "admins manage gift catalog" ON public.gift_catalog TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id text NOT NULL REFERENCES public.gift_catalog(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  coins integer NOT NULL DEFAULT 0,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gifts_recipient_idx ON public.gifts (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gifts_post_idx ON public.gifts (post_id);
GRANT SELECT ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gifts visible" ON public.gifts;
CREATE POLICY "gifts visible" ON public.gifts FOR SELECT TO authenticated USING (true);

-- join / switch house
CREATE OR REPLACE FUNCTION public.join_house(_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.houses WHERE slug = _slug) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_house');
  END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_gamification SET house_slug = _slug WHERE user_id = auth.uid();
  RETURN jsonb_build_object('ok', true, 'house', _slug);
END; $$;

CREATE OR REPLACE FUNCTION public.add_house_points(_points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE h text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT house_slug INTO h FROM public.user_gamification WHERE user_id = auth.uid();
  IF h IS NULL THEN RETURN; END IF;
  UPDATE public.houses SET points = points + GREATEST(COALESCE(_points,0), 0) WHERE slug = h;
END; $$;

-- send a coin gift
CREATE OR REPLACE FUNCTION public.send_gift(_gift_id text, _recipient uuid, _post_id uuid DEFAULT NULL, _message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.gift_catalog; bal integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _recipient = auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'self'); END IF;
  SELECT * INTO g FROM public.gift_catalog WHERE id = _gift_id AND active;
  IF g.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_gift'); END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_gamification (user_id) VALUES (_recipient) ON CONFLICT (user_id) DO NOTHING;
  SELECT coins INTO bal FROM public.user_gamification WHERE user_id = auth.uid();
  IF bal < g.price THEN RETURN jsonb_build_object('ok', false, 'error', 'not_enough_coins'); END IF;
  UPDATE public.user_gamification SET coins = coins - g.price WHERE user_id = auth.uid();
  UPDATE public.user_gamification SET coins = coins + (g.price / 2), reputation = reputation + 5 WHERE user_id = _recipient;
  INSERT INTO public.gifts (gift_id, sender_id, recipient_id, post_id, coins, message)
  VALUES (g.id, auth.uid(), _recipient, _post_id, g.price, NULLIF(btrim(COALESCE(_message,'')), ''));
  INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
  VALUES (_recipient, auth.uid(), 'gift', 'sent you a ' || g.name || ' ' || g.emoji, CASE WHEN _post_id IS NULL THEN 'user' ELSE 'post' END, COALESCE(_post_id, auth.uid()));
  PERFORM public.progress_mission('gift', 1);
  RETURN jsonb_build_object('ok', true, 'gift', g.name, 'emoji', g.emoji, 'coins', g.price);
END; $$;

-- monthly quest support
CREATE OR REPLACE FUNCTION public.mission_period(_cadence text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _cadence = 'weekly' THEN date_trunc('week', now())::date
    WHEN _cadence = 'monthly' THEN date_trunc('month', now())::date
    ELSE (now() AT TIME ZONE 'UTC')::date END;
$$;

CREATE OR REPLACE FUNCTION public.progress_mission(_kind text, _amount integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.missions;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  FOR m IN SELECT * FROM public.missions WHERE active AND kind = _kind LOOP
    INSERT INTO public.mission_progress (mission_id, user_id, period_start, progress)
    VALUES (m.id, auth.uid(), public.mission_period(m.cadence), GREATEST(_amount, 0))
    ON CONFLICT (mission_id, user_id, period_start)
    DO UPDATE SET progress = public.mission_progress.progress + GREATEST(_amount, 0), updated_at = now();
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_mission(_mission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.missions; mp public.mission_progress; ps date; slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM public.missions WHERE id = _mission_id AND active;
  IF m.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_mission'); END IF;
  ps := public.mission_period(m.cadence);
  SELECT * INTO mp FROM public.mission_progress WHERE mission_id = m.id AND user_id = auth.uid() AND period_start = ps;
  IF mp.mission_id IS NULL OR mp.progress < m.goal THEN RETURN jsonb_build_object('ok', false, 'error', 'incomplete'); END IF;
  IF mp.claimed THEN RETURN jsonb_build_object('ok', false, 'error', 'claimed'); END IF;
  UPDATE public.mission_progress SET claimed = true WHERE mission_id = m.id AND user_id = auth.uid() AND period_start = ps;
  PERFORM public.award_xp(m.xp_reward, 'mission');
  PERFORM public.award_coins(m.coin_reward);
  SELECT school_slug INTO slug FROM public.profiles WHERE id = auth.uid();
  PERFORM public.add_war_points(slug, 5);
  PERFORM public.add_house_points(5);
  RETURN jsonb_build_object('ok', true, 'xp', m.xp_reward, 'coins', m.coin_reward);
END; $$;

-- shop unlock check honours badge-gated items
CREATE OR REPLACE FUNCTION public.buy_shop_item(_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it public.shop_items; g public.user_gamification;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO it FROM public.shop_items WHERE id = _item_id AND active;
  IF it.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_item'); END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO g FROM public.user_gamification WHERE user_id = auth.uid();
  IF EXISTS (SELECT 1 FROM public.user_purchases WHERE user_id = auth.uid() AND item_id = it.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'owned');
  END IF;
  IF it.unlock_badge IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = auth.uid() AND achievement_key = it.unlock_badge
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'badge_locked'); END IF;
  IF g.level < it.min_level THEN RETURN jsonb_build_object('ok', false, 'error', 'level_locked'); END IF;
  IF g.coins < it.price THEN RETURN jsonb_build_object('ok', false, 'error', 'not_enough_coins'); END IF;
  UPDATE public.user_gamification SET coins = coins - it.price WHERE user_id = auth.uid();
  INSERT INTO public.user_purchases (user_id, item_id) VALUES (auth.uid(), it.id);
  PERFORM public.progress_mission('purchase', 1);
  RETURN jsonb_build_object('ok', true, 'item_id', it.id);
END; $$;

CREATE OR REPLACE FUNCTION public.equip_item(_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it public.shop_items;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO it FROM public.shop_items WHERE id = _item_id;
  IF it.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_item'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_purchases WHERE user_id = auth.uid() AND item_id = it.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owned');
  END IF;
  UPDATE public.user_gamification SET
    equipped_theme = CASE WHEN it.category = 'theme' THEN it.value ELSE equipped_theme END,
    equipped_frame = CASE WHEN it.category = 'frame' THEN it.value ELSE equipped_frame END,
    equipped_name_color = CASE WHEN it.category = 'name_color' THEN it.value ELSE equipped_name_color END,
    equipped_bubble = CASE WHEN it.category = 'bubble' THEN it.value ELSE equipped_bubble END,
    equipped_sticker = CASE WHEN it.category = 'sticker' THEN it.value ELSE equipped_sticker END,
    equipped_effect = CASE WHEN it.category = 'effect' THEN it.value ELSE equipped_effect END,
    equipped_title = CASE WHEN it.category = 'title' THEN it.value ELSE equipped_title END,
    equipped_chat_theme = CASE WHEN it.category = 'chat_theme' THEN it.value ELSE equipped_chat_theme END
  WHERE user_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END; $$;

-- badge engine: measures the caller's real stats and grants every earned badge
CREATE OR REPLACE FUNCTION public.user_badge_stats(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.user_gamification; p public.profiles; s jsonb;
BEGIN
  SELECT * INTO g FROM public.user_gamification WHERE user_id = _user_id;
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  SELECT jsonb_build_object(
    'posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id),
    'community_posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id),
    'photo_posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id AND post_type = 'photo'),
    'video_posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id AND post_type = 'video'),
    'night_posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id AND EXTRACT(hour FROM created_at) < 6),
    'morning_posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id AND EXTRACT(hour FROM created_at) BETWEEN 5 AND 9),
    'weekend_posts', (SELECT count(*) FROM public.posts WHERE user_id = _user_id AND EXTRACT(dow FROM created_at) IN (0, 6)),
    'total_chars', (SELECT COALESCE(sum(length(COALESCE(content, ''))), 0) FROM public.posts WHERE user_id = _user_id),
    'hashtags_used', (SELECT COALESCE(sum(COALESCE(array_length(hashtags, 1), 0)), 0) FROM public.posts WHERE user_id = _user_id),
    'trending_score', (SELECT COALESCE(floor(max(trending_score)), 0) FROM public.posts WHERE user_id = _user_id),
    'top_post_likes', (SELECT COALESCE(max(likes_count), 0) FROM public.posts WHERE user_id = _user_id),
    'likes_received', (SELECT COALESCE(sum(likes_count), 0) FROM public.posts WHERE user_id = _user_id),
    'comments_received', (SELECT COALESCE(sum(comments_count), 0) FROM public.posts WHERE user_id = _user_id),
    'saves_received', (SELECT COALESCE(sum(saves_count), 0) FROM public.posts WHERE user_id = _user_id),
    'shares_received', (SELECT COALESCE(sum(shares_count), 0) FROM public.posts WHERE user_id = _user_id),
    'views_received', (SELECT COALESCE(sum(views_count), 0) FROM public.posts WHERE user_id = _user_id),
    'engagement_total', (SELECT COALESCE(sum(likes_count + comments_count + saves_count + shares_count), 0) FROM public.posts WHERE user_id = _user_id),
    'likes_given', (SELECT count(*) FROM public.post_likes WHERE user_id = _user_id),
    'comments_made', (SELECT count(*) FROM public.post_comments WHERE user_id = _user_id),
    'saves_given', (SELECT count(*) FROM public.post_saves WHERE user_id = _user_id),
    'shares_given', (SELECT count(*) FROM public.post_shares WHERE user_id = _user_id),
    'views_given', (SELECT count(*) FROM public.post_views WHERE user_id = _user_id),
    'watch_minutes', (SELECT COALESCE(floor(sum(watch_ms) / 60000.0), 0) FROM public.post_interactions WHERE user_id = _user_id),
    'messages_sent', (SELECT count(*) FROM public.messages WHERE sender_id = _user_id),
    'conversations', (SELECT count(*) FROM public.conversations WHERE user_a = _user_id OR user_b = _user_id),
    'stories', (SELECT count(*) FROM public.stories WHERE user_id = _user_id),
    'story_views_received', (SELECT count(*) FROM public.story_views v JOIN public.stories st ON st.id = v.story_id WHERE st.user_id = _user_id),
    'story_reactions_received', (SELECT count(*) FROM public.story_reactions r JOIN public.stories st ON st.id = r.story_id WHERE st.user_id = _user_id),
    'followers', (SELECT count(*) FROM public.follows WHERE following_id = _user_id),
    'following', (SELECT count(*) FROM public.follows WHERE follower_id = _user_id),
    'friends', (SELECT count(*) FROM public.friendships WHERE status = 'accepted' AND (requester_id = _user_id OR addressee_id = _user_id)),
    'invites_confirmed', (SELECT count(DISTINCT invitee_id) FROM public.invites WHERE inviter_id = _user_id AND confirmed),
    'events_created', (SELECT count(*) FROM public.school_events WHERE created_by = _user_id),
    'events_attended', (SELECT count(*) FROM public.event_rsvps WHERE user_id = _user_id),
    'polls_voted', (SELECT count(*) FROM public.poll_votes WHERE user_id = _user_id),
    'confessions_approved', (SELECT count(*) FROM public.confessions WHERE author_id = _user_id AND status = 'approved'),
    'reports_filed', (SELECT count(*) FROM public.reports WHERE reporter_id = _user_id),
    'missions_claimed', (SELECT count(*) FROM public.mission_progress WHERE user_id = _user_id AND claimed),
    'purchases', (SELECT count(*) FROM public.user_purchases WHERE user_id = _user_id),
    'boxes_opened', (SELECT count(*) FROM public.box_openings WHERE user_id = _user_id),
    'spins', (SELECT count(*) FROM public.spin_results WHERE user_id = _user_id),
    'badges_earned', (SELECT count(*) FROM public.user_achievements WHERE user_id = _user_id),
    'gifts_sent', (SELECT count(*) FROM public.gifts WHERE sender_id = _user_id),
    'gifts_received', (SELECT count(*) FROM public.gifts WHERE recipient_id = _user_id),
    'war_points', (SELECT COALESCE(sum(w.points), 0) FROM public.school_war_scores w WHERE w.school_slug IS NOT NULL AND w.school_slug = p.school_slug),
    'days_since_join', GREATEST(EXTRACT(day FROM (now() - COALESCE(p.created_at, now())))::int, 0),
    'profile_completeness', (
      (CASE WHEN p.full_name IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.username IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN p.avatar_url IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.cover_url IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN p.bio IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.school_name IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN p.grade_class IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.city IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN p.region IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.country IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN p.date_of_birth IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.school_type IS NOT NULL THEN 1 ELSE 0 END)
    ),
    'early_rank', COALESCE(public.signup_rank(_user_id), 999999),
    'xp', COALESCE(g.xp, 0), 'level', COALESCE(g.level, 1), 'coins', COALESCE(g.coins, 0),
    'reputation', COALESCE(g.reputation, 0), 'streak', COALESCE(g.streak_days, 0),
    'longest_streak', COALESCE(g.longest_streak, 0)
  ) INTO s;
  RETURN s;
END; $$;

CREATE OR REPLACE FUNCTION public.evaluate_achievements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s jsonb; a record; got jsonb := '[]'::jsonb; val numeric; total_xp int := 0; total_coins int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  s := public.user_badge_stats(auth.uid());
  FOR a IN
    SELECT ac.* FROM public.achievements ac
    WHERE ac.criteria_kind IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = auth.uid() AND ua.achievement_key = ac.key)
  LOOP
    val := COALESCE((s->>a.criteria_kind)::numeric, -1);
    IF val < 0 THEN CONTINUE; END IF;
    IF (a.criteria_kind = 'early_rank' AND val <= a.criteria_value)
       OR (a.criteria_kind <> 'early_rank' AND val >= a.criteria_value) THEN
      INSERT INTO public.user_achievements (user_id, achievement_key) VALUES (auth.uid(), a.key)
      ON CONFLICT DO NOTHING;
      got := got || jsonb_build_object('key', a.key, 'title', a.title, 'icon', a.icon, 'xp', a.xp, 'coins', a.coin_reward, 'tier', a.tier);
      total_xp := total_xp + a.xp;
      total_coins := total_coins + a.coin_reward;
      INSERT INTO public.notifications (user_id, type, message, entity_type)
      VALUES (auth.uid(), 'badge', 'You earned the ' || a.title || ' badge ' || a.icon, 'badge');
    END IF;
  END LOOP;
  IF total_xp > 0 THEN PERFORM public.award_xp(total_xp, 'badges'); END IF;
  IF total_coins > 0 THEN PERFORM public.award_coins(total_coins); END IF;
  RETURN jsonb_build_object('earned', got, 'xp', total_xp, 'coins', total_coins, 'stats', s);
END; $$;