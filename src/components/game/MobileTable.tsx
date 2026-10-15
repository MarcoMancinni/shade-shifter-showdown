import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Shield, Star, Swords, Landmark, Layers, Sparkles, Trophy, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { civById, CATEGORY_LABEL, type Card, type Category, type Civilization } from "@/lib/game/data";
import { conflictTokenLimit, publicPoints, scoreBreakdown, type PublicState, type Source, type PlayerArea } from "@/lib/game/engine";
import type { PlayerRow } from "@/hooks/use-room";
import { GameCard, cardTitle } from "./GameCard";
import { Wonder } from "./Wonder";
import { cn } from "@/lib/utils";

type Deck = { top: Card | null; count: number };
type Tab = "maravilha" | "cartas" | "fichas" | "pontos";

export interface MobileTableProps {
  st: PublicState;
  code: string;
  turn: number;
  players: PlayerRow[];
  meId: string;
  activeId: string | undefined;
  viewSeat: number;
  myTurn: boolean;
  busy: boolean;
  error: string | null;
  leftDeck: Deck;
  rightDeck: Deck;
  me: PlayerArea | undefined;
  myCiv: Civilization | undefined;
  progressNames: Record<string, string>;
  wonderReady: boolean;
  renderRequirements: () => ReactNode;
  onPick: (s: Source) => void;
  onInspect: (id: string) => void;
}

const CAT_ORDER: Category[] = ["recurso", "comercio", "ciencia", "militar", "cultura"];

