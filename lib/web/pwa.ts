/** Registers the application-owned worker only in a production Web document. */
export function registerProductionServiceWorker(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const { protocol, hostname } = window.location;
  if (protocol !== "https:" && hostname !== "localhost") return;

  void navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {
    // Installation is optional; the online application remains usable without it.
  });
}
