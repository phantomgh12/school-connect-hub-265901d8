import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Flame, Zap } from "lucide-react";

export type ProfileCounts = {
  posts: number;
  followers: number;
  following: number;
  friends: number;
  likes: number;
  stories: number;
};

/** Followers / following / posts / likes strip used on every profile. */
export function ProfileStats({ userId }: { userId: string }) {
  const [c, setC] = useState<ProfileCounts | null>(null);
  const [gam, setGam] = useState<{ xp: number; level: number; coins: number; streak_days: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [posts, followers, following, fr1, fr2, myPosts, stories, g] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("requester_id", userId).eq("status", "accepted"),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", userId).eq("status", "accepted"),
        supabase.from("posts").select("likes_count").eq("user_id", userId),
        supabase.from("stories").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("user_gamification").select("xp,level,coins,streak_days").eq("user_id", userId).maybeSingle(),
      ]);
      if (!alive) return;
      setC({
        posts: posts.count ?? 0,
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        friends: (fr1.count ?? 0) + (fr2.count ?? 0),
        likes: (myPosts.data ?? []).reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0),
        stories: stories.count ?? 0,
      });
      setGam((g.data as any) ?? null);
    })();
    return () => { alive = false; };
  }, [userId]);

  const cells: [string, string][] = [
    ["Posts", String(c?.posts ?? 0)],
    ["Followers", String(c?.followers ?? 0)],
    ["Following", String(c?.following ?? 0)],
    ["Friends", String(c?.friends ?? 0)],
    ["Likes", String(c?.likes ?? 0)],
    ["Stories", String(c?.stories ?? 0)],
  ];

  return (
    <div className="grid gap-3">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {cells.map(([label, value]) => (
          <li key={label} className="min-w-0 rounded-xl border bg-card px-2 py-2 text-center">
            <p className="truncate text-base font-black">{value}</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          </li>
        ))}
      </ul>
      {gam && (
        <ul className="flex flex-wrap gap-2 text-xs font-bold">
          <li className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><Zap className="h-3.5 w-3.5 text-primary" /> Level {gam.level} · {gam.xp} XP</li>
          <li className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><Flame className="h-3.5 w-3.5 text-primary" /> {gam.streak_days}d streak</li>
          <li className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><Coins className="h-3.5 w-3.5 text-primary" /> {gam.coins}</li>
        </ul>
      )}
    </div>
  );
}
