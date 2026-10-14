import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CIVILIZATIONS } from "./game/data";
import { setupGame, pickCard, buildAvailableStage, RuleError, type PublicState, type HiddenState } from "./game/engine";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

function randomInt(max: number) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  do crypto.getRandomValues(buf); while (buf[0]! >= limit);
  return buf[0]! % max;
}
function newToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}
function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 5 }, () => A[randomInt(A.length)]).join("");
}

const nick = z.string().trim().min(1, "Informe um apelido").max(20);
const code = z.string().trim().toUpperCase().length(5);
const auth = z.object({ code, playerId: z.string().uuid(), token: z.string().min(32).max(128) });

async function loadRoom(c: string) {
  const db = await admin();
  const { data } = await db.from("rooms").select("*").eq("code", c).maybeSingle();
  return data;
}

async function verify(input: z.infer<typeof auth>) {
  const db = await admin();
  const room = await loadRoom(input.code);
  if (!room) return { error: "Sala não encontrada." } as const;
  const { data: player } = await db.from("room_players").select("*").eq("id", input.playerId).eq("room_id", room.id).maybeSingle();
  if (!player) return { error: "Jogador não encontrado nesta sala." } as const;
  const { data: sec } = await db.from("player_secrets").select("token_hash").eq("player_id", player.id).maybeSingle();
  if (!sec || sec.token_hash !== (await sha256(input.token))) return { error: "Identificação inválida." } as const;
  return { room, player, db } as const;
}

async function addPlayer(roomId: string, nickname: string, seat: number) {
  const db = await admin();
  const { data: p, error } = await db.from("room_players").insert({ room_id: roomId, nickname, seat }).select().single();
  if (error || !p) throw new Error("Não foi possível entrar na sala.");
  const token = newToken();
  await db.from("player_secrets").insert({ player_id: p.id, token_hash: await sha256(token) });
  return { playerId: p.id, token };
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ nickname: nick }).parse(d))
  .handler(async ({ data }): Promise<Ok<{ code: string; playerId: string; token: string }> | Err> => {
    const db = await admin();
    for (let i = 0; i < 5; i++) {
      const c = newCode();
      const { data: room, error } = await db.from("rooms").insert({ code: c }).select().single();
      if (error || !room) continue;
      const { playerId, token } = await addPlayer(room.id, data.nickname, 0);
      await db.from("rooms").update({ host_player_id: playerId }).eq("id", room.id);
      return { ok: true, code: c, playerId, token };
    }
    return { ok: false, error: "Falha ao criar a sala. Tente novamente." };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code, nickname: nick }).parse(d))
  .handler(async ({ data }): Promise<Ok<{ playerId: string; token: string }> | Err> => {
    const room = await loadRoom(data.code);
    if (!room) return { ok: false, error: "Sala não encontrada." };
    if (room.status !== "lobby") return { ok: false, error: "A partida já começou." };
    const db = await admin();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: players } = await db.from("room_players").select("seat").eq("room_id", room.id);
      const used = new Set((players ?? []).map((p) => p.seat));
      if (used.size >= 7) return { ok: false, error: "A sala está cheia (7 jogadores)." };
      let seat = 0; while (used.has(seat)) seat++;
      try { return { ok: true, ...(await addPlayer(room.id, data.nickname, seat)) }; } catch { /* corrida de assento */ }
    }
    return { ok: false, error: "Não foi possível entrar na sala." };
  });

export const verifySession = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.parse(d))
  .handler(async ({ data }) => {
    const v = await verify(data);
    return { valid: !("error" in v) };
  });

export const chooseCiv = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ civId: z.string().nullable() }).parse(d))
  .handler(async ({ data }): Promise<Ok<object> | Err> => {
    const v = await verify(data);
    if ("error" in v) return { ok: false, error: v.error! };
    if (v.room.status !== "lobby") return { ok: false, error: "A partida já começou." };
    if (data.civId && !CIVILIZATIONS.some((c) => c.id === data.civId)) return { ok: false, error: "Civilização inválida." };
    const { error } = await v.db.from("room_players").update({ civ_id: data.civId }).eq("id", v.player.id);
    if (error) return { ok: false, error: "Esta civilização já foi escolhida." };
    return { ok: true };
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.parse(d))
  .handler(async ({ data }): Promise<Ok<object> | Err> => {
    const v = await verify(data);
    if ("error" in v) return { ok: false, error: v.error! };
    if (v.room.host_player_id !== v.player.id) return { ok: false, error: "Apenas o anfitrião pode iniciar." };
    if (v.room.status !== "lobby") return { ok: false, error: "A partida já começou." };
    const { data: players } = await v.db.from("room_players").select("*").eq("room_id", v.room.id);
    const list = players ?? [];
    if (list.length < 2) return { ok: false, error: "São necessários pelo menos 2 jogadores." };
    if (list.some((p) => !p.civ_id)) return { ok: false, error: "Todos precisam escolher uma civilização." };
    const { pub, hidden } = setupGame(list.map((p) => p.id), randomInt, Object.fromEntries(list.map((p) => [p.id, p.civ_id!])));
    // grava assento final conforme a mesa sorteada
    for (const p of list) await v.db.from("room_players").update({ seat: 100 + pub.seats.indexOf(p.id) }).eq("id", p.id);
    for (const p of list) await v.db.from("room_players").update({ seat: pub.seats.indexOf(p.id) }).eq("id", p.id);
    const { data: ok } = await v.db.rpc("commit_room_state", {
      _room_id: v.room.id, _expected_version: v.room.version, _status: "playing", _current_seat: 0, _turn_number: 1,
      _public_state: pub as never, _hidden_state: hidden as never,
      _events: [{ type: "inicio", payload: { seats: pub.seats } }] as never,
    });
    if (!ok) return { ok: false, error: "A sala mudou. Tente novamente." };
    return { ok: true };
  });

export const takeCard = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ source: z.enum(["esquerda", "direita", "centro"]), turn: z.number().int() }).parse(d))
  .handler(async ({ data }): Promise<Ok<object> | Err> => {
    const v = await verify(data);
    if ("error" in v) return { ok: false, error: v.error! };
    const room = v.room;
    if (room.status !== "playing") return { ok: false, error: "A partida não está em andamento." };
    if (room.turn_number !== data.turn) return { ok: false, error: "Jogada já processada." };
    const { data: sec } = await v.db.from("room_secrets").select("hidden_state").eq("room_id", room.id).single();
    try {
      const r = pickCard(room.public_state as unknown as PublicState, sec!.hidden_state as unknown as HiddenState,
        v.player.id, room.current_seat, data.source);
      const { data: ok } = await v.db.rpc("commit_room_state", {
        _room_id: room.id, _expected_version: room.version, _status: r.finished ? "finished" : "playing",
        _current_seat: r.nextSeat, _turn_number: room.turn_number + 1,
        _public_state: r.pub as never, _hidden_state: r.hidden as never,
        _events: [
          { type: "carta", payload: { playerId: v.player.id, source: data.source, card: r.card } },
          ...(r.pub.lastScience ? [{ type: "ciencia", payload: r.pub.lastScience }] : []),
          ...(r.pub.lastBuild ? [{ type: "construcao", payload: r.pub.lastBuild }] : []),
        ] as never,
      });
      if (!ok) return { ok: false, error: "Jogada já processada." };
      return { ok: true };
    } catch (e) {
      if (e instanceof RuleError) return { ok: false, error: e.message };
      throw e;
    }
  });

