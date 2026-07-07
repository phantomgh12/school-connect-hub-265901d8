import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("sc-theme")) as Theme | null;
    const preferred: Theme = stored ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(preferred);
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);
  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try { localStorage.setItem("sc-theme", next); } catch {}
      return next;
    });
  };
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
