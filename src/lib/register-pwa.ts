import { refuseServiceWorker } from "./pwa-policy";

/** The only app-shell registrar. Never registers in the editor or development. */
export async function registerPwa(onUpdate: () => void): Promise<() => void> {
  if (!("serviceWorker" in navigator)) return () => {};
  if (refuseServiceWorker(import.meta.env.PROD, window.self !== window.top, location.hostname, location.search)) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.filter((registration) =>
      [registration.active, registration.waiting, registration.installing].some((worker) =>
        worker && new URL(worker.scriptURL).origin === location.origin && new URL(worker.scriptURL).pathname === "/sw.js"
      )).map((registration) => registration.unregister()));
    return () => {};
  }

  const { Workbox } = await import("workbox-window");
  const worker = new Workbox("/sw.js", { scope: "/", updateViaCache: "none" });
  // autoUpdate installs the new static resources, but never reloads a game tab.
  worker.addEventListener("activated", (event) => { if (event.isUpdate) onUpdate(); });
  worker.addEventListener("waiting", onUpdate);
  const registration = await worker.register();
  const check = () => {
    if (document.visibilityState === "visible" && navigator.onLine) void registration?.update().catch(() => {});
  };
  const interval = window.setInterval(check, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("online", check);
  };
}