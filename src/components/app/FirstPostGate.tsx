import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PenSquare, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { postPrompts } from "@/lib/feed";

/**
 * New members must publish their first post before browsing the feed.
 * Skipped on the composer routes so they can actually complete it.
 */
export function FirstPostGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [show, setShow] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);

  const exempt = pathname.startsWith("/new-post") || pathname.startsWith("/new-story") || pathname.startsWith("/onboarding") || pathname.startsWith("/settings");

  useEffect(() => {
    if (exempt) { setShow(false); return; }
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const [{ count }, { data: p }] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("profiles").select("school_name").eq("id", uid).maybeSingle(),
      ]);
      if (!alive) return;
      if ((count ?? 0) === 0) {
        setPrompts(postPrompts(uid, p?.school_name));
        setShow(true);
      } else setShow(false);
    })();
    return () => { alive = false; };
  }, [pathname, exempt]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/95 px-4 backdrop-blur-md">
      <div className="glass animate-fade-up w-full max-w-md rounded-3xl p-6">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary shadow-soft">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </span>
        <h2 className="mt-4 text-xl font-black tracking-tight">Make your first post to unlock the feed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          SchoolConnect is built on sharing. Publish one post and the whole community opens up.
        </p>
        <ul className="mt-4 grid gap-2">
          {prompts.map((p) => (
            <li key={p} className="rounded-2xl border bg-card px-3 py-2 text-xs font-semibold break-words">{p}</li>
          ))}
        </ul>
        <Link to="/new-post" className="press mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft">
          <PenSquare className="h-4 w-4" /> Write my first post
        </Link>
      </div>
    </div>
  );
}
