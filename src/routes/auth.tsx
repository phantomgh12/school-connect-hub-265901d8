import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("login").catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — SchoolConnect" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Enter your password"),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) {
          const fe: Record<string, string> = {};
          parsed.error.issues.forEach(i => { fe[i.path[0] as string] = i.message; });
          setErrors(fe);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) throw error;
        toast.success("Welcome! Let's set up your profile.");
        navigate({ to: "/onboarding" });
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) {
          const fe: Record<string, string> = {};
          parsed.error.issues.forEach(i => { fe[i.path[0] as string] = i.message; });
          setErrors(fe);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Signed in!");
        navigate({ to: "/home" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setOauthLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) { toast.error(result.error.message ?? "Google sign-in failed"); return; }
      if ((result as any).redirected) return;
      toast.success("Signed in!");
      navigate({ to: "/home" });
    } finally {
      setOauthLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen hero-surface">
      <div className="mx-auto grid min-h-screen w-[min(1100px,94%)] items-center gap-10 py-8 md:grid-cols-2">
        <aside className="hidden md:block">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl gradient-brand shadow-brand">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-extrabold">SchoolConnect</span>
          </Link>
          <h1 className="mt-12 text-5xl font-black leading-tight tracking-tight">
            Welcome to the <span className="text-gradient">campus of the internet</span>.
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground">
            One account. Every school. Endless friendships. Let's get you set up.
          </p>
          <div className="glass mt-10 max-w-md rounded-3xl p-5">
            <p className="text-sm italic">
              "I found my primary school best friend after 8 years. I actually cried."
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full gradient-brand" />
              <div className="text-xs">
                <div className="font-semibold">Ama K.</div>
                <div className="text-muted-foreground">Achimota SHS</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="glass mx-auto w-full max-w-md rounded-3xl p-8">
          <Link to="/" className="mb-6 flex items-center gap-2 md:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-extrabold">SchoolConnect</span>
          </Link>

          <div className="inline-flex rounded-full bg-muted p-1">
            <Link to="/auth" search={{ mode: "login" }}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${!isSignup ? "gradient-brand text-primary-foreground shadow-brand" : "text-muted-foreground"}`}>
              Log in
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${isSignup ? "gradient-brand text-primary-foreground shadow-brand" : "text-muted-foreground"}`}>
              Sign up
            </Link>
          </div>

          <h2 className="mt-6 text-2xl font-black">
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "It only takes a minute." : "Sign in to keep the conversation going."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={oauthLoading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border bg-background/60 px-4 py-3 text-sm font-semibold backdrop-blur transition hover:bg-muted disabled:opacity-60">
            {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            {isSignup && (
              <Field label="Full name" error={errors.fullName}>
                <input
                  type="text" value={form.fullName} autoComplete="name"
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className="input" placeholder="Ama Owusu" />
              </Field>
            )}
            <Field label="Email" error={errors.email}>
              <input
                type="email" value={form.email} autoComplete="email"
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input" placeholder="you@school.com" />
            </Field>
            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} value={form.password}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <button type="submit" disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-full gradient-brand px-6 py-3 text-sm font-bold text-primary-foreground shadow-brand transition hover:opacity-95 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our friendly community rules.
          </p>
        </main>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid var(--color-input);
          background: var(--color-background);
          padding: 0.7rem 0.9rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 4px oklch(0.55 0.22 275 / 0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6L6.1 33.6C9.5 40.1 16.1 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.5 35.6 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
