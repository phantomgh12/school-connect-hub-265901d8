import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  RECOVERY_ANSWERS_REQUIRED,
  SECURITY_QUESTIONS,
  passwordIssues,
} from "@/lib/security-questions";
import { recoveryQuestions, resetPassword, buildProof } from "@/lib/auth-db";

export const Route = createFileRoute("/recover")({
  head: () => ({
    meta: [
      { title: "Recover your account — SchoolConnect" },
      {
        name: "description",
        content:
          "Reset your SchoolConnect password using your private security questions. No email or SMS required.",
      },
      { property: "og:title", content: "Recover your account — SchoolConnect" },
      {
        property: "og:description",
        content: "Answer your security questions to set a new password. No email or SMS needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecoverPage,
});

function RecoverPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [indexes, setIndexes] = useState<number[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hp, setHp] = useState("");
  const [loading, setLoading] = useState(false);
  const [openedAt] = useState(() => Date.now());

  async function proof() {
    return buildProof(openedAt);
  }

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await recoveryQuestions({ username, honeypot: hp, proof: await proof() });
      setIndexes(res.indexes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start recovery");
    } finally {
      setLoading(false);
    }
  }

  async function onFinish(e: React.FormEvent) {
    e.preventDefault();
    const issues = passwordIssues(password);
    if (issues.length) return toast.error(`Password needs ${issues.join(", ")}.`);
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      const { email } = await resetPassword({ username, answers, newPassword: password, honeypot: hp, proof: await proof() });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Password updated — please sign in.");
      toast.success("Password updated. You're back in!");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary">
          <KeyRound className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="mt-4 text-2xl font-black">Recover your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer {RECOVERY_ANSWERS_REQUIRED} of your security questions to set a new password. There is no email
          or SMS reset.
        </p>

        {!indexes ? (
          <form onSubmit={onStart} className="mt-6 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                placeholder="ama_23"
              />
            </label>
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <input tabIndex={-1} value={hp} onChange={(e) => setHp(e.target.value)} name="website_url" />
            </div>
            <Button
              type="submit"
              disabled={loading || username.length < 2}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Continue
            </Button>
          </form>
        ) : (
          <form onSubmit={onFinish} className="mt-6 grid gap-3">
            {indexes.map((i) => (
              <label key={i} className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {SECURITY_QUESTIONS[i]}
                </span>
                <input
                  className="input"
                  autoComplete="off"
                  value={answers[String(i)] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [String(i)]: e.target.value })}
                />
              </label>
            ))}
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                New password
              </span>
              <input
                className="input"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Confirm password
              </span>
              <input
                className="input"
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Reset password & sign in
            </Button>
            <p className="text-xs text-muted-foreground">
              Resetting your password signs out every other device on this account.
            </p>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/auth" search={{ mode: "login" }} className="font-bold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
      <style>{`.input{width:100%;border-radius:.75rem;border:1px solid var(--color-input,var(--color-border));background:var(--color-background);padding:.65rem .9rem;font-size:.9rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}
