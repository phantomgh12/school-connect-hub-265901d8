-- === economy columns ===
ALTER TABLE public.user_gamification
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reputation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_spin_date date,
  ADD COLUMN IF NOT EXISTS boxes_available integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS equipped_theme text,
  ADD COLUMN IF NOT EXISTS equipped_frame text,
  ADD COLUMN IF NOT EXISTS equipped_name_color text,
  ADD COLUMN IF NOT EXISTS equipped_bubble text;

-- === missions ===
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL,
  cadence text NOT NULL DEFAULT 'daily',
  goal integer NOT NULL DEFAULT 1,
  xp_reward integer NOT NULL DEFAULT 25,
  coin_reward integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions readable" ON public.missions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage missions" ON public.missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.mission_progress (
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  progress integer NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, user_id, period_start)
);
GRANT SELECT, INSERT, UPDATE ON public.mission_progress TO authenticated;
GRANT ALL ON public.mission_progress TO service_role;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mission progress read" ON public.mission_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own mission progress insert" ON public.mission_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own mission progress update" ON public.mission_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER mission_progress_updated BEFORE UPDATE ON public.mission_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === shop ===
CREATE TABLE IF NOT EXISTS public.shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 100,
  rarity text NOT NULL DEFAULT 'common',
  value text NOT NULL,
  min_level integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop readable" ON public.shop_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage shop" ON public.shop_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.user_purchases (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases readable" ON public.user_purchases FOR SELECT TO authenticated USING (true);

-- === mystery boxes ===
CREATE TABLE IF NOT EXISTS public.reward_boxes (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  cost_coins integer NOT NULL DEFAULT 0,
  rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_boxes TO authenticated;
GRANT ALL ON public.reward_boxes TO service_role;
ALTER TABLE public.reward_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boxes readable" ON public.reward_boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage boxes" ON public.reward_boxes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.box_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  box_id text NOT NULL REFERENCES public.reward_boxes(id) ON DELETE CASCADE,
  reward jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.box_openings TO authenticated;
GRANT ALL ON public.box_openings TO service_role;
ALTER TABLE public.box_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own box openings" ON public.box_openings FOR SELECT TO authenticated USING (user_id = auth.uid());

-- === spin wheel ===
CREATE TABLE IF NOT EXISTS public.spin_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_kind text NOT NULL,
  reward_amount integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spin_results TO authenticated;
GRANT ALL ON public.spin_results TO service_role;
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spins" ON public.spin_results FOR SELECT TO authenticated USING (user_id = auth.uid());

-- === seasons ===
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  theme text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons readable" ON public.seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage seasons" ON public.seasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- === school wars ===
CREATE TABLE IF NOT EXISTS public.school_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_wars TO authenticated;
GRANT ALL ON public.school_wars TO service_role;
ALTER TABLE public.school_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wars readable" ON public.school_wars FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage wars" ON public.school_wars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.school_war_scores (
  war_id uuid NOT NULL REFERENCES public.school_wars(id) ON DELETE CASCADE,
  school_slug text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (war_id, school_slug)
);
GRANT SELECT ON public.school_war_scores TO authenticated;
GRANT ALL ON public.school_war_scores TO service_role;
ALTER TABLE public.school_war_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "war scores readable" ON public.school_war_scores FOR SELECT TO authenticated USING (true);
CREATE TRIGGER war_scores_updated BEFORE UPDATE ON public.school_war_scores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === RPCs ===
CREATE OR REPLACE FUNCTION public.award_coins(_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_gamification SET coins = GREATEST(coins + COALESCE(_amount,0), 0)
    WHERE user_id = auth.uid() RETURNING coins INTO c;
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.add_war_points(_school_slug text, _points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w uuid;
BEGIN
  IF _school_slug IS NULL THEN RETURN; END IF;
  SELECT id INTO w FROM public.school_wars WHERE active AND now() BETWEEN starts_at AND ends_at ORDER BY starts_at DESC LIMIT 1;
  IF w IS NULL THEN RETURN; END IF;
  INSERT INTO public.school_war_scores (war_id, school_slug, points) VALUES (w, _school_slug, GREATEST(_points,0))
  ON CONFLICT (war_id, school_slug) DO UPDATE SET points = public.school_war_scores.points + GREATEST(_points,0), updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.daily_spin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.user_gamification; today date := (now() AT TIME ZONE 'UTC')::date;
        r numeric; kind text; amt integer; lbl text; slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO g FROM public.user_gamification WHERE user_id = auth.uid();
  IF g.last_spin_date = today THEN RETURN jsonb_build_object('ok', false, 'error', 'already_spun'); END IF;
  r := random();
  IF r < 0.30 THEN kind := 'coins'; amt := 25; lbl := '25 coins';
  ELSIF r < 0.55 THEN kind := 'coins'; amt := 60; lbl := '60 coins';
  ELSIF r < 0.72 THEN kind := 'xp'; amt := 50; lbl := '50 XP';
  ELSIF r < 0.86 THEN kind := 'xp'; amt := 150; lbl := '150 XP';
  ELSIF r < 0.95 THEN kind := 'box'; amt := 1; lbl := 'Mystery box';
  ELSE kind := 'coins'; amt := 250; lbl := 'JACKPOT 250 coins';
  END IF;
  UPDATE public.user_gamification SET last_spin_date = today,
    coins = coins + CASE WHEN kind = 'coins' THEN amt ELSE 0 END,
    boxes_available = boxes_available + CASE WHEN kind = 'box' THEN amt ELSE 0 END
  WHERE user_id = auth.uid();
  IF kind = 'xp' THEN PERFORM public.award_xp(amt, 'daily_spin'); END IF;
  INSERT INTO public.spin_results (user_id, reward_kind, reward_amount, label) VALUES (auth.uid(), kind, amt, lbl);
  SELECT school_slug INTO slug FROM public.profiles WHERE id = auth.uid();
  PERFORM public.add_war_points(slug, 2);
  RETURN jsonb_build_object('ok', true, 'kind', kind, 'amount', amt, 'label', lbl);
END; $$;

CREATE OR REPLACE FUNCTION public.open_box(_box_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.reward_boxes; g public.user_gamification; rw jsonb; total numeric := 0; pick numeric; acc numeric := 0; el jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO b FROM public.reward_boxes WHERE id = _box_id AND active;
  IF b.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_box'); END IF;
  INSERT INTO public.user_gamification (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO g FROM public.user_gamification WHERE user_id = auth.uid();
  IF b.cost_coins > 0 THEN
    IF g.coins < b.cost_coins THEN RETURN jsonb_build_object('ok', false, 'error', 'not_enough_coins'); END IF;
  ELSE
    IF g.boxes_available < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'no_boxes'); END IF;
  END IF;
  FOR el IN SELECT * FROM jsonb_array_elements(b.rewards) LOOP total := total + COALESCE((el->>'weight')::numeric, 1); END LOOP;
  IF total = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'empty_box'); END IF;
  pick := random() * total;
  FOR el IN SELECT * FROM jsonb_array_elements(b.rewards) LOOP
    acc := acc + COALESCE((el->>'weight')::numeric, 1);
    IF pick <= acc THEN rw := el; EXIT; END IF;
  END LOOP;
  UPDATE public.user_gamification SET
    coins = coins - CASE WHEN b.cost_coins > 0 THEN b.cost_coins ELSE 0 END
                  + CASE WHEN rw->>'kind' = 'coins' THEN COALESCE((rw->>'amount')::int,0) ELSE 0 END,
    boxes_available = boxes_available - CASE WHEN b.cost_coins > 0 THEN 0 ELSE 1 END
  WHERE user_id = auth.uid();
  IF rw->>'kind' = 'xp' THEN PERFORM public.award_xp(COALESCE((rw->>'amount')::int,0), 'mystery_box'); END IF;
  IF rw->>'kind' = 'item' THEN
    INSERT INTO public.user_purchases (user_id, item_id) VALUES (auth.uid(), rw->>'item_id') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.box_openings (user_id, box_id, reward) VALUES (auth.uid(), b.id, rw);
  RETURN jsonb_build_object('ok', true, 'reward', rw);
END; $$;

CREATE OR REPLACE FUNCTION public.buy_shop_item(_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF g.level < it.min_level THEN RETURN jsonb_build_object('ok', false, 'error', 'level_locked'); END IF;
  IF g.coins < it.price THEN RETURN jsonb_build_object('ok', false, 'error', 'not_enough_coins'); END IF;
  UPDATE public.user_gamification SET coins = coins - it.price WHERE user_id = auth.uid();
  INSERT INTO public.user_purchases (user_id, item_id) VALUES (auth.uid(), it.id);
  RETURN jsonb_build_object('ok', true, 'item_id', it.id);
END; $$;

CREATE OR REPLACE FUNCTION public.equip_item(_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    equipped_bubble = CASE WHEN it.category = 'bubble' THEN it.value ELSE equipped_bubble END
  WHERE user_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.progress_mission(_kind text, _amount integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.missions; ps date;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  FOR m IN SELECT * FROM public.missions WHERE active AND kind = _kind LOOP
    ps := CASE WHEN m.cadence = 'weekly' THEN date_trunc('week', now())::date ELSE (now() AT TIME ZONE 'UTC')::date END;
    INSERT INTO public.mission_progress (mission_id, user_id, period_start, progress)
    VALUES (m.id, auth.uid(), ps, GREATEST(_amount, 0))
    ON CONFLICT (mission_id, user_id, period_start)
    DO UPDATE SET progress = public.mission_progress.progress + GREATEST(_amount, 0), updated_at = now();
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_mission(_mission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.missions; mp public.mission_progress; ps date; slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM public.missions WHERE id = _mission_id AND active;
  IF m.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_mission'); END IF;
  ps := CASE WHEN m.cadence = 'weekly' THEN date_trunc('week', now())::date ELSE (now() AT TIME ZONE 'UTC')::date END;
  SELECT * INTO mp FROM public.mission_progress WHERE mission_id = m.id AND user_id = auth.uid() AND period_start = ps;
  IF mp.mission_id IS NULL OR mp.progress < m.goal THEN RETURN jsonb_build_object('ok', false, 'error', 'incomplete'); END IF;
  IF mp.claimed THEN RETURN jsonb_build_object('ok', false, 'error', 'claimed'); END IF;
  UPDATE public.mission_progress SET claimed = true WHERE mission_id = m.id AND user_id = auth.uid() AND period_start = ps;
  PERFORM public.award_xp(m.xp_reward, 'mission');
  PERFORM public.award_coins(m.coin_reward);
  SELECT school_slug INTO slug FROM public.profiles WHERE id = auth.uid();
  PERFORM public.add_war_points(slug, 5);
  RETURN jsonb_build_object('ok', true, 'xp', m.xp_reward, 'coins', m.coin_reward);
END; $$;

-- === seed content ===
INSERT INTO public.missions (title, description, kind, cadence, goal, xp_reward, coin_reward) VALUES
  ('Say something', 'Create 1 post today', 'post', 'daily', 1, 40, 20),
  ('Show love', 'Like 5 posts today', 'like', 'daily', 5, 25, 10),
  ('Join the chat', 'Leave 3 comments today', 'comment', 'daily', 3, 30, 15),
  ('Story time', 'Share 1 story today', 'story', 'daily', 1, 35, 15),
  ('Say hi', 'Send 5 messages today', 'message', 'daily', 5, 20, 10),
  ('Content machine', 'Create 5 posts this week', 'post', 'weekly', 5, 200, 100),
  ('Social butterfly', 'Make 3 new friends this week', 'friend', 'weekly', 3, 180, 90),
  ('Campus voice', 'Get 25 likes this week', 'received_like', 'weekly', 25, 250, 120),
  ('Recruiter', 'Invite 2 people this week', 'invite', 'weekly', 2, 300, 150)
ON CONFLICT DO NOTHING;

INSERT INTO public.shop_items (id, name, category, description, price, rarity, value, min_level) VALUES
  ('theme_midnight','Midnight','theme','Deep navy dark theme',300,'rare','midnight',1),
  ('theme_sunset','Sunset','theme','Warm orange gradient theme',300,'rare','sunset',3),
  ('theme_forest','Forest','theme','Calm green theme',250,'common','forest',1),
  ('theme_neon','Neon','theme','High-contrast neon theme',600,'epic','neon',8),
  ('frame_gold','Gold Ring','frame','Gold profile frame',400,'epic','gold',5),
  ('frame_silver','Silver Ring','frame','Silver profile frame',200,'common','silver',1),
  ('frame_fire','Fire Ring','frame','Animated fire frame',800,'legendary','fire',10),
  ('frame_leaf','Leaf Crown','frame','Green leaf frame',350,'rare','leaf',4),
  ('name_blue','Blue Name','name_color','Blue username colour',150,'common','#2563EB',1),
  ('name_green','Green Name','name_color','Green username colour',150,'common','#10B981',1),
  ('name_amber','Amber Name','name_color','Amber username colour',250,'rare','#F59E0B',3),
  ('name_rose','Rose Name','name_color','Rose username colour',250,'rare','#EF4444',3),
  ('name_rainbow','Rainbow Name','name_color','Animated rainbow name',900,'legendary','rainbow',12),
  ('bubble_classic','Classic Bubbles','bubble','Default chat bubbles',0,'common','classic',1),
  ('bubble_ocean','Ocean Bubbles','bubble','Blue chat bubbles',200,'common','ocean',1),
  ('bubble_sunset','Sunset Bubbles','bubble','Warm chat bubbles',300,'rare','sunset',4),
  ('bubble_mono','Mono Bubbles','bubble','Minimal grey bubbles',300,'rare','mono',4),
  ('bubble_galaxy','Galaxy Bubbles','bubble','Purple galaxy bubbles',700,'epic','galaxy',9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.reward_boxes (id, name, description, cost_coins, rewards) VALUES
  ('daily_box','Daily Box','One free box a day from streaks and spins',0,
   '[{"kind":"coins","amount":30,"weight":35,"label":"30 coins"},{"kind":"coins","amount":80,"weight":20,"label":"80 coins"},{"kind":"xp","amount":75,"weight":25,"label":"75 XP"},{"kind":"xp","amount":200,"weight":12,"label":"200 XP"},{"kind":"item","item_id":"frame_silver","weight":5,"label":"Silver Ring frame"},{"kind":"item","item_id":"bubble_ocean","weight":3,"label":"Ocean bubbles"}]'::jsonb),
  ('premium_box','Premium Box','Costs coins, better rewards',250,
   '[{"kind":"coins","amount":400,"weight":10,"label":"400 coins"},{"kind":"xp","amount":500,"weight":25,"label":"500 XP"},{"kind":"item","item_id":"frame_gold","weight":12,"label":"Gold Ring frame"},{"kind":"item","item_id":"theme_neon","weight":8,"label":"Neon theme"},{"kind":"item","item_id":"bubble_galaxy","weight":10,"label":"Galaxy bubbles"},{"kind":"coins","amount":100,"weight":35,"label":"100 coins"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seasons (name, theme, description, ends_at) VALUES
  ('Season 1: First Bell','back-to-school','Earn XP, climb the ranks and win the first School War.', now() + interval '60 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.school_wars (title, description, ends_at) VALUES
  ('School War: Week 1','Every post, like, mission and spin earns points for your school.', now() + interval '7 days')
ON CONFLICT DO NOTHING;