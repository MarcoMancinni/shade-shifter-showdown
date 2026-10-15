import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import hero from "@/assets/hero.jpg";
import { createRoom } from "@/lib/game.functions";
import { saveSession } from "@/lib/session";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Impérios: A Era das Maravilhas — Jogue online" },
      { name: "description", content: "Crie uma partida, convide amigos por link e construa sua maravilha. 2 a 7 jogadores, sem cadastro." },
      { property: "og:title", content: "Impérios: A Era das Maravilhas" },
      { property: "og:description", content: "Jogo de tabuleiro online de civilizações e maravilhas, direto no navegador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const [mode, setMode] = useState<"menu" | "criar" | "entrar">("menu");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !online) return;
    setBusy(true); setError(null);
    try {
      const r = await create({ data: { nickname } });
      if (!r.ok) { setError(r.error); return; }
      saveSession(r.code, { playerId: r.playerId, token: r.token });
      navigate({ to: "/sala/$code", params: { code: r.code } });
    } catch { setError("Não foi possível criar a partida."); } finally { setBusy(false); }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <img src={hero} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/40 to-background" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-display text-sm uppercase tracking-[0.4em] text-gold">
          Um jogo de civilizações
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-3 text-5xl font-black text-gold-grad drop-shadow md:text-7xl">
          Impérios
        </motion.h1>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-2 text-xl text-foreground md:text-2xl">
          A Era das Maravilhas
        </motion.h2>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="panel-stone mt-10 w-full max-w-sm p-6">
          {mode === "menu" && (
            <div className="flex flex-col gap-3">
              <button className="btn-gold py-3 text-lg" onClick={() => setMode("criar")}>Criar partida</button>
              <button className="btn-bronze py-3" onClick={() => setMode("entrar")}>Entrar com código</button>
              <p className="mt-2 text-sm text-muted-foreground">2 a 7 jogadores · sem cadastro</p>
            </div>
          )}
          {mode === "criar" && (
            <form onSubmit={onCreate} className="flex flex-col gap-3">
              <label className="text-left text-sm text-muted-foreground" htmlFor="nick">Seu apelido</label>
              <input id="nick" autoFocus maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)}
                className="rounded-md border border-input bg-background/60 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring" />
              <Button disabled={!online || busy || !nickname.trim()} className="btn-gold py-3">{busy ? "Criando…" : "Fundar império"}</Button>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("menu")}>Voltar</button>
            </form>
          )}
          {mode === "entrar" && (
            <form onSubmit={(e) => { e.preventDefault(); if (code.trim().length === 5) navigate({ to: "/sala/$code", params: { code: code.trim().toUpperCase() } }); }} className="flex flex-col gap-3">
              <label className="text-left text-sm text-muted-foreground" htmlFor="code">Código da sala</label>
              <input id="code" autoFocus maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="rounded-md border border-input bg-background/60 px-3 py-2 text-center font-display text-2xl tracking-[0.4em] text-foreground outline-none focus:ring-2 focus:ring-ring" />
              <button disabled={code.trim().length !== 5} className="btn-gold py-3">Continuar</button>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("menu")}>Voltar</button>
            </form>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </motion.div>
      </div>
    </main>
  );
}
