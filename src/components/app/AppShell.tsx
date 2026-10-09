import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home, User, Bell, Search, Users, Bookmark, LogOut, Sun, Moon, GraduationCap,
  Menu, X, MessageCircle, PlusSquare, Film, BadgeCheck, Shield, Sparkles,
  School, CalendarDays, Trophy, Settings, Flame, UserCheck, MessageSquareDashed,
  Gift, ShoppingBag, Award, MoreHorizontal,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { InstallAppPrompt } from "@/components/app/InstallAppPrompt";
import { FirstPostGate } from "@/components/app/FirstPostGate";
import { NotificationBell } from "@/components/app/NotificationBell";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof Home; search?: Record<string, string> };

const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/communities", label: "My school", icon: School },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/saved", label: "Saved", icon: Bookmark },
];
const DISCOVER: NavItem[] = [
  { to: "/for-you", label: "Reels", icon: Film },
  { to: "/trending", label: "Trending", icon: Flame },
  { to: "/confessions", label: "Confessions", icon: MessageSquareDashed },
  { to: "/events", label: "Events", icon: CalendarDays },
];
const MORE: NavItem[] = [
  { to: "/leaderboards", label: "School rankings", icon: Trophy },
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
  const [studentName, setStudentName] = useState("Student");
  const [schoolName, setSchoolName] = useState("My school community");
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
      const userId = u.user.id;
      setUid(userId);
      const { data: prof } = await supabase.from("profiles").select("avatar_url,full_name,school_name").eq("id", u.user.id).maybeSingle();
      if (mounted) {
        setAvatar(prof?.avatar_url ?? null);
        setStudentName(prof?.full_name || "Student");
        setSchoolName(prof?.school_name || "My school community");
      }
      await supabase.from("profiles").update({ is_online: true, last_seen_at: new Date().toISOString() }).eq("id", u.user.id);
      const role = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (mounted) setIsAdmin(role.data === true);
      await refreshCounts(u.user.id);

      ch = supabase.channel(`shell-${u.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${u.user.id}` }, () => refreshCounts(userId))
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${u.user.id}` }, () => refreshCounts(userId))
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refreshCounts(userId))
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

  useEffect(() => { setOpen(false); }, [pathname, activeTab]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open]);

  async function signOut() {
    if (uid) await supabase.from("profiles").update({ is_online: false }).eq("id", uid);
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/", replace: true });
  }

  const secondaryItems = isAdmin ? [...MORE, { to: "/admin", label: "Admin", icon: Shield }] : MORE;
  const isActive = (n: NavItem) => pathname === n.to || pathname.startsWith(`${n.to}/`);
  const badgeFor = (to: string) => to === "/notifications" ? unread : to === "/friends" ? pendingReq : to === "/messages" ? unreadMsgs : 0;

  const NavLinks = ({ items, compact = false }: { items: NavItem[]; compact?: boolean }) => (
    <ul className="grid gap-1">
      {items.map((n) => (
        <li key={n.to}>
          <Button asChild variant="ghost" className={`h-11 w-full justify-start gap-3 rounded-md px-3 font-medium ${isActive(n) ? "bg-accent text-primary" : "text-muted-foreground"} ${compact ? "md:justify-center xl:justify-start" : ""}`}>
            <Link to={n.to} title={n.label} aria-current={isActive(n) ? "page" : undefined}>
              <n.icon className="size-5 shrink-0" />
              <span className={compact ? "hidden truncate xl:inline" : "truncate"}>{n.label}</span>
              {badgeFor(n.to) > 0 && <span className={`ml-auto rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground ${compact ? "hidden xl:inline" : ""}`}>{badgeFor(n.to) > 9 ? "9+" : badgeFor(n.to)}</span>}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );

  const Navigation = ({ compact = false }: { compact?: boolean }) => <>
    <NavLinks items={NAV} compact={compact} />
    <div className="my-5 border-t" />
    <p className={`mb-2 px-3 text-xs font-semibold text-muted-foreground ${compact ? "hidden xl:block" : ""}`}>Discover</p>
    <NavLinks items={DISCOVER} compact={compact} />
    <details className="mt-4">
      <summary className="cursor-pointer rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted" title="More destinations"><span className={compact ? "hidden xl:inline" : ""}>More</span><MoreHorizontal className={compact ? "size-5 xl:hidden" : "hidden"} /></summary>
      <NavLinks items={secondaryItems} compact={compact} />
    </details>
    <Button onClick={toggle} variant="ghost" className={`mt-2 h-11 w-full justify-start gap-3 px-3 text-muted-foreground ${compact ? "md:justify-center xl:justify-start" : ""}`} title="Switch appearance">
      {theme === "dark" ? <Sun /> : <Moon />}<span className={compact ? "hidden xl:inline" : ""}>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span>
    </Button>
    <Button onClick={signOut} variant="ghost" title="Sign out" className={`h-11 w-full justify-start gap-3 px-3 text-muted-foreground ${compact ? "md:justify-center xl:justify-start" : ""}`}><LogOut /><span className={compact ? "hidden xl:inline" : ""}>Sign out</span></Button>
  </>;

  return (
    <div className="student-workspace min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-surface">
        <div className="mx-auto grid h-16 max-w-[1360px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 sm:grid-cols-[240px_minmax(0,1fr)_auto] sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} className="size-10 shrink-0 md:hidden">{open ? <X /> : <Menu />}</Button>
            <Link to="/home" className="flex min-w-0 items-center gap-2 font-display text-base font-bold sm:text-lg"><GraduationCap className="size-7 shrink-0 text-primary" /><span className="truncate">SchoolConnect</span></Link>
          </div>
          <Button asChild variant="outline" className="mx-auto hidden h-10 w-full max-w-md justify-start gap-3 border-border bg-background font-normal text-muted-foreground sm:flex"><Link to="/search"><Search /><span className="truncate">Search your community</span></Link></Button>
          <div className="flex shrink-0 items-center gap-1 justify-self-end">
            <Button asChild variant="ghost" size="icon" className="size-10 sm:hidden"><Link to="/search" aria-label="Search"><Search /></Link></Button>
            <NotificationBell uid={uid} unread={unread} onRead={() => setUnread(0)} />
            <Button asChild variant="ghost" size="icon" className="ml-1 hidden overflow-hidden rounded-full bg-muted sm:flex"><Link to="/profile" aria-label="My profile">{avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <User />}</Link></Button>
          </div>
        </div>
      </header>

      {open && <>
        <Button variant="ghost" aria-label="Close navigation backdrop" onClick={() => setOpen(false)} className="fixed inset-0 top-16 z-40 h-auto rounded-none bg-foreground/40 hover:bg-foreground/40 md:hidden" />
        <nav aria-label="Student menu" className="fixed bottom-0 left-0 top-16 z-50 w-[85%] max-w-xs overflow-y-auto border-r bg-surface p-4 pb-24 md:hidden">
          <div className="mb-5 border-b px-3 pb-4"><p className="truncate font-semibold">{studentName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{schoolName}</p></div>
          <Navigation />
        </nav>
      </>}

      <div className="mx-auto grid w-full max-w-[1360px] grid-cols-[minmax(0,1fr)] md:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[80px_minmax(0,1fr)_280px] xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside aria-label="Primary navigation" className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r bg-surface px-3 py-6 no-scrollbar md:block">
          <Navigation compact />
          <Button asChild className="mt-6 hidden h-11 w-full xl:flex"><Link to="/new-post"><PlusSquare />Create post</Link></Button>
          <Link to="/profile" className="mt-6 hidden items-center gap-3 border-t px-2 pt-5 xl:flex"><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">{avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <User className="size-4" />}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{studentName}</span><span className="block truncate text-xs text-muted-foreground">{schoolName}</span></span></Link>
        </aside>
        <main className="min-w-0 px-4 py-6 pb-28 sm:px-6 md:pb-8"><div className="mx-auto w-full max-w-[640px]">{children}</div></main>
        <aside className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto px-5 py-6 no-scrollbar lg:block"><div className="grid gap-5">{right}</div></aside>
      </div>

      <nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {[
            { to: "/home", icon: Home, label: "Home" },
            { to: "/communities", icon: School, label: "School" },
            { to: "/new-post", icon: PlusSquare, label: "Create" },
            { to: "/messages", icon: MessageCircle, label: "Chats" },
            { to: "/profile", icon: User, label: "You" },
          ].map((n) => <li key={n.to}><Button asChild variant="ghost" className={`relative h-[68px] w-full flex-col gap-1 rounded-none px-1 text-[11px] ${isActive(n) ? "text-primary" : "text-muted-foreground"}`}><Link to={n.to} aria-current={isActive(n) ? "page" : undefined}><n.icon className="size-5" />{n.label}{badgeFor(n.to) > 0 && <span className="absolute right-4 top-2 size-2 rounded-full bg-destructive" />}</Link></Button></li>)}
        </ul>
      </nav>

      <FirstPostGate />
      <InstallAppPrompt />
    </div>
  );
}
