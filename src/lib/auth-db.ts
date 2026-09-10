/**
 * Host-agnostic auth client.
 *
 * All sign-up / sign-in server logic lives inside the database as security
 * routines, so the app works on ANY host (Vercel, Netlify, Lovable, a VPS)
 * with nothing but the public project URL + publishable key. No private
 * server key is required at the hosting layer.
 */
import { supabase } from "@/integrations/supabase/client";
import { solveChallenge } from "./security-questions";

const AUTH_EMAIL_DOMAIN = "users.schoolconnect.app";

export type Challenge = { nonce: string; ts: number; sig: string };
export type Proof = { challenge: Challenge; solution: string; elapsedMs: number };

// The generated database types are regenerated from migrations; cast once here
// so call sites stay fully typed on the values we actually use.
type Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = ((name: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: Rpc }).rpc(name, args)) as Rpc;

function clean(message: string) {
  // Postgres prefixes raised messages; show only the human sentence.
  return message.replace(/^.*?(?:ERROR:\s*)?(?:P0001:\s*)?/, "").trim() || "Something went wrong.";
}

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(clean(error.message));
  return data as T;
}

export function usernameKey(u: string) {
  return u.trim().toLowerCase();
}

export function syntheticEmail(u: string) {
  return `${usernameKey(u).replace(/[^a-z0-9._]/g, "")}@${AUTH_EMAIL_DOMAIN}`;
}

/* ------------------------------ bot challenge ----------------------------- */

export async function newChallenge(): Promise<Challenge> {
  return call<Challenge>("auth_new_challenge");
}

/** Solves the proof-of-work for a fresh challenge. */
export async function buildProof(startedAt: number, cached?: Challenge | null): Promise<Proof> {
  const challenge = cached ?? (await newChallenge());
  const solution = await solveChallenge(challenge.nonce);
  return { challenge, solution, elapsedMs: Date.now() - startedAt };
}

function proofArgs(p: Proof, honeypot: string) {
  return {
    _nonce: p.challenge.nonce,
    _ts: p.challenge.ts,
    _sig: p.challenge.sig,
    _solution: p.solution,
    _elapsed_ms: Math.round(p.elapsedMs),
    _honeypot: honeypot,
  };
}

/* -------------------------------- username -------------------------------- */

export async function checkUsernameAvailable(username: string) {
  return call<{ ok: boolean; reason: string }>("auth_username_status", { _u: usernameKey(username) });
}

/* --------------------------------- sign up -------------------------------- */

export async function registerAccount(input: {
  username: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  password: string;
  answers: Record<string, string>;
  honeypot: string;
  proof: Proof;
}) {
  const key = usernameKey(input.username);

  // 1. Screen everything BEFORE an account exists (no orphan accounts).
  await call<{ ok: boolean; age: number }>("auth_precheck_signup", {
    _username: key,
    _full_name: input.fullName.trim(),
    _dob: input.dateOfBirth,
    _age: input.age,
    ...proofArgs(input.proof, input.honeypot),
  });
  if (input.password.toLowerCase().includes(key))
    throw new Error("Your password cannot contain your username.");

  // 2. Create the account with the internal address derived from the username.
  const email = syntheticEmail(key);
  const { data: signUp, error: sErr } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: input.fullName.trim(), username: key, age: input.age } },
  });
  if (sErr) {
    if (/already/i.test(sErr.message)) throw new Error("That username is already taken.");
    throw new Error(sErr.message);
  }

  // 3. Make sure we hold a session, then save profile + security answers.
  if (!signUp.session) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error) throw new Error("Account created — please sign in.");
  }

  await call("auth_complete_signup", {
    _username: key,
    _full_name: input.fullName.trim(),
    _dob: input.dateOfBirth,
    _age: input.age,
    _answers: input.answers,
  });

  return { email };
}

/* --------------------------------- sign in -------------------------------- */

export async function signIn(input: {
  username: string;
  password: string;
  honeypot: string;
  proof: Proof;
}) {
  const key = usernameKey(input.username);
  const { email } = await call<{ email: string; userId: string }>("auth_signin_lookup", {
    _username: key,
    ...proofArgs(input.proof, input.honeypot),
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  await logEvent("signin", !error, key);
  if (error) throw new Error("Incorrect username or password.");
  return { email };
}

export async function logEvent(kind: string, success: boolean, username?: string, detail?: string) {
  try {
    await rpc("auth_log_event", {
      _kind: kind,
      _success: success,
      _username: username ?? null,
      _detail: detail ?? null,
    });
  } catch {
    /* logging must never break auth */
  }
}

/* -------------------------------- recovery -------------------------------- */

export async function recoveryQuestions(input: { username: string; honeypot: string; proof: Proof }) {
  return call<{ indexes: number[] }>("auth_recovery_questions", {
    _username: usernameKey(input.username),
    ...proofArgs(input.proof, input.honeypot),
  });
}
