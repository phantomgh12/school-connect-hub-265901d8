import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("login").catch("login"),
  invite: z.string().trim().max(64).optional().catch(undefined),
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
  const { mode, invite } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) throw error;
        if (invite) {
          try { await supabase.rpc("claim_invite", { _code: invite }); } catch { /* ignore */ }
          toast.info("Confirm who invited you on the Verification page.");
        }
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
        if (invite) { try { await supabase.rpc("claim_invite", { _code: invite }); } catch { /* ignore */ } }
        toast.success("Signed in!");
        navigate({ to: "/home" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hero-surface">
      <div className="mx-auto grid min-h-screen w-[min(1200px,94%)] gap-10 py-10 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl gradient-brand shadow-brand">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-black tracking-tight">SchoolConnect</span>
          </Link>
          <h1 className="mt-8 text-5xl font-black leading-tight tracking-tight">
            Where students <span className="bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-2)] bg-clip-text text-transparent">stay connected</span>.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Chat, share stories, discover friends across every school and grade — the safe social home for students.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
            {["Live feed & real-time chat", "24h stories & reels", "Study groups & mutual friends"].map((t) => (
              <div key={t} className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[color:var(--brand)]" /> {t}</div>
            ))}
          </div>
        </div>

        <div className="glass mx-auto w-full max-w-md rounded-3xl p-6 sm:p-8">
          <div className="lg:hidden mb-6 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-black tracking-tight">SchoolConnect</span>
          </div>
          <h2 className="text-2xl font-black">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Join thousands of students already connecting." : "Sign in to continue where you left off."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
            {mode === "signup" && (
              <Field label="Full name" error={errors.fullName}>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" placeholder="Ama Mensah" autoComplete="name" />
              </Field>
            )}
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="you@school.com" autoComplete="email" />
            </Field>
            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input pr-10" placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <button type="submit" disabled={loading} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full gradient-brand px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account? <Link to="/auth" search={{ mode: "login" }} className="font-bold text-[color:var(--brand)] hover:underline">Sign in</Link></>
            ) : (
              <>New here? <Link to="/auth" search={{ mode: "signup" }} className="font-bold text-[color:var(--brand)] hover:underline">Create account</Link></>
            )}
          </p>
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:9999px;border:1px solid hsl(var(--border));background:hsl(var(--background)/.6);padding:.6rem 1rem;font-size:.875rem;outline:none;transition:border-color .15s}.input:focus{border-color:var(--brand)}`}</style>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs font-semibold text-rose-500">{error}</span>}
    </label>
  );
}
