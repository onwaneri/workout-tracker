# Workout Tracker

A personal, mobile-first Progressive Web App for tracking an Upper/Lower training split. Single user, installable to iPhone home screen, offline-capable, with an in-app editable plan, progressive-overload history, and post-session stats.

---

## 1. Overview

This is a single-user workout logger built for one specific program (Upper/Lower, 5 training days over 7), with everything about the program — exercises, days, supersets, rest targets — editable from within the app rather than hardcoded. It is a PWA so that launching it from the iPhone home screen feels like a native app (fullscreen, no Safari chrome) and lets sets be logged offline, syncing to Supabase when the device reconnects. Desktop is a secondary, additive experience focused on analytics and plan editing.

---

## 2. Goals & Non-Goals

### Goals
- Fast, one-handed set logging on mobile during a real workout
- Full program editability from within the app — no code deploy to change an exercise
- Progressive-overload visibility per exercise (week over week)
- Weekly consistency and volume-vs-target tracking
- Offline-first logging with background sync
- End-of-session stats summary (duration, time off-app, volume, PRs)
- Installable to iPhone home screen with a native-app feel
- Data persists across devices (mobile ↔ desktop) via Supabase

### Non-Goals
- Multi-user accounts, sharing, or social features
- Bodyweight tracking (explicitly excluded)
- Calendar-locked scheduling (the schedule is rolling — see §3)
- In-app video/exercise instruction content
- Nutrition or cardio tracking
- Wearable integrations

---

## 3. Program Structure

- **Split:** Upper / Lower
- **Weekly schedule:** Upper → Lower → Rest → Upper → Lower → Rest → Rest
- **Sets per exercise:** 2 sets to failure (editable per-exercise default)
- **Rest between compound lifts:** 2–3 minutes
- **Rest between isolation lifts:** 1.5–2 minutes
- **Schedule model:** **Rolling**. The app always shows "next session" based on what was last completed, not what day of the week it is. Missing a day doesn't penalize consistency — it just means the same session is still next. Rest days only advance once the preceding workout is completed.

---

## 4. Workout Plan

### Day 1 — Upper (~85–100 min)

| Exercise | Muscle Group | Type |
|---|---|---|
| Incline Smith Machine Bench | Chest / Front Delt | Compound |
| Skullcrushers | Triceps (long head) | Isolation |
| Cable Pushdown | Triceps (lateral/medial head) | Isolation |
| Upright Row Machine | Lateral Delt / Traps | Compound |
| Pull-Ups | Lats / Back | Compound |
| Bicep Curl | Biceps | Isolation |
| Brachialis Curl | Brachialis | Isolation |
| Lateral Raise | Lateral Delt | Isolation |
| Rear Delt Fly | Rear Delt | Isolation |

### Day 2 — Lower, Quad-Focused (~40–50 min)

| Exercise | Muscle Group | Type |
|---|---|---|
| Leg Press | Quads | Compound |
| Bulgarian Split Squat | Quads / Glutes | Compound |
| Sumo RDL | Hamstrings / Glutes | Compound |
| Calf Raise | Calves | Isolation |

### Day 3 — Rest

### Day 4 — Upper

Same as Day 1.

### Day 5 — Lower, Posterior-Chain-Focused (~40–55 min)

| Exercise | Muscle Group | Type |
|---|---|---|
| RDL | Hamstrings | Compound |
| Leg Curl | Hamstrings | Isolation |
| Cable Kickback | Glutes | Isolation |
| Adductor Machine | Adductors | Isolation |
| Calf Raise | Calves | Isolation |

### Day 6 — Rest

### Day 7 — Rest

---

## 5. Supersets

Flagged pairings (both exercises performed back-to-back before resting):

- Skullcrushers **+** Cable Pushdown
- Bicep Curl **+** Brachialis Curl
- Lateral Raise **+** Rear Delt Fly

Superset pairings are stored in Supabase, editable in the plan editor, and drive the UI to stack paired exercises together during a session.

