import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, User, Bell, Search, Users, Bookmark, Compass, LogOut, Sun, Moon, GraduationCap, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/home", label: "Explore", icon: Compass, disabled: true },
  { to: "/home", label: "Friends", icon: Users, disabled: true },
  { to: "/home", label: "Saved", icon: Bookmark, disabled: true },
  { to: "/home", label: "Notifications", icon: Bell, disabled: true },
] as const;

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { theme, toggle } = useTheme();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen hero-surface pb-16 lg:pb-0">
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
            <div className="hidden md:flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input placeholder="Search students, schools…" className="w-56 bg-transparent text-sm outline-none" />
            </div>
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
                const active = pathname === n.to && !n.disabled;
                return (
                  <li key={n.label}>
                    <Link
                      to={n.disabled ? "/home" : n.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        active ? "gradient-brand text-primary-foreground shadow-brand" : "hover:bg-muted"
                      } ${n.disabled ? "opacity-50" : ""}`}
                    >
                      <n.icon className="h-4 w-4" />
                      {n.label}
                      {n.disabled && <span className="ml-auto text-[9px] font-bold uppercase text-muted-foreground">Soon</span>}
                    </Link>
                  </li>
                );
              })}
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
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {[
            { to: "/home", icon: Home, label: "Home" },
            { to: "/home", icon: Search, label: "Search" },
            { to: "/home", icon: Bell, label: "Alerts" },
            { to: "/profile", icon: User, label: "Me" },
          ].map((n, i) => (
            <li key={i}>
              <Link to={n.to} className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold text-muted-foreground [&.active]:text-[color:var(--brand)]" activeProps={{ className: "active" }}>
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
