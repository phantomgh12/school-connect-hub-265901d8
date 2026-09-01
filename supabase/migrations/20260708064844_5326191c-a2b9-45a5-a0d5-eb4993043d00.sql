
-- ==========================================
-- Phase 2: Stories, Friends, Notifications, Messages, Presence
-- ==========================================

-- Add presence fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- ---------- Stories ----------
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text,
  media_type text NOT NULL DEFAULT 'text' CHECK (media_type IN ('photo','video','text')),
  caption text,
  background text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories readable by authenticated" ON public.stories FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "stories insert own" ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories delete own" ON public.stories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS stories_user_idx ON public.stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories(expires_at);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_views read own or as author" ON public.story_views FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM public.stories WHERE id = story_id));
CREATE POLICY "story_views insert own" ON public.story_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.story_reactions TO authenticated;
GRANT ALL ON public.story_reactions TO service_role;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_reactions read auth" ON public.story_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "story_reactions insert own" ON public.story_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "story_reactions delete own" ON public.story_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.story_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.story_replies TO authenticated;
GRANT ALL ON public.story_replies TO service_role;
ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_replies read own or as author" ON public.story_replies FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM public.stories WHERE id = story_id));
CREATE POLICY "story_replies insert own" ON public.story_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- Friendships ----------
DO $$ BEGIN
  CREATE TYPE public.friendship_status AS ENUM ('pending','accepted','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships read involved" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships insert as requester" ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships update by addressee or requester" ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "friendships delete involved" ON public.friendships FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE TRIGGER trg_friendships_updated BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications read own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications insert any auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications delete own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- ---------- Conversations & Messages (DM) ----------
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_a, user_b),
  CHECK (user_a < user_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convo read involved" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "convo insert involved" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "convo update involved" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages read involved" ON public.messages FOR SELECT TO authenticated USING (
  auth.uid() IN (SELECT user_a FROM public.conversations WHERE id = conversation_id UNION SELECT user_b FROM public.conversations WHERE id = conversation_id)
);
CREATE POLICY "messages insert as sender in convo" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND auth.uid() IN (SELECT user_a FROM public.conversations WHERE id = conversation_id UNION SELECT user_b FROM public.conversations WHERE id = conversation_id)
);
CREATE POLICY "messages update own or as recipient" ON public.messages FOR UPDATE TO authenticated USING (
  auth.uid() = sender_id OR auth.uid() IN (SELECT user_a FROM public.conversations WHERE id = conversation_id UNION SELECT user_b FROM public.conversations WHERE id = conversation_id)
);
CREATE INDEX IF NOT EXISTS messages_convo_idx ON public.messages(conversation_id, created_at);

-- Make profiles readable to authenticated users (for search / suggestions)
DO $$ BEGIN
  CREATE POLICY "profiles readable to authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
