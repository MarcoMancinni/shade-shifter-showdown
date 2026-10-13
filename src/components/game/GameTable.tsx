import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield, Star, Swords } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { takeCard, evolveWonder } from "@/lib/game.functions";
import { civById, COST_LABEL, RESOURCE_LABEL, type CostKind, type Card, type Civilization, type Resource } from "@/lib/game/data";
import { deckIndexFor, publicPoints, type PublicState, type Source } from "@/lib/game/engine";
import type { Session } from "@/lib/session";
import type { PlayerRow, RoomRow } from "@/hooks/use-room";
import { GameCard } from "./GameCard";
import { Wonder } from "./Wonder";
import { cn } from "@/lib/utils";

export function GameTable({ room, players, session, code }: { room: RoomRow; players: PlayerRow[]; session: Session; code: string }) {
  const take = useServerFn(takeCard);
  const evolve = useServerFn(evolveWonder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [evolving, setEvolving] = useState(false);
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

  async function buildWonder() {
    if (evolving || room.status !== "playing") return;
    setEvolving(true); setError(null);
    try {
      const result = await evolve({ data: { code, ...session, version: room.version } });
      if (!result.ok) setError(result.error);
    } catch { setError("Falha ao evoluir. Tente novamente."); }
    finally { setEvolving(false); }
  }

  const opponents = st.seats.map((id, i) => ({ id, i })).filter((o) => o.id !== session.playerId);
  const me = st.areas[session.playerId];
  const myCiv = civById(byId[session.playerId]?.civ_id);
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

      {/* Maravilha pessoal destacada no canto, fora da área das cartas */}
      {me && myCiv && (
        <div className="arena-corner-wonder" aria-label={`Maravilha ${myCiv.wonder}, etapa ${me.stages} de 5`}>
          <Wonder civ={myCiv} built={me.stages} />
        </div>
      )}

      {/* Área do jogador */}
      {me && myCiv && (
        <section className="arena-my-empire arena-v2-empire panel-stone relative z-20 mx-4 mb-4 flex flex-wrap items-center gap-6 p-4">
          <div className="empire-identity">
            <div className="empire-eyebrow">SUA CIVILIZAÇÃO</div>
            <div className="font-display text-gold">{myCiv.name}</div>
            <div className="empire-wonder-name">{myCiv.wonder}</div>
            <div className="empire-stage-count">Maravilha · {me.stages}/5 etapas</div>
            <div className="empire-stats">
              <span className="flex items-center gap-1"><Shield className="size-4 text-cat-militar" />{me.shields} escudos</span>
              <span className="flex items-center gap-1"><Star className="size-4 text-gold" />{publicPoints(me)} pontos</span>
            </div>
          </div>
          <WonderRequirements civ={myCiv} built={me.stages} cards={me.cards}
            onEvolve={buildWonder} evolving={evolving} canPlay={room.status === "playing"} />
          <div className="empire-hand">
            <div className="empire-hand-title">INVENTÁRIO <span>{me.cards.length} cartas</span></div>
            <div className="empire-hand-cards">
              <AnimatePresence>
                {me.cards.map((c) => (
                  <motion.div key={c.id} initial={{ y: -30, opacity: 0, scale: 1.4 }} animate={{ y: 0, opacity: 1, scale: 1 }}>
                    <GameCard card={c} size="sm" />
                  </motion.div>
                ))}
              </AnimatePresence>
              {me.cards.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma carta ainda.</span>}
            </div>
          </div>
          {error && <p role="alert" className="empire-action-error text-xs text-destructive">{error}</p>}
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

const RESOURCE_ORDER: Resource[] = ["pedra", "argila", "madeira", "vidro"];

function requirementProgress(cards: Card[], cost: CostKind): { current: number; required: number; resources: Resource[] } {
  const required = Number(cost[0]);
  const available = cards.filter((card) => card.cat === "recurso" && card.resource);
  const counts = RESOURCE_ORDER.map((resource) => ({
    resource,
    count: available.filter((card) => card.resource === resource).length,
  }));
  if (cost.endsWith("ig")) {
    const best = counts.reduce((a, b) => b.count > a.count ? b : a);
    return { current: Math.min(best.count, required), required, resources: best.count ? [best.resource] : [] };
  }
  const distinct = counts.filter((item) => item.count > 0).map((item) => item.resource);
  return { current: Math.min(distinct.length, required), required, resources: distinct };
}

function WonderRequirements({ civ, built, cards, onEvolve, evolving, canPlay }: { civ: Civilization; built: number; cards: Card[]; onEvolve: () => void; evolving: boolean; canPlay: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const next = civ.stages[built];
  const progress = next ? requirementProgress(cards, next.cost) : null;
  const ready = !!progress && progress.current >= progress.required && canPlay;
  return (
    <div className="wonder-requirements">
      <div className="wonder-requirements-header">
        <div>
          <div className="font-display text-xs uppercase tracking-wider text-gold">
            {next ? `Próxima etapa · ${built + 1}/5` : "Maravilha concluída"}
          </div>
          <div className="wonder-cost-label">
            {next ? COST_LABEL[next.cost] : "Todas as cinco etapas foram erguidas"}
          </div>
        </div>
        <button type="button" className="wonder-requirements-toggle" onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded} aria-label={expanded ? "Ocultar requisitos" : "Ver todas as etapas"}>
          {expanded ? "Ocultar" : "Ver 5 etapas"}
        </button>
      </div>
      {next && progress && (
        <>
          <div className="wonder-progress-row">
            <div className="wonder-requirements-track" aria-label={`${progress.current} de ${progress.required} recursos`}>
              {Array.from({ length: progress.required }, (_, i) => (
                <span key={i} className={i < progress.current ? "is-ready" : ""} />
              ))}
            </div>
            <span className="wonder-progress-count">{progress.current}/{progress.required}</span>
            <span className="wonder-stage-points">+{next.points} pts</span>
          </div>
          <div className="wonder-resources-caption">
            {progress.resources.length
              ? `Disponíveis: ${progress.resources.map((r) => RESOURCE_LABEL[r]).join(", ")}`
              : "Colete cartas de recurso para construir"}
          </div>
        </>
      )}
      <button type="button" className="wonder-evolve-button" onClick={onEvolve}
        disabled={!ready || evolving} aria-label="Evoluir maravilha para a próxima etapa">
        <span className="wonder-evolve-symbol" aria-hidden="true">✦</span>
        {evolving ? "EVOLUINDO..." : built >= 5 ? "MARAVILHA COMPLETA" : ready ? "EVOLUIR MARAVILHA" : "EVOLUÇÃO BLOQUEADA"}
      </button>
      {expanded && (
        <ol className="wonder-requirements-list">
          {civ.stages.map((stage, i) => (
            <li key={i} className={i < built ? "is-complete" : i === built ? "is-current" : ""}>
              <span>{i < built ? "✓" : i + 1}</span>
              <span>{COST_LABEL[stage.cost]}</span>
              <span>+{stage.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
