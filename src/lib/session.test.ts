import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession } from "./session";
describe("room identity persistence", () => {
  beforeEach(() => localStorage.clear());
  it("restores only the identity stored for that room", () => {
    const session = { playerId: "test-player", token: "test-token" };
    saveSession("abcde", session);
    expect(loadSession("ABCDE")).toEqual(session);
    expect(loadSession("OTHER")).toBeNull();
    clearSession("abcde");
    expect(loadSession("ABCDE")).toBeNull();
  });
  it("rejects malformed storage instead of submitting invalid identities", () => {
    localStorage.setItem("imperios:ABCDE", JSON.stringify({ token: 42 }));
    expect(loadSession("ABCDE")).toBeNull();
  });
});