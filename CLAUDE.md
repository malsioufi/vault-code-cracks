# CLAUDE.md — Vault Code Cracks

> A comprehensive guide for AI assistants working on this codebase.

## Project Overview

**Vault Breaker** (repo: `vault-code-cracks`) is a hacking-themed code-breaking logic game where players deduce a secret numerical code — similar to Mastermind/Bulls & Cows. It features solo play (vs AI), real-time online multiplayer, a daily puzzle, achievements, stats tracking, and i18n (English / Arabic with RTL).

Originally scaffolded with [Lovable](https://lovable.dev), the app is a fully self-hostable **Vite + React + TypeScript SPA** backed by **Supabase** (Postgres, Auth, Realtime, Edge Functions).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 (SPA, no SSR) |
| Build | Vite 5 with `@vitejs/plugin-react-swc` |
| Language | TypeScript 5 (strict mode OFF — `noImplicitAny: false`, `strictNullChecks: false`) |
| Styling | Tailwind CSS 3 + `tailwindcss-animate` + CSS variables (HSL design tokens) |
| UI Library | shadcn/ui (Radix primitives, `components.json` config) |
| Routing | React Router v6 (client-side, hash-less) |
| State / Data | TanStack React Query v5 + Supabase Realtime subscriptions |
| Backend | Supabase (Postgres 15, GoTrue Auth, Edge Functions on Deno) |
| Testing | Vitest + jsdom + @testing-library/react |
| Fonts | Inter (sans), JetBrains Mono (mono) — loaded via Google Fonts |
| i18n | Custom context-based system (no library) — EN + AR |
| Package Manager | npm (also has `bun.lock` / `bun.lockb`) |

---

## Repository Structure

```
vault-code-cracks/
├── index.html                  # Vite HTML entry
├── package.json
├── vite.config.ts              # Vite config (SWC, path aliases, Lovable tagger)
├── vitest.config.ts            # Test config (jsdom, globals)
├── tailwind.config.ts          # Tailwind theme + custom keyframes
├── tsconfig.json               # TS project references
├── tsconfig.app.json           # App TS config (strict OFF)
├── eslint.config.js            # Flat ESLint config
├── components.json             # shadcn/ui configuration
├── .env                        # VITE_SUPABASE_URL, _PUBLISHABLE_KEY, _PROJECT_ID
├── SELF_HOSTING.md             # Comprehensive self-hosting guide
│
├── src/
│   ├── main.tsx                # React root (createRoot)
│   ├── App.tsx                 # Routes + providers (QueryClient, Tooltip, Language, Toast)
│   ├── index.css               # Tailwind base + CSS variables (dark theme) + utilities
│   ├── App.css                 # Minimal app-level styles
│   ├── vite-env.d.ts
│   │
│   ├── pages/                  # Route-level components (10 pages)
│   │   ├── Index.tsx           # Landing / main menu → "/"
│   │   ├── Auth.tsx            # Sign-in / sign-up / guest → "/auth"
│   │   ├── ResetPassword.tsx   # Password reset → "/reset-password"
│   │   ├── Solo.tsx            # Solo vs AI game → "/solo"
│   │   ├── Online.tsx          # Room creation / join / quick match → "/online"
│   │   ├── Room.tsx            # Active multiplayer room → "/room/:code"
│   │   ├── Daily.tsx           # Daily puzzle → "/daily"
│   │   ├── Stats.tsx           # Player statistics → "/stats"
│   │   ├── Achievements.tsx    # Achievement gallery → "/achievements"
│   │   └── NotFound.tsx        # 404 → "*"
│   │
│   ├── components/
│   │   ├── ui/                 # 49 shadcn/ui primitives (do NOT hand-edit unless customizing)
│   │   ├── game/               # Game-specific components
│   │   │   ├── MainMenu.tsx    # Landing page menu with mode selection
│   │   │   ├── GameBoard.tsx   # Core game UI (digit input, guess submit, feedback)
│   │   │   ├── DigitInput.tsx  # Individual digit input component
│   │   │   ├── GuessHistory.tsx# Scrollable guess log with color-coded feedback
│   │   │   ├── DailyLeaderboard.tsx  # Today's top solvers
│   │   │   └── AchievementsCard.tsx  # Achievement display card with progress
│   │   ├── MatrixRain.tsx      # Decorative background animation (canvas-based)
│   │   ├── NavLink.tsx         # Navigation link component
│   │   └── PageHeader.tsx      # Shared page header with back navigation
│   │
│   ├── game/                   # Pure game logic (no React, no side effects)
│   │   ├── engine.ts           # Core: generateSecret(), evaluateGuess(), getDigitStatuses(), AI strategies
│   │   ├── difficulty.ts       # Difficulty scoring and tier classification
│   │   ├── dailyPuzzle.ts      # Deterministic daily puzzle (seeded PRNG, Europe/Berlin timezone)
│   │   ├── achievements.ts     # 24 achievements with progress tracking
│   │   └── __tests__/          # Unit tests for engine and dailyPuzzle
│   │
│   ├── hooks/                  # React hooks
│   │   ├── useAuth.ts          # Supabase auth (session, profile, signIn/Up/Out, guest)
│   │   ├── useRoom.ts          # Room state + Realtime subscriptions + rematch handling
│   │   ├── usePresence.ts      # Player presence heartbeat
│   │   ├── useDailyPuzzle.ts   # Daily puzzle state management
│   │   ├── useAchievements.ts  # Achievement unlock tracking
│   │   ├── useAchievementsContext.ts  # Achievement context provider
│   │   ├── use-mobile.tsx      # Responsive breakpoint detection
│   │   └── use-toast.ts        # Toast notification hook
│   │
│   ├── i18n/                   # Internationalization
│   │   ├── translations.ts     # EN + AR translation dictionaries (typed keys)
│   │   ├── LanguageContext.tsx  # React context provider (lang, setLang, t(), dir)
│   │   └── useLanguage.ts      # Convenience hook for language context
│   │
│   ├── integrations/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Supabase client (reads from VITE_* env vars)
│   │   │   └── types.ts        # Auto-generated TypeScript types for DB schema
│   │   └── lovable/
│   │       └── index.ts        # Lovable cloud auth (can be removed for self-hosting)
│   │
│   ├── lib/
│   │   ├── utils.ts            # cn() — clsx + tailwind-merge
│   │   └── shareBadge.ts       # Canvas-based achievement badge image generator
│   │
│   └── test/
│       ├── setup.ts            # Vitest setup (jest-dom matchers, matchMedia mock)
│       └── example.test.ts     # Smoke test
│
├── supabase/
│   ├── config.toml             # Supabase CLI project config
│   ├── migrations/             # 5 SQL migration files (schema + RLS + triggers)
│   └── functions/              # 9 Edge Functions + shared utilities
│       ├── _shared/
│       │   ├── auth.ts         # serviceClient(), getUserFromRequest()
│       │   ├── cors.ts         # CORS headers, json() response helper
│       │   └── game.ts         # Server-side evaluateGuess(), generateRoomCode(), validateDigits()
│       ├── create-room/        # Create a private room
│       ├── join-room/          # Join by room code
│       ├── quick-match/        # Matchmaking queue
│       ├── rematch/            # Rematch proposal/accept
│       ├── set-secret/         # Lock player's secret code
│       ├── submit-guess/       # Submit guess + evaluate + check win/loss
│       ├── reveal-secrets/     # Reveal both secrets after game ends
│       ├── heartbeat/          # Presence heartbeat
│       └── forfeit/            # Forfeit match
│
└── public/
    ├── favicon.ico
    ├── placeholder.svg
    └── robots.txt
```

---

## Key Commands

```bash
# Install dependencies
npm install

# Development server (port 8080)
npm run dev

# Production build → dist/
npm run build

# Lint
npm run lint

# Run tests (single run)
npm test

# Run tests (watch mode)
npm run test:watch
```

---

## Environment Variables

The app reads three `VITE_`-prefixed variables from `.env`:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project reference ID |

These are baked into the frontend at build time. The `.env` file is **not** gitignored by default — consider adding it for forks.

---

## Architecture & Design Patterns

### Frontend

- **Routing**: React Router v6 with flat route definitions in `App.tsx`. No nested layouts.
- **State Management**: Local React state (`useState`) for UI; TanStack Query for server data; Supabase Realtime subscriptions for live updates in rooms.
- **Auth Flow**: Supabase GoTrue. Supports email/password, Google OAuth, and anonymous (guest) sign-in. The `useAuth` hook manages session state and profile fetching.
- **i18n**: Simple context-based system — no third-party library. Language context wraps the app; `t('key')` returns the localized string. Arabic mode sets `dir="rtl"`.
- **Component Library**: shadcn/ui components live in `src/components/ui/`. They are copy-pasted primitives — edit them only when customizing behavior.
- **Path Aliases**: `@/` maps to `src/` (configured in `tsconfig.json` and `vite.config.ts`).

### Backend (Supabase)

- **Edge Functions**: Written in TypeScript for Deno. Each function follows the same pattern:
  1. Handle CORS preflight
  2. Authenticate via `getUserFromRequest()`
  3. Validate input
  4. Perform DB operations via `serviceClient()` (service role — bypasses RLS)
  5. Return JSON response
- **Row Level Security (RLS)**: Enabled on all tables. Clients can only SELECT data they're authorized to see. All mutations go through Edge Functions.
- **Realtime**: Tables `rooms`, `guesses`, and `presence` are added to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`.
- **Triggers**: `handle_new_user()` auto-creates a `profiles` row on user signup. `update_updated_at_column()` auto-updates timestamps.

### Game Logic

The game engine (`src/game/engine.ts`) is pure, stateless, and fully testable:

- **Feedback**: `evaluateGuess()` returns `{matches, shifts, glitches}` — green (right digit right position), yellow (right digit wrong position), red (digit not present).
- **AI Strategies**: Easy (random), Medium (constraint-consistent random), Hard (optimal first guess + constraint-consistent).
- **Daily Puzzle**: Deterministic via seeded PRNG (`mulberry32`). Same puzzle worldwide per Europe/Berlin date. Parameters: code length 3–6, ±duplicates, scaled max tries.
- **Achievements**: 24 achievements across 4 rarity tiers (common, rare, epic, legendary). Progress is computed from an `UnlockContext` containing match history and streaks.
- **Server-side validation**: The `submit-guess` Edge Function re-evaluates guesses server-side. Never trust client computations for multiplayer.

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User display names, guest flag |
| `rooms` | Multiplayer game rooms (code, status, settings, winner) |
| `room_secrets` | Per-player secret codes (RLS: own secret only) |
| `guesses` | Guess history with server-computed feedback |
| `matchmaking_queue` | Quick match queue entries |
| `presence` | Player heartbeat / disconnect tracking |
| `daily_results` | Daily puzzle results + leaderboard |

### Enums

- `room_status`: `waiting` → `setting_secrets` → `playing` → `finished` | `abandoned`
- `room_mode`: `turn_based` | `simultaneous`

### Key Functions (Postgres)

- `handle_new_user()` — trigger on `auth.users` INSERT
- `is_room_participant(room_id, user_id)` — RLS helper
- `get_daily_streak(user_id)` — streak calculation
- `get_daily_leaderboard(date)` — daily rankings

---

## Coding Conventions

### TypeScript

- **Strict mode is OFF** — `noImplicitAny: false`, `strictNullChecks: false`, `strict: false`. Code commonly uses `!` non-null assertions and implicit `any`.
- Interfaces preferred over type aliases for object shapes.
- Unused variable warnings disabled (`@typescript-eslint/no-unused-vars: off`).

### React

- **Functional components only** — arrow function syntax (`const Comp = () => { ... }`).
- Hooks follow React naming convention (`useXxx`).
- No state management libraries — local state + context + React Query.
- Pages are in `src/pages/`, components in `src/components/`.

### Styling

- **Dark-only theme** — no light mode. HSL CSS variables define the design tokens.
- Tailwind utility classes for layout; custom CSS utilities for glows, scanlines, and cyber effects.
- Color scheme: deep navy background (`220 30% 5%`), neon green primary (`155 100% 50%`), cyan secondary (`195 100% 50%`).
- Use `cn()` from `@/lib/utils` to merge Tailwind classes.

### Edge Functions (Deno)

- Import Supabase JS from `esm.sh`, std lib from `deno.land`.
- Always handle `OPTIONS` for CORS.
- Use `serviceClient()` for privileged DB access.
- Return errors as `json({ error: '...' }, statusCode)`.

---

## Testing

- **Framework**: Vitest with jsdom environment and global test APIs.
- **Setup**: `src/test/setup.ts` — imports `@testing-library/jest-dom` matchers and mocks `window.matchMedia`.
- **Existing tests**: `src/game/__tests__/engine.test.ts` and `dailyPuzzle.test.ts` cover the pure game logic.
- **No integration/E2E tests** currently — all tests are unit tests on pure functions.

Run tests:
```bash
npm test           # single run
npm run test:watch # watch mode
```

---

## Important Caveats

1. **TypeScript is loose** — strict checks are off. Don't assume the compiler catches null/undefined errors. Explicit null checks are needed at runtime.
2. **No light mode** — the app is dark-only. All color variables assume a dark background.
3. **Daily puzzle timezone** — Uses `Europe/Berlin` for daily resets. This is hardcoded in `dailyPuzzle.ts`.
4. **Lovable artifacts** — `lovable-tagger` dev dependency and `src/integrations/lovable/` can be removed for self-hosting (see `SELF_HOSTING.md` §11).
5. **Secrets are protected by RLS** — `room_secrets` table only allows players to see their own secret. Opponent secrets are never exposed until the game finishes (via `reveal-secrets` Edge Function).
6. **Edge Functions duplicate game logic** — `evaluateGuess()` exists in both `src/game/engine.ts` (client-side) and `supabase/functions/_shared/game.ts` (server-side). Keep them in sync when modifying.
7. **Vite dev port** — The dev server runs on port **8080** (not the default 5173), configured in `vite.config.ts`.
8. **Anonymous auth** — Guest users get anonymous Supabase sessions. The `profiles` table tracks `is_guest` flag.
9. **No SSR/SSG** — This is a pure client-side SPA. SEO meta tags are static in `index.html`.
10. **shadcn/ui components** — Located in `src/components/ui/`. These are vendored copies, not a library dependency. They can be customized directly.