---

## 6. Features

### 6.1 Active Session (mobile-primary)

- **Set entry fields:** weight, reps, RPE (1–10), warm-up vs working tag, optional free-text note
- **Skip exercise:** any exercise can be skipped mid-session without logging sets; skipped exercises are recorded in the session but excluded from volume totals
- **Rest timer:** implemented as a **web push notification only**. When a set is logged, a notification is scheduled for the exercise's rest-type target (2–3 min compound, 1.5–2 min isolation). No in-app countdown is shown; no in-app sound plays. Notification permission is requested when starting the first session.
- **Foreground / background tracking:** the app uses the Page Visibility API to measure how long the PWA is in the foreground vs. backgrounded during an active session. Surfaced in end-of-session stats as "time off-app".
- **Estimated duration:** shown before starting, based on the day's exercises and default rest targets.

### 6.2 End-of-Session Stats

After a session is marked complete, a summary screen shows:

- Total session duration
- Time off-app (backgrounded time during the session)
- Total volume lifted, broken down by muscle group
- Personal records hit (new weight PRs, new rep PRs at a given weight)
- Sets completed vs. planned (with skipped exercises called out)

### 6.3 Progressive Overload Tracking

Per exercise, surface week-over-week change in weight and reps. A new plan version that renames an exercise does **not** break this history — logs remain pinned to the exercise identity at the time they were logged (see §6.6).

### 6.4 Weekly Schedule View

- **Mobile:** "Next session: [Day name, exercise list preview]" card
- **Desktop:** full weekly strip showing the rolling position (which session is next, which are already done this week)

### 6.5 History & Progress Per Exercise

- **Mobile:** scrollable table of past sets (date, weight, reps, RPE, note)
- **Desktop:** line chart of top-set weight over time, plus the same table

### 6.6 Plan Editor

The entire program is edited from within the app. No code deploy required.

Supported edits:
- Add / remove / rename exercises on any day
- Change an exercise's type (compound ↔ isolation) — affects rest-timer target
- Reorder exercises within a day (drag and drop)
- Create / rename / reorder workout days
- Edit the weekly day-type schedule (which days are workout vs. rest)
- Mark or unmark supersets
- Change default sets per exercise

**Plan versioning rules:**
- Editing the plan creates a new `plan_version` snapshot
- The new version takes effect from the **next** session only — any in-progress session continues on its original version
- Historical session logs remain pinned to the plan version active at the time, so progress charts and history stay accurate even after renames or reorders

### 6.7 Goals & Consistency

- **Per-exercise goal:** user sets target weight and target reps; shown as a progress bar on the exercise detail view
- **Weekly consistency score:** did all 5 scheduled workouts get completed this week?
- **Streak:** consecutive weeks at 5/5
- **Weekly volume per muscle group vs. target:** user-set target volume per muscle group, visualized against actual weekly volume

---

## 7. UX Requirements

### 7.1 Mobile (primary)

- One-handed use, thumb-reachable primary actions
- Numeric inputs optimized for the iOS numeric keypad
- No visible Safari browser chrome when launched from the home screen
- Dark mode by default
- Rest is a push notification — the app itself stays in "next set" state

### 7.2 Desktop (additive)

- Wider layout utilizing the extra real estate
- Progress-over-time line charts per exercise
- GitHub-style consistency heatmap (workout adherence by day)
- Volume per muscle group per week, vs. target
- Goal progress bars per exercise
- The plan editor is more comfortable on desktop but must remain usable on mobile

---

## 8. Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend / DB:** Supabase (free tier) — Postgres + row-level security
- **Auth:** **Anonymous** — a client-generated UUID is stored in `localStorage` on first launch and used as the tenant key; RLS policies scope every row to that UUID. No email / password.
- **Hosting:** Vercel (free tier)
- **State / data:** React Query (TanStack) for Supabase queries + cache; Zustand (or equivalent lightweight store) for in-session UI state
- **Charts:** Recharts or similar (desktop only)
- **Runtime validation:** Zod at Supabase boundaries

