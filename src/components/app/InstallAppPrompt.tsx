import { useEffect, useState } from "react";
import { Download, X, Share2 } from "lucide-react";

const KEY = "sc-install-dismissed";

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) === "1") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isMobile = isIos || /android|tablet|mobile/i.test(window.navigator.userAgent);
    if (!isMobile) return;

    setIos(isIos);
    if (isIos) setShow(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="glass fixed bottom-20 left-2 right-2 z-50 flex items-center gap-3 rounded-2xl p-3 lg:hidden">
      <img src="/app-icon-192.png" alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">Get the SchoolConnect app</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {ios ? "Tap Share → Add to Home Screen" : "Install it on your home screen"}
        </p>
      </div>
      {ios ? (
        <Share2 className="h-5 w-5 shrink-0 text-[color:var(--brand)]" />
      ) : (
        <button onClick={install} className="shrink-0 rounded-full gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-brand">
          <Download className="mr-1 inline h-3.5 w-3.5" />Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-full p-1.5 hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
