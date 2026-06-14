
-- rooms additions
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS team_turn text,
  ADD COLUMN IF NOT EXISTS turn_deadline timestamp with time zone,
  ADD COLUMN IF NOT EXISTS winner_team text;

-- room_participants: team marker
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS team text;

-- guesses: team marker
ALTER TABLE public.guesses
  ADD COLUMN IF NOT EXISTS team text;

-- room_teams table
CREATE TABLE IF NOT EXISTS public.room_teams (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  team text NOT NULL CHECK (team IN ('A','B')),
  setter_id uuid REFERENCES auth.users(id),
  setter_deadline timestamp with time zone,
  failed_setters uuid[] NOT NULL DEFAULT '{}',
  active_user_id uuid,
  rotation uuid[] NOT NULL DEFAULT '{}',
  rotation_index integer NOT NULL DEFAULT 0,
  guesses_count integer NOT NULL DEFAULT 0,
  secret_set boolean NOT NULL DEFAULT false,
  PRIMARY KEY (room_id, team)
);
CREATE INDEX IF NOT EXISTS idx_room_teams_room ON public.room_teams(room_id);

GRANT SELECT ON public.room_teams TO authenticated;
GRANT ALL ON public.room_teams TO service_role;

ALTER TABLE public.room_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view team state"
  ON public.room_teams FOR SELECT
  TO authenticated
  USING (public.is_room_participant_br(room_id, auth.uid()));

-- rooms SELECT policy: allow relay participants too
DROP POLICY IF EXISTS "Participants can view room" ON public.rooms;
CREATE POLICY "Participants can view room"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid()
    OR guest_id = auth.uid()
    OR (mode IN ('battle_royale','relay_race') AND public.is_room_participant_br(id, auth.uid()))
  );

-- room_secrets: relay team members can see their team's secret (while game active)
CREATE POLICY "Relay teammates can view team secret"
  ON public.room_secrets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.room_teams rt
      JOIN public.room_participants me
        ON me.room_id = rt.room_id AND me.user_id = auth.uid() AND me.team = rt.team
      WHERE rt.room_id = room_secrets.room_id
        AND rt.setter_id = room_secrets.player_id
    )
  );

-- room_secrets: after a relay room finishes, both teams can see both secrets
CREATE POLICY "Relay participants can view both secrets after finish"
  ON public.room_secrets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_secrets.room_id
        AND r.mode = 'relay_race'
        AND r.status IN ('finished','abandoned')
        AND public.is_room_participant_br(r.id, auth.uid())
    )
  );

-- guesses: restrict relay guesses to own team while playing; everyone sees after finish
DROP POLICY IF EXISTS "Participants can view guesses" ON public.guesses;
CREATE POLICY "Participants can view guesses"
  ON public.guesses FOR SELECT
  TO authenticated
  USING (
    public.is_room_participant(room_id, auth.uid())
    AND (
      -- non-relay rooms: full visibility
      NOT EXISTS (
        SELECT 1 FROM public.rooms r
        WHERE r.id = guesses.room_id AND r.mode = 'relay_race'
      )
      OR
      -- relay finished: everyone can view
      EXISTS (
        SELECT 1 FROM public.rooms r
        WHERE r.id = guesses.room_id
          AND r.mode = 'relay_race'
          AND r.status IN ('finished','abandoned')
      )
      OR
      -- relay active: only own-team guesses
      EXISTS (
        SELECT 1 FROM public.room_participants me
        WHERE me.room_id = guesses.room_id
          AND me.user_id = auth.uid()
          AND me.team IS NOT NULL
          AND me.team = guesses.team
      )
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_teams;
ALTER TABLE public.room_teams REPLICA IDENTITY FULL;
