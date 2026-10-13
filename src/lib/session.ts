// Identificação persistente do jogador por sala (apenas no navegador).
export interface Session { playerId: string; token: string }
const key = (code: string) => `imperios:${code.toUpperCase()}`;
export function loadSession(code: string): Session | null {
  try { const r = localStorage.getItem(key(code)); return r ? (JSON.parse(r) as Session) : null; } catch { return null; }
}
export function saveSession(code: string, s: Session) { localStorage.setItem(key(code), JSON.stringify(s)); }
export function clearSession(code: string) { localStorage.removeItem(key(code)); }
