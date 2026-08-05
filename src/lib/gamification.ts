import { supabase } from "@/integrations/supabase/client";

export type GamState = {
  xp: number;
  level: number;
  coins: number;
  reputation: number;
  streak_days: number;
  longest_streak: number;
  weekly_xp: number;
  boxes_available: number;
  last_spin_date: string | null;
  equipped_theme: string | null;
  equipped_frame: string | null;
  equipped_name_color: string | null;
  equipped_bubble: string | null;
};

export type Mission = {
  id: string;
  title: string;
  description: string;
  kind: string;
  cadence: string;
  goal: number;
  xp_reward: number;
  coin_reward: number;
};

export type MissionRow = Mission & { progress: number; claimed: boolean };

export type ShopItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  rarity: string;
  value: string;
  min_level: number;
};

export function xpForLevel(level: number) {
  return Math.pow(Math.max(level - 1, 0), 2) * 100;
}

export function levelProgress(xp: number, level: number) {
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(next - start, 1);
  return {
    pct: Math.min(100, Math.max(0, Math.round(((xp - start) / span) * 100))),
    next,
    remaining: Math.max(next - xp, 0),
  };
}

export async function fetchGamState(userId: string): Promise<GamState | null> {
  const { data } = await supabase
    .from("user_gamification")
    .select(
      "xp,level,coins,reputation,streak_days,longest_streak,weekly_xp,boxes_available,last_spin_date,equipped_theme,equipped_frame,equipped_name_color,equipped_bubble",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as GamState) ?? null;
}

function periodStart(cadence: string) {
  const now = new Date();
  if (cadence === "weekly") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0, matches date_trunc('week')
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

export async function fetchMissions(userId: string): Promise<MissionRow[]> {
  const [{ data: missions }, { data: prog }] = await Promise.all([
    supabase.from("missions").select("*").eq("active", true).order("cadence").order("xp_reward"),
    supabase.from("mission_progress").select("mission_id,progress,claimed,period_start").eq("user_id", userId),
  ]);
  const map = new Map(
    (prog ?? []).map((p: any) => [`${p.mission_id}:${p.period_start}`, p]),
  );
  return (missions ?? []).map((m: any) => {
    const row = map.get(`${m.id}:${periodStart(m.cadence)}`);
    return { ...m, progress: row?.progress ?? 0, claimed: row?.claimed ?? false } as MissionRow;
  });
}

/** Fire-and-forget mission progress. Never throws. */
export function trackMission(kind: string, amount = 1) {
  supabase.rpc("progress_mission", { _kind: kind, _amount: amount }).then(() => {}, () => {});
}

export async function claimMission(missionId: string) {
  const { data, error } = await supabase.rpc("claim_mission", { _mission_id: missionId });
  if (error) throw error;
  return data as any;
}

export async function dailySpin() {
  const { data, error } = await supabase.rpc("daily_spin");
  if (error) throw error;
  return data as any;
}

export async function openBox(boxId: string) {
  const { data, error } = await supabase.rpc("open_box", { _box_id: boxId });
  if (error) throw error;
  return data as any;
}

export async function buyItem(itemId: string) {
  const { data, error } = await supabase.rpc("buy_shop_item", { _item_id: itemId });
  if (error) throw error;
  return data as any;
}

export async function equipItem(itemId: string) {
  const { data, error } = await supabase.rpc("equip_item", { _item_id: itemId });
  if (error) throw error;
  return data as any;
}

export const RARITY_STYLES: Record<string, string> = {
  common: "border-border text-muted-foreground",
  rare: "border-primary/40 text-primary",
  epic: "border-amber-500/50 text-amber-600",
  legendary: "border-rose-500/50 text-rose-600",
};

export const SPIN_SEGMENTS = [
  "25 coins",
  "60 coins",
  "50 XP",
  "150 XP",
  "Mystery box",
  "250 coins",
];
