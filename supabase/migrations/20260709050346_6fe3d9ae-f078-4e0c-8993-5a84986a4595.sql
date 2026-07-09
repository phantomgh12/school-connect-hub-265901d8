
-- FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows readable" ON public.follows;
CREATE POLICY "follows readable" ON public.follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "follow self only" ON public.follows;
CREATE POLICY "follow self only" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "unfollow self only" ON public.follows;
CREATE POLICY "unfollow self only" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- POST VIEWS
CREATE TABLE IF NOT EXISTS public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
-- Owner-only SELECT: viewers list is private; users cannot see who viewed
DROP POLICY IF EXISTS "post views owner read" ON public.post_views;
CREATE POLICY "post views owner read" ON public.post_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "post views insert self" ON public.post_views;
CREATE POLICY "post views insert self" ON public.post_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- POST SHARES
CREATE TABLE IF NOT EXISTS public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
GRANT ALL ON public.post_shares TO service_role;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shares readable" ON public.post_shares;
CREATE POLICY "shares readable" ON public.post_shares FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shares insert self" ON public.post_shares;
CREATE POLICY "shares insert self" ON public.post_shares FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Helper: are two users friends? (accepted friendship either direction)
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
  );
$$;

-- Stories: only friends (and owner) can view
DROP POLICY IF EXISTS "Users can view active stories" ON public.stories;
DROP POLICY IF EXISTS "stories friends and self" ON public.stories;
CREATE POLICY "stories friends and self" ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now() AND (user_id = auth.uid() OR public.are_friends(auth.uid(), user_id)));

-- Mutual friends count between me and another user
CREATE OR REPLACE FUNCTION public.mutual_friends_count(_me uuid, _other uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_friends AS (
    SELECT CASE WHEN requester_id = _me THEN addressee_id ELSE requester_id END AS fid
    FROM public.friendships WHERE status = 'accepted' AND (requester_id = _me OR addressee_id = _me)
  ),
  their_friends AS (
    SELECT CASE WHEN requester_id = _other THEN addressee_id ELSE requester_id END AS fid
    FROM public.friendships WHERE status = 'accepted' AND (requester_id = _other OR addressee_id = _other)
  )
  SELECT COUNT(*)::int FROM my_friends m JOIN their_friends t ON m.fid = t.fid WHERE m.fid <> _me AND m.fid <> _other;
$$;
GRANT EXECUTE ON FUNCTION public.mutual_friends_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- Notification triggers
CREATE OR REPLACE FUNCTION public.notify_on_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
    VALUES (owner, NEW.user_id, 'like', 'liked your post', 'post', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_like ON public.post_likes;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
    VALUES (owner, NEW.user_id, 'comment', 'commented on your post', 'post', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_comment ON public.post_comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_save() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
    VALUES (owner, NEW.user_id, 'save', 'saved your post', 'post', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_save ON public.post_saves;
CREATE TRIGGER trg_notify_save AFTER INSERT ON public.post_saves FOR EACH ROW EXECUTE FUNCTION public.notify_on_save();

CREATE OR REPLACE FUNCTION public.notify_on_share() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
    VALUES (owner, NEW.user_id, 'share', 'shared your post', 'post', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_share ON public.post_shares;
CREATE TRIGGER trg_notify_share AFTER INSERT ON public.post_shares FOR EACH ROW EXECUTE FUNCTION public.notify_on_share();

CREATE OR REPLACE FUNCTION public.notify_on_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you', 'user', NEW.follower_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Realtime
DO $$ BEGIN
  PERFORM 1;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.follows; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_shares; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
