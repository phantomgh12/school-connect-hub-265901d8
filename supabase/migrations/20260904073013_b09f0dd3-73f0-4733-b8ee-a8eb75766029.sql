CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index smallint NOT NULL CHECK (option_index BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_votes TO authenticated;
GRANT ALL ON public.post_poll_votes TO service_role;

ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in students can read post poll votes" ON public.post_poll_votes;
CREATE POLICY "Signed-in students can read post poll votes"
  ON public.post_poll_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Students manage their own post poll vote" ON public.post_poll_votes;
CREATE POLICY "Students manage their own post poll vote"
  ON public.post_poll_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS post_poll_votes_touch ON public.post_poll_votes;
CREATE TRIGGER post_poll_votes_touch BEFORE UPDATE ON public.post_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TABLE IF EXISTS public.poll_votes_unused;
