import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing you in…" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      // Supabase auto-parses ?code=... via detectSessionInUrl. Also handle #access_token=.
      // Give it a moment and then check for a session.
      for (let i = 0; i < 15; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) break;
        await new Promise(r => setTimeout(r, 200));
      }
      if (cancelled) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth", search: { mode: "login" }, replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!profile?.onboarded) navigate({ to: "/onboarding", replace: true });
      else navigate({ to: "/home", replace: true });
    }

    finish();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center hero-surface">
      <div className="glass rounded-3xl p-10 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[color:var(--brand)]" />
        <p className="mt-4 text-sm font-semibold">Signing you in…</p>
      </div>
    </div>
  );
}
