ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS feeling text,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS poll jsonb;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_audience_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_audience_check CHECK (audience IN ('public','friends','school'));

CREATE INDEX IF NOT EXISTS posts_publish_idx ON public.posts (publish_at DESC) WHERE is_draft = false;
CREATE INDEX IF NOT EXISTS posts_pinned_idx ON public.posts (user_id) WHERE pinned;

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index smallint NOT NULL CHECK (option_index BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in students can read poll votes" ON public.poll_votes;
CREATE POLICY "Signed-in students can read poll votes"
  ON public.poll_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Students manage their own poll vote" ON public.poll_votes;
CREATE POLICY "Students manage their own poll vote"
  ON public.poll_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS poll_votes_touch ON public.poll_votes;
CREATE TRIGGER poll_votes_touch BEFORE UPDATE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
