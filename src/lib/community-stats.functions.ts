import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type CommunityStats = { members: number; schools: number; posts: number; friendships: number; updatedAt: string };

export const getCommunityStats = createServerFn({ method: "GET" }).handler(async (): Promise<CommunityStats | null> => {
  const url = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return null;
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_')) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers, signal: AbortSignal.timeout(4000) });
      } },
    });
    const { data, error } = await client.rpc('landing_community_stats');
    if (error || !data || typeof data !== 'object') return null;
    const stats = data as Partial<CommunityStats>;
    if (![stats.members, stats.schools, stats.posts, stats.friendships].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) || typeof stats.updatedAt !== 'string') return null;
    return stats as CommunityStats;
  } catch { return null; }
});