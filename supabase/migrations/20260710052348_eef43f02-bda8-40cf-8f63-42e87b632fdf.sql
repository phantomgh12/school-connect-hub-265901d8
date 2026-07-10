
-- Counters on posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0;

-- Backfill from existing rows
UPDATE public.posts p SET views_count = COALESCE((SELECT COUNT(*) FROM public.post_views v WHERE v.post_id = p.id), 0);
UPDATE public.posts p SET shares_count = COALESCE((SELECT COUNT(*) FROM public.post_shares s WHERE s.post_id = p.id), 0);

-- Bump triggers
CREATE OR REPLACE FUNCTION public.bump_post_views_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET views_count = views_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_post_views ON public.post_views;
CREATE TRIGGER trg_bump_post_views AFTER INSERT ON public.post_views
  FOR EACH ROW EXECUTE FUNCTION public.bump_post_views_count();

CREATE OR REPLACE FUNCTION public.bump_post_shares_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_post_shares ON public.post_shares;
CREATE TRIGGER trg_bump_post_shares AFTER INSERT ON public.post_shares
  FOR EACH ROW EXECUTE FUNCTION public.bump_post_shares_count();

-- Notify all followers when a user publishes a new post
CREATE OR REPLACE FUNCTION public.notify_followers_on_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
  SELECT f.follower_id, NEW.user_id, 'new_post', 'shared a new post', 'post', NEW.id
  FROM public.follows f
  WHERE f.following_id = NEW.user_id AND f.follower_id <> NEW.user_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_followers_on_post ON public.posts;
CREATE TRIGGER trg_notify_followers_on_post AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_post();

-- Enforce 1..5 hashtags per post
CREATE OR REPLACE FUNCTION public.validate_post_hashtags()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.hashtags IS NULL OR array_length(NEW.hashtags, 1) IS NULL OR array_length(NEW.hashtags, 1) < 1 THEN
    RAISE EXCEPTION 'At least 1 hashtag is required';
  END IF;
  IF array_length(NEW.hashtags, 1) > 5 THEN
    RAISE EXCEPTION 'Maximum 5 hashtags allowed';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_post_hashtags ON public.posts;
CREATE TRIGGER trg_validate_post_hashtags BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_post_hashtags();