export function MobileTable(p: MobileTableProps) {
  const { st, players, meId, activeId, viewSeat } = p;
  const [tab, setTab] = useState<Tab | null>(null);
  const [zoom, setZoom] = useState<{ source: Source | null; card: Card | null } | null>(null);
  const n = st.seats.length;
  const byId = Object.fromEntries(players.map((x) => [x.id, x]));
  const leftId = st.seats[(viewSeat + n - 1) % n];
  const rightId = st.seats[(viewSeat + 1) % n];
  const activeName = activeId ? byId[activeId]?.nickname : undefined;
  const me = p.me;
  const score = me ? scoreBreakdown(me, p.myCiv?.id) : null;

  const decks: { source: Source; label: string; deck: Deck; from?: string }[] = [
    { source: "esquerda", label: "Esquerda", deck: p.leftDeck, from: leftId !== meId ? byId[leftId ?? ""]?.nickname : undefined },
    { source: "centro", label: "Centro", deck: st.central },
    { source: "direita", label: "Direita", deck: p.rightDeck, from: n > 2 && rightId !== meId ? byId[rightId ?? ""]?.nickname : undefined },
  ];

  return (
    <div className="m-table">
      <header className="m-top">
        <div className="m-top-row">
          <Link to="/" className="font-display text-gold">Impérios</Link>
          <span className="m-top-meta">Sala {p.code} · T{p.turn}</span>
          <span className="m-top-war" aria-label={`${st.conflictTokens} de ${conflictTokenLimit(n)} fichas de batalha`}>
            <Swords className="size-3.5 text-cat-militar" />
            {Array.from({ length: conflictTokenLimit(n) }, (_, i) => (
              <span key={i} className={cn("m-war-dot", i < st.conflictTokens && "is-on")} />
            ))}
          </span>
        </div>
        <div className="m-avatars" role="list">
          {st.seats.map((id) => {
            const pl = byId[id]; const civ = civById(pl?.civ_id); const a = st.areas[id]!;
            return (
              <button key={id} role="listitem" onClick={() => id !== meId && p.onInspect(id)}
                className={cn("m-avatar", id === activeId && "is-active", id === meId && "is-me")}>
                <span className="m-avatar-seal" style={{ ["--civ-hue" as string]: civ?.hue ?? 40 }}>{civ?.name.charAt(0) ?? "?"}</span>
                <span className="m-avatar-name">{id === meId ? "Você" : pl?.nickname ?? "?"}</span>
                <span className="m-avatar-pts">
                  {id === leftId && id !== meId && "← "}{publicPoints(a)}★{id === rightId && id !== meId && n > 2 && " →"}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <section className="m-center">
        <div className={cn("m-turn", p.myTurn && "is-mine")}>
          {p.myTurn ? "★ Sua vez — toque numa carta" : `Vez de ${activeName ?? "…"}`}
        </div>
        <div className="m-decks">
          {decks.map((d) => (
            <button key={d.source} className="m-deck" disabled={d.deck.count === 0}
              onClick={() => setZoom({ source: d.source, card: d.source === "centro" ? null : d.deck.top })}>
              <span className="m-deck-label">{d.label}</span>
              <div className="m-deck-card">
                {d.source === "centro"
                  ? <img src="/cartas/verso-centro.webp" alt="Verso do baralho central" className="h-full w-full rounded-lg object-fill" draggable={false} />
                  : <div className="m-card-fit"><GameCard card={d.deck.top} size="md" /></div>}
              </div>
              <span className="m-deck-count">{d.from ? `${d.from} · ` : ""}{d.deck.count}</span>
            </button>
          ))}
        </div>
        {p.error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{p.error}</p>}
      </section>

      <nav className="m-dock" aria-label="Seu império">
        <DockBtn icon={<Landmark />} label="Maravilha" value={`${me?.stages ?? 0}/5`} glow={p.wonderReady} onClick={() => setTab("maravilha")} />
        <DockBtn icon={<Layers />} label="Cartas" value={String(me?.cards.length ?? 0)} onClick={() => setTab("cartas")} />
        <DockBtn icon={<Sparkles />} label="Fichas" value={String(me?.progressTokens ?? 0)} onClick={() => setTab("fichas")} />
        <DockBtn icon={<Trophy />} label="Pontos" value={String(score?.total ?? 0)} onClick={() => setTab("pontos")} />
      </nav>

      <Drawer open={tab !== null} onOpenChange={(o) => !o && setTab(null)}>
        <DrawerContent className="m-drawer">
          <DrawerHeader className="pb-1">
            <DrawerTitle className="font-display text-gold">
              {tab === "maravilha" ? p.myCiv?.wonder ?? "Maravilha" : tab === "cartas" ? "Suas cartas" : tab === "fichas" ? "Fichas e escudos" : "Pontuação"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="m-drawer-body">
            {tab === "maravilha" && p.myCiv && me && (
              <div className="flex flex-col items-center gap-3">
                <div className="m-wonder-art"><Wonder civ={p.myCiv} built={me.stages} /></div>
                <p className="text-sm text-muted-foreground">{p.myCiv.name} · etapa {me.stages}/5</p>
                <div className="w-full">{p.renderRequirements()}</div>
              </div>
            )}
            {tab === "cartas" && me && (
              me.cards.length === 0 ? <p className="text-center text-muted-foreground">Nenhuma carta ainda.</p> :
              CAT_ORDER.map((cat) => {
                const cs = me.cards.filter((c) => c.cat === cat);
                if (!cs.length) return null;
                return (
                  <div key={cat} className="mb-4">
                    <h3 className="mb-2 font-display text-sm uppercase tracking-wider text-gold">{CATEGORY_LABEL[cat]} · {cs.length}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {cs.map((c) => (
                        <button key={c.id} className="m-card-fit-sm" onClick={() => setZoom({ source: null, card: c })} aria-label={cardTitle(c)}>
                          <GameCard card={c} size="md" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            {tab === "fichas" && me && (
              <div className="space-y-3">
                <div className="m-stat"><Shield className="size-5 text-cat-militar" /> {me.shields} escudos</div>
                <div className="m-stat"><Sparkles className="size-5 text-gold" /> {me.progressTokens ?? 0} fichas de Progresso</div>
                <ul className="space-y-1 pl-2 text-sm">
                  {(me.progressChosen ?? []).map((id) => <li key={id}>✦ {p.progressNames[id] ?? id}</li>)}
                </ul>
              </div>
            )}
            {tab === "pontos" && score && (
              <div className="space-y-2">
                {([["Maravilha", score.wonder], ["Cultura", score.culture], ["Batalha", score.military]] as const).map(([l, v]) => (
                  <div key={l} className="m-stat justify-between"><span>{l}</span><strong>{v}</strong></div>
                ))}
                <div className="m-stat justify-between border-gold text-gold"><span><Star className="inline size-4" /> Total</span><strong>{score.total}</strong></div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {zoom && typeof document !== "undefined" && createPortal(
        <div className="m-zoom" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <button className="m-zoom-close" aria-label="Fechar" onClick={() => setZoom(null)}><X /></button>
          <div className="m-zoom-card" onClick={(e) => e.stopPropagation()}>
            {zoom.source === "centro"
              ? <img src="/cartas/verso-centro.webp" alt="Carta oculta do centro" className="h-full w-full rounded-xl object-fill" />
              : <div className="m-card-fit"><GameCard card={zoom.card} size="lg" /></div>}
          </div>
          <p className="m-zoom-title">{zoom.source === "centro" ? "Carta oculta do centro" : zoom.card ? cardTitle(zoom.card) : ""}</p>
          {zoom.source && (
            <button className="btn-gold m-zoom-take" disabled={!p.myTurn || p.busy}
              onClick={(e) => { e.stopPropagation(); p.onPick(zoom.source!); setZoom(null); }}>
              {p.myTurn ? (p.busy ? "Aguarde…" : "Pegar esta carta") : "Aguarde sua vez"}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function DockBtn({ icon, label, value, glow, onClick }: { icon: ReactNode; label: string; value: string; glow?: boolean; onClick: () => void }) {
  return (
    <button className={cn("m-dock-btn", glow && "is-glow")} onClick={onClick}>
      <span className="m-dock-icon">{icon}</span>
      <span className="m-dock-label">{label}</span>
      <span className="m-dock-value">{value}</span>
    </button>
  );
}
