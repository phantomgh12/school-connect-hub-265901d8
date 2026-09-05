REVOKE ALL ON public.security_answers FROM anon, authenticated;
GRANT ALL ON public.security_answers TO service_role;
DROP POLICY IF EXISTS "No direct access to security answers" ON public.security_answers;
CREATE POLICY "No direct access to security answers"
ON public.security_answers FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);