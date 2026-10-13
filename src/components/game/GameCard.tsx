import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Mountain, Layers, TreePine, Gem, Coins, Landmark, Cat, Orbit, Cog, ScrollText, Shield, Swords, HelpCircle } from "lucide-react";
import type { Card } from "@/lib/game/data";
import { CATEGORY_LABEL, RESOURCE_LABEL, SCIENCE_LABEL } from "@/lib/game/data";
import { cn } from "@/lib/utils";

const CAT_BG: Record<Card["cat"], string> = {
  recurso: "bg-cat-recurso", comercio: "bg-cat-comercio", cultura: "bg-cat-cultura", ciencia: "bg-cat-ciencia", militar: "bg-cat-militar",
};

export function CardIcon({ card, className }: { card: Card; className?: string }) {
  const c = cn("size-7", className);
  if (card.cat === "recurso") {
    if (card.resource === "pedra") return <Mountain className={c} />;
    if (card.resource === "argila") return <Layers className={c} />;
    if (card.resource === "madeira" || card.resource === "vidro") return <TreePine className={c} />;
    return <Gem className={c} />;
  }
  if (card.cat === "comercio") return <Coins className={c} />;
  if (card.cat === "cultura") return card.mascot ? <Cat className={c} /> : <Landmark className={c} />;
  if (card.cat === "ciencia") return card.science === "astro" ? <Orbit className={c} /> : card.science === "engenho" ? <Cog className={c} /> : <ScrollText className={c} />;
  return card.conflict ? <Swords className={c} /> : <Shield className={c} />;
}

export function cardTitle(card: Card) {
  if (card.cat === "recurso") return RESOURCE_LABEL[card.resource!];
  if (card.cat === "comercio") return "Moeda";
  if (card.cat === "cultura") return `${card.points} pontos${card.mascot ? " · Mascote" : ""}`;
  if (card.cat === "ciencia") return SCIENCE_LABEL[card.science!];
  return `${card.shields} escudo${(card.shields ?? 0) > 1 ? "s" : ""}${card.conflict ? ` · ${card.conflict} ⚔` : ""}`;
}

export function GameCard({ card, size = "md", hidden }: { card: Card | null; size?: "sm" | "md" | "lg"; hidden?: boolean }) {
  const dims = size === "lg" ? "w-36 h-52" : size === "md" ? "w-24 h-36" : "w-10 h-14";
  if (!card || hidden) {
    return (
      <div className={cn(dims, "relative flex items-center justify-center rounded-lg border-2 border-bronze bg-wood shadow-card")}>
        <div className="absolute inset-1.5 rounded-md border border-gold/40" />
        <HelpCircle className={size === "sm" ? "size-4 text-gold/70" : "size-10 text-gold/70"} />
      </div>
    );
  }
  // Recursos ilustrados usam suas artes próprias, com alternativa caso a imagem falhe.
  if (card.cat === "recurso" && (card.resource === "pedra" || card.resource === "argila" || card.resource === "madeira")) {
    return <IllustratedResourceCard size={size} resource={card.resource} title={cardTitle(card)} />;
  }
  if (size === "sm") {
    return (
      <div title={cardTitle(card)} className={cn(dims, CAT_BG[card.cat], "flex items-center justify-center rounded-md border border-background/40 text-background shadow-card")}>
        <CardIcon card={card} className="size-5" />
      </div>
    );
  }
  return (
    <div className={cn(dims, "relative flex flex-col overflow-hidden rounded-lg border-2 border-gold/60 bg-card shadow-card")}>
      <div className={cn(CAT_BG[card.cat], "px-2 py-1 text-center font-display text-[10px] font-bold uppercase tracking-widest text-background")}>
        {CATEGORY_LABEL[card.cat]}
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className={cn(CAT_BG[card.cat], "flex items-center justify-center rounded-full p-3 text-background", size === "lg" && "p-5")}>
          <CardIcon card={card} className={size === "lg" ? "size-12" : "size-8"} />
        </div>
      </div>
      <div className="px-1 pb-2 text-center text-xs font-medium text-foreground">{cardTitle(card)}</div>
    </div>
  );
}

function IllustratedResourceCard({ size, title, resource }: { size: "sm" | "md" | "lg"; title: string; resource: "pedra" | "argila" | "madeira" | "vidro" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, below: false });
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dims = size === "lg" ? "w-36 h-52" : size === "md" ? "w-24 h-36" : "w-10 h-14";

  const showPreview = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const previewWidth = size === "sm" ? 112 : size === "lg" ? 210 : 165;
    const previewHeight = previewWidth * (3 / 2);
    const left = Math.max(8, Math.min(window.innerWidth - previewWidth - 8, rect.left + rect.width / 2 - previewWidth / 2));
    const below = rect.top < previewHeight + 12;
    const top = below ? Math.min(window.innerHeight - previewHeight - 8, rect.bottom + 8) : rect.top - previewHeight - 8;
    setPosition({ left, top, below });
    setPreviewOpen(true);
  };

  const clearLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  useEffect(() => {
    if (!previewOpen) return;
    const close = () => setPreviewOpen(false);
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [previewOpen]);

  useEffect(() => () => clearLongPress(), []);

  if (imageFailed) {
    return (
      <div title={title} className={cn(dims, "flex items-center justify-center rounded-md border border-gold/60 bg-cat-recurso text-background shadow-card")}>
        {resource === "pedra" ? <Mountain className={size === "sm" ? "size-5" : "size-8"} /> : <Layers className={size === "sm" ? "size-5" : "size-8"} />}
      </div>
    );
  }

  return (
    <div
      className={cn(dims, "relative overflow-hidden rounded-md shadow-card cursor-zoom-in")}
      onMouseEnter={(event) => showPreview(event.currentTarget)}
      onMouseLeave={() => setPreviewOpen(false)}
      onTouchStart={(event) => {
        const element = event.currentTarget;
        clearLongPress();
        longPress.current = setTimeout(() => showPreview(element), 450);
      }}
      onTouchEnd={() => { clearLongPress(); setPreviewOpen(false); }}
      onTouchCancel={() => { clearLongPress(); setPreviewOpen(false); }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img
        src={`/cartas/${resource}.webp`}
        alt={`Carta de recurso ${title}`}
        className="h-full w-full object-fill"
        loading="lazy"
        onError={() => setImageFailed(true)}
        draggable={false}
      />
      {previewOpen && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] overflow-hidden rounded-lg border border-amber-400/70 shadow-[0_10px_30px_rgba(0,0,0,0.65)]"
          style={{ left: position.left, top: position.top, width: size === "sm" ? 112 : size === "lg" ? 210 : 165, aspectRatio: "2 / 3" }}
          aria-hidden="true"
        >
          <img src={`/cartas/${resource}.webp`} alt="" className="h-full w-full object-fill" />
        </div>,
        document.body
      )}
    </div>
  );
}
