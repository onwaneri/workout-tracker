# CLAUDE.md

Guidance for Claude Code sessions working in this repo. Requirements live in [README.md](README.md) — this file is conventions, patterns, and guardrails.

---

## Project summary

Single-user mobile-first PWA for logging an Upper/Lower workout split. React + TypeScript + Vite + Tailwind on the frontend; Supabase (Postgres + anonymous auth + RLS) as the backend; Vercel hosting. Installable to iPhone home screen, logs offline, rest-timer via web push notification. Plan (exercises, days) is fully editable from within the app — never hardcoded in the frontend.

Treat `README.md` as the product source of truth. If something here conflicts with it, `README.md` wins — flag the conflict and ask.

---

## Tech stack

- React 18+ with TypeScript (strict mode)
- Vite for dev server + build
- Tailwind CSS for all styling
- Supabase JS client (`@supabase/supabase-js`) with anonymous auth
- TanStack Query for server state; Zustand (or similar) for session UI state
- Zod for runtime validation at Supabase boundaries
- Recharts (desktop-only charts)
- Workbox or a minimal hand-rolled service worker for offline + web push

---

## Code conventions

- **TypeScript strict mode.** No `any` unless there's a genuinely dynamic boundary and it's commented.
- **Function components + hooks only.** No class components.
- **Styling:** Tailwind utility classes only. No CSS modules, no styled-components. Inline `style={{}}` is acceptable only for genuinely dynamic values (e.g. a width percentage on a progress bar).
- **Folder layout:** feature-first under `src/features/` — e.g. `src/features/session/`, `src/features/plan-editor/`, `src/features/history/`. Shared primitives in `src/components/`, hooks in `src/hooks/`, Supabase client + types in `src/lib/supabase/`.
- **Imports:** absolute imports via `@/` path alias configured in `tsconfig.json` + `vite.config.ts`.
- **File naming:** components `PascalCase.tsx`, hooks `useCamelCase.ts`, utilities `camelCase.ts`.

---

## Supabase patterns

- Anonymous auth: on app boot, check `localStorage` for a `client_uuid`; if absent, generate one (`crypto.randomUUID()`) and persist. Pass it as a header (`x-client-uuid`) that RLS policies read via `current_setting('request.header.x-client-uuid', true)`.
- **Never mock Supabase in integration tests** — use a seeded test project. Unit-level business logic can be tested without Supabase.
- **Always read plan data from `plan_versions`** — never assume the "current" plan is what the session was logged against. Historical session queries must join through `sessions.plan_version_id`.
- Row-level security is the only data-scoping mechanism. Don't filter by `client_uuid` in app code and trust it — trust RLS.
- Schema changes happen via SQL migrations checked into `supabase/migrations/`.

---

## Mobile-first rule

- Write all styles for a 320px-wide viewport first.
- Add `sm:`, `md:`, `lg:` breakpoints only to enhance the wider experience.
- Desktop layouts are **additive** — they must not require a different component tree. If a desktop feature (e.g. line chart) doesn't fit mobile, render a mobile-appropriate alternative (e.g. a table) rather than branching the whole page.
- Touch targets ≥ 44×44 px.
- Primary actions reachable by thumb on a held-in-one-hand phone.

---

## PWA specifics

- Manifest lives at `public/manifest.webmanifest`. `display: standalone`, dark `theme_color`.
- `index.html` must include: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, an `apple-touch-icon` link, and the manifest link.
- Service worker registered from the app entrypoint; exposes a message API for scheduling rest-timer notifications.
- Offline write queue lives in IndexedDB; drained on `online` event and (opportunistically) on app focus.

---

## Do / Don't

### Do
- Treat `README.md` as product spec; if unclear, ask the user rather than guess
- Store everything plan-related (exercises, days, schedule, sets defaults) in Supabase — never in TypeScript constants
- Snapshot a new `plan_version` row on any plan edit
- Log foreground/background time per session via the Page Visibility API
- Test offline behavior in DevTools before shipping a release

### Don't
- Don't hardcode exercises, days, or the weekly schedule in the frontend
- Don't mock Supabase in integration tests
- Don't track bodyweight (explicitly excluded from the product)
- Don't lock scheduling to calendar weekdays — the schedule is rolling, position-based
- Don't add in-app rest timer countdowns or sounds unless we've explicitly decided to handle the "notification permission denied" fallback
- Don't introduce a new state management library without a clear need — TanStack Query + Zustand is the baseline
- Don't add features beyond what `README.md` specifies without asking

---

## Verification patterns

Before marking any feature complete:
- Run the dev server and exercise the feature on a mobile viewport (375×667 or similar)
- If it touches logging/history, verify that logs survive a hard reload
- If it touches the plan editor, verify that a new `plan_version` is created and that an in-progress session (if any) stays on the old version
- If it touches offline behavior, toggle DevTools → Network → Offline and confirm writes queue and drain
