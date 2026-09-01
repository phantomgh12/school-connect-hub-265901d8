REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.signup_rank(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.signup_rank(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verification_eligibility(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.verification_eligibility(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_admin_for_verified_email() FROM anon, public;