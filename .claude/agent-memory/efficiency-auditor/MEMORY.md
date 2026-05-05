# Efficiency Auditor Memory

## Common Inefficiency Patterns Found

### 1. Inline Array/Object Creation in JSX
- **Pattern**: Creating arrays/objects inline in render (e.g., `(['a', 'b'] as Type[]).map(...)`)
- **Impact**: New reference on every render, causing unnecessary work
- **Fix**: Extract to constant outside component
- **Example**: `HistoryView.tsx` TABS array

### 2. Heavy Computations Without Proper Memoization
- **Pattern**: Expensive operations (Date parsing, graph traversals) running on every render
- **Impact**: Wasted CPU, especially with large datasets
- **Fix**: Wrap in `useMemo` with correct dependencies
- **Examples**:
  - `PastSessionsList.tsx`: Duration calculations with Date parsing
  - `SessionDetail.tsx`: Session stats computation
  - `HistoryView.tsx`: Exercise lineage resolution (O(N²) complexity)

### 3. Bundle Size - Heavy Desktop-Only Libraries
- **Pattern**: Recharts (~100KB+ gzipped) loaded for all users but only rendered on desktop
- **Impact**: Mobile users pay bundle cost for unused code
- **Fix**: Lazy-load with React.lazy() wrapped in `hidden md:block` containers
- **Example**: `ExerciseChart.tsx` with Recharts

### 4. TanStack Query Best Practices
- **Observed**: Query keys properly scoped with client_uuid, structural sharing works well
- **No issues found**: Query invalidation patterns are efficient
- **Note**: No over-fetching detected - queries select only needed columns

## History Feature Specifics

### File: `/src/features/history/HistoryView.tsx`
- **Heavy computation**: Exercise lineage resolution called for every exercise
- **Optimization applied**: Lineage caching within useMemo to reduce O(N²) to O(N)
- **Bundle optimization**: Lazy-loaded ExerciseChart to save ~100KB for mobile

### File: `/src/features/history/PastSessionsList.tsx`
- **Unnecessary recomputation**: Duration calculated inline for every session on each render
- **Optimization applied**: Memoized session items with pre-computed durations
- **Event handler**: Wrapped onDelete and handleBack in useCallback

### File: `/src/features/history/SessionDetail.tsx`
- **Unnecessary recomputation**: Session stats (duration, volume, working sets) recalculated every render
- **Optimization applied**: Combined into single memoized sessionStats object

## Performance Characteristics by Scale

### Small datasets (< 20 exercises, < 50 sessions)
- Original code performs adequately
- Optimizations provide marginal gains

### Medium datasets (20-50 exercises, 50-200 sessions)
- Date parsing overhead becomes noticeable
- Lineage resolution O(N²) starts to lag
- Optimizations provide measurable improvements

### Large datasets (50+ exercises, 200+ sessions)
- Original code shows visible lag on renders
- Optimizations critical for maintaining responsiveness
- Bundle size matters significantly on mobile networks

## Tools & Utilities

### Format Functions (`src/lib/format.ts`)
- All functions are pure and efficient
- `fmtDate` and `fmtDuration` involve Date parsing - should be memoized when called repeatedly
- No optimizations needed in the utility itself

### Stats Functions
- `src/lib/stats/rest.ts`: Efficient single-pass algorithms
- `src/lib/stats/volume.ts`: Efficient single-pass algorithms
- No optimizations needed

## TodayView & Active Session Flow (2026-05-05 Audit)

### Critical Memory Leak Patterns Fixed

**1. RestTimerBanner interval dependency**
- **Pattern**: `useEffect` with interval had `timer.setId` in deps, causing recreation on every timer change
- **Fix**: Empty deps array — interval persists for component lifetime, reads current timer state on each tick
- **Also**: Reduced interval from 250ms to 1000ms (4x fewer renders) since display is MM:SS precision

**2. useRestNotification dependency cycle**
- **Pattern**: `ensure` callback in effect deps, but `ensure` recreated when `activeSessionId` changes → cycle
- **Fix**: Effect depends on `ensure` but it's stable now; added cleanup to reset permission state on session end

**3. CycleStrip chipRefs Map unbounded growth**
- **Pattern**: Ref Map stores DOM nodes by offset key, never prunes when chips change (workoutDays/nextDayId change)
- **Fix**: Added `useEffect` that deletes stale keys when chips array updates
- **Takeaway**: Any `useRef<Map>` holding DOM/object references needs cleanup effect

### Zustand + useCallback Anti-Pattern

**ActiveSessionView Zustand usage**
- **Anti-pattern**: `const session = useSession(); useCallback([..., session], ...)` → `session` is entire hook, unstable
- **Fix**: Extract granular selectors: `useSession(s => s.clearRest)`, `useSession(s => s.startRest)`, etc.
- **Impact**: Callbacks now stable, downstream effects don't re-run unnecessarily
- **Rule**: Never pass entire Zustand hook as useCallback dependency — extract methods/values individually

