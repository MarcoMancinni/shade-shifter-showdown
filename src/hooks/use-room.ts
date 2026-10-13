import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
export type PlayerRow = Database["public"]["Tables"]["room_players"]["Row"];

/** Estado público da sala, sincronizado em tempo real. */
export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: r } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
    setRoom(r);
    if (r) {
      const { data: p } = await supabase.from("room_players").select("*").eq("room_id", r.id).order("seat");
      setPlayers(p ?? []);
    }
    setLoading(false);
  }, [code]);

  useEffect(() => { void refresh(); }, [refresh]);

  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`sala-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (p) => {
        if (p.new && "id" in p.new) setRoom(p.new as RoomRow);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, () => { void refresh(); })
      .subscribe();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); };
  }, [roomId, refresh]);

  return { room, players, loading, refresh };
}
