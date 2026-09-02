
revoke all on function public.username_available(text) from anon, authenticated;
revoke all on function public.is_username_blocked(text) from anon, authenticated;
revoke all on function public.normalize_username(text) from anon, authenticated;
grant execute on function public.username_available(text) to service_role;
grant execute on function public.is_username_blocked(text) to service_role;
grant execute on function public.normalize_username(text) to service_role;
