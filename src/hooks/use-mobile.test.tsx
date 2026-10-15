import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileLayout } from "./use-mobile";

afterEach(() => vi.unstubAllGlobals());

describe("Mobile layout detection", () => {
  it("uses an unknown server snapshot rather than a desktop table", () => {
    function Snapshot() { return <span>{String(useMobileLayout())}</span>; }
    expect(renderToString(<Snapshot />)).toContain("null");
  });

  it("reacts to media changes and removes its listener", () => {
    let matches = true;
    let listener: (() => void) | undefined;
    const remove = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      get matches() { return matches; },
      addEventListener: (_: string, callback: () => void) => { listener = callback; },
      removeEventListener: remove,
    })));
    const hook = renderHook(() => useMobileLayout());
    expect(hook.result.current).toBe(true);
    act(() => { matches = false; listener?.(); });
    expect(hook.result.current).toBe(false);
    hook.unmount();
    expect(remove).toHaveBeenCalled();
  });
});