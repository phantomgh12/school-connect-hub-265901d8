import { useEffect, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { isStandalone } from "@/lib/pwa";

const SNOOZE_KEY = "sc-install-snoozed-at";
const SNOOZE_MS = 1000 * 60 * 60 * 12; // gate comes back twice a day

/**
 * Advanced install gate.
 * Mobile / tablet visitors get a blocking screen asking them to install the app;
 * they can snooze it, but it returns. Desktop gets a small dismissible card.
 */
export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [mode, setMode] = useState<"none" | "gate" | "card">("none");
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    const isMobile = isIos || /android|tablet|mobile|silk|kindle/i.test(ua);
    setIos(isIos);

    const snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    const snoozeActive = Date.now() - snoozed < SNOOZE_MS;

    if (isMobile) setMode(snoozeActive ? "none" : "gate");
    else if (!snoozeActive) setMode("card");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setMode("none");
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function snooze() {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    setMode("none");
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    snooze();
  }

  if (mode === "none") return null;

  if (mode === "card") {
    return (
      <div className="glass fixed bottom-4 right-4 z-50 hidden w-[320px] rounded-2xl p-4 lg:block">
        <div className="flex items-start gap-3">
          <img src="/app-icon-192.png" alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Install SchoolConnect</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Faster, uses less data, and opens like a real app.</p>
          </div>
          <button onClick={snooze} aria-label="Dismiss" className="shrink-0 rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {deferred && (
          <button onClick={install} className="press mt-3 w-full rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft">
            <Download className="mr-1.5 inline h-4 w-4" />Install now
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/95 px-4 backdrop-blur-md lg:hidden">
      <div className="glass w-full max-w-sm rounded-3xl p-6 text-center animate-fade-up">
        <img src="/app-icon-192.png" alt="" width={72} height={72} className="mx-auto h-18 w-18 rounded-3xl shadow-soft" loading="lazy" decoding="async" />
        <h2 className="mt-4 text-xl font-black tracking-tight">Install the SchoolConnect app</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The app uses far less data, loads instantly, and keeps you signed in. Install it to continue with the best experience.
        </p>

        <ul className="mt-4 grid gap-2 text-left text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 shrink-0 text-primary" /> Home-screen icon, full-screen app</li>
          <li className="flex items-center gap-2"><Download className="h-4 w-4 shrink-0 text-primary" /> Cached assets — much lighter on data</li>
        </ul>

        {ios ? (
          <div className="mt-5 rounded-2xl border bg-card p-3 text-left text-sm font-semibold">
            <Share2 className="mr-1.5 inline h-4 w-4 text-primary" />
            Tap <span className="text-primary">Share</span> → <span className="text-primary">Add to Home Screen</span>
          </div>
        ) : deferred ? (
          <button onClick={install} className="press mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft">
            <Download className="mr-1.5 inline h-4 w-4" /> Install app
          </button>
        ) : (
          <div className="mt-5 rounded-2xl border bg-card p-3 text-left text-sm font-semibold">
            Open your browser menu and tap <span className="text-primary">Add to Home screen</span>
          </div>
        )}

        <button onClick={snooze} className="mt-3 w-full rounded-full px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
          Continue in browser for now
        </button>
      </div>
    </div>
  );
}
