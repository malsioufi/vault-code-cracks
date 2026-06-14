# Battle Royale Mode — Plan

A new multiplayer mode where 2+ players race to crack the same server-generated secret. Each player guesses independently; first to crack wins; others can keep going until they exhaust max tries or give up.

## User flow

1. **Online page**: New "Battle Royale" option alongside Quick Match / Create Room / Join.
2. **Host setup**: Choose code length (3–6), allow duplicates, max tries (required, 6–20), min players to start (default 2, cap 8).
3. **Lobby**: Share room code; participant list updates live; host sees "Start" button (enabled when ≥ min players).
4. **Game start**: Server generates the single secret. Status flips to `playing`. No secret-setting step.
5. **In-game**: Each player has their own guess pad + history. A sidebar shows every opponent with their guess count and status (still in / cracked / out / gave up) — never their guesses or feedback.
6. **End**: First crack ends the round (winner announced); or all players out → no winner. Reveal panel shows the secret and a side-by-side column per player with their full guess history.

## Data model changes

- `rooms.mode` enum: add `battle_royale`.
- `rooms`: add `min_players int`, `started_at timestamptz`.
- New table `room_participants`: `room_id`, `user_id`, `joined_at`, `gave_up_at` nullable, `finished_at` nullable, `cracked boolean default false`, PK (room_id, user_id).
- `room_secrets`: add `is_shared boolean default false`. For BR, one shared row keyed by host_id + is_shared=true.
- `guesses`: unchanged.
- RLS: participants can read `room_participants` for rooms they're in; shared `room_secrets` row only readable after status IN ('finished','abandoned').
- Realtime: add `room_participants` to `supabase_realtime` publication.

## Edge functions

- `create-room`: accept `mode='battle_royale'` + `min_players`. Insert host into `room_participants`.
- `join-room`: if BR and `status='waiting'`, insert into `room_participants` (no guest_id, no status change). Block once started or at cap.
- New `start-battle-royale`: host-only; requires participant count ≥ min_players. Generates secret server-side, inserts shared `room_secrets` row, sets `status='playing'`, `started_at=now()`.
- `submit-guess`: branch on `room.mode`. For BR: verify caller is active (not cracked/out/gave up); evaluate vs shared secret; insert guess; if win → mark cracked, set room winner + status='finished'; if hits max_tries → mark out. If all participants out → finish with winner_id=null.
- New `give-up-battle-royale`: marks caller gave_up_at=now(); if all out → finish with no winner.
- `reveal-secrets`: extend to return shared secret for BR rooms once finished.

## Frontend

- `src/pages/Online.tsx`: add Battle Royale entry + create dialog (length, duplicates, max_tries, min_players).
- `src/pages/Room.tsx` + `useRoom`: detect BR mode; load + subscribe to `room_participants`. Compute per-player guess counts from `guesses`.
- New `src/components/game/BattleRoyaleLobby.tsx`: participant list, share code, host Start button.
- New `src/components/game/BattleRoyaleBoard.tsx`: own guess pad/history; opponents sidebar (name • guess count / max • status badge). "Give up" button.
- New `src/components/game/BattleRoyaleResults.tsx`: winner banner, revealed secret, horizontal scroll of per-player guess columns.
- i18n keys for all new strings (EN + AR).

## Technical notes

- Server-side game logic only — never expose secret until room finished.
- Reuse `evaluateGuess` in `supabase/functions/_shared/game.ts`.
- Migration order: enum value add → table/column changes → GRANTs → RLS policies → publication.
- 1v1 turn_based/simultaneous flows untouched.

## Open questions

1. Per-player turn timer, or fully self-paced? (Plan: self-paced.)
2. Opponent view shows only "guess N of M" + status — no matches/shifts/glitches leakage. OK?

Confirm and I'll build it.