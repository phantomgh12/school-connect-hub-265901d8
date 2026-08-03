import { supabase } from "@/integrations/supabase/client";
import type { FeedPost } from "@/components/app/PostCard";

export type FeedTab = "foryou" | "following" | "trending" | "latest";

export type RawPost = {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[];
  post_type: string;
  hashtags: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  shares_count: number;
  views_count: number;
  watch_ms: number;
  trending_score: number;
};

const SELECT =
  "id,user_id,content,media_urls,post_type,hashtags,created_at,likes_count,comments_count,saves_count,shares_count,views_count,watch_ms,trending_score";

export type ViewerContext = {
  uid: string;
  schoolSlug: string | null;
  followingIds: Set<string>;
  friendIds: Set<string>;
  interests: string[];
  affinityTags: Map<string, number>;
  interactedAuthors: Map<string, number>;
};

/** Everything the ranking algorithm needs about the current viewer. */
export async function loadViewerContext(uid: string): Promise<ViewerContext> {
  const [{ data: me }, { data: follows }, { data: friends }, { data: interests }, { data: myLikes }] =
    await Promise.all([
      supabase.from("profiles").select("school_slug").eq("id", uid).maybeSingle(),
      supabase.from("follows").select("following_id").eq("follower_id", uid),
      supabase.from("friendships").select("requester_id,addressee_id").eq("status", "accepted").or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      supabase.from("user_interests").select("interest").eq("user_id", uid),
      supabase.from("post_likes").select("post_id").eq("user_id", uid).limit(200),
    ]);

  // Build hashtag affinity + author affinity from the posts the viewer liked.
  const affinityTags = new Map<string, number>();
  const interactedAuthors = new Map<string, number>();
  const likedIds = (myLikes ?? []).map((l: any) => l.post_id);
  if (likedIds.length) {
    const { data: likedPosts } = await supabase.from("posts").select("user_id,hashtags").in("id", likedIds);
    (likedPosts ?? []).forEach((p: any) => {
      interactedAuthors.set(p.user_id, (interactedAuthors.get(p.user_id) ?? 0) + 1);
      (p.hashtags ?? []).forEach((t: string) => affinityTags.set(t.toLowerCase(), (affinityTags.get(t.toLowerCase()) ?? 0) + 1));
    });
  }

  return {
    uid,
    schoolSlug: me?.school_slug ?? null,
    followingIds: new Set((follows ?? []).map((f: any) => f.following_id)),
    friendIds: new Set(
      (friends ?? []).map((f: any) => (f.requester_id === uid ? f.addressee_id : f.requester_id))
    ),
    interests: (interests ?? []).map((i: any) => i.interest.toLowerCase()),
    affinityTags,
    interactedAuthors,
  };
}

/**
 * Composite "For You" ranking score.
 * Engagement + watch time + recency decay + interest, school, follow,
 * hashtag affinity, trending score and past interaction history.
 */
export function scorePost(p: RawPost, ctx: ViewerContext, authorSchool: string | null): number {
  const hours = Math.max((Date.now() - new Date(p.created_at).getTime()) / 3_600_000, 0.25);

  const engagement =
    p.likes_count * 1 + p.comments_count * 2 + p.shares_count * 3 + p.saves_count * 2.5 + Math.min(p.views_count, 5000) * 0.04;
  const watch = Math.min(p.watch_ms / 1000, 4000) * 0.02;
  const recency = 45 / Math.pow(hours + 2, 0.9);

  const tags = (p.hashtags ?? []).map((t) => t.toLowerCase());
  const interestMatch = tags.filter((t) => ctx.interests.some((i) => t.includes(i) || i.includes(t))).length * 12;
  const affinity = tags.reduce((sum, t) => sum + (ctx.affinityTags.get(t) ?? 0) * 4, 0);
  const schoolBoost = authorSchool && ctx.schoolSlug && authorSchool === ctx.schoolSlug ? 20 : 0;
  const followBoost = ctx.followingIds.has(p.user_id) ? 25 : 0;
  const friendBoost = ctx.friendIds.has(p.user_id) ? 18 : 0;
  const history = (ctx.interactedAuthors.get(p.user_id) ?? 0) * 6;
  const trending = (p.trending_score ?? 0) * 8;
  const mine = p.user_id === ctx.uid ? -8 : 0; // slightly de-prioritise your own posts
  const media = (p.media_urls ?? []).length ? 6 : 0;

  return engagement + watch + recency + interestMatch + affinity + schoolBoost + followBoost + friendBoost + history + trending + mine + media;
}