### Inline Function Allocation → Child Re-renders

**TodayView callback props**
- All event handlers now wrapped in `useCallback`: `handleSelectDay`, `handlePickAnother`, `handleStart`
- **CycleStrip** `onSelect` prop was inline arrow function → recreated every render → CycleStrip re-rendered
- **PickAnotherView** `onPick` prop was inline async function → same issue
- **Rule**: Any callback passed as prop to child component must be wrapped unless trivial single-use

### Query Over-fetching

**fetchLastSetsForExercises unbounded fetch**
- **Pattern**: `.in('exercise_id', exerciseIds)` + `.order('logged_at', 'desc')` with no `.limit()`
- **Impact**: Fetches all historical sets for all exercises in workout (could be hundreds/thousands of rows)
- **Fix**: Added `.limit(200)` — enough to cover recent history per exercise, prevents unbounded growth
- **Rule**: Any Supabase query with `.in()` on dynamic array should have `.limit()` unless full scan is required

## Query Layer Audit (2026-05-05)

### Query Key Stability (CRITICAL)
- **Client UUID Anti-Pattern**: `getClientUuid()` called on every query key construction creates unstable references
- **Fix**: Evaluate once at module load: `const CLIENT_UUID = getClientUuid()` in `keys.ts`
- **Impact**: Prevents cache thrashing, unnecessary re-renders
- **Array Parameters**: Always sort arrays before joining into query keys (e.g., exercise IDs)
- **Example**: `useExerciseHistory` now sorts IDs before joining

### Query Invalidation Anti-Patterns
- **Overly Broad Invalidations**: `queryClient.invalidateQueries()` with no filter invalidates ALL queries
- **Fix**: After offline queue drain, only invalidate affected tables: sessions, session_sets, exercise-history, last-sets
- **Key Mismatches**: Invalidating `qk.exerciseHistory(singleId)` doesn't match queries using `qk.exerciseHistory(joinedIds)`
- **Fix**: Use prefix match `{ queryKey: ['exercise-history'] }` for broad invalidation

### StaleTime Configuration
- **Static Data**: Plan metadata, workout days, exercises change infrequently (only on user edits)
- **Fix**: Use `staleTime: 5 * 60 * 1000` (5 minutes) instead of global 30 seconds
- **Session Data**: Keep default 30s — actively changing during workouts

### Offline Queue Memory Leaks
1. **Event Listeners**: `setupQueueDrainTriggers` didn't return cleanup function → listeners accumulate on hot reload
   - **Fix**: Return cleanup function to remove listeners
2. **Failed Mutations**: Mutations that fail (RLS errors, malformed data) stay in IndexedDB forever
   - **Fix**: Delete mutations on permanent errors, prune entries older than 7 days
3. **Unbounded Growth**: Queue grows indefinitely without age-based pruning
   - **Fix**: Added MAX_AGE_MS = 7 days, prune old entries on drain

### Stats Calculation Optimizations
- **PR Detection**: Session sets arrive pre-sorted from query; don't `.slice().sort()` unnecessarily
- **Map Copying**: Don't copy locally-scoped maps unless they escape function scope
- **Array Operations**: `Array.from()` returns new array; no need for `.slice()` before sorting
- **Nested Iterations**: Use Sets to avoid O(n×m) patterns (e.g., finding skipped exercises in SessionSummary)

### Files Modified (Query Layer Audit)
- `/src/lib/queries/keys.ts` - CLIENT_UUID stability
- `/src/lib/queries/sessions.ts` - exerciseHistory invalidation, array sorting
- `/src/lib/queries/plans.ts` - staleTime for static data
- `/src/lib/queries/exercises.ts` - staleTime, lineage comment
- `/src/lib/offline/queue.ts` - memory leak fixes (listeners, failed mutations, age-based pruning)
- `/src/lib/stats/prs.ts` - removed redundant sort and map copy
- `/src/lib/stats/consistency.ts` - removed redundant Date copies
- `/src/features/session-stats/SessionSummary.tsx` - optimized skipped exercise detection
- `/src/main.tsx` - targeted invalidations after queue drain

## Recommendations for Future Features

1. **Always memoize Date parsing** - it's expensive and often done with stable data
2. **Lazy-load desktop-only heavy dependencies** - Recharts, chart libraries, etc.
3. **Batch computed values** - if computing multiple derived values from same data, combine into one useMemo
4. **Profile before optimizing** - but follow patterns above proactively for known-heavy operations
5. **Zustand callbacks**: Extract granular selectors, never use entire hook in deps
6. **Ref Maps**: Add cleanup effect when keys can go stale
7. **Supabase `.in()` queries**: Always add `.limit()` for safety
