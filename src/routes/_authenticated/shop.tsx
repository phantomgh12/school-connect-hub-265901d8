import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { buyItem, equipItem, fetchGamState, RARITY_STYLES, type GamState, type ShopItem } from "@/lib/gamification";
import { Coins, Loader2, Check, Lock, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Cosmetic shop — GH School Hub" },
      { name: "description", content: "Spend coins on themes, profile frames, name colours, chat bubbles and badge cosmetics." },
      { property: "og:title", content: "Cosmetic shop — GH School Hub" },
      { property: "og:description", content: "Themes, frames, name colours and chat bubbles for your profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

const CATS = [
  { key: "theme", label: "Themes" },
  { key: "frame", label: "Frames" },
  { key: "name_color", label: "Name colours" },
  { key: "bubble", label: "Chat bubbles" },
] as const;

function ShopPage() {
  const [uid, setUid] = useState("");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [gam, setGam] = useState<GamState | null>(null);
  const [cat, setCat] = useState<string>("theme");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const [{ data: its }, { data: mine }, g] = await Promise.all([
      supabase.from("shop_items").select("*").eq("active", true).order("price"),
      supabase.from("user_purchases").select("item_id").eq("user_id", id),
      fetchGamState(id),
    ]);
    setItems((its ?? []) as ShopItem[]);
    setOwned(new Set((mine ?? []).map((m: any) => m.item_id)));
    setGam(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      await load(u.user.id);
    })();
  }, [load]);

  const equippedValue = (c: string) =>
    c === "theme" ? gam?.equipped_theme : c === "frame" ? gam?.equipped_frame
      : c === "name_color" ? gam?.equipped_name_color : gam?.equipped_bubble;

  async function onBuy(it: ShopItem) {
    setBusy(it.id);
    try {
      const res = await buyItem(it.id);
      if (!res?.ok) {
        toast.error(
          res?.error === "not_enough_coins" ? "Not enough coins"
            : res?.error === "level_locked" ? `Unlocks at level ${it.min_level}` : "Could not buy",
        );
      } else toast.success(`${it.name} unlocked!`);
      await load(uid);
    } catch (e: any) {
      toast.error(e.message ?? "Could not buy");
    } finally { setBusy(null); }
  }

  async function onEquip(it: ShopItem) {
    setBusy(it.id);
    try {
      const res = await equipItem(it.id);
      if (!res?.ok) toast.error("Could not equip");
      else toast.success(`${it.name} equipped`);
      await load(uid);
    } finally { setBusy(null); }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center rounded-2xl border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const list = items.filter((i) => i.category === cat);

  return (
    <AppShell>
      <div className="grid gap-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border bg-card p-5">
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 truncate text-xl font-black sm:text-2xl">
              <ShoppingBag className="h-5 w-5 shrink-0 text-primary" /> Shop
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">Cosmetics only — no pay-to-win.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-sm font-black">
            <Coins className="h-4 w-4 text-primary" /> {gam?.coins ?? 0}
          </span>
        </header>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${cat === c.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((it) => {
            const has = owned.has(it.id);
            const equipped = equippedValue(it.category) === it.value;
            const locked = (gam?.level ?? 1) < it.min_level;
            return (
              <li key={it.id} className={`min-w-0 rounded-2xl border bg-card p-4 ${RARITY_STYLES[it.rarity] ?? ""}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{it.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{it.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase">{it.rarity}</span>
                </div>

                <div className="mt-3 h-10 rounded-xl border" style={preview(it)} />

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs font-bold text-foreground">
                    {locked ? <><Lock className="h-3.5 w-3.5" /> Level {it.min_level}</> : <><Coins className="h-3.5 w-3.5 text-primary" /> {it.price}</>}
                  </span>
                  {has ? (
                    <button
                      onClick={() => onEquip(it)}
                      disabled={equipped || busy === it.id}
                      className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                    >
                      {equipped ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Equipped</span> : "Equip"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuy(it)}
                      disabled={locked || busy === it.id}
                      className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {busy === it.id ? "…" : "Buy"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}

function preview(it: ShopItem): React.CSSProperties {
  if (it.category === "name_color") {
    return it.value === "rainbow"
      ? { background: "linear-gradient(90deg,#EF4444,#F59E0B,#10B981,#2563EB)" }
      : { background: it.value };
  }
  const map: Record<string, string> = {
    midnight: "#0f172a", sunset: "#F59E0B", forest: "#10B981", neon: "#22d3ee",
    gold: "#F59E0B", silver: "#9ca3af", fire: "#EF4444", leaf: "#10B981",
    classic: "#F3F4F6", ocean: "#2563EB", mono: "#6b7280", galaxy: "#7c3aed",
  };
  return { background: map[it.value] ?? "var(--color-muted)" };
}