export type FeedPage = { posts: FeedPost[]; hasMore: boolean };

/** Fetch + hydrate + rank one page of the feed for a tab. */
export async function fetchFeedPage(tab: FeedTab, ctx: ViewerContext, page: number, pageSize = 10): Promise<FeedPage> {
  // Pull a wider candidate window for ranked tabs, exact windows for chronological ones.
  const ranked = tab === "foryou" || tab === "trending";
  const from = ranked ? 0 : page * pageSize;
  const to = ranked ? Math.max((page + 1) * pageSize * 4, 40) - 1 : from + pageSize - 1;

  let q = supabase.from("posts").select(SELECT).range(from, to);
  if (tab === "trending") q = q.order("trending_score", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  if (tab === "following") {
    const ids = [...ctx.followingIds, ...ctx.friendIds];
    if (!ids.length) return { posts: [], hasMore: false };
    q = q.in("user_id", ids);
  }

  const { data: raw } = await q;
  let rows = (raw ?? []) as unknown as RawPost[];
  if (!rows.length) return { posts: [], hasMore: false };

  const authorIds = [...new Set(rows.map((p) => p.user_id))];
  const ids = rows.map((p) => p.id);
  const [{ data: authors }, { data: myLikes }, { data: mySaves }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,username,avatar_url,school_name,school_slug,verified").in("id", authorIds),
    supabase.from("post_likes").select("post_id").eq("user_id", ctx.uid).in("post_id", ids),
    supabase.from("post_saves").select("post_id").eq("user_id", ctx.uid).in("post_id", ids),
  ]);
  const amap = new Map((authors ?? []).map((a: any) => [a.id, a]));
  const liked = new Set((myLikes ?? []).map((l: any) => l.post_id));
  const saved = new Set((mySaves ?? []).map((s: any) => s.post_id));

  if (tab === "foryou") {
    rows = [...rows].sort(
      (a, b) =>
        scorePost(b, ctx, amap.get(b.user_id)?.school_slug ?? null) -
        scorePost(a, ctx, amap.get(a.user_id)?.school_slug ?? null)
    );
  }

  const window = ranked ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows;

  const posts: FeedPost[] = window.map((p) => ({
    ...(p as any),
    author: amap.get(p.user_id) ?? null,
    like_count: p.likes_count,
    comment_count: p.comments_count,
    liked_by_me: liked.has(p.id),
    saved_by_me: saved.has(p.id),
  }));

  const hasMore = ranked ? rows.length > (page + 1) * pageSize : window.length === pageSize;
  return { posts, hasMore };
}

/** Algorithm-generated prompts for people with little or no activity. */
export function postPrompts(seed: string, schoolName?: string | null): string[] {
  const pool = [
    `Introduce yourself — what makes ${schoolName || "your school"} special?`,
    "Share a study tip that actually works for you 📚",
    "What's the funniest thing that happened in class this week?",
    "Post a photo from your last school event 📸",
    "Which subject are you crushing right now, and why?",
    "Ask your classmates one question you're curious about",
    "Shout out a friend who helped you this term 🙌",
    "What's your goal for this term?",
  ];
  const start = seed.charCodeAt(0) % pool.length;
  return [pool[start]!, pool[(start + 3) % pool.length]!, pool[(start + 5) % pool.length]!];
}
