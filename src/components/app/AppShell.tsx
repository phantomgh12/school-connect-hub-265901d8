import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home, User, Bell, Search, Users, Bookmark, LogOut, Sun, Moon, GraduationCap,
  Menu, X, MessageCircle, PlusSquare, Film, BadgeCheck, Shield, Sparkles,
  School, CalendarDays, Trophy, Settings, Flame, UserCheck, MessageSquareDashed,
  Gift, ShoppingBag, Award,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { InstallAppPrompt } from "@/components/app/InstallAppPrompt";
import { FirstPostGate } from "@/components/app/FirstPostGate";
import { NotificationBell } from "@/components/app/NotificationBell";

type NavItem = { to: string; label: string; icon: typeof Home; search?: Record<string, string> };

const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/home", label: "For You", icon: Sparkles, search: { tab: "foryou" } },
  { to: "/home", label: "Following", icon: UserCheck, search: { tab: "following" } },
  { to: "/communities", label: "School Communities", icon: School },
  { to: "/for-you", label: "Reels", icon: Film },
  { to: "/trending", label: "Trending", icon: Flame },
  { to: "/confessions", label: "Confessions", icon: MessageSquareDashed },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/badges", label: "Badges", icon: Award },
  { to: "/verification", label: "Verification", icon: BadgeCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [pendingReq, setPendingReq] = useState(0);
  const [uid, setUid] = useState<string>("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const state = useRouterState({ select: (s) => ({ pathname: s.location.pathname, search: s.location.search as any }) });
  const pathname = state.pathname;
  const activeTab = (state.search?.tab as string) ?? "foryou";
  const nav = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    let mounted = true;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    async function refreshCounts(id: string) {
      const [{ count: n }, { count: r }, { data: convos }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", id).eq("read", false),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", id).eq("status", "pending"),
        supabase.from("conversations").select("id").or(`user_a.eq.${id},user_b.eq.${id}`),
      ]);
      let msgs = 0;
      const cids = (convos ?? []).map((c: any) => c.id);
      if (cids.length) {
        const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
          .in("conversation_id", cids).eq("read", false).neq("sender_id", id);
        msgs = count ?? 0;
      }
      if (!mounted) return;
      setUnread(n ?? 0);
      setPendingReq(r ?? 0);
      setUnreadMsgs(msgs);
    }

    async function init() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !mounted) return;
      setUid(u.user.id);
      const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", u.user.id).maybeSingle();
      if (mounted) setAvatar(prof?.avatar_url ?? null);
      await supabase.from("profiles").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", u.user.id);
      const role = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (mounted) setIsAdmin(role.data === true);
      await refreshCounts(u.user.id);

      ch = supabase.channel(`shell-${u.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${u.user.id}` }, () => refreshCounts(u.user!.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${u.user.id}` }, () => refreshCounts(u.user!.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refreshCounts(u.user!.id))
        .subscribe();
    }
    init();

    const iv = setInterval(async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) supabase.from("profiles").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", u.user.id).then(() => {});
    }, 120000);

    return () => {
      mounted = false;
      clearInterval(iv);
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    if (uid) await supabase.from("profiles").update({ is_online: false }).eq("id", uid);
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/", replace: true });
  }

  const items = isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: Shield }] : NAV;

  const isActive = (n: NavItem) => {
    if (n.search) return pathname === "/home" && activeTab === n.search["tab"];
    if (n.to === "/home") return pathname === "/home" && activeTab !== "following";
    return pathname === n.to || pathname.startsWith(`${n.to}/`);
  };
  const badgeFor = (to: string) =>
    to === "/notifications" ? unread : to === "/friends" ? pendingReq : to === "/messages" ? unreadMsgs : 0;

  const NavLinks = ({ compact }: { compact?: boolean }) => (
    <ul className="grid gap-1">
      {items.map((n) => {
        const active = isActive(n as NavItem);
        const badge = badgeFor(n.to);
        return (
          <li key={n.label}>
            <Link
              to={n.to}
              {...(n.search ? { search: n.search as any } : {})}
              title={n.label}
              className={`press flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-primary text-primary-foreground shadow-soft" : "hover:bg-muted"
              } ${compact ? "md:justify-center xl:justify-start" : ""}`}
            >
              <n.icon className="h-5 w-5 shrink-0" />
              <span className={compact ? "hidden truncate xl:inline" : "truncate"}>{n.label}</span>
              {badge > 0 && (
                <span className={`ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground ${compact ? "hidden xl:inline" : ""}`}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      {/* ---- Fixed top bar ---- */}
      <header className="glass-blur sticky top-0 z-50">
        <div className="mx-auto grid h-14 w-full max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="press rounded-xl p-2 hover:bg-muted lg:hidden">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/home" className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-1xl bg-primary shadow-soft">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </span>
              <span className="hidden truncate text-base font-extrabold tracking-tight sm:inline">GH School Hub</span>
            </Link>
          </div>

          <Link
            to="/search"
            className="hidden min-w-0 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search students, schools, hashtags…</span>
          </Link>

          <div className="flex items-center gap-1 justify-self-end">
            <Link to="/search" className="press rounded-full p-2 hover:bg-muted md:hidden" aria-label="Search"><Search className="h-5 w-5" /></Link>
            <Link to="/new-post" className="press hidden items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground shadow-soft sm:inline-flex">
              <PlusSquare className="h-4 w-4" /> Post
            </Link>
            <NotificationBell uid={uid} unread={unread} onRead={() => setUnread(0)} />
            <Link to="/messages" className="press relative hidden rounded-full p-2 hover:bg-muted sm:inline-flex" aria-label="Messages">
              <MessageCircle className="h-5 w-5" />
              {unreadMsgs > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {unreadMsgs > 9 ? "9+" : unreadMsgs}
                </span>
              )}
            </Link>
            <button onClick={toggle} aria-label="Toggle theme" className="press rounded-full p-2 hover:bg-muted">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/profile" aria-label="Profile" className="press ml-0.5 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <User className="h-4 w-4" />}
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Mobile / tablet drawer ---- */}
      {open && (
        <>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 top-14 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden" />
          <nav className="animate-fade-up fixed left-0 top-14 z-50 h-[calc(100dvh-3.5rem)] w-[80%] max-w-xs overflow-y-auto border-r bg-[color:var(--surface)] p-3 lg:hidden">
            <NavLinks />
            <div className="mt-2 border-t pt-2">
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                <LogOut className="h-5 w-5" /> Sign out
              </button>
            </div>
          </nav>
        </>
      )}

      {/* ---- Main 3-column frame ---- */}
      <div className="mx-auto flex w-full max-w-[1500px] items-start gap-0 px-0 sm:px-4">
        <aside className="sticky top-14 z-30 hidden h-[calc(100dvh-3.5rem)] shrink-0 overflow-y-auto overscroll-contain py-4 pb-24 pr-2 no-scrollbar md:block md:w-[76px] xl:w-[248px] xl:pr-4">
          <NavLinks compact />
          <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold hover:bg-muted md:justify-center xl:justify-start">
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="hidden xl:inline">Sign out</span>
          </button>
        </aside>

        <main className="relative z-10 min-w-0 flex-1 overflow-x-clip px-3 py-4 pb-28 sm:px-4 lg:pb-8">
          <div className="mx-auto w-full max-w-[680px]">{children}</div>
        </main>

        <aside className="sticky top-14 z-20 hidden h-[calc(100dvh-3.5rem)] w-[330px] shrink-0 overflow-y-auto overscroll-contain py-4 pb-24 pl-4 no-scrollbar lg:block">
          <div className="grid gap-4">{right}</div>
        </aside>
      </div>

      {/* ---- Mobile bottom navigation ---- */}
      <nav className="glass-blur fixed bottom-0 left-0 right-0 z-40 border-t md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-6 pb-[env(safe-area-inset-bottom)]">
          {[
            { to: "/home", icon: Home, label: "Home" },
            { to: "/search", icon: Search, label: "Search" },
            { to: "/for-you", icon: Film, label: "Reels" },
            { to: "/new-post", icon: PlusSquare, label: "Create", accent: true },
            { to: "/notifications", icon: Bell, label: "Alerts", badge: unread },
            { to: "/profile", icon: User, label: "Me" },
          ].map((n: any) => {
            const active = pathname === n.to;
            const Icon = n.icon;
            return (
              <li key={n.to}>
                <Link to={n.to} className={`press relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {n.accent ? (
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft"><Icon className="h-4 w-4" /></span>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {n.badge > 0 && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <FirstPostGate />
      <InstallAppPrompt />
    </div>
  );
}
