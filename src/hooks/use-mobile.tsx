import * as React from "react";

const MOBILE_QUERY = "(max-width: 768px), (max-height: 500px) and (max-width: 1024px) and (orientation: landscape)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Unknown during SSR/hydration: do not briefly render the desktop table on phones. */
export function useMobileLayout(): boolean | null {
  return React.useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => null);
}

export function useIsMobile() {
  return useMobileLayout() ?? false;
}
