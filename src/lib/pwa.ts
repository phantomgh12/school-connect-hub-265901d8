/// <reference types="vite-plugin-pwa/client" />

/**
 * Guarded service-worker registration.
 * Never registers in dev, inside an iframe, or in any Lovable preview host —
 * a stale app shell there would serve deleted chunks.
 */
function blockedHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

export function shouldRegisterSW() {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.PROD) return false;
  if (window.top !== window.self) return false;
  if (blockedHost(window.location.hostname)) return false;
  if (new URLSearchParams(window.location.search).has("sw") && new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return true;
}

async function unregisterAll() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs.filter((r) => (r.active?.scriptURL ?? "").includes("/sw.js")).map((r) => r.unregister()),
  );
}

export async function setupPWA() {
  if (typeof window === "undefined") return;
  if (!shouldRegisterSW()) {
    await unregisterAll();
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}

/** True once the app is running as an installed standalone app. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as any).standalone === true
  );
}

/** Capture the browser's install prompt as early as possible so the Install button always works. */
let deferredPrompt: any = null;
const listeners = new Set<(e: any) => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((l) => l(e));
  });
}
export function getInstallPrompt() { return deferredPrompt; }
export function onInstallPrompt(cb: (e: any) => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function clearInstallPrompt() { deferredPrompt = null; }
