import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Shield, Users, FileText, Film, MessageSquare, BadgeCheck, Flag, Settings, ScrollText,
  Search, Loader2, Ban, Trash2, Download, Megaphone, Clock, Check, X, ShieldCheck, ShieldOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { VerifiedBadge } from "@/components/app/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — SchoolConnect" },
      { name: "description", content: "Moderate members, posts, stories, reports and verification across SchoolConnect." },
      { property: "og:title", content: "Admin dashboard — SchoolConnect" },
      { property: "og:description", content: "Members, content, reports, verification and site settings in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type Tab = "overview" | "members" | "content" | "verification" | "reports" | "settings" | "log";
type Profile = {
  id: string; full_name: string | null; username: string | null; avatar_url: string | null;
  school_name: string | null; verified: boolean; verification_tier: string | null;
  banned: boolean; suspended_until: string | null; created_at: string; is_online: boolean | null;
};

function AdminPage() {
  const [uid, setUid] = useState("");
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        setUid(u.user.id);
        const r = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
        setIsAdmin(r.data === true);
      }
      setChecking(false);
    })();
  }, []);

  const log = useCallback(async (action: string, target_type?: string, target_id?: string, details?: Record<string, unknown>) => {
    await supabase.from("admin_actions").insert({ admin_id: uid, action, target_type: target_type ?? null, target_id: target_id ?? null, details: details ?? null });
  }, [uid]);

  if (checking) {
    return <AppShell><div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="card-flat rounded-2xl p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-extrabold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">This dashboard is restricted to SchoolConnect staff.</p>
          <Link to="/home" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Back to feed</Link>
        </div>
      </AppShell>
    );
  }

  const TABS: { key: Tab; label: string; icon: typeof Shield }[] = [
    { key: "overview", label: "Overview", icon: Shield },
    { key: "members", label: "Members", icon: Users },
    { key: "content", label: "Content", icon: FileText },
    { key: "verification", label: "Verification", icon: BadgeCheck },
    { key: "reports", label: "Reports", icon: Flag },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "log", label: "Audit log", icon: ScrollText },
  ];

  return (
    <AppShell>
      <div className="grid gap-4">
        <header className="card-flat rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary"><Shield className="h-5 w-5 text-primary-foreground" /></span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold sm:text-xl">Admin dashboard</h1>
                <p className="truncate text-xs text-muted-foreground">25 moderation tools · leonacquaye73@gmail.com</p>
              </div>
            </div>
          </div>
          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${tab === t.key ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </header>

        {tab === "overview" && <Overview />}
        {tab === "members" && <Members log={log} />}
        {tab === "content" && <Content log={log} />}
        {tab === "verification" && <Verification log={log} />}
        {tab === "reports" && <Reports log={log} />}
        {tab === "settings" && <SettingsPanel log={log} adminId={uid} />}
        {tab === "log" && <AuditLog />}
      </div>
    </AppShell>
  );
}

/* ------------------------------ 1–12: Overview widgets ----------------------------- */

