# Relay Race Mode — Plan

Two teams (A & B) race to crack each other's secret. One randomly-picked teammate per team sets the team's code; teammates rotate as the active guesser each turn with a 30s timer.

## User flow

1. **Online page**: New "Relay Race" card next to Battle Royale. Create dialog: code length, allow duplicates, max tries (or infinite), min players per team (default 2, cap 4 per team = 8 total).
2. **Lobby**: Share room code. Each joiner picks Team A or Team B (switchable until start). Host sees Start button (enabled when each team has ≥ min players).
3. **Setting phase**: Server randomly picks one player per team as "code setter". That player sees a secret-input pad with a 60s deadline. Their teammates see "Waiting for {name} to set Team X's code"; once submitted teammates can view the code. Opposing team sees only "Team X is setting their code". If the setter's deadline expires without submission, server re-picks another random teammate (excluding those who already failed); repeats until someone submits or no candidates left (then room abandoned). When both teams submitted → status flips to `playing`.
4. **Playing phase**: Server rotates active guesser per team in a fixed order. Only the current active player on the team whose turn it is can submit. After a guess, that team's rotation index advances and `team_turn` flips. 30s timer per turn — on expiry, auto-pass (no guess recorded). Each team sees their own full feedback; opponent side shows only "Guesses: N".
5. **End**: First team to score `matches === code_length` wins. Reveal panel shows both secrets + both teams' guess histories side by side.

## Data model

- `room_mode` enum: add `relay_race`.
- `rooms`: add `team_turn text` ('A'|'B'), `turn_deadline timestamptz`, `winner_team text`.
- New `room_teams` table: `(room_id, team text, secret int[], setter_id uuid, setter_deadline timestamptz, failed_setters uuid[], active_user_id uuid, rotation uuid[], rotation_index int, guesses_count int default 0)`, PK (room_id, team).
- `room_participants`: add nullable `team text` (only set for relay).
- `guesses`: add nullable `team text` for relay grouping.
- RLS: a team's `secret` only visible to that team's members after their setter submits (or game finished) — via security-definer RPC `get_relay_secret_for_me`; never SELECT-able by opposing team. `guesses` SELECT policy: own team or finished room.
- Realtime: add `room_teams` to publication.

## Edge functions

- `create-room`: accept `mode='relay_race'` + `minPlayersPerTeam`.
- `join-room`: relay branch — insert participant if waiting & total <8.
- New `pick-team`: caller sets their own `team` while `status='waiting'`. Cap 4 per team.
- New `start-relay`: host only. Each team must have ≥ min. Randomly pick one setter per team. Build shuffled rotation. Insert `room_teams` rows with `setter_deadline=now()+60s`. Set `status='setting_secrets'`.
- New `set-relay-secret`: caller must be `setter_id` for their team; validate; store secret. If both teams done → `status='playing'`, `team_turn='A'`, set `active_user_id` per team to rotation[0], `turn_deadline=now()+30s`.
- New `relay-resetter`: any teammate may call when `now() > setter_deadline` and that team's secret still null. Server validates expiry, appends old setter to `failed_setters`, picks a new random setter from remaining teammates, resets `setter_deadline`. If no candidates left → room `abandoned`.
- `submit-guess`: relay branch. Verify caller is `active_user_id` on the team whose `team_turn` it is. Evaluate vs opposing team's secret. Insert guess with `team`. Win → finish with `winner_team`, `winner_id=caller`. Else increment `guesses_count`, advance rotation_index, flip `team_turn`, reset `turn_deadline`. Max-tries hit → team eliminated; both eliminated → finish, no winner.
- New `relay-pass-turn`: any participant can call when `now() > turn_deadline`; server validates expiry and advances/flips.
- `reveal-secrets`: extend to return both team secrets once finished.

## Frontend

- `src/pages/Online.tsx`: add Relay Race entry + create dialog.
- `src/pages/Room.tsx` + `useRoom`: detect relay; subscribe to `room_teams`; fetch own team secret via RPC.
- New `RelayLobby.tsx`: two team columns with chips, "Join Team A/B" buttons, host Start.
- New `RelaySetting.tsx`: setter view (input + countdown); teammate waiting view (reveals code once submitted, "Re-pick setter" button after expiry); opposing team sees "Team X choosing…".
- New `RelayBoard.tsx`: own team panel (full history, active player highlight, guess pad if I'm active), opponent panel (guess count + turn indicator), 30s countdown.
- New `RelayResults.tsx`: winning team banner, both secrets, side-by-side guess columns per team.
- Client-side timers; any teammate triggers `relay-pass-turn` / `relay-resetter` once expired (server idempotent).
- i18n keys EN + AR.

## Technical notes

- Secrets server-only until reveal; teammate visibility through authenticated RPC.
- Reuse `evaluateGuess`.
- Migration order: enum value → columns/tables → GRANTs → RLS → publication.
- Existing 1v1 / Battle Royale flows untouched.

Confirm and I'll build it.
