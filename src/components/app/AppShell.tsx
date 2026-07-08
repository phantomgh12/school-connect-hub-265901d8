import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, User, Bell, Search, Users, Bookmark, Compass, LogOut, Sun, Moon, GraduationCap, Menu, X, MessageCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof Home };
const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/search", label: "Search", icon: Search },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pendingReq, setPendingReq] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    let mounted = true;
    async function tick() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !mounted) return;
      // Presence heartbeat
      supabase.from("profiles").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", u.user.id).then(() => {});
      const [{ count: n }, { count: r }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", u.user.id).eq("read", false),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", u.user.id).eq("status", "pending"),
      ]);
      if (!mounted) return;
      setUnread(n ?? 0);
      setPendingReq(r ?? 0);
    }
    tick();
    const iv = setInterval(tick, 20000);
    const beforeUnload = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) await supabase.from("profiles").update({ is_online: false, last_seen_at: new Date().toISOString() }).eq("id", u.user.id);
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { mounted = false; clearInterval(iv); window.removeEventListener("beforeunload", beforeUnload); };
  }, [pathname]);

  async function signOut() {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("profiles").update({ is_online: false }).eq("id", u.user.id);
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen hero-surface pb-20 lg:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-[min(1400px,96%)] items-center gap-3">
          <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-muted lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/home" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl gradient-brand shadow-brand">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-black tracking-tight">SchoolConnect</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/search" className="hidden md:flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 hover:bg-muted">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="w-56 text-sm text-muted-foreground">Search students, schools…</span>
            </Link>
            <Link to="/notifications" className="relative rounded-full border bg-background/60 p-2 hover:bg-muted">
              <Bell className="h-4 w-4" />
              {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <button onClick={toggle} aria-label="Toggle theme" className="rounded-full border bg-background/60 p-2 hover:bg-muted">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={signOut} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 text-sm font-semibold hover:bg-muted">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1400px,96%)] gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left sidebar */}
        <aside className={`${open ? "block" : "hidden"} lg:block`}>
          <nav className="glass sticky top-20 rounded-3xl p-3">
            <ul className="grid gap-1">
              {NAV.map((n) => {
                const active = pathname === n.to || (n.to !== "/home" && pathname.startsWith(n.to));
                const badge = n.to === "/notifications" ? unread : n.to === "/friends" ? pendingReq : 0;
                return (
                  <li key={n.label}>
                    <Link
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        active ? "gradient-brand text-primary-foreground shadow-brand" : "hover:bg-muted"
                      }`}
                    >
                      <n.icon className="h-4 w-4" />
                      {n.label}
                      {badge > 0 && (
                        <span className={`ml-auto rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white/25 text-white" : "bg-rose-500 text-white"}`}>{badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
              <li className="mt-2 border-t border-border/60 pt-2 sm:hidden">
                <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>

        {/* Right sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 grid gap-4">{right}</div>
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {[
            { to: "/home", icon: Home, label: "Home" },
            { to: "/search", icon: Search, label: "Search" },
            { to: "/messages", icon: MessageCircle, label: "Chats" },
            { to: "/notifications", icon: Bell, label: "Alerts" },
            { to: "/profile", icon: User, label: "Me" },
          ].map((n, i) => {
            const active = pathname === n.to || (n.to !== "/home" && pathname.startsWith(n.to));
            return (
              <li key={i}>
                <Link to={n.to} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${active ? "text-[color:var(--brand)]" : "text-muted-foreground"}`}>
                  <n.icon className="h-5 w-5" />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