function Overview() {
  const [s, setS] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const count = async (table: string, build?: (q: any) => any) => {
        let q = supabase.from(table as any).select("*", { count: "exact", head: true });
        if (build) q = build(q);
        const { count: c } = await q;
        return c ?? 0;
      };
      const dayAgo = new Date(Date.now() - 864e5).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const [
        users, posts, stories, comments, messages, likes, verified, pendingVerif, openReports,
        newUsers, newPosts, online, invites, follows, saves, convos, weekUsers,
      ] = await Promise.all([
        count("profiles"), count("posts"), count("stories"), count("post_comments"), count("messages"),
        count("post_likes"),
        count("profiles", (q) => q.eq("verified", true)),
        count("verification_requests", (q) => q.eq("status", "pending")),
        count("reports", (q) => q.eq("status", "open")),
        count("profiles", (q) => q.gte("created_at", dayAgo)),
        count("posts", (q) => q.gte("created_at", dayAgo)),
        count("profiles", (q) => q.eq("is_online", true)),
        count("invites", (q) => q.eq("confirmed", true)),
        count("follows"), count("post_saves"), count("conversations"),
        count("profiles", (q) => q.gte("created_at", weekAgo)),
      ]);
      setS({ users, posts, stories, comments, messages, likes, verified, pendingVerif, openReports, newUsers, newPosts, online, invites, follows, saves, convos, weekUsers });
      setLoading(false);
    })();
  }, []);

  const widgets: { label: string; value: number; icon: typeof Users }[] = [
    { label: "Members", value: s.users ?? 0, icon: Users },
    { label: "Verified", value: s.verified ?? 0, icon: BadgeCheck },
    { label: "Online now", value: s.online ?? 0, icon: Users },
    { label: "New (24h)", value: s.newUsers ?? 0, icon: Clock },
    { label: "New (7d)", value: s.weekUsers ?? 0, icon: Clock },
    { label: "Posts", value: s.posts ?? 0, icon: FileText },
    { label: "Posts (24h)", value: s.newPosts ?? 0, icon: FileText },
    { label: "Stories", value: s.stories ?? 0, icon: Film },
    { label: "Comments", value: s.comments ?? 0, icon: MessageSquare },
    { label: "Likes", value: s.likes ?? 0, icon: Check },
    { label: "Saves", value: s.saves ?? 0, icon: Check },
    { label: "Follows", value: s.follows ?? 0, icon: Users },
    { label: "Conversations", value: s.convos ?? 0, icon: MessageSquare },
    { label: "Messages", value: s.messages ?? 0, icon: MessageSquare },
    { label: "Confirmed invites", value: s.invites ?? 0, icon: Users },
    { label: "Pending badges", value: s.pendingVerif ?? 0, icon: BadgeCheck },
    { label: "Open reports", value: s.openReports ?? 0, icon: Flag },
  ];

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {widgets.map((w) => (
        <div key={w.label} className="card-flat rounded-2xl p-3.5">
          <w.icon className="h-4 w-4 text-muted-foreground" />
          <p className="mt-2 text-xl font-extrabold tabular-nums">{w.value.toLocaleString()}</p>
          <p className="truncate text-[11px] font-semibold text-muted-foreground">{w.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- 1 search · 2 verify · 3 unverify · 4 ban · 5 unban · 6 suspend ·
   7 lift suspension · 8 grant admin · 9 revoke admin · 10 grant moderator ·
   11 revoke moderator · 12 export CSV ---------- */

type LogFn = (action: string, target_type?: string, target_id?: string, details?: Record<string, unknown>) => Promise<void>;

function Members({ log }: { log: LogFn }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    let query = supabase.from("profiles")
      .select("id,full_name,username,avatar_url,school_name,verified,verification_tier,banned,suspended_until,created_at,is_online")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q.trim()) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%,school_name.ilike.%${q}%`);
    const { data } = await query;
    const list = (data ?? []) as Profile[];
    setRows(list);
    if (list.length) {
      const { data: r } = await supabase.from("user_roles").select("user_id,role").in("user_id", list.map((p) => p.id));
      const map: Record<string, string[]> = {};
      (r ?? []).forEach((x) => { map[x.user_id] = [...(map[x.user_id] ?? []), x.role as string]; });
      setRoles(map);
    }
    setBusy(false);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, values: Record<string, unknown>, action: string) {
    const { error } = await supabase.from("profiles").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    await log(action, "profile", id, values);
    toast.success("Done");
    load();
  }

  async function setRole(id: string, role: "admin" | "moderator", on: boolean) {
    const res = on
      ? await supabase.from("user_roles").insert({ user_id: id, role })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role);
    if (res.error) return toast.error(res.error.message);
    await log(on ? `grant_${role}` : `revoke_${role}`, "profile", id);
    toast.success(`${on ? "Granted" : "Revoked"} ${role}`);
    load();
  }

  function exportCsv() {
    const header = "id,full_name,username,school,verified,tier,banned,joined\n";
    const body = rows.map((r) => [r.id, r.full_name ?? "", r.username ?? "", r.school_name ?? "", r.verified, r.verification_tier ?? "", r.banned, r.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "schoolconnect-members.csv"; a.click();
    URL.revokeObjectURL(url);
    log("export_members_csv");
  }

  return (
    <section className="grid gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border bg-[color:var(--surface)] px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members, schools…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
        </div>
        <button onClick={exportCsv} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold hover:bg-muted">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {busy && <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

      <ul className="grid gap-2">
        {rows.map((p) => {
          const r = roles[p.id] ?? [];
          const suspended = p.suspended_until && new Date(p.suspended_until) > new Date();
          return (
            <li key={p.id} className="card-flat rounded-2xl p-3">
              <div className="flex min-w-0 items-center gap-3">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{(p.full_name ?? "S").slice(0, 2).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1 truncate text-sm font-bold">
                    <Link to="/profile/$userId" params={{ userId: p.id }} className="truncate hover:underline">{p.full_name || "Student"}</Link>
                    <VerifiedBadge verified={p.verified} className="h-3.5 w-3.5" />
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.school_name || "No school"} · joined {new Date(p.created_at).toLocaleDateString()}
                    {r.length ? ` · ${r.join(", ")}` : ""}
                    {p.banned ? " · BANNED" : suspended ? " · suspended" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {p.verified
                  ? <Act onClick={() => patch(p.id, { verified: false, verified_at: null, verification_tier: null }, "unverify_user")} icon={X}>Unverify</Act>
                  : <>
                      <Act onClick={() => patch(p.id, { verified: true, verified_at: new Date().toISOString(), verification_tier: "founder" }, "verify_user")} icon={BadgeCheck}>Verify (founder)</Act>
                      <Act onClick={() => patch(p.id, { verified: true, verified_at: new Date().toISOString(), verification_tier: "followers" }, "verify_user")} icon={BadgeCheck}>Verify (followers)</Act>
                      <Act onClick={() => patch(p.id, { verified: true, verified_at: new Date().toISOString(), verification_tier: "inviter" }, "verify_user")} icon={BadgeCheck}>Verify (invites)</Act>
                    </>}
                {p.banned
                  ? <Act onClick={() => patch(p.id, { banned: false, ban_reason: null }, "unban_user")} icon={Check}>Unban</Act>
                  : <Act danger onClick={() => patch(p.id, { banned: true, ban_reason: "Violated community rules" }, "ban_user")} icon={Ban}>Ban</Act>}
                {suspended
                  ? <Act onClick={() => patch(p.id, { suspended_until: null }, "lift_suspension")} icon={Check}>Lift suspension</Act>
                  : <Act onClick={() => patch(p.id, { suspended_until: new Date(Date.now() + 7 * 864e5).toISOString() }, "suspend_user_7d")} icon={Clock}>Suspend 7d</Act>}
                {r.includes("admin")
                  ? <Act onClick={() => setRole(p.id, "admin", false)} icon={ShieldOff}>Revoke admin</Act>
                  : <Act onClick={() => setRole(p.id, "admin", true)} icon={ShieldCheck}>Make admin</Act>}
                {r.includes("moderator")
                  ? <Act onClick={() => setRole(p.id, "moderator", false)} icon={ShieldOff}>Revoke mod</Act>
                  : <Act onClick={() => setRole(p.id, "moderator", true)} icon={ShieldCheck}>Make mod</Act>}
              </div>
            </li>
          );
        })}
        {!busy && !rows.length && <li className="card-flat rounded-2xl p-6 text-center text-sm text-muted-foreground">No members found.</li>}
      </ul>
    </section>
  );
}

function Act({ children, onClick, icon: Icon, danger }: { children: React.ReactNode; onClick: () => void; icon: typeof Check; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold hover:bg-muted ${danger ? "border-destructive/40 text-destructive" : ""}`}>
      <Icon className="h-3 w-3" /> {children}
    </button>
  );
}

/* ---------- 13 delete post · 14 delete comment · 15 delete story ---------- */

function Content({ log }: { log: LogFn }) {
  const [kind, setKind] = useState<"posts" | "post_comments" | "stories">("posts");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const cols = kind === "posts" ? "id,user_id,content,post_type,created_at" : kind === "stories" ? "id,user_id,media_type,caption,created_at" : "id,user_id,content,post_id,created_at";
    const { data } = await supabase.from(kind).select(cols).order("created_at", { ascending: false }).limit(40);
    setRows(data ?? []);
    setBusy(false);
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    const { error } = await supabase.from(kind).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await log(`delete_${kind}`, kind, id);
    toast.success("Removed");
    load();
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(["posts", "post_comments", "stories"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind === k ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>
            {k === "posts" ? "Posts" : k === "post_comments" ? "Comments" : "Stories"}
          </button>
        ))}
      </div>
      {busy ? <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="card-flat grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.content || r.caption || `(${r.media_type ?? r.post_type ?? "media"})`}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  <Link to="/profile/$userId" params={{ userId: r.user_id }} className="hover:underline">author</Link> · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => remove(r.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-muted">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </li>
          ))}
          {!rows.length && <li className="card-flat rounded-2xl p-6 text-center text-sm text-muted-foreground">Nothing here.</li>}
        </ul>
      )}
    </section>
  );
}

