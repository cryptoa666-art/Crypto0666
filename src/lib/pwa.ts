import { canInstallPwa, isEmbedded, isEphemeralPreviewHost, isGrokAccountHost } from "@/lib/app-url";

export function registerCryptoPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (isGrokAccountHost() || isEmbedded() || isEphemeralPreviewHost()) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
    return;
  }
  if (!canInstallPwa()) return;
  const run = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* optional */
    });
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}