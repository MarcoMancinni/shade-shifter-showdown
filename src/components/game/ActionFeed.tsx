import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CATEGORY_LABEL, RESOURCE_LABEL } from "@/lib/game/data";
import type { PublicState } from "@/lib/game/engine";

interface Entry { id: string; text: string; tone: "pick" | "build" | "battle" }

const SOURCE_LABEL = { esquerda: "da esquerda", direita: "da direita", centro: "do centro (oculta)" } as const;

/** Crônica da partida: derivada das mudanças do estado público recebido em tempo real. */
export function ActionFeed({ st, turn, names, meId }: { st: PublicState; turn: number; names: Record<string, string>; meId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const seen = useRef<{ turn: number; build: string | undefined; round: number } | null>(null);
  const name = (id: string) => (id === meId ? "Você" : names[id] ?? "?");

  useEffect(() => {
    const prev = seen.current;
    const round = st.conflictRound ?? 0;
    const buildKey = st.lastBuild ? `${st.lastBuild.playerId}-${st.lastBuild.stage}` : undefined;
    seen.current = { turn, build: buildKey, round };
    if (!prev) return;
    const add: Entry[] = [];
    if (turn > prev.turn && st.lastPick) {
      const c = st.lastPick.card;
      const what = c ? (c.resource ? RESOURCE_LABEL[c.resource] : CATEGORY_LABEL[c.cat]) : "uma carta";
      add.push({ id: `p${turn}`, tone: "pick", text: `${name(st.lastPick.playerId)} pegou ${what} ${SOURCE_LABEL[st.lastPick.source]}` });
    }
    if (buildKey && buildKey !== prev.build && st.lastBuild) {
      add.push({ id: `b${buildKey}`, tone: "build", text: `${name(st.lastBuild.playerId)} ergueu a etapa ${st.lastBuild.stage} (+${st.lastBuild.points} pts)` });
    }
    if (round > prev.round && st.lastBattle) {
      const winners = Object.entries(st.lastBattle.results).filter(([, r]) => r.wins > 0).map(([id, r]) => `${name(id)} +${r.points}`);
      add.push({ id: `w${round}`, tone: "battle", text: `Batalha ${round}: ${winners.length ? winners.join(", ") : "empate geral"}` });
    }
    if (add.length) setEntries((e) => [...add.reverse(), ...e].slice(0, 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, st.lastPick, st.lastBuild, st.conflictRound]);

  if (!entries.length) return null;
  return (
    <aside className="action-feed" aria-live="polite" aria-label="Crônica da partida">
      <div className="action-feed-title">Crônica</div>
      <AnimatePresence initial={false}>
        {entries.map((e, i) => (
          <motion.div key={e.id} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1 - i * 0.13, x: 0 }} exit={{ opacity: 0 }}
            className={`action-feed-item action-feed-${e.tone}`}>{e.text}</motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
}

/** Alerta de "sua vez": acorde sutil + título da aba piscando quando a janela está em segundo plano. */
export function useTurnAlert(myTurn: boolean) {
  const was = useRef(myTurn);
  useEffect(() => {
    const became = myTurn && !was.current;
    was.current = myTurn;
    if (!became) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = f;
        const t = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.65);
      });
      window.setTimeout(() => ctx.close(), 1200);
    } catch { /* áudio indisponível */ }
    if (!document.hidden) return;
    const original = document.title;
    let on = false;
    const id = window.setInterval(() => { on = !on; document.title = on ? "⚔ Sua vez! — Impérios" : original; }, 1000);
    const stop = () => { if (!document.hidden) { window.clearInterval(id); document.title = original; document.removeEventListener("visibilitychange", stop); } };
    document.addEventListener("visibilitychange", stop);
    return () => { window.clearInterval(id); document.title = original; document.removeEventListener("visibilitychange", stop); };
  }, [myTurn]);
}
