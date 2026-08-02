import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Check, Copy, Loader2, Users, UserPlus, Trophy, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({
    meta: [
      { title: "Verification & badges — SchoolConnect" },
      { name: "description", content: "See how to earn the SchoolConnect verified badge: founding member, 20 followers, or 50 confirmed invites." },
      { property: "og:title", content: "Verification & badges — SchoolConnect" },
      { property: "og:description", content: "Founding members, 20 followers, or 50 confirmed invites — three routes to the blue check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerificationPage,
});

type Elig = {
  rank: number | null;
  joined_at: string | null;
  followers: number;
  confirmed_invites: number;
  founder_eligible: boolean;
  follower_eligible: boolean;
  inviter_eligible: boolean;
};

function VerificationPage() {
  const [uid, setUid] = useState("");
  const [elig, setElig] = useState<Elig | null>(null);
  const [verified, setVerified] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [request, setRequest] = useState<{ status: string; route: string } | null>(null);
  const [code, setCode] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const [e, p, s, r, inv] = await Promise.all([
        supabase.rpc("verification_eligibility", { _user_id: u.user.id }),
        supabase.from("profiles").select("verified,verification_tier").eq("id", u.user.id).maybeSingle(),
        supabase.from("site_settings").select("value").eq("key", "verification_enabled").maybeSingle(),
        supabase.from("verification_requests").select("status,route").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("invites").select("code").eq("inviter_id", u.user.id).limit(1).maybeSingle(),
      ]);
      setElig((e.data as unknown as Elig) ?? null);
      setVerified(!!p.data?.verified);
      setTier(p.data?.verification_tier ?? null);
      setEnabled(s.data?.value === true);
      setRequest(r.data ?? null);
      if (inv.data?.code) setCode(inv.data.code);
    })();
  }, []);

  async function makeCode() {
    setBusy(true);
    const { data, error } = await supabase.from("invites").insert({ inviter_id: uid }).select("code").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setCode(data.code);
    toast.success("Invite link created");
  }

  async function apply(route: string) {
    setBusy(true);
    const { error } = await supabase.from("verification_requests").insert({ user_id: uid, route });
    setBusy(false);
    if (error) return toast.error(error.message);
    setRequest({ status: "pending", route });
    toast.success("Application sent — an admin will review it");
  }

  const link = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?invite=${code}` : "";
  const routes = [
    { key: "founder", icon: Trophy, title: "Founding member", desc: "One of the first 20 people to join SchoolConnect.", progress: `#${elig?.rank ?? "—"} of all members`, ok: !!elig?.founder_eligible },
    { key: "followers", icon: Users, title: "20 followers", desc: "For members who joined between July and October.", progress: `${elig?.followers ?? 0} / 20 followers`, ok: !!elig?.follower_eligible },
    { key: "inviter", icon: UserPlus, title: "Invite 50 people", desc: "50 different people join and confirm that you invited them.", progress: `${elig?.confirmed_invites ?? 0} / 50 confirmed`, ok: !!elig?.inviter_eligible },
  ];
  const anyEligible = routes.some((r) => r.ok);

  return (
    <AppShell>
      <div className="grid gap-4">
        <section className="card-flat rounded-2xl p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--verified)]/12">
              <BadgeCheck className="h-6 w-6 text-[color:var(--verified)]" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold sm:text-2xl">Verification &amp; badges</h1>
              <p className="text-sm text-muted-foreground">
                {enabled ? "Verification is live — apply below." : "Badges activate tomorrow. Check your progress now."}
              </p>
            </div>
          </div>

          {verified && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-[color:var(--verified)]/30 bg-[color:var(--verified)]/8 px-3 py-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-[color:var(--verified)]" />
              You are verified{tier ? ` — ${tier} route` : ""}.
            </p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {routes.map((r) => (
            <section key={r.key} className="card-flat rounded-2xl p-4">
              <r.icon className="h-5 w-5 text-[color:var(--brand)]" />
              <h2 className="mt-2 text-sm font-bold">{r.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              <p className="mt-3 text-xs font-semibold">{r.progress}</p>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.ok ? "bg-[color:var(--brand)]/12 text-[color:var(--brand)]" : "bg-muted text-muted-foreground"}`}>
                {r.ok ? <><Check className="h-3 w-3" /> Requirement met</> : "Not yet"}
              </span>
            </section>
          ))}
        </div>

        <section className="card-flat rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-bold">Your invite link</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this link. When someone signs up with it they are asked to confirm you invited them — only confirmed invites count.
          </p>
          {code ? (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input readOnly value={link} className="min-w-0 rounded-xl border bg-background px-3 py-2 text-xs" />
              <button
                onClick={() => { navigator.clipboard?.writeText(link); toast.success("Copied"); }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          ) : (
            <button onClick={makeCode} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create invite link
            </button>
          )}
        </section>

        <section className="card-flat rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-bold">Apply for your badge</h2>
          {request ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Application status: <span className="font-bold text-foreground">{request.status}</span> ({request.route} route).
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {routes.filter((r) => r.ok).map((r) => (
                <button key={r.key} onClick={() => apply(r.key)} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
                  Apply — {r.title}
                </button>
              ))}
              {!anyEligible && <p className="text-sm text-muted-foreground">You don't meet a requirement yet. Keep growing your network!</p>}
            </div>
          )}
        </section>

        <section className="card-flat rounded-2xl p-4 text-xs text-muted-foreground sm:p-5">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="text-foreground">Disclaimer:</strong> verification on this site does not mean monetization.
              Monetization will be activated when SchoolConnect reaches 100,000 active users.
            </span>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
