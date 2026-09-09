import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Lock,
  UserCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  MAX_AGE,
  MIN_AGE,
  REQUIRED_ANSWERS,
  SECURITY_QUESTIONS,
  USERNAME_RE,
  passwordIssues,
  solveChallenge,
} from "@/lib/security-questions";
import {
  beginSignIn,
  checkUsername,
  getAuthChallenge,
  recordSignIn,
  registerAccount,
} from "@/lib/auth.functions";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("login").catch("login"),
  invite: z.string().trim().max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in with your username — SchoolConnect" },
      {
        name: "description",
        content:
          "Secure username-only sign in for SchoolConnect students. No email needed — protected by security questions, bot protection and age verification.",
      },
      { property: "og:title", content: "Sign in with your username — SchoolConnect" },
      {
        property: "og:description",
        content: "Username-only student sign in with security questions, bot protection and age verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function useChallenge() {
  const fetchChallenge = useServerFn(getAuthChallenge);
  const startedAt = useRef(Date.now());
  const [challenge, setChallenge] = useState<{ nonce: string; ts: number; sig: string } | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    fetchChallenge().then(setChallenge).catch(() => setChallenge(null));
  }, [fetchChallenge]);

  async function proof() {
    const c = challenge ?? (await fetchChallenge());
    if (!challenge) setChallenge(c);
    const solution = await solveChallenge(c.nonce);
    return { challenge: c, solution, elapsedMs: Date.now() - startedAt.current };
  }

  return { proof, ready: !!challenge };
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-[min(1180px,94%)] gap-10 py-10 lg:grid-cols-[1fr_minmax(0,460px)] lg:items-center">
        <aside className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-black tracking-tight">SchoolConnect</span>
          </Link>
          <h1 className="mt-8 max-w-lg text-4xl font-black leading-tight tracking-tight">
            No email. No phone. Just your username — and serious security.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Accounts are protected by seven private security questions, bot screening, age verification and
            automatic lockouts.
          </p>
          <ul className="mt-8 grid gap-3 text-sm">
            {[
              ["Username-only accounts", "Nothing personal to leak — no email, no SMS."],
              ["7 security questions", "Hashed one-way; even staff can never read them."],
              ["Bot & automation shield", "Proof-of-work, honeypot and timing checks on every attempt."],
              ["Age verified students", `Only students aged ${MIN_AGE}+ can join.`],
              ["Brute-force lockouts", "Attempts are rate limited per account and per device."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-bold">{t}</p>
                  <p className="text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-black tracking-tight">SchoolConnect</span>
          </div>
          {isSignup ? <SignUpForm /> : <SignInForm />}
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:.75rem;border:1px solid var(--color-input,var(--color-border));background:var(--color-background);padding:.65rem .9rem;font-size:.9rem;outline:none;transition:border-color .15s}.input:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}

/* --------------------------------- sign in -------------------------------- */

function SignInForm() {
  const navigate = useNavigate();
  const { proof } = useChallenge();
  const begin = useServerFn(beginSignIn);
  const record = useServerFn(recordSignIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [hp, setHp] = useState("");
  const [loading, setLoading] = useState(false);

  // Remember the last username on this device, and skip the form entirely
  // when a valid session is already stored (auto sign-in).
  useEffect(() => {
    const saved = localStorage.getItem("sc:last-username");
    if (saved) setUsername(saved);
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", data.session.user.id)
        .maybeSingle();
      navigate({ to: profile?.onboarded ? "/home" : "/onboarding" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const p = await proof();
      const { email } = await begin({ data: { username, honeypot: hp, ...p } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      await record({ data: { username, success: !error } });
      if (error) throw new Error("Incorrect username or password.");

      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", u.user!.id)
        .maybeSingle();
      localStorage.setItem("sc:last-username", username);
      toast.success("Signed in");
      navigate({ to: profile?.onboarded ? "/home" : "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign you in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-black">Welcome back</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sign in with your username and password.</p>

      <div className="mt-6 grid gap-3">
        <Field label="Username">
          <input
            className="input"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
            placeholder="ama_23"
          />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input
              className="input pr-10"
              type={showPw ? "text" : "password"}
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Toggle password"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Honeypot value={hp} onChange={setHp} />

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {loading ? "Verifying…" : "Sign in securely"}
        </button>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link to="/recover" className="font-bold text-primary hover:underline">
          Forgot password? Use your security questions
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/auth" search={{ mode: "signup" }} className="font-bold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

/* --------------------------------- sign up -------------------------------- */

type Answers = Record<string, string>;

function SignUpForm() {
  const navigate = useNavigate();
  const { proof } = useChallenge();
  const register = useServerFn(registerAccount);
  const check = useServerFn(checkUsername);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hp, setHp] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [username, setUsername] = useState("");
  const [uState, setUState] = useState<{ ok: boolean; reason: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    setUState(null);
    if (!USERNAME_RE.test(username)) return;
    const t = setTimeout(() => {
      check({ data: { username } })
        .then(setUState)
        .catch(() => setUState(null));
    }, 450);
    return () => clearTimeout(t);
  }, [username, check]);

  const pwIssues = passwordIssues(password);
  const answered = Object.values(answers).filter((v) => (v ?? "").trim().length >= 2).length;

  function nextStep() {
    if (step === 0) {
      if (!USERNAME_RE.test(username)) return toast.error("Pick a valid username (3–24 characters).");
      if (uState && !uState.ok) return toast.error(uState.reason);
      if (!/^[A-Za-z][A-Za-z' .-]*[A-Za-z]$/.test(fullName.trim()) || fullName.trim().length < 3)
        return toast.error("Enter your real name using letters only.");
      const a = Number(age);
      if (!dob) return toast.error("Enter your date of birth.");
      if (!a || a < MIN_AGE || a > MAX_AGE)
        return toast.error(`SchoolConnect is for students aged ${MIN_AGE} and above.`);
      if (pwIssues.length) return toast.error(`Password needs ${pwIssues.join(", ")}.`);
      if (password !== confirm) return toast.error("Passwords do not match.");
    }
    setStep(step + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (answered < REQUIRED_ANSWERS) return toast.error(`Answer all ${REQUIRED_ANSWERS} security questions.`);
    setLoading(true);
    try {
      const p = await proof();
      const { email } = await register({
        data: {
          username,
          fullName: fullName.trim(),
          age: Number(age),
          dateOfBirth: dob,
          password,
          answers,
          honeypot: hp,
          ...p,
        },
      });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Account created — please sign in.");
      toast.success("Account secured. Welcome to SchoolConnect!");
      navigate({ to: "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-black">Create your account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === 0 ? "Step 1 of 2 — your identity" : `Step 2 of 2 — your ${REQUIRED_ANSWERS} security questions`}
      </p>

      {step === 0 ? (
        <div className="mt-6 grid gap-3">
          <Field label="Username" hint="This is how friends find you. No email required.">
            <div className="relative">
              <input
                className="input pr-10"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                placeholder="ama_23"
              />
              {uState && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {uState.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                </span>
              )}
            </div>
            {uState && !uState.ok && <p className="text-xs font-semibold text-rose-500">{uState.reason}</p>}
          </Field>

          <Field label="Full name" hint="Real names only — placeholder names are blocked.">
            <input
              className="input"
              value={fullName}
              autoComplete="name"
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ama Mensah"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date of birth">
              <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="Age">
              <input
                inputMode="numeric"
                className="input"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="16"
              />
            </Field>
          </div>
          <p className="-mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5" /> Your age is verified against your date of birth. Minimum age{" "}
            {MIN_AGE}.
          </p>

          <Field label="Password" hint="10+ characters with upper, lower, number and symbol.">
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Toggle password"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && pwIssues.length > 0 && (
              <p className="text-xs font-semibold text-amber-600">Needs {pwIssues.join(", ")}.</p>
            )}
          </Field>
          <Field label="Confirm password">
            <input
              className="input"
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Honeypot value={hp} onChange={setHp} />

          <button
            type="button"
            onClick={nextStep}
            className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Continue to security questions
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          <p className="rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            These are the <strong>only</strong> way to recover your account — there is no email or SMS reset.
            Answers are stored one-way hashed and can never be read by anyone.
          </p>
          {SECURITY_QUESTIONS.map((q, i) => (
            <Field key={q} label={`${i + 1}. ${q}`}>
              <input
                className="input"
                value={answers[String(i)] ?? ""}
                autoComplete="off"
                onChange={(e) => setAnswers({ ...answers, [String(i)]: e.target.value })}
              />
            </Field>
          ))}
          <p className="text-xs text-muted-foreground">
            {answered}/{REQUIRED_ANSWERS} answered
          </p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? "Securing account…" : "Create secure account"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth" search={{ mode: "login" }} className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* ---------------------------------- bits ---------------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Invisible field: real users never fill this, bots do. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          name="website_url"
        />
      </label>
    </div>
  );
}
