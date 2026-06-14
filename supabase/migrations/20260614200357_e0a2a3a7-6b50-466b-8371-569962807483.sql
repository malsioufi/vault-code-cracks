
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS min_players integer,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;

ALTER TABLE public.room_secrets
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.room_participants (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  cracked boolean NOT NULL DEFAULT false,
  finished_at timestamp with time zone,
  gave_up_at timestamp with time zone,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);

GRANT SELECT ON public.room_participants TO authenticated;
GRANT ALL ON public.room_participants TO service_role;

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_room_participant_br(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = _room_id AND user_id = _user_id
  );
$$;

CREATE POLICY "Participants can view BR participants"
  ON public.room_participants FOR SELECT
  TO authenticated
  USING (public.is_room_participant_br(room_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can view room" ON public.rooms;
CREATE POLICY "Participants can view room"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid()
    OR guest_id = auth.uid()
    OR (mode = 'battle_royale' AND public.is_room_participant_br(id, auth.uid()))
  );

CREATE POLICY "BR participants can view shared secret after finish"
  ON public.room_secrets FOR SELECT
  TO authenticated
  USING (
    is_shared = true
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_secrets.room_id
        AND r.status IN ('finished','abandoned')
        AND public.is_room_participant_br(r.id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = _room_id
      AND (host_id = _user_id OR guest_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = _room_id AND user_id = _user_id
  );
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
