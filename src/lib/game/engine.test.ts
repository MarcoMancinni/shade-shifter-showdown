import { describe, it, expect } from "vitest";
import { setupGame, pickCard, RuleError, buildDeck, resourcesForCost, buildAvailableStage, scienceCombination, claimScienceProgress } from "./engine";

const rnd = (m: number) => Math.floor(Math.random() * m);

describe("motor de regras", () => {
  it("cria baralhos sem cartas duplicadas", () => {
    const { hidden } = setupGame(["a", "b", "c"], rnd);
    const ids = [...hidden.decks.flat(), ...hidden.central].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(hidden.decks).toHaveLength(3);
    expect(buildDeck("x")).toHaveLength(24);
    expect(buildDeck("x").filter((c) => c.resource === "vidro")).toHaveLength(2);
  });

  it("recusa jogada fora da vez", () => {
    const { pub, hidden } = setupGame(["a", "b"], rnd);
    const other = pub.seats[1]!;
    expect(() => pickCard(pub, hidden, other, 0, "esquerda")).toThrow(RuleError);
  });

  it("revela a próxima carta e passa a vez", () => {
    const { pub, hidden } = setupGame(["a", "b", "c"], rnd);
    const p = pub.seats[0]!;
    const second = hidden.decks[0]![1]!;
    const r = pickCard(pub, hidden, p, 0, "esquerda");
    expect(r.pub.decks[0]!.top?.id).toBe(second.id);
    expect(r.pub.areas[p]!.cards).toHaveLength(1);
    expect(r.nextSeat).toBe(1);
  });

  it("não expõe a carta central na jogada pública", () => {
    const { pub, hidden } = setupGame(["a", "b"], rnd);
    const r = pickCard(pub, hidden, pub.seats[0]!, 0, "centro");
    expect(r.pub.lastPick?.card).toBeNull();
    expect(r.pub.central.count).toBe(hidden.central.length - 1);
  });
});

describe("construção automática", () => {
  const r = (id: string, resource: "pedra" | "argila" | "madeira" | "vidro") => ({ id, cat: "recurso" as const, resource });
  it("consome dois recursos diferentes na etapa inicial", () => {
    const area = { cards: [r("p", "pedra"), r("v", "vidro")], stages: 0, shields: 0 };
    const result = buildAvailableStage(area, "aurelia");
    expect(result.area.stages).toBe(1);
    expect(result.area.cards).toHaveLength(0);
    expect(area.stages).toBe(0);
  });
  it("requer iguais na segunda etapa", () => {
    expect(resourcesForCost([r("p", "pedra"), r("v", "vidro")], "2ig")).toBeNull();
    expect(resourcesForCost([r("a", "vidro"), r("b", "vidro")], "2ig")).toEqual(["a", "b"]);
  });
  it("requer quatro recursos diferentes no quinto estágio", () => {
    const area = { cards: [r("p", "pedra"), r("a", "argila"), r("m", "madeira"), r("v", "vidro")], stages: 4, shields: 0 };
    expect(buildAvailableStage(area, "vaelis").area.stages).toBe(5);
  });
  it("aplica o escudo de Draknor", () => {
    const area = { cards: [r("p", "pedra"), r("v", "vidro")], stages: 0, shields: 0 };
    expect(buildAvailableStage(area, "draknor").area.shields).toBe(1);
  });
  const coin = (id: string) => ({ id, cat: "comercio" as const });
  it("usa uma moeda para completar dois recursos diferentes", () => {
    const area = { cards: [r("p", "pedra"), coin("c")], stages: 0, shields: 0 };
    const result = buildAvailableStage(area, "aurelia");
    expect(result.area.stages).toBe(1);
    expect(result.build?.used).toEqual(["p", "c"]);
    expect(result.area.cards).toHaveLength(0);
  });
  it("usa uma moeda para completar dois recursos iguais", () => {
    expect(resourcesForCost([r("p", "pedra"), coin("c")], "2ig")).toEqual(["p", "c"]);
  });
  it("duas moedas podem completar requisito de dois materiais", () => {
    expect(resourcesForCost([coin("c1"), coin("c2")], "2dif")).toEqual(["c1", "c2"]);
  });
  it("moeda nao e consumida quando materiais ja sao suficientes", () => {
    expect(resourcesForCost([r("p", "pedra"), r("v", "vidro"), coin("c")], "2dif")).toEqual(["p", "v"]);
  });
  it("moedas insuficientes nao liberam construcao", () => {
    expect(resourcesForCost([r("p", "pedra"), coin("c")], "3dif")).toBeNull();
  });

});

describe("cartas verdes e fichas de progresso", () => {
  const green = (id: string, science: "astro" | "engenho" | "escrita") =>
    ({ id, cat: "ciencia" as const, science });
  it("troca duas cartas iguais por uma ficha", () => {
    const cards = [green("a", "astro"), green("b", "astro"), green("c", "escrita")];
    expect(scienceCombination(cards)).toEqual(["a", "b"]);
    const r = claimScienceProgress({ cards, stages: 0, shields: 0 });
    expect(r?.tokenCount).toBe(1);
    expect(r?.area.progressTokens).toBe(1);
    expect(r?.area.cards.map((c) => c.id)).toEqual(["c"]);
  });
  it("troca tres simbolos diferentes por uma ficha", () => {
    const cards = [green("a", "astro"), green("b", "engenho"), green("c", "escrita")];
    expect(claimScienceProgress({ cards, stages: 0, shields: 0 })?.tokenCount).toBe(1);
  });
  it("nao concede ficha para combinacao incompleta", () => {
    const cards = [green("a", "astro"), green("b", "escrita")];
    expect(claimScienceProgress({ cards, stages: 0, shields: 0 })).toBeNull();
  });
  it("mantem fichas anteriores e resolve varias combinacoes", () => {
    const cards = [green("a", "astro"), green("b", "astro"), green("c", "engenho"), green("d", "engenho")];
    const r = claimScienceProgress({ cards, stages: 0, shields: 0, progressTokens: 2 });
    expect(r?.tokenCount).toBe(2);
    expect(r?.area.progressTokens).toBe(4);
    expect(r?.area.cards).toHaveLength(0);
  });
});