---

## 9. PWA Requirements

- **Manifest:** name, short name, icon set (at least 192×192 and 512×512), theme color, background color, `"display": "standalone"`, `"start_url": "/"`
- **Meta tags:** `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` links
- **Service worker:**
  - Caches app shell for offline launch
  - Intercepts Supabase writes when offline and queues them to IndexedDB
  - Drains the queue on reconnect (`online` event + periodic sync)
- **Web Push for rest timer:** notification permission requested on first session start; scheduled via the service worker when a set is logged. If permission is denied, behavior is an open question (§12).

---

## 10. Data Model Sketch

All tables carry a `client_uuid` column, protected by an RLS policy: `USING (client_uuid = current_setting('request.jwt.claim.client_uuid', true)::uuid)` or equivalent pattern via anon key + header.

| Table | Key columns |
|---|---|
| `plans` | `id`, `client_uuid`, `name`, `created_at` |
| `plan_versions` | `id`, `plan_id`, `client_uuid`, `version_number`, `created_at`, `is_active` |
| `workout_days` | `id`, `plan_version_id`, `client_uuid`, `name`, `order_index`, `is_rest` |
| `exercises` | `id`, `workout_day_id`, `client_uuid`, `name`, `muscle_group`, `type` (compound / isolation), `order_index`, `default_sets`, `previous_exercise_id` (for rename continuity) |
| `superset_groups` | `id`, `workout_day_id`, `client_uuid`, `exercise_ids[]` |
| `sessions` | `id`, `client_uuid`, `plan_version_id`, `workout_day_id`, `started_at`, `ended_at`, `foreground_ms`, `background_ms` |
| `session_sets` | `id`, `session_id`, `exercise_id`, `client_uuid`, `set_order`, `weight`, `reps`, `rpe`, `is_warmup`, `is_skipped`, `note`, `logged_at` |
| `goals` | `id`, `client_uuid`, `exercise_id`, `target_weight`, `target_reps`, `muscle_group` (for volume goals), `weekly_volume_target` |

**Pinning pattern:** `session_sets.exercise_id` points to the `exercises` row from the `plan_version` that was active when the session started. New plan versions create new `exercises` rows; old rows are retained, so historical logs never lose their identity. `previous_exercise_id` lets the UI chain renames together for a continuous progress chart.

---

## 11. Accessibility & Theme

- Dark mode default; light mode optional (later)
- Contrast: WCAG AA minimum on primary text / interactive elements
- Touch targets ≥ 44×44 px on mobile
- Large numeric inputs with clear labels
- Component design: clean and modern, not generic — comfortable typography, generous spacing, purposeful motion only

---

## 12. Open Questions

These need a decision before (or during) implementation. None of them block writing the initial spec.

1. **"Time on phone" scope.** Confirm interpretation: *time the PWA is not in the foreground during an active session* (measurable via Page Visibility API). Device-wide phone usage is not observable from a PWA.
2. **Rest-timer fallback.** If notification permission is denied or the browser doesn't support scheduled notifications, what's the fallback? Options: silent (no alert at all), in-app visible countdown as last resort, or prompt the user to re-grant on each session.
3. **Goal setting UX.** Manual targets only, or auto-suggested from recent history (e.g. "your last top set was 135×8, suggest 140×8")?
4. **Plan edit retroactivity.** When renaming an exercise, should the old logs merge under the new name (rewrite history) or stay under the old name with a visual "was X" chain? Current plan assumes chain via `previous_exercise_id`.
5. **PWA branding.** Need an icon set (192×192, 512×512, apple-touch-icon), theme color, and app name. Placeholder or supplied assets?
6. **Deployment domain.** `.vercel.app` subdomain or a custom domain?
7. **Anonymous account recovery.** If `localStorage` is cleared, the UUID is lost and data is orphaned in Supabase. Options: one-time export/import code, optional email upgrade path, or accept the risk and document it.
