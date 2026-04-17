-- =======================
-- ENUMS
-- =======================
CREATE TYPE public.room_status AS ENUM ('waiting', 'setting_secrets', 'playing', 'finished', 'abandoned');
CREATE TYPE public.room_mode AS ENUM ('turn_based', 'simultaneous');

-- =======================
-- updated_at helper
-- =======================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =======================
-- PROFILES
-- =======================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Vault Breaker',
  is_guest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup (including anonymous)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      'Breaker_' || substr(NEW.id::text, 1, 6)
    ),
    COALESCE((NEW.raw_user_meta_data->>'is_guest')::boolean, NEW.is_anonymous, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =======================
-- ROOMS
-- =======================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.room_status NOT NULL DEFAULT 'waiting',
  mode public.room_mode NOT NULL DEFAULT 'turn_based',
  code_length INT NOT NULL DEFAULT 4 CHECK (code_length BETWEEN 3 AND 6),
  allow_duplicates BOOLEAN NOT NULL DEFAULT false,
  max_tries INT,
  current_turn UUID,
  turn_started_at TIMESTAMPTZ,
  winner_id UUID,
  is_quick_match BOOLEAN NOT NULL DEFAULT false,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_code ON public.rooms(code);
CREATE INDEX idx_rooms_host ON public.rooms(host_id);
CREATE INDEX idx_rooms_guest ON public.rooms(guest_id);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Helper: is participant
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = _room_id
      AND (host_id = _user_id OR guest_id = _user_id)
  );
$$;

CREATE POLICY "Participants can view room"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (host_id = auth.uid() OR guest_id = auth.uid());

-- No client INSERT/UPDATE/DELETE — only edge functions (service role) mutate

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =======================
-- ROOM SECRETS
-- =======================
CREATE TABLE public.room_secrets (
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret INT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, player_id)
);

ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

-- Each player can only read their OWN secret — never the opponent's
CREATE POLICY "Players can view own secret"
  ON public.room_secrets FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

-- No client mutations — set-secret edge function handles writes

-- =======================
-- GUESSES
-- =======================
CREATE TABLE public.guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guess INT[] NOT NULL,
  matches INT NOT NULL,
  shifts INT NOT NULL,
  glitches INT NOT NULL,
  round_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guesses_room ON public.guesses(room_id, created_at);

ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view guesses"
  ON public.guesses FOR SELECT
  TO authenticated
  USING (public.is_room_participant(room_id, auth.uid()));

-- No client INSERT — submit-guess edge function handles it

-- =======================
-- MATCHMAKING QUEUE
-- =======================
CREATE TABLE public.matchmaking_queue (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_length INT NOT NULL,
  allow_duplicates BOOLEAN NOT NULL,
  max_tries INT,
  mode public.room_mode NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_joined ON public.matchmaking_queue(joined_at);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own queue entry select"
  ON public.matchmaking_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users manage own queue entry insert"
  ON public.matchmaking_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own queue entry delete"
  ON public.matchmaking_queue FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =======================
-- PRESENCE
-- =======================
CREATE TABLE public.presence (
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX idx_presence_room ON public.presence(room_id);

ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view presence"
  ON public.presence FOR SELECT
  TO authenticated
  USING (public.is_room_participant(room_id, auth.uid()));

CREATE POLICY "Players can upsert own presence"
  ON public.presence FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid() AND public.is_room_participant(room_id, auth.uid()));

CREATE POLICY "Players can update own presence"
  ON public.presence FOR UPDATE
  TO authenticated
  USING (player_id = auth.uid());

-- =======================
-- REALTIME
-- =======================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.guesses REPLICA IDENTITY FULL;
ALTER TABLE public.presence REPLICA IDENTITY FULL;