import { useEffect, useState } from "react";

export function useAppUpdate() {
  const [available, setAvailable] = useState(false);
  useEffect(function watchForDeployments() {
    if (import.meta.env.DEV) return;
    const entry = document
      .querySelector<HTMLScriptElement>('script[type="module"][src]')
      ?.getAttribute("src");
    if (!entry) return;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const version: unknown = await response.json();
        if (
          !disposed &&
          typeof version === "object" &&
          version !== null &&
          "entry" in version &&
          typeof version.entry === "string" &&
          version.entry !== entry
        )
          setAvailable(true);
      } catch {
        /* Keep working when offline or while a release is starting. */
      } finally {
        checking = false;
      }
    };
    const onActivate = () => {
      void check();
    };
    window.addEventListener("focus", onActivate);
    window.addEventListener("pageshow", onActivate);
    document.addEventListener("visibilitychange", onActivate);
    const timer = window.setInterval(onActivate, 60_000);
    onActivate();
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", onActivate);
      window.removeEventListener("pageshow", onActivate);
      document.removeEventListener("visibilitychange", onActivate);
    };
  }, []);
  return available;
}
