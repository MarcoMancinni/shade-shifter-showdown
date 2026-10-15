// Identificação persistente do jogador por sala (apenas no navegador).
export interface Session { playerId: string; token: string }
const key = (code: string) => `imperios:${code.toUpperCase()}`;
export function loadSession(code: string): Session | null {
  try {
    const r = localStorage.getItem(key(code));
    if (!r) return null;
    const value: unknown = JSON.parse(r);
    if (!value || typeof value !== "object" || !("playerId" in value) || !("token" in value) ||
      typeof value.playerId !== "string" || typeof value.token !== "string") return null;
    return { playerId: value.playerId, token: value.token };
  } catch { return null; }
}
export function saveSession(code: string, s: Session) { localStorage.setItem(key(code), JSON.stringify(s)); }
export function clearSession(code: string) { localStorage.removeItem(key(code)); }
