DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutual_friends_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_shop_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.progress_mission(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_spin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_house(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_box(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift(text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_badge_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.signup_rank(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verification_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_invite(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_house_points(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_war_points(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_post_trending(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_coins(integer) TO authenticated;
