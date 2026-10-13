import { motion, useReducedMotion } from "framer-motion";
import type { Civilization } from "@/lib/game/data";

/** Monumento 2.5D progressivo. As cinco etapas refletem apenas o estado do servidor. */
export function Wonder({ civ, built, size = "md" }: { civ: Civilization; built: number; size?: "sm" | "md" }) {
  const compact = size === "sm";
  const reducedMotion = useReducedMotion();
  const completed = Math.max(0, Math.min(civ.stages.length, built));
  const kind = civ.id;
  return (
    <div
      className={`wonder-scene wonder-${kind} ${compact ? "wonder-small" : "wonder-medium"}`}
      style={{ "--wonder-hue": civ.hue } as React.CSSProperties}
      role="img"
      aria-label={`${civ.wonder}: ${completed} de ${civ.stages.length} etapas construídas`}
      title={`${civ.wonder} — ${completed}/${civ.stages.length} etapas`}
    >
      <div className="wonder-aura" aria-hidden="true" />
      <div className="wonder-ground" aria-hidden="true" />
      <div className="wonder-architecture" aria-hidden="true">
        {civ.stages.map((stage, i) => {
          const done = i < completed;
          return (
            <motion.div
              key={i}
              className={`wonder-tier wonder-tier-${i + 1} ${done ? "wonder-tier-built" : "wonder-tier-pending"}`}
              initial={false}
              animate={{ opacity: done ? 1 : 0.19, y: done ? 0 : 5, scale: done ? 1 : 0.93 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 18 }}
              title={`Etapa ${i + 1}: ${stage.points} pontos${stage.effect ? ` — ${stage.effect}` : ""}`}
            >
              <span className="wonder-tier-face" />
              <span className="wonder-tier-roof" />
              <span className="wonder-tier-ornament" />
            </motion.div>
          );
        })}
      </div>
      <div className="wonder-foundation" aria-hidden="true" />
      <div className="wonder-progress" aria-hidden="true">
        {civ.stages.map((_, i) => <span key={i} className={i < completed ? "is-built" : ""} />)}
      </div>
    </div>
  );
}
