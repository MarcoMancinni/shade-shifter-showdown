import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
export type PlayerRow = Database["public"]["Tables"]["room_players"]["Row"];

/** Estado público da sala, sincronizado em tempo real. */
export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    if (!navigator.onLine) { setConnection("disconnected"); setLoading(false); return; }
    const { data: r, error } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
    if (sequence !== request.current) return;
    if (error) { setConnection("disconnected"); setLoading(false); return; }
    if (r) {
      const { data: p, error: playerError } = await supabase.from("room_players").select("*").eq("room_id", r.id).order("seat");
      if (sequence !== request.current) return;
      if (playerError) { setConnection("disconnected"); setLoading(false); return; }
      setPlayers(p ?? []);
      setRoom((previous) => previous?.id === r.id && previous.version > r.version ? previous : r);
    } else { setRoom(null); setPlayers([]); }
    setConnection("connected"); setLoading(false);
  }, [code]);

  useEffect(() => {
    setRoom(null); setPlayers([]); setLoading(true); setConnection("connecting");
    void refresh();
    const sync = () => { if (document.visibilityState === "visible") void refresh(); };
    const offline = () => { ++request.current; setConnection("disconnected"); };
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", sync);
    // Recover even when a realtime channel missed an update or was suspended.
    const poll = window.setInterval(sync, 15000);
    return () => {
      ++request.current; clearInterval(poll);
      window.removeEventListener("focus", sync); window.removeEventListener("online", sync);
      window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", sync);
    };
  }, [refresh]);

  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`sala-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (p) => {
        if (p.new && "id" in p.new) {
          const next = p.new as RoomRow;
          setRoom((previous) => previous?.id === next.id && previous.version > next.version ? previous : next);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, () => { void refresh(); })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("disconnected");
      });
    return () => { void supabase.removeChannel(ch); };
  }, [roomId, refresh]);

  return { room, players, loading, refresh, connection };
}
