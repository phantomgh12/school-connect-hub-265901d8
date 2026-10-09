CREATE OR REPLACE FUNCTION public.landing_community_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT jsonb_build_object(
  'members', (SELECT count(*) FROM public.profiles WHERE NOT banned AND onboarded),
  'schools', (SELECT count(DISTINCT school_slug) FROM public.profiles WHERE NOT banned AND onboarded AND school_slug IS NOT NULL AND school_slug <> ''),
  'posts', (SELECT count(*) FROM public.posts p JOIN public.profiles u ON u.id=p.user_id WHERE NOT u.banned AND NOT p.is_draft AND p.audience='everyone' AND (p.publish_at IS NULL OR p.publish_at<=now())),
  'friendships', (SELECT count(*) FROM public.friendships WHERE status='accepted'),
  'updatedAt', now()
);
$$;
REVOKE ALL ON FUNCTION public.landing_community_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_community_stats() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.landing_community_stats() IS 'Public aggregate community totals only; no personal data, private posts or account details.';