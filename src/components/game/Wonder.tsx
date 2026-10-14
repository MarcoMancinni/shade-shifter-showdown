import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Civilization } from "@/lib/game/data";

/** Monumento 2.5D progressivo. As cinco etapas refletem apenas o estado do servidor. */
export function Wonder({ civ, built, size = "md" }: { civ: Civilization; built: number; size?: "sm" | "md" }) {
  const compact = size === "sm";
  const reducedMotion = useReducedMotion();
  const completed = Math.max(0, Math.min(civ.stages.length, built));
  const kind = civ.id;
  const [assetFailed, setAssetFailed] = useState(false);
  const previousStage = useRef(completed);
  const [celebration, setCelebration] = useState<number | null>(null);
  useEffect(() => {
    const previous = previousStage.current;
    previousStage.current = completed;
    if (completed <= previous || reducedMotion) return;
    setCelebration(completed);
    const timer = window.setTimeout(() => setCelebration(null), 1700);
    return () => window.clearTimeout(timer);
  }, [completed, reducedMotion]);
  const useAureliaImage = kind === "aurelia" && !assetFailed;
  const aureliaSrc = `/aurelia/etapa-${completed}.webp`;
  useEffect(() => { setAssetFailed(false); }, [aureliaSrc]);
  return (
    <div
      className={`wonder-scene wonder-${kind} ${compact ? "wonder-small" : "wonder-medium"} ${completed === civ.stages.length ? "wonder-complete" : ""}`}
      style={{ "--wonder-hue": civ.hue } as React.CSSProperties}
      role="img"
      aria-label={`${civ.wonder}: ${completed} de ${civ.stages.length} etapas construídas`}
      title={`${civ.wonder} — ${completed}/${civ.stages.length} etapas`}
    >
      <div className="wonder-aura" aria-hidden="true" />
      {useAureliaImage ? (
        <AnimatePresence initial={false} mode="sync">
          <motion.img
            className="wonder-artwork"
            key={aureliaSrc}
            src={aureliaSrc}
            alt=""
            draggable={false}
            onError={() => setAssetFailed(true)}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.94, y: 12, filter: "brightness(1.7) blur(5px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "brightness(1) blur(0px)" }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "brightness(1.4) blur(3px)" }}
            transition={{ duration: reducedMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>
      ) : (
        <MonumentSilhouette civId={civ.id} built={completed} />
      )}
      <AnimatePresence>
        {celebration !== null && (
          <motion.div
            key={celebration}
            className="wonder-construction-effect"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: [0, 0.9, 0.5, 0], scale: [0.65, 1, 1.12, 1.25] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, times: [0, 0.25, 0.65, 1] }}
          >
            <span className="wonder-construction-rays" />
            <span className="wonder-construction-dust" />
          </motion.div>
        )}
      </AnimatePresence>
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

/** Architectural identity rendered as vector scenery; not a generic stacked building. */
function MonumentSilhouette({ civId, built }: { civId: string; built: number }) {
  const opacity = (stage: number) => built >= stage ? 1 : 0.13;
  const stone = "#c5a676";
  const gold = "#f6d28a";
  const dark = "#5e4536";
  const shapes: Record<string, React.ReactNode> = {
    aurelia: <>
      <g opacity={opacity(1)}><path d="M20 112H180V123H20Z" fill={dark}/><path d="M30 103H170V112H30Z" fill={stone}/></g>
      <g opacity={opacity(2)}><path d="M64 98V48L76 38 88 48V98M112 98V48L124 38 136 48V98" fill={stone} stroke={gold} strokeWidth="2"/></g>
      <g opacity={opacity(3)}><path d="M76 68L100 43 124 68 115 72 100 57 85 72Z" fill={gold}/><path d="M95 44V27H105V44" fill={stone}/></g>
      <g opacity={opacity(4)}><circle cx="100" cy="21" r="16" fill={gold}/><path d="M100 0V-7M80 5L74 0M120 5L126 0" stroke={gold} strokeWidth="4"/></g>
      <g opacity={opacity(5)}><path d="M96 16L90 29 100 34 110 29 104 16" fill="#fff0bd"/></g>
    </>,
    nihara: <>
      <g opacity={opacity(1)}><path d="M10 109H190V124H10Z" fill={dark}/><path d="M20 100H180V110H20Z" fill={stone}/></g>
      <g opacity={opacity(2)}><path d="M30 60H170V100H30Z" fill={stone}/><path d="M43 68H157V99H43Z" fill={dark}/></g>
      <g opacity={opacity(3)}>{[49,76,103,130].map(x=><g key={x}><rect x={x} y="62" width="9" height="37" fill={gold}/><path d={`M${x-3} 62h15v5h-15z`} fill={stone}/></g>)}</g>
      <g opacity={opacity(4)}><path d="M25 60L100 25 175 60Z" fill={stone} stroke={gold} strokeWidth="3"/><path d="M83 45H117V60H83Z" fill={dark}/></g>
      <g opacity={opacity(5)}><circle cx="100" cy="19" r="9" fill={gold}/><path d="M100 4V0M85 12L80 8M115 12L120 8" stroke={gold} strokeWidth="2"/></g>
    </>,
    thalassa: <>
      <g opacity={opacity(1)}><path d="M25 111Q100 95 175 111V124H25Z" fill={dark}/></g>
      <g opacity={opacity(2)}><path d="M76 107L85 67H115L124 107Z" fill={stone} stroke={gold} strokeWidth="2"/></g>
      <g opacity={opacity(3)}><path d="M83 68L89 35H111L117 68Z" fill={stone}/><path d="M91 57H109V67H91Z" fill={dark}/></g>
      <g opacity={opacity(4)}><path d="M85 35V25H115V35Z" fill={gold}/><path d="M90 25L100 12 110 25Z" fill={stone}/></g>
      <g opacity={opacity(5)}><circle cx="100" cy="10" r="8" fill="#c9f4ff"/><path d="M100 -8V-1M80 10H89M111 10H120" stroke="#c9f4ff" strokeWidth="3"/></g>
    </>,
    karvath: <>
      <g opacity={opacity(1)}><path d="M12 111H188V124H12Z" fill={dark}/></g>
      <g opacity={opacity(2)}><path d="M25 55H72V111H25ZM128 55H175V111H128Z" fill={stone}/></g>
      <g opacity={opacity(3)}><path d="M32 55V37H43V55M54 55V37H65V55M135 55V37H146V55M157 55V37H168V55" fill={gold}/></g>
      <g opacity={opacity(4)}><path d="M72 111V73Q100 41 128 73V111H114V80Q100 65 86 80V111Z" fill={gold}/></g>
      <g opacity={opacity(5)}><path d="M90 45L100 20 110 45Z" fill={gold}/><circle cx="100" cy="18" r="5" fill="#fff2b9"/></g>
    </>,
    ereshkal: <>
      <g opacity={opacity(1)}><path d="M13 104H187V123H13Z" fill={dark}/></g>
      <g opacity={opacity(2)}><path d="M29 83H171V105H29Z" fill={stone}/></g>
      <g opacity={opacity(3)}><path d="M46 60H154V84H46Z" fill={stone}/></g>
      <g opacity={opacity(4)}><path d="M65 38H135V61H65Z" fill={gold}/><path d="M84 23H116V39H84Z" fill={stone}/></g>
      <g opacity={opacity(5)}><path d="M100 5L104 16 116 16 107 23 111 34 100 27 89 34 93 23 84 16 96 16Z" fill={gold}/></g>
    </>,
    draknor: <>
      <g opacity={opacity(1)}><path d="M14 109H186V124H14Z" fill={dark}/></g>
      <g opacity={opacity(2)}><path d="M26 58H174V110H26Z" fill="#8e9298"/></g>
      <g opacity={opacity(3)}><path d="M26 58V30H49V58M151 58V30H174V58" fill="#aeb4b9"/><path d="M33 30V19H43V30M158 30V19H168V30" fill={gold}/></g>
      <g opacity={opacity(4)}><path d="M78 110V75Q100 48 122 75V110Z" fill={dark} stroke={gold} strokeWidth="3"/></g>
      <g opacity={opacity(5)}><path d="M90 45L100 25 110 45Z" fill={gold}/><path d="M88 50H112" stroke={gold} strokeWidth="3"/></g>
    </>,
    vaelis: <>
      <g opacity={opacity(1)}><path d="M12 109H188V123H12Z" fill={dark}/></g>
      <g opacity={opacity(2)}><path d="M26 90H174V110H26Z" fill="#62855d"/></g>
      <g opacity={opacity(3)}><path d="M44 68H156V91H44Z" fill="#91aa73"/><path d="M55 89Q60 108 67 89M140 89Q146 109 152 89" fill="none" stroke="#6aa86d" strokeWidth="5"/></g>
      <g opacity={opacity(4)}><path d="M66 47H134V69H66Z" fill="#a6bb83"/><path d="M79 47V28H121V47" fill="#d1c38d"/></g>
      <g opacity={opacity(5)}><path d="M100 30V6M100 19Q76 0 70 16Q85 29 100 19M100 14Q124 -2 130 13Q115 27 100 14" fill="#7fb87a" stroke="#648c55" strokeWidth="2"/></g>
    </>,
  };
  return (
    <svg className="wonder-identity" viewBox="0 -10 200 145" aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="123" rx="91" ry="11" fill="#100e0b" opacity=".7" />
      {shapes[civId] ?? shapes["aurelia"]}
    </svg>
  );
}
