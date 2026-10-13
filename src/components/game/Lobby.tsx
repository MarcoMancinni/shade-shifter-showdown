import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Copy, Check } from "lucide-react";
import { chooseCiv, startGame } from "@/lib/game.functions";
import { CIVILIZATIONS, civById } from "@/lib/game/data";
import type { Session } from "@/lib/session";
import type { PlayerRow, RoomRow } from "@/hooks/use-room";
import { Wonder } from "./Wonder";
import { cn } from "@/lib/utils";

export function Lobby({ room, players, session, code }: { room: RoomRow; players: PlayerRow[]; session: Session; code: string }) {
  const choose = useServerFn(chooseCiv);
  const start = useServerFn(startGame);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const me = players.find((p) => p.id === session.playerId);
  const isHost = room.host_player_id === session.playerId;
  const ready = players.length >= 2 && players.every((p) => p.civ_id);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (busy) return; setBusy(true); setError(null);
    try { const r = await fn(); if (!r.ok) setError(r.error ?? "Erro."); } catch { setError("Falha de conexão."); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.4em] text-gold">Salão do conselho</p>
          <h1 className="text-4xl text-gold-grad">Sala {code}</h1>
        </div>
        <button className="btn-bronze flex items-center gap-2 px-4 py-2" onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/sala/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1500);
        }}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Link copiado" : "Copiar convite"}
        </button>
      </header>

      <section className="panel-stone mt-8 p-5">
        <h2 className="text-lg text-gold">Jogadores ({players.length}/7)</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {players.map((p) => {
            const civ = civById(p.civ_id);
            return (
              <motion.div layout key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={cn("flex min-w-40 items-center gap-3 rounded-lg border px-3 py-2", p.id === session.playerId ? "border-gold" : "border-border")}>
                {room.host_player_id === p.id && <Crown className="size-4 text-gold" />}
                <div>
                  <div className="font-medium">{p.nickname}{p.id === session.playerId && " (você)"}</div>
                  <div className="text-xs text-muted-foreground">{civ ? civ.name : "Escolhendo…"}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg text-gold">Escolha sua civilização</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CIVILIZATIONS.map((civ) => {
            const owner = players.find((p) => p.civ_id === civ.id);
            const mine = owner?.id === session.playerId;
            const taken = !!owner && !mine;
            return (
              <button key={civ.id} disabled={taken || busy}
                onClick={() => run(() => choose({ data: { code, ...session, civId: mine ? null : civ.id } }))}
                className={cn("panel-stone flex flex-col items-center gap-3 p-4 text-left transition", mine && "ring-2 ring-gold glow-gold", taken ? "opacity-40" : "hover:-translate-y-1")}>
                <div className="flex h-28 items-end"><Wonder civ={civ} built={5} /></div>
                <div className="w-full">
                  <div className="font-display text-lg text-gold">{civ.name}</div>
                  <div className="text-sm">{civ.wonder}</div>
                  <div className="text-xs text-muted-foreground">{civ.style}</div>
                  <p className="mt-2 text-xs">{civ.ability}</p>
                  <p className="mt-2 text-xs text-gold">{mine ? "Sua escolha" : taken ? `Escolhida por ${owner!.nickname}` : "Disponível"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 flex flex-col items-center gap-2">
        {isHost ? (
          <button className="btn-gold px-10 py-3 text-lg" disabled={!ready || busy} onClick={() => run(() => start({ data: { code, ...session } }))}>
            Iniciar partida
          </button>
        ) : (
          <p className="text-muted-foreground">Aguardando o anfitrião iniciar a partida…</p>
        )}
        {!ready && <p className="text-sm text-muted-foreground">É preciso 2+ jogadores, todos com civilização escolhida.</p>}
        {!me?.civ_id && <p className="text-sm text-gold">Escolha uma civilização acima.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
