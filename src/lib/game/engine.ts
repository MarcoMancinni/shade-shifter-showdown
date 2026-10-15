// Motor de regras puro (sem banco). Executado apenas no servidor.
import { civById, type Card, type CostKind, type Resource, type Science } from "./data";

export interface PublicDeck { top: Card | null; count: number }
export interface PlayerArea { cards: Card[]; stages: number; shields: number; battlePoints?: number; wonderPoints?: number; progressTokens?: number; progressChosen?: string[]; extraPicks?: number; extraPickActive?: boolean }
export interface PublicState {
  civIds?: Record<string, string>;
  seats: string[]; // player ids por assento
  decks: PublicDeck[]; // deck i fica entre assento i (sua esquerda) e assento i-1
  central: { count: number };
  areas: Record<string, PlayerArea>;
  conflictTokens: number;
  conflictRound?: number;
  lastBattle?: { round: number; results: Record<string, { shields: number; wins: number; points: number }> };
  lastScience?: { playerId: string; used: string[]; tokenCount: number } | undefined;
  lastPick?: { playerId: string; source: Source; card: Card | null };
  lastBuild?: { playerId: string; stage: number; used: string[]; points: number; effect?: string } | undefined;
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
 * Ficha 'engenharia' permite ignorar restrição de 'iguais' ou 'diferentes'.
 * Ficha 'economia' faz cada carta amarela valer 2 moedas.
 */
export function resourcesForCost(cards: Card[], cost: CostKind, tokens: string[] = []): string[] | null {
  const materials = cards.filter((c) => c.cat === "recurso" && c.resource);
  const yellowCards = cards.filter((c) => c.cat === "comercio");
  const hasEngenharia = tokens.includes("engenharia");
  const hasEconomia = tokens.includes("economia");
  
  const amount = Number(cost[0]);
  
  // Se tem engenharia, qualquer conjunto de (amount) cartas resolve.
  if (hasEngenharia) {
    const totalPower = yellowCards.length * (hasEconomia ? 2 : 1) + materials.length;
    if (totalPower < amount) return null;
    
    // Simplesmente consome o que for necessário, priorizando materiais
    const used: string[] = [];
    let needed = amount;
    for (const m of materials) {
      if (needed <= 0) break;
      used.push(m.id);
      needed--;
    }
    for (const y of yellowCards) {
      if (needed <= 0) break;
      used.push(y.id);
      needed -= (hasEconomia ? 2 : 1);
    }
    return used;
  }

  // Lógica padrão
  const coinValue = hasEconomia ? 2 : 1;
  const totalCoins = yellowCards.length * coinValue;

  if (cost.endsWith("ig")) {
    let best: Card[] = [];
    for (const resource of RES) {
      const matching = materials.filter((c) => c.resource === resource);
      if (matching.length > best.length) best = matching;
      if (matching.length >= amount) return matching.slice(0, amount).map((c) => c.id);
    }
    const missing = amount - best.length;
    if (totalCoins < missing) return null;
    // Retorna os IDs das cartas. Nota: se hasEconomia, uma carta pode cobrir 2 'missing'.
    const usedCoins: string[] = [];
    let covered = 0;
    for (const y of yellowCards) {
      if (covered >= missing) break;
      usedCoins.push(y.id);
      covered += coinValue;
    }
    return [...best.map((c) => c.id), ...usedCoins];
  }
  
  const distinct = RES.map((resource) => materials.find((c) => c.resource === resource))
    .filter((c): c is Card => !!c);
  const missing = amount - distinct.length;
  if (missing > totalCoins) return null;
  
  const usedCoins: string[] = [];
  let covered = 0;
  for (const y of yellowCards) {
    if (covered >= missing) break;
    usedCoins.push(y.id);
    covered += coinValue;
  }
  
  return [...distinct.slice(0, amount).map((c) => c.id), ...usedCoins];
}

export function buildAvailableStage(area: PlayerArea, civId?: string) {
  const civ = civById(civId);
  if (!civ || area.stages >= civ.stages.length) return { area };
  const stage = civ.stages[area.stages]!;
  const tokens = area.progressChosen ?? [];
  const used = resourcesForCost(area.cards, stage.cost, tokens);
  if (!used) return { area };
  const ids = new Set(used);
  return {
    area: { ...area, stages: area.stages + 1, cards: area.cards.filter((c) => !ids.has(c.id)),
      extraPicks: (area.extraPicks ?? 0) + (tokens.includes("arquitetura") ? 1 : 0),
      shields: area.shields + (stage.effect === "+1 escudo" ? 1 : stage.effect === "+2 escudos" ? 2 : 0),
      wonderPoints: (area.wonderPoints ?? civ.stages.slice(0, area.stages).reduce((sum, stage) => sum + stage.points, 0)) + stage.points },
    build: { stage: area.stages + 1, used, points: stage.points, ...(stage.effect ? { effect: stage.effect } : {}) },
  };
}

/** Cada jogador enfrenta apenas seus vizinhos imediatos (esquerda e direita).
 * Em mesas de 2 jogadores, ambos os lados apontam para o mesmo rival: um unico duelo.
 * Resolve o conflito entre vizinhos e descarta soldados com trombeta.
 * Uma vitória contra um vizinho concede uma ficha de vitória de 3 pontos; empate não pontua.
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
    const points = results[id]!.wins * 3;
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

/** Retira exatamente 2 simbolos iguais ou 3 diferentes, sem gastar cartas extras. */
export function scienceCombination(cards: Card[]): string[] | null {
  const sciences = cards.filter((c) => c.cat === "ciencia" && c.science);
  for (const kind of ["astro", "engenho", "escrita"] as const) {
    const pair = sciences.filter((c) => c.science === kind).slice(0, 2);
    if (pair.length === 2) return pair.map((c) => c.id);
  }
  const distinct = (["astro", "engenho", "escrita"] as const)
    .map((kind) => sciences.find((c) => c.science === kind));
  return distinct.every((c) => !!c) ? distinct.map((c) => c!.id) : null;
}

export function claimScienceProgress(area: PlayerArea): { area: PlayerArea; used: string[]; tokenCount: number } | null {
  const cards = [...area.cards];
  const used: string[] = [];
  let count = 0;
  while (true) {
    const combination = scienceCombination(cards);
    if (!combination) break;
    used.push(...combination);
    count++;
    const ids = new Set(combination);
    for (let i = cards.length - 1; i >= 0; i--) if (ids.has(cards[i]!.id)) cards.splice(i, 1);
  }
  if (!used.length) return null;
  const tokenCount = count;
  return { area: { ...area, cards, progressTokens: (area.progressTokens ?? 0) + tokenCount }, used, tokenCount };
}

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
  const tokens = area.progressChosen ?? [];
  const bonus = (tokens.includes("ciencia") && card.cat === "ciencia" ? 1 : 0) +
    (tokens.includes("urbanismo") && card.cat === "recurso" ? 1 : 0) +
    (tokens.includes("manufatura") && card.cat === "recurso" ? 1 : 0) +
    (tokens.includes("joalheria") && (card.cat === "recurso" || card.cat === "comercio") ? 1 : 0) +
    (tokens.includes("propaganda") && card.cat === "militar" && (card.conflict ?? 0) > 0 ? 1 : 0);
  const extraPicks = Math.max(0, (area.extraPicks ?? 0) - (area.extraPickActive ? 1 : 0)) + bonus;
  let newArea: PlayerArea = {
    ...area,
    extraPicks,
    extraPickActive: extraPicks > 0,
    cards: [...area.cards, card],
    shields: area.shields + (card.shields ?? 0),
  };
  const science = claimScienceProgress(newArea);
  if (science) newArea = science.area;
  // A evolução é uma ação explícita do jogador, nunca automática na compra.
  const finished = h.central.length === 0 && h.decks.every((d) => d.length === 0);
  const next: PublicState = {
    ...pub,
    areas: { ...pub.areas, [playerId]: newArea },
    lastBuild: undefined,
    lastScience: science ? { playerId, used: science.used, tokenCount: science.tokenCount } : undefined,
    decks: projectDecks(h),
    central: { count: h.central.length },
    conflictTokens: Math.min(conflictTokenLimit(n), pub.conflictTokens + (card.conflict ?? 0)),
    lastPick: { playerId, source, card: source === "centro" ? null : card },
  };
  const resolved = next.conflictTokens >= conflictTokenLimit(n) ? resolveBattle(next) : next;
  return { pub: resolved, hidden: h, nextSeat: extraPicks > 0 && !finished ? currentSeat : (currentSeat + 1) % n, finished, card };
}

export function scoreBreakdown(area: PlayerArea, civId?: string) {
  const civ = civById(civId);
  const wonder = area.wonderPoints ?? (civ ? civ.stages.slice(0, area.stages).reduce((sum, stage) => sum + stage.points, 0) : 0);
  const culture = area.cards.reduce((sum, card) => sum + (card.cat === "cultura" ? card.points ?? 0 : 0), 0);
  const military = area.battlePoints ?? 0;
  
  // Pontos de fichas de progresso
  const tokens = area.progressChosen ?? [];
  let progress = 0;
  for (const token of tokens) {
    if (token === "decoracao") progress += (area.stages >= 5 ? 6 : 4);
    if (token === "politica") progress += area.cards.filter(c => c.cat === "cultura" && c.mascot).length;
    if (token === "estrategia") progress += (area.battlePoints ?? 0) / 3;
    if (token === "educacao") progress += tokens.length * 2;
  }

  return { wonder, culture, military, progress, total: wonder + culture + military + progress };
}

export function publicPoints(area: PlayerArea, civId?: string): number {
  return scoreBreakdown(area, civId).total;
}
