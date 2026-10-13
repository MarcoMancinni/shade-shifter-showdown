import { describe, it, expect } from "vitest";
import { setupGame, pickCard, RuleError, buildDeck } from "./engine";

const rnd = (m: number) => Math.floor(Math.random() * m);

describe("motor de regras", () => {
  it("cria baralhos sem cartas duplicadas", () => {
    const { hidden } = setupGame(["a", "b", "c"], rnd);
    const ids = [...hidden.decks.flat(), ...hidden.central].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(hidden.decks).toHaveLength(3);
    expect(buildDeck("x")).toHaveLength(24);
  });

  it("recusa jogada fora da vez", () => {
    const { pub, hidden } = setupGame(["a", "b"], rnd);
    const other = pub.seats[1];
    expect(() => pickCard(pub, hidden, other, 0, "esquerda")).toThrow(RuleError);
  });

  it("revela a próxima carta e passa a vez", () => {
    const { pub, hidden } = setupGame(["a", "b", "c"], rnd);
    const p = pub.seats[0];
    const second = hidden.decks[0][1];
    const r = pickCard(pub, hidden, p, 0, "esquerda");
    expect(r.pub.decks[0].top?.id).toBe(second.id);
    expect(r.pub.areas[p].cards).toHaveLength(1);
    expect(r.nextSeat).toBe(1);
  });

  it("não expõe a carta central na jogada pública", () => {
    const { pub, hidden } = setupGame(["a", "b"], rnd);
    const r = pickCard(pub, hidden, pub.seats[0], 0, "centro");
    expect(r.pub.lastPick?.card).toBeNull();
    expect(r.pub.central.count).toBe(hidden.central.length - 1);
  });
});
