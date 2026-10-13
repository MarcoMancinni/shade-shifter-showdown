// Motor de regras puro (sem banco). Executado apenas no servidor.
import { civById, type Card, type CostKind, type Resource, type Science } from "./data";

export interface PublicDeck { top: Card | null; count: number }
export interface PlayerArea { cards: Card[]; stages: number; shields: number }
export interface PublicState {
  civIds?: Record<string, string>;
  seats: string[]; // player ids por assento
  decks: PublicDeck[]; // deck i fica entre assento i (sua esquerda) e assento i-1
  central: { count: number };
  areas: Record<string, PlayerArea>;
  conflictTokens: number;
  lastPick?: { playerId: string; source: Source; card: Card | null };
  lastBuild?: { playerId: string; stage: number; used: string[]; points: number; effect?: string };
}
export interface HiddenState { decks: Card[][]; central: Card[] }
export type Source = "esquerda" | "direita" | "centro";

export type RandomFn = (maxExclusive: number) => number;

export function shuffle<T>(arr: T[], rnd: RandomFn): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const RES: Resource[] = ["pedra", "argila", "madeira", "vidro"];
const SCI: Science[] = ["astro", "engenho", "escrita"];

/** Composição fixa de um baralho lateral (24 cartas). */
export function buildDeck(prefix: string): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (c: Omit<Card, "id">) => cards.push({ id: `${prefix}-${n++}`, ...c });
  for (const r of RES) for (let i = 0; i < (r === "vidro" ? 2 : 3); i++) add({ cat: "recurso", resource: r });
  // Mantém 24 cartas por baralho: duas cartas de vidro substituem duas de comércio.
  add({ cat: "comercio" });
  add({ cat: "cultura", points: 3 }); add({ cat: "cultura", points: 3 });
  add({ cat: "cultura", points: 2, mascot: true }); add({ cat: "cultura", points: 2, mascot: true });
  for (const s of SCI) add({ cat: "ciencia", science: s });
  add({ cat: "militar", shields: 1 }); add({ cat: "militar", shields: 1, conflict: 1 });
  add({ cat: "militar", shields: 1, conflict: 2 }); add({ cat: "militar", shields: 2 });
  add({ cat: "ciencia", science: SCI[prefix.length % 3]! });
  return cards;
}

export function setupGame(playerIds: string[], rnd: RandomFn, civIds: Record<string, string> = {}): { pub: PublicState; hidden: HiddenState } {
  const seats = shuffle(playerIds, rnd);
  const hiddenDecks = seats.map((_, i) => shuffle(buildDeck(`d${i}`), rnd));
  const central = shuffle([...buildDeck("c0"), ...buildDeck("c1")].slice(0, 30), rnd);
  const hidden: HiddenState = { decks: hiddenDecks, central };
  const areas: Record<string, PlayerArea> = {};
  for (const id of seats) areas[id] = { cards: [], stages: 0, shields: 0 };
  return { pub: { seats, civIds, decks: projectDecks(hidden), central: { count: central.length }, areas, conflictTokens: 0 }, hidden };
}

function projectDecks(h: HiddenState): PublicDeck[] {
  return h.decks.map((d) => ({ top: d[0] ?? null, count: d.length }));
}

/** Índice do baralho para o assento e a origem escolhida. */
export function deckIndexFor(seat: number, nSeats: number, source: "esquerda" | "direita"): number {
  return source === "esquerda" ? seat : (seat + 1) % nSeats;
}

export class RuleError extends Error {}


export function resourcesForCost(cards: Card[], cost: CostKind): string[] | null {
  const available = cards.filter((c) => c.cat === "recurso" && c.resource);
  const amount = Number(cost[0]);
  if (cost.endsWith("ig")) {
    for (const resource of RES) {
      const found = available.filter((c) => c.resource === resource);
      if (found.length >= amount) return found.slice(0, amount).map((c) => c.id);
    }
  } else {
    const found = RES.map((resource) => available.find((c) => c.resource === resource)).filter((c): c is Card => !!c);
    if (found.length >= amount) return found.slice(0, amount).map((c) => c.id);
  }
  return null;
}
export function buildAvailableStage(area: PlayerArea, civId?: string) {
  const civ = civById(civId);
  if (!civ || area.stages >= civ.stages.length) return { area };
  const stage = civ.stages[area.stages]!;
  const used = resourcesForCost(area.cards, stage.cost);
  if (!used) return { area };
  const ids = new Set(used);
  return {
    area: { ...area, stages: area.stages + 1, cards: area.cards.filter((c) => !ids.has(c.id)),
      shields: area.shields + (stage.effect === "+1 escudo" ? 1 : stage.effect === "+2 escudos" ? 2 : 0) },
    build: { stage: area.stages + 1, used, points: stage.points, ...(stage.effect ? { effect: stage.effect } : {}) },
  };
}

export interface PickResult { pub: PublicState; hidden: HiddenState; nextSeat: number; finished: boolean; card: Card }

export function pickCard(
  pub: PublicState, hidden: HiddenState, playerId: string, currentSeat: number, source: Source,
): PickResult {
  const n = pub.seats.length;
  if (pub.seats[currentSeat] !== playerId) throw new RuleError("Não é a sua vez.");
  const h: HiddenState = { decks: hidden.decks.map((d) => [...d]), central: [...hidden.central] };
  let card: Card | undefined;
  if (source === "centro") card = h.central.shift();
  else card = h.decks[deckIndexFor(currentSeat, n, source)]!.shift();
  if (!card) throw new RuleError("Este baralho está vazio.");

  const area = pub.areas[playerId]!;
  const newArea: PlayerArea = {
    ...area,
    cards: [...area.cards, card],
    shields: area.shields + (card.shields ?? 0),
  };
  const construction = buildAvailableStage(newArea, pub.civIds?.[playerId]);
  const finished = construction.area.stages === 5 || (h.central.length === 0 && h.decks.every((d) => d.length === 0));
  const next: PublicState = {
    ...pub,
    areas: { ...pub.areas, [playerId]: construction.area },
    lastBuild: construction.build ? { playerId, ...construction.build } : undefined,
    decks: projectDecks(h),
    central: { count: h.central.length },
    conflictTokens: Math.min(6, pub.conflictTokens + (card.conflict ?? 0)),
    lastPick: { playerId, source, card: source === "centro" ? null : card },
  };
  return { pub: next, hidden: h, nextSeat: (currentSeat + 1) % n, finished, card };
}

export function publicPoints(area: PlayerArea): number {
  return area.cards.reduce((s, c) => s + (c.cat === "cultura" ? c.points ?? 0 : 0), 0);
}
