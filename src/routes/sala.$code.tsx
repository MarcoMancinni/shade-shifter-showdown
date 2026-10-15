import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { joinRoom, verifySession } from "@/lib/game.functions";
import { loadSession, saveSession, clearSession, type Session } from "@/lib/session";
import { useRoom } from "@/hooks/use-room";
import { Lobby } from "@/components/game/Lobby";
import { GameTable } from "@/components/game/GameTable";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sala/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Sala ${params.code} — Impérios: A Era das Maravilhas` },
      { name: "description", content: "Você foi convidado para uma partida de Impérios. Escolha sua civilização e entre na mesa." },
      { property: "og:title", content: `Convite para a sala ${params.code} — Impérios` },
      { property: "og:description", content: "Entre na partida, escolha sua civilização e construa sua maravilha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const code = Route.useParams().code.toUpperCase();
  const { room, players, loading, connection, refresh } = useRoom(code);
  const online = useOnline();
  const verify = useServerFn(verifySession);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecked(false); setSession(null);
    const s = loadSession(code);
    if (!s) { setChecked(true); return; }
    verify({ data: { code, ...s } })
      .then((r) => { if (cancelled) return; if (r.valid) setSession(s); else clearSession(code); })
      .catch(() => { if (!cancelled) setSession(s); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [code, verify]);

  if (loading || !checked) return <Center><p className="font-display text-xl text-gold animate-pulse">Abrindo os portões…</p></Center>;
  if (!room && (!online || connection === "disconnected")) return <Center><h1 className="text-2xl text-gold">Não foi possível conectar</h1><p className="mt-3 text-muted-foreground">É preciso estar conectado para abrir sua sala. Sua identificação foi preservada.</p><Button className="mt-6" disabled={!online} onClick={() => void refresh()}>Tentar novamente</Button></Center>;
  if (!room) return (
    <Center>
      <h1 className="text-3xl text-gold">Sala não encontrada</h1>
      <Link to="/" className="btn-gold mt-6 inline-block px-6 py-2">Voltar ao início</Link>
    </Center>
  );
  if (!session) {
    if (room.status !== "lobby") return (
      <Center>
        <h1 className="text-3xl text-gold">Partida em andamento</h1>
        <p className="mt-2 text-muted-foreground">Esta sala já começou e não aceita novos jogadores.</p>
        <Link to="/" className="btn-gold mt-6 inline-block px-6 py-2">Voltar ao início</Link>
      </Center>
    );
    return <JoinForm code={code} onJoined={setSession} />;
  }
  const connected = online && connection === "connected";
  return <>
    {online && !connected && <div className="pwa-connection" role="alert">Reconectando à sala… As ações estão pausadas.</div>}
    {room.status === "lobby" ? <Lobby room={room} players={players} session={session} code={code} connected={connected} /> : <GameTable room={room} players={players} session={session} code={code} connected={connected} />}
  </>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">{children}</main>;
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (s: Session) => void }) {
  const join = useServerFn(joinRoom);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  return (
    <Center>
      <p className="font-display text-sm uppercase tracking-[0.4em] text-gold">Convite</p>
      <h1 className="mt-2 text-4xl text-gold-grad">Sala {code}</h1>
      <form className="panel-stone mt-8 flex w-full max-w-sm flex-col gap-3 p-6" onSubmit={async (e) => {
        e.preventDefault(); if (busy || !online) return; setBusy(true); setError(null);
        try {
          const r = await join({ data: { code, nickname } });
          if (!r.ok) { setError(r.error); return; }
          const s = { playerId: r.playerId, token: r.token };
          saveSession(code, s); onJoined(s);
        } catch { setError("Não foi possível entrar."); } finally { setBusy(false); }
      }}>
        <label htmlFor="nick" className="text-left text-sm text-muted-foreground">Seu apelido</label>
        <input id="nick" autoFocus maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)}
          className="rounded-md border border-input bg-background/60 px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
        <Button disabled={!online || busy || !nickname.trim()} className="btn-gold py-3">{busy ? "Entrando…" : "Entrar na mesa"}</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Center>
  );
}
