// Motor de regras puro (sem banco). Executado apenas no servidor.
import { civById, type Card, type CostKind, type Resource, type Science } from "./data";

export interface PublicDeck { top: Card | null; count: number }
export interface PlayerArea { cards: Card[]; stages: number; shields: number; battlePoints?: number }
export interface PublicState {
  civIds?: Record<string, string>;
  seats: string[]; // player ids por assento
  decks: PublicDeck[]; // deck i fica entre assento i (sua esquerda) e assento i-1
  central: { count: number };
  areas: Record<string, PlayerArea>;
  conflictTokens: number;
  conflictRound?: number;
  lastBattle?: { round: number; results: Record<string, { shields: number; wins: number; points: number }> };
  lastPick?: { playerId: string; source: Source; card: Card | null };
  lastBuild?: { playerId: string; stage: number; used: string[]; points: number; effect?: string };
}
/** Fichas de conflito necessárias conforme a quantidade de jogadores. */
export function conflictTokenLimit(players: number): number {
  if (players <= 3) return 3;
  if (players === 4) return 4;
  if (players === 5) return 5;
  return 6;
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
  add({ cat: "militar", shields: 1, conflict: 2 }); add({ cat: "militar", shields: 1 });
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
  return { pub: { seats, civIds, decks: projectDecks(hidden), central: { count: central.length }, areas, conflictTokens: 0, conflictRound: 0 }, hidden };
}

function projectDecks(h: HiddenState): PublicDeck[] {
  return h.decks.map((d) => ({ top: d[0] ?? null, count: d.length }));
}

/** Índice do baralho para o assento e a origem escolhida. */
export function deckIndexFor(seat: number, nSeats: number, source: "esquerda" | "direita"): number {
  return source === "esquerda" ? seat : (seat + 1) % nSeats;
}

export class RuleError extends Error {}


/** Cada carta de comércio (moeda) substitui exatamente um recurso na construção.
 * O servidor escolhe primeiro materiais reais e só consome moedas quando necessário.
 */
export function resourcesForCost(cards: Card[], cost: CostKind): string[] | null {
  const materials = cards.filter((c) => c.cat === "recurso" && c.resource);
  const coins = cards.filter((c) => c.cat === "comercio");
  const amount = Number(cost[0]);
  if (cost.endsWith("ig")) {
    let best: Card[] = [];
    for (const resource of RES) {
      const matching = materials.filter((c) => c.resource === resource);
      if (matching.length > best.length) best = matching;
      if (matching.length >= amount) return matching.slice(0, amount).map((c) => c.id);
    }
    const missing = amount - best.length;
    if (coins.length < missing) return null;
    return [...best.map((c) => c.id), ...coins.slice(0, missing).map((c) => c.id)];
  }
  const distinct = RES.map((resource) => materials.find((c) => c.resource === resource))
    .filter((c): c is Card => !!c);
  const missing = amount - distinct.length;
  if (missing > coins.length) return null;
  return [...distinct.slice(0, amount).map((c) => c.id), ...coins.slice(0, Math.max(0, missing)).map((c) => c.id)];
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

/** Cada jogador enfrenta apenas seus vizinhos imediatos (esquerda e direita).\n * Em mesas de 2 jogadores, ambos os lados apontam para o mesmo rival: um unico duelo.\n * Resolve o conflito entre vizinhos e descarta soldados com trombeta.
 * Uma vitória contra um vizinho vale 1 ponto; empate não pontua.
 * Cada par de jogadores é comparado uma única vez.
 */
export function resolveBattle(pub: PublicState): PublicState {
  const n = pub.seats.length;
  const results: Record<string, { shields: number; wins: number; points: number }> = {};
  for (const id of pub.seats) {
    const area = pub.areas[id]!;
    results[id] = { shields: area.shields, wins: 0, points: 0 };
  }
  for (let i = 0; i < n; i++) {
    const a = pub.seats[i]!;
    const b = pub.seats[(i + 1) % n]!;
    if (n === 2 && i === 1) break; // evitar duelo duplicado com dois jogadores
    if (results[a]!.shields > results[b]!.shields) results[a]!.wins++;
    else if (results[b]!.shields > results[a]!.shields) results[b]!.wins++;
  }
  const areas: Record<string, PlayerArea> = {};
  for (const id of pub.seats) {
    const area = pub.areas[id]!;
    const discarded = area.cards.filter((card) => card.cat === "militar" && (card.conflict ?? 0) > 0);
    const removedShields = discarded.reduce((sum, card) => sum + (card.shields ?? 0), 0);
    const points = results[id]!.wins;
    results[id]!.points = points;
    areas[id] = {
      ...area, cards: area.cards.filter((card) => !discarded.includes(card)),
      shields: Math.max(0, area.shields - removedShields),
      battlePoints: (area.battlePoints ?? 0) + points,
    };
  }
  const round = (pub.conflictRound ?? 0) + 1;
  return { ...pub, areas, conflictTokens: 0, conflictRound: round, lastBattle: { round, results } };
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
  // A evolução é uma ação explícita do jogador, nunca automática na compra.
  const finished = h.central.length === 0 && h.decks.every((d) => d.length === 0);
  const next: PublicState = {
    ...pub,
    areas: { ...pub.areas, [playerId]: newArea },
    lastBuild: undefined,
    decks: projectDecks(h),
    central: { count: h.central.length },
    conflictTokens: Math.min(conflictTokenLimit(n), pub.conflictTokens + (card.conflict ?? 0)),
    lastPick: { playerId, source, card: source === "centro" ? null : card },
  };
  const resolved = next.conflictTokens >= conflictTokenLimit(n) ? resolveBattle(next) : next;
  return { pub: resolved, hidden: h, nextSeat: (currentSeat + 1) % n, finished, card };
}

export function publicPoints(area: PlayerArea): number {
  return (area.battlePoints ?? 0) + area.cards.reduce((s, c) => s + (c.cat === "cultura" ? c.points ?? 0 : 0), 0);
}
