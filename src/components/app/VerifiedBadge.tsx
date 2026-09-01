import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, boolean>();
const pending = new Map<string, Promise<boolean>>();

async function fetchVerified(userId: string): Promise<boolean> {
  if (cache.has(userId)) return cache.get(userId)!;
  let p = pending.get(userId);
  if (!p) {
    p = (async () => {
      const r = await supabase.from("profiles").select("verified").eq("id", userId).maybeSingle();
      const v = !!(r.data as { verified?: boolean } | null)?.verified;
      cache.set(userId, v);
      pending.delete(userId);
      return v;
    })();
    pending.set(userId, p);
  }
  return p;
}

/** Blue check shown next to a member's name once an admin verifies them. */
export function VerifiedBadge({
  userId,
  verified,
  className = "h-4 w-4",
}: {
  userId?: string;
  verified?: boolean | null;
  className?: string;
}) {
  const [isVerified, setIsVerified] = useState(!!verified);

  useEffect(() => {
    if (typeof verified === "boolean") { setIsVerified(verified); return; }
    if (!userId) return;
    let alive = true;
    fetchVerified(userId).then((v) => { if (alive) setIsVerified(v); });
    return () => { alive = false; };
  }, [userId, verified]);

  if (!isVerified) return null;
  return (
    <BadgeCheck
      aria-label="Verified member"
      className={`${className} shrink-0 text-[color:var(--verified)]`}
    />
  );
}
