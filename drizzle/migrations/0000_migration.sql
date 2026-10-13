CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  host_player_id uuid,
  current_seat int NOT NULL DEFAULT 0,
  turn_number int NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 0,
  public_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms public read" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  seat int NOT NULL,
  civ_id text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat)
);
CREATE UNIQUE INDEX room_players_civ_unique ON public.room_players(room_id, civ_id) WHERE civ_id IS NOT NULL;
GRANT SELECT ON public.room_players TO anon, authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players public read" ON public.room_players FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.player_secrets (
  player_id uuid PRIMARY KEY REFERENCES public.room_players(id) ON DELETE CASCADE,
  token_hash text NOT NULL
);
GRANT ALL ON public.player_secrets TO service_role;
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  hidden_state jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.room_secrets TO service_role;
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_events (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  turn_number int NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_events_room_idx ON public.game_events(room_id, id);
GRANT SELECT ON public.game_events TO anon, authenticated;
GRANT ALL ON public.game_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.game_events_id_seq TO service_role;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.game_events FOR SELECT TO anon, authenticated USING (true);

-- Atomic, version-checked state commit (server only)
CREATE OR REPLACE FUNCTION public.commit_room_state(
  _room_id uuid, _expected_version int, _status text, _current_seat int, _turn_number int,
  _public_state jsonb, _hidden_state jsonb, _events jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; ev jsonb;
BEGIN
  UPDATE public.rooms SET status=_status, current_seat=_current_seat, turn_number=_turn_number,
    public_state=_public_state, version=version+1, updated_at=now()
  WHERE id=_room_id AND version=_expected_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  IF _hidden_state IS NOT NULL THEN
    INSERT INTO public.room_secrets(room_id, hidden_state) VALUES (_room_id, _hidden_state)
    ON CONFLICT (room_id) DO UPDATE SET hidden_state = EXCLUDED.hidden_state;
  END IF;
  FOR ev IN SELECT * FROM jsonb_array_elements(coalesce(_events,'[]'::jsonb)) LOOP
    INSERT INTO public.game_events(room_id, turn_number, type, payload)
    VALUES (_room_id, _turn_number, ev->>'type', coalesce(ev->'payload','{}'::jsonb));
  END LOOP;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.commit_room_state(uuid,int,text,int,int,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_room_state(uuid,int,text,int,int,jsonb,jsonb,jsonb) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;