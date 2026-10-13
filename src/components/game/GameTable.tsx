import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield, Star, Swords } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { takeCard } from "@/lib/game.functions";
import { civById } from "@/lib/game/data";
import { deckIndexFor, publicPoints, type PublicState, type Source } from "@/lib/game/engine";
import type { Session } from "@/lib/session";
import type { PlayerRow, RoomRow } from "@/hooks/use-room";
import { GameCard } from "./GameCard";
import { Wonder } from "./Wonder";
import { cn } from "@/lib/utils";

export function GameTable({ room, players, session, code }: { room: RoomRow; players: PlayerRow[]; session: Session; code: string }) {
  const take = useServerFn(takeCard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const st = room.public_state as unknown as PublicState;
  const n = st.seats.length;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const mySeat = st.seats.indexOf(session.playerId);
  const activeId = st.seats[room.current_seat];
  const nextId = st.seats[(room.current_seat + 1) % n];
  const EMPTY = { top: null, count: 0 };
  const myTurn = activeId === session.playerId && room.status === "playing";
  const viewSeat = mySeat >= 0 ? mySeat : room.current_seat;
  const leftDeck = st.decks[deckIndexFor(viewSeat, n, "esquerda")] ?? EMPTY;
  const rightDeck = st.decks[deckIndexFor(viewSeat, n, "direita")] ?? EMPTY;

  async function pick(source: Source) {
    if (!myTurn || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await take({ data: { code, ...session, source, turn: room.turn_number } });
      if (!r.ok) setError(r.error);
    } catch { setError("Falha de conexão. Tente novamente."); } finally { setBusy(false); }
  }

  const opponents = st.seats.map((id, i) => ({ id, i })).filter((o) => o.id !== session.playerId);
  const me = st.areas[session.playerId];
  const myCiv = civById(byId[session.playerId]?.civ_id);
  const featuredOpponent = opponents.find((o) => o.id === activeId) ?? opponents[0];
  const featuredCiv = featuredOpponent ? civById(byId[featuredOpponent.id]?.civ_id) : undefined;
  const featuredArea = featuredOpponent ? st.areas[featuredOpponent.id] : undefined;
  const inspected = inspect && st.areas[inspect] ? { p: byId[inspect], a: st.areas[inspect]! } : null;

  return (
    <main className="imperios-arena arena-v2 flex min-h-screen flex-col">
      <header className="arena-hud relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="font-display text-gold">Impérios</Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1"><Swords className="size-4 text-cat-militar" /> Conflito {st.conflictTokens}/6</span>
          <span className="text-muted-foreground">Sala {code} · Turno {room.turn_number}</span>
        </div>
      </header>

      {/* Adversários ao redor da mesa */}
      <section className="arena-opponents arena-v2-opponents relative z-10 flex flex-wrap justify-center gap-3 px-4">
        {opponents.map(({ id, i }) => {
          const p = byId[id]; const a = st.areas[id]!; const civ = civById(p?.civ_id);
          const active = id === activeId;
          return (
            <button key={id} onClick={() => setInspect(id)}
              className={cn("arena-player panel-stone flex items-center gap-3 px-3 py-2 text-left transition", active && "arena-player-active ring-2 ring-gold glow-gold")}>
              {civ && <Wonder civ={civ} built={a.stages} size="sm" />}
              <div>
                <div className="font-medium">{p?.nickname ?? "?"} <span className="text-xs text-muted-foreground">· {civ?.name}</span></div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Shield className="size-3" />{a.shields}</span>
                  <span className="flex items-center gap-1"><Star className="size-3" />{publicPoints(a)}</span>
                  <span>{a.cards.length} cartas</span>
                  {i === (viewSeat + n - 1) % n && <span className="text-gold">← esquerda</span>}
                  {i === (viewSeat + 1) % n && n > 2 && <span className="text-gold">direita →</span>}
                </div>
                {active && <div className="text-xs text-gold">Jogando agora</div>}
                {!active && id === nextId && <div className="text-xs text-muted-foreground">Próximo</div>}
              </div>
            </button>
          );
        })}
      </section>

      {/* Mesa central */}
      <section className="arena-stage arena-v2-stage relative flex flex-1 items-center justify-center px-4 py-6">
        <div className="arena-table arena-v2-table table-wood relative flex w-full flex-col items-center justify-center gap-5 p-8">
          <div className="arena-monument arena-monument-left" aria-hidden="true">
            {myCiv && me && <Wonder civ={myCiv} built={me.stages} />}
          </div>
          <div className="arena-monument arena-monument-right" aria-hidden="true">
            {featuredCiv && featuredArea && <Wonder civ={featuredCiv} built={featuredArea.stages} />}
          </div>
          {room.status === "finished" ? (
            <div className="text-center">
              <h2 className="text-3xl text-gold-grad">Baralhos esgotados</h2>
              <p className="mt-2 text-sm text-muted-foreground">A pontuação completa chega na próxima fase.</p>
            </div>
          ) : (
            <>
              <p className={cn("font-display text-lg", myTurn ? "text-gold" : "text-foreground")}>
                {myTurn ? "Sua vez: escolha uma carta" : `Vez de ${(activeId ? byId[activeId]?.nickname : undefined) ?? "…"}`}
              </p>
              <div className="arena-decks arena-v2-decks flex items-end gap-4">
                <DeckSlot label="Esquerda" count={leftDeck.count} enabled={myTurn && !busy && leftDeck.count > 0} onClick={() => pick("esquerda")}>
                  <GameCard card={leftDeck.top} />
                </DeckSlot>
                <DeckSlot label="Centro" count={st.central.count} enabled={myTurn && !busy && st.central.count > 0} onClick={() => pick("centro")}>
                  <GameCard card={null} hidden />
                </DeckSlot>
                <DeckSlot label="Direita" count={rightDeck.count} enabled={myTurn && !busy && rightDeck.count > 0} onClick={() => pick("direita")}>
                  <GameCard card={rightDeck.top} />
                </DeckSlot>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>
      </section>

      {/* Área do jogador */}
      {me && myCiv && (
        <section className="arena-my-empire arena-v2-empire panel-stone relative z-20 mx-4 mb-4 flex flex-wrap items-center gap-6 p-4">
          <div className="arena-v2-monument flex items-end gap-3">
            <Wonder civ={myCiv} built={me.stages} />
            <div>
              <div className="font-display text-gold">{myCiv.name}</div>
              <div className="text-sm">{myCiv.wonder}</div>
              <div className="text-xs text-muted-foreground">Etapas {me.stages}/5</div>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1"><Shield className="size-4 text-cat-militar" />{me.shields} escudos</span>
            <span className="flex items-center gap-1"><Star className="size-4 text-gold" />{publicPoints(me)} pontos</span>
          </div>
          <div className="flex flex-1 flex-wrap gap-1.5">
            <AnimatePresence>
              {me.cards.map((c) => (
                <motion.div key={c.id} initial={{ y: -30, opacity: 0, scale: 1.4 }} animate={{ y: 0, opacity: 1, scale: 1 }}>
                  <GameCard card={c} size="sm" />
                </motion.div>
              ))}
            </AnimatePresence>
            {me.cards.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma carta ainda.</span>}
          </div>
        </section>
      )}

      {inspected?.p && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={() => setInspect(null)}>
          <div className="panel-stone w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {(() => { const civ = civById(inspected.p.civ_id)!; return (
              <>
                <div className="flex items-end gap-4">
                  <Wonder civ={civ} built={inspected.a.stages} />
                  <div><h3 className="text-xl text-gold">{inspected.p.nickname}</h3><p className="text-sm">{civ.name} · {civ.wonder}</p></div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{civ.ability}</p>
                <div className="mt-3 flex gap-4 text-sm"><span>{inspected.a.shields} escudos</span><span>{publicPoints(inspected.a)} pontos</span></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{inspected.a.cards.map((c) => <GameCard key={c.id} card={c} size="sm" />)}</div>
                <button className="btn-bronze mt-5 w-full py-2" onClick={() => setInspect(null)}>Fechar</button>
              </>
            ); })()}
          </div>
        </div>
      )}
    </main>
  );
}

function DeckSlot({ label, count, enabled, onClick, children }: { label: string; count: number; enabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button disabled={!enabled} onClick={onClick} className={cn("arena-deck flex flex-col items-center gap-1 transition", enabled ? "arena-deck-enabled" : "cursor-default opacity-80")}>
      <div className={cn("rounded-lg", enabled && "glow-gold")}>{count > 0 ? children : <div className="h-36 w-24 rounded-lg border-2 border-dashed border-muted-foreground/40" />}</div>
      <span className="font-display text-xs uppercase tracking-widest text-gold">{label}</span>
      <span className="text-xs text-muted-foreground">{count} cartas</span>
    </button>
  );
}