/* ---------- 16 approve badge request · 17 reject badge request · 18 review invites ---------- */

function Verification({ log }: { log: LogFn }) {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.from("verification_requests").select("*").order("created_at", { ascending: false }).limit(50);
    setRows(data ?? []);
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(row: any, approve: boolean) {
    const { data: me } = await supabase.auth.getUser();
    const upd = await supabase.from("verification_requests").update({
      status: approve ? "approved" : "rejected",
      reviewed_by: me.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (upd.error) return toast.error(upd.error.message);
    if (approve) {
      await supabase.from("profiles").update({ verified: true, verified_at: new Date().toISOString(), verification_tier: row.route }).eq("id", row.user_id);
      await supabase.from("notifications").insert({ user_id: row.user_id, type: "verified", message: "Your account is now verified 🎉", entity_type: "user", entity_id: row.user_id });
    }
    await log(approve ? "approve_verification" : "reject_verification", "verification_request", row.id);
    toast.success(approve ? "Approved" : "Rejected");
    load();
  }

  return (
    <section className="grid gap-2">
      {busy ? <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : rows.map((r) => (
        <div key={r.id} className="card-flat grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              <Link to="/profile/$userId" params={{ userId: r.user_id }} className="hover:underline">Member</Link> · {r.route} route
            </p>
            <p className="text-[11px] text-muted-foreground">{r.status} · {new Date(r.created_at).toLocaleString()}</p>
          </div>
          {r.status === "pending" && (
            <div className="flex shrink-0 gap-1.5">
              <Act onClick={() => decide(r, true)} icon={Check}>Approve</Act>
              <Act danger onClick={() => decide(r, false)} icon={X}>Reject</Act>
            </div>
          )}
        </div>
      ))}
      {!busy && !rows.length && <p className="card-flat rounded-2xl p-6 text-center text-sm text-muted-foreground">No badge applications yet.</p>}
    </section>
  );
}

/* ---------- 19 resolve report · 20 dismiss report ---------- */

function Reports({ log }: { log: LogFn }) {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(50);
    setRows(data ?? []);
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handle(id: string, status: "resolved" | "dismissed") {
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("reports").update({ status, handled_by: me.user?.id ?? null, handled_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    await log(`report_${status}`, "report", id);
    load();
  }

  return (
    <section className="grid gap-2">
      {busy ? <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : rows.map((r) => (
        <div key={r.id} className="card-flat grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{r.reason}</p>
            <p className="truncate text-[11px] text-muted-foreground">{r.target_type} · {r.status} · {new Date(r.created_at).toLocaleString()}</p>
          </div>
          {r.status === "open" && (
            <div className="flex shrink-0 gap-1.5">
              <Act onClick={() => handle(r.id, "resolved")} icon={Check}>Resolve</Act>
              <Act onClick={() => handle(r.id, "dismissed")} icon={X}>Dismiss</Act>
            </div>
          )}
        </div>
      ))}
      {!busy && !rows.length && <p className="card-flat rounded-2xl p-6 text-center text-sm text-muted-foreground">No reports. Nice and quiet.</p>}
    </section>
  );
}

/* ---------- 21 toggle verification · 22 announcement · 23 monetization target ·
   24 broadcast notification ---------- */

function SettingsPanel({ log, adminId }: { log: LogFn; adminId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [target, setTarget] = useState(100000);
  const [broadcast, setBroadcast] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key,value");
      (data ?? []).forEach((r) => {
        if (r.key === "verification_enabled") setEnabled(r.value === true);
        if (r.key === "announcement") setAnnouncement(typeof r.value === "string" ? r.value : "");
        if (r.key === "monetization_target_users") setTarget(Number(r.value) || 100000);
      });
    })();
  }, []);

  async function save(key: string, value: unknown, action: string) {
    setBusy(true);
    const { error } = await supabase.from("site_settings").upsert({ key, value: value as never }, { onConflict: "key" });
    setBusy(false);
    if (error) return toast.error(error.message);
    await log(action, "site_setting", undefined, { key, value });
    toast.success("Saved");
  }

  async function sendBroadcast() {
    if (!broadcast.trim()) return;
    setBusy(true);
    const { data: users } = await supabase.from("profiles").select("id").limit(1000);
    const rows = (users ?? []).map((u) => ({ user_id: u.id, actor_id: adminId, type: "announcement", message: broadcast.trim(), entity_type: "system" }));
    const { error } = await supabase.from("notifications").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    await log("broadcast_notification", "system", undefined, { count: rows.length });
    setBroadcast("");
    toast.success(`Sent to ${rows.length} members`);
  }

  return (
    <section className="grid gap-3">
      <div className="card-flat grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold">Verification badges live</p>
          <p className="text-xs text-muted-foreground">Turn this on to let eligible members apply and show checks.</p>
        </div>
        <button
          onClick={() => { const v = !enabled; setEnabled(v); save("verification_enabled", v, "toggle_verification"); }}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${enabled ? "bg-primary text-primary-foreground" : "border"}`}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      <div className="card-flat grid gap-2 rounded-2xl p-4">
        <p className="text-sm font-bold">Site announcement</p>
        <textarea value={announcement} onChange={(e) => setAnnouncement(e.target.value)} rows={3} className="rounded-xl border bg-background p-3 text-sm" />
        <button onClick={() => save("announcement", announcement, "update_announcement")} disabled={busy} className="justify-self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Save announcement</button>
      </div>

      <div className="card-flat grid gap-2 rounded-2xl p-4">
        <p className="text-sm font-bold">Monetization target (active users)</p>
        <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <button onClick={() => save("monetization_target_users", target, "update_monetization_target")} disabled={busy} className="justify-self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Save target</button>
      </div>

      <div className="card-flat grid gap-2 rounded-2xl p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Megaphone className="h-4 w-4" /> Broadcast to all members</p>
        <textarea value={broadcast} onChange={(e) => setBroadcast(e.target.value)} rows={2} placeholder="Verification icons and badges are now active…" className="rounded-xl border bg-background p-3 text-sm" />
        <button onClick={sendBroadcast} disabled={busy || !broadcast.trim()} className="justify-self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {busy ? "Sending…" : "Send notification"}
        </button>
      </div>
    </section>
  );
}

/* ---------- 25 audit log ---------- */

function AuditLog() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("admin_actions").select("*").order("created_at", { ascending: false }).limit(100).then((r) => setRows(r.data ?? []));
  }, []);
  return (
    <section className="card-flat rounded-2xl p-2">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="px-2 py-2.5">
            <p className="truncate text-sm font-semibold">{r.action}</p>
            <p className="truncate text-[11px] text-muted-foreground">{r.target_type ?? "—"} · {new Date(r.created_at).toLocaleString()}</p>
          </li>
        ))}
        {!rows.length && <li className="p-6 text-center text-sm text-muted-foreground">No admin actions logged yet.</li>}
      </ul>
    </section>
  );
}