/** Informação privada do jogador (ex.: dono do mascote vê o topo central — Fase 2). */
export const getPrivateView = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.parse(d))
  .handler(async ({ data }) => {
    const v = await verify(data);
    if ("error" in v) return { centralTop: null };
    return { centralTop: null as null };
  });

/** Evolução explícita da maravilha, validada e persistida no servidor. */
export const evolveWonder = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ version: z.number().int() }).parse(d))
  .handler(async ({ data }): Promise<Ok<{ stage: number }> | Err> => {
    const v = await verify(data);
    if ("error" in v) return { ok: false, error: v.error! };
    const room = v.room;
    if (room.status !== "playing") return { ok: false, error: "A partida não está em andamento." };
    if (room.version !== data.version) return { ok: false, error: "A partida mudou. Tente novamente." };
    const pub = room.public_state as unknown as PublicState;
    const area = pub.areas[v.player.id];
    if (!area) return { ok: false, error: "Jogador não encontrado na partida." };
    if (area.stages >= 5) return { ok: false, error: "Maravilha já concluída." };
    const result = buildAvailableStage(area, pub.civIds?.[v.player.id] ?? v.player.civ_id ?? undefined);
    if (!result.build) return { ok: false, error: "Recursos insuficientes para evoluir." };
    const next: PublicState = {
      ...pub,
      areas: { ...pub.areas, [v.player.id]: result.area },
      lastBuild: { playerId: v.player.id, ...result.build },
    };
    const { data: sec, error: secretError } = await v.db.from("room_secrets")
      .select("hidden_state").eq("room_id", room.id).single();
    if (secretError || !sec) return { ok: false, error: "Não foi possível carregar a partida." };
    const { data: ok, error } = await v.db.rpc("commit_room_state", {
      _room_id: room.id, _expected_version: room.version,
      _status: result.area.stages >= 5 ? "finished" : "playing",
      _current_seat: room.current_seat, _turn_number: room.turn_number,
      _public_state: next as never, _hidden_state: sec.hidden_state as never,
      _events: [{ type: "construcao", payload: next.lastBuild }] as never,
    });
    if (error || !ok) return { ok: false, error: "A partida mudou. Tente novamente." };
    return { ok: true, stage: result.area.stages };
  });

/** Reabre a mesma sala para uma nova partida, somente pelo anfitriao. */
export const returnToLobby = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ version: z.number().int() }).parse(d))
  .handler(async ({ data }): Promise<Ok<object> | Err> => {
    const v = await verify(data);
    if ("error" in v) return { ok: false, error: v.error! };
    if (v.room.host_player_id !== v.player.id) return { ok: false, error: "Apenas o anfitrião pode reabrir a sala." };
    if (v.room.status !== "finished") return { ok: false, error: "A partida ainda não terminou." };
    if (v.room.version !== data.version) return { ok: false, error: "A sala mudou. Atualize e tente novamente." };
    const { data: sec, error: secretError } = await v.db.from("room_secrets")
      .select("hidden_state").eq("room_id", v.room.id).single();
    if (secretError || !sec) return { ok: false, error: "Não foi possível recuperar a sala." };
    const { data: ok, error } = await v.db.rpc("commit_room_state", {
      _room_id: v.room.id, _expected_version: v.room.version, _status: "lobby",
      _current_seat: 0, _turn_number: 1,
      _public_state: v.room.public_state as never, _hidden_state: sec.hidden_state as never,
      _events: [{ type: "retorno_lobby", payload: { playerId: v.player.id } }] as never,
    });
    if (error || !ok) return { ok: false, error: "Não foi possível reabrir a sala." };
    return { ok: true };
  });
