import { describe, expect, it } from "vitest";
import { isGameNavigation, isStaticGameAsset, refuseServiceWorker } from "./pwa-policy";

describe("PWA safety", () => {
  it.each(["id-preview--game.lovable.app", "preview--game.lovable.app", "lovableproject.com", "x.lovableproject.com", "lovableproject-dev.com", "x.lovableproject-dev.com", "beta.lovable.dev", "x.beta.lovable.dev"])("never registers in %s", (host) => {
    expect(refuseServiceWorker(true, false, host, "")).toBe(true);
  });
  it("refuses development, iframes and the kill switch", () => {
    expect(refuseServiceWorker(false, false, "game.lovable.app", "")).toBe(true);
    expect(refuseServiceWorker(true, true, "game.lovable.app", "")).toBe(true);
    expect(refuseServiceWorker(true, false, "game.lovable.app", "?sw=off")).toBe(true);
    expect(refuseServiceWorker(true, false, "imperios-maravilhas.lovable.app", "")).toBe(false);
  });
  const origin = "https://imperios-maravilhas.lovable.app";
  it.each(["/api/public/hook", "/_serverFn/action", "/~oauth", "/sala/ABCDE?token=secret", "/rest/v1/rooms", "/auth/v1/token"])("does not cache dynamic path %s", (path) => {
    expect(isStaticGameAsset(new URL(path, origin), origin)).toBe(false);
    expect(isGameNavigation(new URL(path, origin), origin, "navigate")).toBe(false);
  });
  it("matches only static art and hashed assets", () => {
    expect(isStaticGameAsset(new URL("/assets/table-12345678.js", origin), origin)).toBe(true);
    expect(isStaticGameAsset(new URL("/cartas/pedra.webp", origin), origin)).toBe(true);
    expect(isStaticGameAsset(new URL("/cartas/pedra.webp?token=secret", origin), origin)).toBe(false);
    expect(isStaticGameAsset(new URL("https://external.test/cartas/pedra.webp"), origin)).toBe(false);
    expect(isGameNavigation(new URL("/sala/ABCDE", origin), origin, "navigate")).toBe(true);
    expect(isGameNavigation(new URL("/", origin), origin, "cors")).toBe(false);
  });
});