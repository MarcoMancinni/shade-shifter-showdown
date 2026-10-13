import type { Civilization } from "@/lib/game/data";
import { cn } from "@/lib/utils";

/** Maravilha em 2.5D: cinco camadas empilhadas de baixo para cima. */
export function Wonder({ civ, built, size = "md" }: { civ: Civilization; built: number; size?: "sm" | "md" }) {
  const w = size === "sm" ? 64 : 140;
  return (
    <div className="flex flex-col-reverse items-center" style={{ width: w }} aria-label={`${civ.wonder}: ${built} de 5 etapas`}>
      {civ.stages.map((s, i) => {
        const done = i < built;
        const width = w * (1 - i * 0.15);
        return (
          <div key={i} title={`Etapa ${i + 1}: ${s.points} pts${s.effect ? ` · ${s.effect}` : ""}`}
            className={cn("relative border transition-all", done ? "border-gold glow-gold" : "border-dashed border-muted-foreground/40")}
            style={{
              width, height: size === "sm" ? 8 : 18,
              background: done ? `linear-gradient(180deg, oklch(0.8 0.12 ${civ.hue}), oklch(0.5 0.1 ${civ.hue}))` : "oklch(0.3 0.01 60 / 0.4)",
              transform: "perspective(200px) rotateX(20deg)",
            }} />
        );
      })}
    </div>
  );
}
