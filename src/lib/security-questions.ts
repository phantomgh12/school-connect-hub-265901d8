// Browser-safe shared constants for the username-only auth system.

export const SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What is your mother's first name?",
  "What was your childhood nickname?",
  "What is the name of the town where you were born?",
  "What was your favourite subject in Primary school?",
  "What is the name of your best friend from childhood?",
  "What was the name of your first pet or favourite animal?",
] as const;

export const REQUIRED_ANSWERS = SECURITY_QUESTIONS.length; // 7
export const RECOVERY_ANSWERS_REQUIRED = 3;

export const MIN_AGE = 13;
export const MAX_AGE = 100;

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,22})[a-z0-9]$/;

/** Minimum milliseconds a real human needs to fill the form (bot timing check). */
export const MIN_FORM_MS = 3500;

export const POW_PREFIX = "0000";

/** Solve the proof-of-work challenge in the browser. */
export async function solveChallenge(nonce: string): Promise<string> {
  const enc = new TextEncoder();
  for (let i = 0; i < 5_000_000; i++) {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(`${nonce}:${i}`));
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hex.startsWith(POW_PREFIX)) return String(i);
  }
  throw new Error("Could not complete the security check");
}

export function passwordIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 10) out.push("at least 10 characters");
  if (!/[a-z]/.test(pw)) out.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) out.push("an uppercase letter");
  if (!/[0-9]/.test(pw)) out.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) out.push("a symbol");
  return out;
}
