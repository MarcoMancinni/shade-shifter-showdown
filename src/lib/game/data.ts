// Dados estáticos do jogo (seguros para o navegador).

export type Resource = "pedra" | "argila" | "madeira";
export type Science = "astro" | "engenho" | "escrita";
export type Category = "recurso" | "comercio" | "cultura" | "ciencia" | "militar";

export interface Card {
  id: string;
  cat: Category;
  resource?: Resource;
  points?: number;
  mascot?: boolean;
  science?: Science;
  shields?: number;
  conflict?: number; // símbolos de preparação de conflito
}

export type CostKind = "2dif" | "2ig" | "3dif" | "3ig" | "4dif";

export interface WonderStage {
  cost: CostKind;
  points: number;
  effect?: string | undefined;
}

export interface Civilization {
  id: string;
  name: string;
  wonder: string;
  style: string;
  ability: string;
  hue: number; // matiz para a identidade visual
  stages: WonderStage[];
}

export const COST_LABEL: Record<CostKind, string> = {
  "2dif": "2 recursos diferentes",
  "2ig": "2 recursos iguais",
  "3dif": "3 recursos diferentes",
  "3ig": "3 recursos iguais",
  "4dif": "4 recursos diferentes",
};

const base: CostKind[] = ["2dif", "2ig", "3dif", "3ig", "4dif"];
const mk = (pts: number[], fx: (string | undefined)[]): WonderStage[] =>
  base.map((cost, i) => ({ cost, points: pts[i]!, effect: fx[i] }));

export const CIVILIZATIONS: Civilization[] = [
  {
    id: "aurelia", name: "Aurélia", wonder: "Colosso do Sol Nascente", style: "Bronze helênico",
    ability: "Compra uma carta adicional de um baralho lateral.", hue: 70,
    stages: mk([3, 3, 4, 5, 7], [undefined, "Carta extra lateral", undefined, "Carta extra lateral", undefined]),
  },
  {
    id: "nihara", name: "Nihara", wonder: "Biblioteca das Areias", style: "Arenito do deserto",
    ability: "Examina as 4 primeiras cartas do centro e escolhe uma.", hue: 55,
    stages: mk([3, 3, 4, 5, 6], [undefined, "Examinar e escolher", undefined, "Examinar e escolher", undefined]),
  },
  {
    id: "thalassa", name: "Thalassa", wonder: "Farol das Marés", style: "Mármore marítimo",
    ability: "Compra uma carta adicional do baralho central.", hue: 210,
    stages: mk([3, 3, 4, 5, 6], [undefined, "Carta extra central", "Carta extra central", undefined, undefined]),
  },
  {
    id: "karvath", name: "Karvath", wonder: "Portões Gêmeos", style: "Basalto das estepes",
    ability: "Compra uma carta de cada baralho lateral.", hue: 20,
    stages: mk([3, 3, 4, 4, 6], [undefined, undefined, "Cartas dos dois lados", undefined, "Cartas dos dois lados"]),
  },
  {
    id: "ereshkal", name: "Ereshkal", wonder: "Zigurate das Estrelas", style: "Tijolo mesopotâmico",
    ability: "Escolhe uma ficha de progresso.", hue: 35,
    stages: mk([3, 3, 4, 5, 6], [undefined, "Ficha de progresso", undefined, "Ficha de progresso", undefined]),
  },
  {
    id: "draknor", name: "Draknor", wonder: "Fortaleza de Ferro", style: "Granito nórdico",
    ability: "Recebe escudos permanentes.", hue: 0,
    stages: mk([3, 4, 4, 5, 6], ["+1 escudo", undefined, "+2 escudos", undefined, undefined]),
  },
  {
    id: "vaelis", name: "Vaelis", wonder: "Jardins Suspensos de Vaelis", style: "Jade e terraços",
    ability: "Sem habilidade: maior potencial de pontos.", hue: 150,
    stages: mk([3, 4, 5, 6, 8], [undefined, undefined, undefined, undefined, undefined]),
  },
];

export const civById = (id: string | null | undefined) => CIVILIZATIONS.find((c) => c.id === id);

export const RESOURCE_LABEL: Record<Resource, string> = { pedra: "Pedra", argila: "Argila", madeira: "Madeira" };
export const SCIENCE_LABEL: Record<Science, string> = { astro: "Astrolábio", engenho: "Engrenagem", escrita: "Tábua" };
export const CATEGORY_LABEL: Record<Category, string> = {
  recurso: "Recurso", comercio: "Comércio", cultura: "Cultura", ciencia: "Ciência", militar: "Militar",
};
