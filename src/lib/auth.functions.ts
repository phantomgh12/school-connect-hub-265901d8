import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  MAX_AGE,
  MIN_AGE,
  MIN_FORM_MS,
  POW_PREFIX,
  RECOVERY_ANSWERS_REQUIRED,
  REQUIRED_ANSWERS,
  USERNAME_RE,
} from "./security-questions";

const AUTH_EMAIL_DOMAIN = "users.schoolconnect.app";

/* ---------------------------------- utils --------------------------------- */

const enc = new TextEncoder();

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clientIp() {
  const h = getRequest()?.headers;
  const fwd = h?.get("x-forwarded-for") ?? "";
  return (
    h?.get("cf-connecting-ip") ??
    (fwd ? fwd.split(",")[0]!.trim() : null) ??
    h?.get("x-real-ip") ??
    "unknown"
  );
}

async function ipHash() {
  return sha256Hex(`${clientIp()}|${process.env["AUTH_CHALLENGE_SECRET"] ?? "dev"}`);
}

function usernameKey(u: string) {
  return u.trim().toLowerCase();
}

function syntheticEmail(u: string) {
  return `${usernameKey(u).replace(/[^a-z0-9._]/g, "")}@${AUTH_EMAIL_DOMAIN}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(entry: {
  kind: string;
  success: boolean;
  username_key?: string | null;
  user_id?: string | null;
  detail?: string | null;
}) {
  try {
    const db = await admin();
    await db.from("auth_events").insert({
      kind: entry.kind,
      success: entry.success,
      username_key: entry.username_key ?? null,
      user_id: entry.user_id ?? null,
      detail: entry.detail ?? null,
      ip_hash: await ipHash(),
    } as never);
  } catch {
    /* logging must never break auth */
  }
}

/** Bot gate: honeypot, form timing, signed proof-of-work challenge. */
async function assertNotBot(input: {
  honeypot?: string;
  elapsedMs: number;
  challenge: { nonce: string; ts: number; sig: string };
  solution: string;
}) {
  if (input.honeypot && input.honeypot.trim() !== "") throw new Error("Blocked: automated request detected.");
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < MIN_FORM_MS)
    throw new Error("That was too fast — please take a moment and try again.");

  const secret = process.env["AUTH_CHALLENGE_SECRET"];
  if (!secret) throw new Error("Security check unavailable. Try again later.");

  const { nonce, ts, sig } = input.challenge;
  const expected = await hmacHex(secret, `${nonce}.${ts}`);
  if (!timingSafeEqual(sig, expected)) throw new Error("Invalid security check.");
  if (Date.now() - ts > 10 * 60_000) throw new Error("Security check expired — please retry.");

  const hex = await sha256Hex(`${nonce}:${input.solution}`);
  if (!hex.startsWith(POW_PREFIX)) throw new Error("Security check failed.");
}

async function assertNotThrottled(key: string) {
  const db = await admin();
  const { data } = await db.rpc("auth_throttle_state", {
    _username_key: key,
    _ip_hash: await ipHash(),
  } as never);
  const s = (data ?? {}) as { user_fails?: number; ip_fails?: number; ip_signups?: number };
  if ((s.user_fails ?? 0) >= 5)
    throw new Error("Too many failed attempts on this account. Locked for 15 minutes.");
  if ((s.ip_fails ?? 0) >= 12)
    throw new Error("Too many attempts from this device. Please wait 15 minutes.");
  return s;
}

/* -------------------------------- challenge -------------------------------- */

export const getAuthChallenge = createServerFn({ method: "GET" }).handler(async () => {
  const secret = process.env["AUTH_CHALLENGE_SECRET"];
  if (!secret) throw new Error("Security check unavailable.");
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const ts = Date.now();
  return { nonce, ts, sig: await hmacHex(secret, `${nonce}.${ts}`) };
});

/* ------------------------------ availability ------------------------------ */

export const checkUsername = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string }) => z.object({ username: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const u = data.username.trim().toLowerCase();
    if (!USERNAME_RE.test(u))
      return { ok: false, reason: "3–24 characters: letters, numbers, dots or underscores." };
    const db = await admin();
    const [{ data: blocked }, { data: free }] = await Promise.all([
      db.rpc("is_username_blocked", { _u: u } as never),
      db.rpc("username_available", { _u: u } as never),
    ]);
    if (blocked) return { ok: false, reason: "That name isn't allowed on SchoolConnect." };
    if (!free) return { ok: false, reason: "That username is already taken." };
    return { ok: true, reason: "" };
  });

/* --------------------------------- sign up -------------------------------- */

const challengeSchema = z.object({ nonce: z.string(), ts: z.number(), sig: z.string() });

const signUpSchema = z.object({
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, "Invalid username"),
  fullName: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z][A-Za-z' .-]*[A-Za-z]$/, "Use your real name (letters only)"),
  age: z.number().int().min(MIN_AGE, `You must be at least ${MIN_AGE}`).max(MAX_AGE),
  dateOfBirth: z.string().min(8),
  password: z.string().min(10).max(72),
  answers: z.record(z.string(), z.string().trim().min(2).max(80)),
  honeypot: z.string().optional(),
  elapsedMs: z.number(),
  challenge: challengeSchema,
  solution: z.string(),
});

function ageFromDob(dob: string) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signUpSchema.parse(d))
  .handler(async ({ data }) => {
    const key = usernameKey(data.username);
    try {
      await assertNotBot(data);
      const state = await assertNotThrottled(key);
      if ((state.ip_signups ?? 0) >= 3)
        throw new Error("This device has created too many accounts today.");

      // --- age verification (declared age must match the date of birth) ---
      const derived = ageFromDob(data.dateOfBirth);
      if (derived === null) throw new Error("Enter a valid date of birth.");
      if (Math.abs(derived - data.age) > 1)
        throw new Error("Your age does not match your date of birth.");
      if (derived < MIN_AGE) throw new Error(`SchoolConnect is for students aged ${MIN_AGE} and above.`);
      if (derived > MAX_AGE) throw new Error("Enter a valid date of birth.");

      // --- security questions ---
      const answers = Object.fromEntries(
        Object.entries(data.answers).filter(([, v]) => v.trim().length >= 2),
      );
      if (Object.keys(answers).length < REQUIRED_ANSWERS)
        throw new Error(`Please answer all ${REQUIRED_ANSWERS} security questions.`);
      const distinct = new Set(Object.values(answers).map((v) => v.trim().toLowerCase()));
      if (distinct.size < REQUIRED_ANSWERS)
        throw new Error("Each security answer must be different.");

      const db = await admin();

      // --- name / username screening ---
      const [{ data: uBlocked }, { data: nBlocked }, { data: free }] = await Promise.all([
        db.rpc("is_username_blocked", { _u: key } as never),
        db.rpc("is_username_blocked", { _u: data.fullName } as never),
        db.rpc("username_available", { _u: key } as never),
      ]);
      if (uBlocked || nBlocked) throw new Error("That name isn't allowed on SchoolConnect.");
      if (!free) throw new Error("That username is already taken.");
      if (data.password.toLowerCase().includes(key))
        throw new Error("Your password cannot contain your username.");

      const email = syntheticEmail(key);
      const { data: created, error: cErr } = await db.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, username: key, age: derived },
      });
      if (cErr || !created.user) throw new Error(cErr?.message ?? "Could not create your account.");

      const uid = created.user.id;
      const { error: pErr } = await db.from("profiles").upsert(
        {
          id: uid,
          username: key,
          full_name: data.fullName,
          age: derived,
          date_of_birth: data.dateOfBirth,
          age_verified: true,
        } as never,
        { onConflict: "id" },
      );
      if (pErr) {
        await db.auth.admin.deleteUser(uid);
        throw new Error("Could not save your profile. Please try again.");
      }

      const { error: sErr } = await db.rpc("set_security_answers", {
        _user_id: uid,
        _answers: answers,
      } as never);
      if (sErr) {
        await db.auth.admin.deleteUser(uid);
        throw new Error("Could not save your security answers. Please try again.");
      }

      await log({ kind: "signup", success: true, username_key: key, user_id: uid });
      return { email };
    } catch (err) {
      await log({
        kind: "signup",
        success: false,
        username_key: key,
        detail: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  });

/* --------------------------------- sign in -------------------------------- */

const signInSchema = z.object({
  username: z.string().trim().toLowerCase().min(2).max(40),
  honeypot: z.string().optional(),
  elapsedMs: z.number(),
  challenge: challengeSchema,
  solution: z.string(),
});

/** Resolves a username to its login email after bot + lockout checks. */
export const beginSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signInSchema.parse(d))
  .handler(async ({ data }) => {
    const key = usernameKey(data.username);
    await assertNotBot(data);
    await assertNotThrottled(key);

    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id, banned, suspended_until")
      .eq("username", key)
      .maybeSingle();

    if (!profile) {
      await log({ kind: "signin", success: false, username_key: key, detail: "no such user" });
      throw new Error("Incorrect username or password.");
    }
    if (profile.banned) throw new Error("This account has been permanently disabled.");
    if (profile.suspended_until && new Date(profile.suspended_until) > new Date())
      throw new Error("This account is temporarily suspended.");

    const { data: authUser } = await db.auth.admin.getUserById(profile.id);
    const email = authUser.user?.email ?? syntheticEmail(key);
    return { email, userId: profile.id };
  });

export const recordSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; success: boolean }) =>
    z.object({ username: z.string().max(40), success: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await log({ kind: "signin", success: data.success, username_key: usernameKey(data.username) });
    return { ok: true };
  });

/* -------------------------------- recovery -------------------------------- */

const recoverStartSchema = signInSchema;

export const beginRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recoverStartSchema.parse(d))
  .handler(async ({ data }) => {
    const key = usernameKey(data.username);
    await assertNotBot(data);
    await assertNotThrottled(key);

    const db = await admin();
    const { data: profile } = await db.from("profiles").select("id").eq("username", key).maybeSingle();
    let indexes: number[] = [];
    if (profile) {
      const { data: rows } = await db
        .from("security_answers")
        .select("q_index")
        .eq("user_id", profile.id);
      const available = (rows ?? []).map((r) => r.q_index as number);
      indexes = available.sort(() => Math.random() - 0.5).slice(0, RECOVERY_ANSWERS_REQUIRED).sort();
    }
    if (indexes.length < RECOVERY_ANSWERS_REQUIRED) {
      // Never reveal whether the account exists — return decoy questions.
      indexes = [0, 2, 4];
    }
    return { indexes };
  });

const recoverFinishSchema = z.object({
  username: z.string().trim().toLowerCase().min(2).max(40),
  answers: z.record(z.string(), z.string().trim().min(1).max(80)),
  newPassword: z.string().min(10).max(72),
  honeypot: z.string().optional(),
  elapsedMs: z.number(),
  challenge: challengeSchema,
  solution: z.string(),
});

export const completeRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recoverFinishSchema.parse(d))
  .handler(async ({ data }) => {
    const key = usernameKey(data.username);
    const fail = async (msg: string) => {
      await log({ kind: "recover", success: false, username_key: key, detail: msg });
      throw new Error("Those answers don't match our records.");
    };
    await assertNotBot(data);
    await assertNotThrottled(key);

    const db = await admin();
    const { data: profile } = await db.from("profiles").select("id").eq("username", key).maybeSingle();
    if (!profile) return fail("no such user");
    if (data.newPassword.toLowerCase().includes(key)) throw new Error("Password cannot contain your username.");

    const { data: matched } = await db.rpc("verify_security_answers", {
      _user_id: profile.id,
      _answers: data.answers,
    } as never);
    if ((matched ?? 0) < RECOVERY_ANSWERS_REQUIRED) return fail("answers mismatch");

    const { error } = await db.auth.admin.updateUserById(profile.id, { password: data.newPassword });
    if (error) throw new Error(error.message);

    // Invalidate every existing session on this account after a password reset.
    try {
      await db.auth.admin.signOut(profile.id as never, "global" as never);
    } catch {
      /* best effort */
    }

    await log({ kind: "recover", success: true, username_key: key, user_id: profile.id });
    const { data: authUser } = await db.auth.admin.getUserById(profile.id);
    return { email: authUser.user?.email ?? syntheticEmail(key) };
  });
