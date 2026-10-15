import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Copy, Check, Swords, Shield, ScrollText, Users } from "lucide-react";
import { chooseCiv, startGame } from "@/lib/game.functions";
import { CIVILIZATIONS, civById } from "@/lib/game/data";
import type { Session } from "@/lib/session";
import type { PlayerRow, RoomRow } from "@/hooks/use-room";
import { Wonder } from "./Wonder";
import { cn } from "@/lib/utils";

export function Lobby({ room, players, session, code, connected = true }: { room: RoomRow; players: PlayerRow[]; session: Session; code: string; connected?: boolean }) {
  const choose = useServerFn(chooseCiv);
  const start = useServerFn(startGame);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [brokenBandejas, setBrokenBandejas] = useState<Record<string, boolean>>({});
  const me = players.find((p) => p.id === session.playerId);
  const isHost = room.host_player_id === session.playerId;
  const ready = players.length >= 2 && players.every((p) => p.civ_id);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (busy || !connected || !navigator.onLine) return; setBusy(true); setError(null);
    try { const r = await fn(); if (!r.ok) setError(r.error ?? "Erro."); } catch { setError("Falha de conexão."); } finally { setBusy(false); }
  }

  return (
    <main className="war-lobby mx-auto max-w-6xl px-4 py-10">
      <div className="war-lobby-scenery" aria-hidden="true" />
      <header className="war-lobby-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="war-lobby-kicker font-display text-sm uppercase tracking-[0.4em] text-gold"><Swords className="inline size-4 align-[-2px] mr-2" /> Conselho de Guerra</p>
          <h1 className="text-4xl text-gold-grad">Sala {code}</h1><p className="war-lobby-intro">Os impérios se reúnem. Escolha sua civilização e prepare-se para conquistar a glória.</p>
        </div>
        <button className="btn-bronze flex items-center gap-2 px-4 py-2" onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/sala/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1500);
        }}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Link copiado" : "Copiar convite"}
        </button>
      </header>

      <div className="war-lobby-battle-caption"><span>⚔</span> ÀS VÉSPERAS DA CONQUISTA <span>⚔</span></div>
      <section className="war-lobby-roster panel-stone mt-8 p-5">
        <div className="war-lobby-roster-ornament" aria-hidden="true"><Swords /></div>
        <div className="war-lobby-roster-heading"><div><p className="war-lobby-eyebrow">O CONSELHO SE REÚNE</p><h2 className="text-lg text-gold"><Users className="inline size-5 mr-2 align-[-3px]" /> Comandantes ({players.length}/7)</h2></div><span className="war-lobby-ready">{ready ? "EXÉRCITOS PRONTOS" : "AGUARDANDO COMANDANTES"}</span></div>
        <div className="war-lobby-roster-content"><div className="war-lobby-players mt-4 flex flex-wrap gap-3">
          {players.map((p) => {
            const civ = civById(p.civ_id);
            return (
              <motion.div layout key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={cn("war-lobby-player flex min-w-40 items-center gap-3 rounded-lg border px-3 py-2", p.id === session.playerId ? "border-gold" : "border-border")}>
                {room.host_player_id === p.id && <Crown className="size-4 text-gold" />}
                <div>
                  <div className="font-medium">{p.nickname}{p.id === session.playerId && " (você)"}</div>
                  <div className="text-xs text-muted-foreground">{civ ? civ.name : "Escolhendo…"}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="war-lobby-launch">
          {isHost ? (
            <button className="war-lobby-start btn-gold" disabled={!connected || !ready || busy} onClick={() => run(() => start({ data: { code, ...session } }))}>
              <Swords className="size-5" /> {busy ? "Preparando..." : "INICIAR PARTIDA"}
            </button>
          ) : <div className="war-lobby-await"><Shield className="size-5" /> Aguardando o anfitrião iniciar a partida</div>}
          {!ready && <p className="war-lobby-hint">Mínimo de 2 jogadores, todos com civilização escolhida.</p>}
          {!me?.civ_id && <p className="war-lobby-hint">Escolha sua civilização abaixo.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div></div>
      </section>

      <section className="war-lobby-civilizations mt-8">
        <div className="war-lobby-section-heading"><ScrollText className="size-6" /><div><p className="war-lobby-eyebrow">BANDEIRAS DO IMPÉRIO</p><h2 className="text-lg text-gold">Escolha sua civilização</h2></div></div>
        <div className="mx-auto mt-5 flex max-w-4xl flex-col gap-5">
          {CIVILIZATIONS.map((civ) => {
            const owner = players.find((p) => p.civ_id === civ.id);
            const mine = owner?.id === session.playerId;
            const taken = !!owner && !mine;
            return (
              <button key={civ.id} disabled={!connected || taken || busy}
                onClick={() => run(() => choose({ data: { code, ...session, civId: mine ? null : civ.id } }))}
                className={cn("war-lobby-civ group relative flex w-full min-w-0 flex-col items-center gap-2 rounded-xl border border-transparent bg-transparent px-2 py-3 text-left transition-all duration-200", mine && "border-gold/70 bg-gold/5", taken ? "opacity-40" : "hover:-translate-y-0.5 hover:bg-gold/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold")}>
                {(civ.id === "aurelia" || civ.id === "nihara" || civ.id === "thalassa") && !brokenBandejas[civ.id] ? (
                  <>
                    <img
                      src={`/${civ.id}-bandeja.webp`}
                      onError={() => setBrokenBandejas((previous) => ({ ...previous, [civ.id]: true }))}
                      alt={`Bandeja da civilização ${civ.name} — ${civ.wonder}`}
                      className="block h-auto w-full max-w-[760px] object-contain drop-shadow-[0_12px_14px_rgba(0,0,0,0.4)]"
                      decoding="async"
                    />
                    <span className="block w-full max-w-[760px] px-2 pb-1 text-center text-sm font-semibold text-gold">
                      {mine ? "Sua escolha" : taken ? `Escolhida por ${owner!.nickname}` : "Disponível"}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-28 items-end"><Wonder civ={civ} built={5} /></div>
                    <div className="w-full max-w-[760px] text-center">
                      <div className="font-display text-lg text-gold">{civ.name}</div>
                      <div className="text-sm">{civ.wonder}</div>
                      <div className="text-xs text-muted-foreground">{civ.style}</div>
                      <p className="mt-2 text-xs">{civ.ability}</p>
                      <p className="mt-2 text-xs text-gold">
                        {mine ? "Sua escolha" : taken ? `Escolhida por ${owner!.nickname}` : "Disponível"}
                      </p>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="war-lobby-footer">A glória pertence àqueles que ousam construir seu legado.</div>
    </main>
  );
}
