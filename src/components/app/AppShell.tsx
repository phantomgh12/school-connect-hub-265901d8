import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home, User, Bell, Search, Users, Bookmark, Compass, LogOut, Sun, Moon, GraduationCap,
  Menu, X, MessageCircle, PlusSquare, Film, BadgeCheck, Shield,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { InstallAppPrompt } from "@/components/app/InstallAppPrompt";

type NavItem = { to: string; label: string; icon: typeof Home };

const NAV: NavItem[] = [
  { to: "/home", label: "Feed", icon: Home },
  { to: "/for-you", label: "Reels", icon: Film },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/search", label: "Search", icon: Search },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/verification", label: "Verification", icon: BadgeCheck },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pendingReq, setPendingReq] = useState(0);
  const [uid, setUid] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    let mounted = true;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    async function refreshCounts(id: string) {
      const [{ count: n }, { count: r }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", id).eq("read", false),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", id).eq("status", "pending"),
      ]);
      if (!mounted) return;
      setUnread(n ?? 0);
      setPendingReq(r ?? 0);
    }

    async function init() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !mounted) return;
      setUid(u.user.id);
      await supabase.from("profiles").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", u.user.id);
      const role = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (mounted) setIsAdmin(role.data === true);
      await refreshCounts(u.user.id);

      ch = supabase.channel(`shell-${u.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${u.user.id}` }, () => refreshCounts(u.user!.id))
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${u.user.id}` }, () => refreshCounts(u.user!.id))
        .subscribe();
    }
    init();

    const iv = setInterval(async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) supabase.from("profiles").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", u.user.id).then(() => {});
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(iv);
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    if (uid) await supabase.from("profiles").update({ is_online: false }).eq("id", uid);
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/", replace: true });
  }

  const items = isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: Shield }] : NAV;
  const isActive = (to: string) => pathname === to || (to !== "/home" && pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Top bar ---- */}
      <header className="sticky top-0 z-50 border-b bg-[color:var(--surface)]">
        <div className="mx-auto grid h-14 w-full max-w-[1400px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="rounded-lg p-2 hover:bg-muted lg:hidden">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/home" className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="hidden truncate text-base font-extrabold tracking-tight sm:inline">SchoolConnect</span>
            </Link>
          </div>

          <Link
            to="/search"
            className="hidden min-w-0 items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted md:flex"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search students, schools, hashtags…</span>
          </Link>

          <div className="flex items-center gap-1 justify-self-end">
            <Link to="/search" className="rounded-full p-2 hover:bg-muted md:hidden" aria-label="Search"><Search className="h-5 w-5" /></Link>
            <Link to="/new-post" className="hidden items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground sm:inline-flex">
              <PlusSquare className="h-4 w-4" /> Post
            </Link>
            <Link to="/notifications" className="relative rounded-full p-2 hover:bg-muted" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button onClick={toggle} aria-label="Toggle theme" className="rounded-full p-2 hover:bg-muted">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={signOut} aria-label="Sign out" className="hidden rounded-full p-2 hover:bg-muted lg:inline-flex">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ---- Mobile / tablet drawer ---- */}
      {open && (
        <>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 top-14 z-40 bg-foreground/30 lg:hidden" />
          <nav className="fixed left-0 top-14 z-50 h-[calc(100dvh-3.5rem)] w-[78%] max-w-xs overflow-y-auto border-r bg-[color:var(--surface)] p-3 lg:hidden">
            <ul className="grid gap-0.5">
              {items.map((n) => (
                <li key={n.label}>
                  <Link to={n.to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive(n.to) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <n.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{n.label}</span>
                    {(n.to === "/notifications" ? unread : n.to === "/friends" ? pendingReq : 0) > 0 && (
                      <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {n.to === "/notifications" ? unread : pendingReq}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t pt-2">
                <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                  <LogOut className="h-5 w-5" /> Sign out
                </button>
              </li>
            </ul>
          </nav>
        </>
      )}

      {/* ---- Main 3-column frame ---- */}
      <div className="mx-auto flex w-full max-w-[1400px] gap-0 px-0 sm:px-4">
        {/* Left rail: icons on tablet, full labels on desktop */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 overflow-y-auto border-r py-4 pr-2 md:block md:w-[76px] xl:w-[236px] xl:pr-4">
          <ul className="grid gap-1">
            {items.map((n) => {
              const active = isActive(n.to);
              const badge = n.to === "/notifications" ? unread : n.to === "/friends" ? pendingReq : 0;
              return (
                <li key={n.label}>
                  <Link
                    to={n.to}
                    title={n.label}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold md:justify-center xl:justify-start ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <n.icon className="h-5 w-5 shrink-0" />
                    <span className="hidden truncate xl:inline">{n.label}</span>
                    {badge > 0 && (
                      <span className="ml-auto hidden rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground xl:inline">{badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Centre column */}
        <main className="min-w-0 flex-1 px-3 py-4 pb-28 sm:px-4 lg:pb-8">
          <div className="mx-auto w-full max-w-[680px]">{children}</div>
        </main>

        {/* Right column */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[320px] shrink-0 overflow-y-auto border-l py-4 pl-4 lg:block">
          <div className="grid gap-4">{right}</div>
        </aside>
      </div>

      {/* ---- Mobile bottom tab bar ---- */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-[color:var(--surface)] md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {[
            { to: "/home", icon: Home, label: "Feed" },
            { to: "/for-you", icon: Film, label: "Reels" },
            { to: "/new-post", icon: PlusSquare, label: "Post", accent: true },
            { to: "/messages", icon: MessageCircle, label: "Chats" },
            { to: "/profile", icon: User, label: "Me" },
          ].map((n) => {
            const active = isActive(n.to);
            const Icon = n.icon;
            return (
              <li key={n.to}>
                <Link to={n.to} className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {"accent" in n ? (
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></span>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <InstallAppPrompt />
    </div>
  );
}
