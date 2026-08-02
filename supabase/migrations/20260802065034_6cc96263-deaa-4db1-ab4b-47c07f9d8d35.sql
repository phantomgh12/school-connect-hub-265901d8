CREATE OR REPLACE FUNCTION public.claim_invite(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invites; inviter_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM public.invites WHERE code = _code;
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_code'); END IF;
  IF inv.inviter_id = auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'own_code'); END IF;
  IF inv.invitee_id IS NOT NULL AND inv.invitee_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;
  UPDATE public.invites SET invitee_id = auth.uid() WHERE id = inv.id;
  SELECT full_name INTO inviter_name FROM public.profiles WHERE id = inv.inviter_id;
  RETURN jsonb_build_object('ok', true, 'inviter_id', inv.inviter_id, 'inviter_name', inviter_name, 'confirmed', inv.confirmed);
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_invite(_code text, _confirm boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM public.invites WHERE code = _code AND invitee_id = auth.uid();
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_your_invite'); END IF;
  IF _confirm THEN
    UPDATE public.invites SET confirmed = true, confirmed_at = now() WHERE id = inv.id;
    INSERT INTO public.notifications (user_id, actor_id, type, message, entity_type, entity_id)
    VALUES (inv.inviter_id, auth.uid(), 'invite_confirmed', 'confirmed your invite', 'user', auth.uid());
  ELSE
    UPDATE public.invites SET confirmed = false, invitee_id = NULL WHERE id = inv.id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_invite(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.confirm_invite(text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_invite(text, boolean) TO authenticated;