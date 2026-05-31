# UI, Sync, and Firestore Flow Design

This document describes the current theory of operation for the app UI and Firestore synchronization. It focuses on how state moves through the app today.

## High-Level Theory Of Operation

The app is a single React screen flow driven by one main state object: `session`.

The UI renders one of several modes based on that state:

- Home / start screen.
- Warm-up screen.
- "Who goes first?" screen for each exercise.
- Active set tracking screen.
- Workout complete / history summary screen.

Firestore provides three kinds of data:

- Startup configuration: group metadata, workout plan, exercise metadata, user profiles, current baselines, completed workout history.
- Live synchronization: `workoutSessions/mike-victoria_demo`.
- Persisted history: `completedWorkouts` filtered by `groupId`.

The current design is optimistic in some places and blocking in others. Stepper changes update local UI immediately and save shortly after. Major navigation actions update local state immediately, then await Firestore before clearing their pending button state.

## Primary Code Blocks

### `src/App.tsx`

Owns the React UI state machine and orchestration.

Primary responsibilities:

- Holds the current local `session`.
- Loads workout plan, user profiles, and completed workouts.
- Listens to the live Firestore session.
- Decides which screen to render.
- Calls the workout engine for start, warm-up, choosing first person, postponing, set completion, skipping, and tandem progression.
- Queues debounced saves for rep/weight steppers.

### `src/workoutEngine.ts`

Owns deterministic workout rules.

Primary responsibilities:

- Start and warm-up state transitions.
- Choosing first person.
- Optional tandem exercise selection.
- Rep/weight adjustment state.
- Postpone exercise state.
- Recording completed/skipped sets.
- Advancing movement, person, set, exercise, tandem turn, or completion state.

This module is tested directly by `scripts/testWorkoutEngine.ts`.

### `src/workoutSync.ts`

Owns deterministic sync/join/cancel/stale-session decisions.

Primary responsibilities:

- Decide whether a remote session is joinable.
- Ignore stale active sessions.
- Apply incoming active/completed/cancelled sessions to local sync state.
- Filter workout events by session id.
- Build local/cancelled state for cancel actions.

This module is tested directly by `scripts/testWorkoutSync.ts`.

### `src/workoutSession.ts`

Owns Firestore read/write helpers and workout-derived calculations.

Primary responsibilities:

- Save and listen to the live workout session.
- Append ordered event records under `workoutSessions/mike-victoria_demo/events`.
- Delete temporary event records for all non-active workout sessions after completion or cancellation.
- Load the current workout session.
- Load and merge workout plan data.
- Load user profile settings.
- Load and save current baselines.
- Save and load completed workout summaries.
- Calculate exercise outcomes.
- Calculate baseline progression from completed workout results.

### `src/workoutData.ts`

Owns local fallback data and core workout types.

Primary responsibilities:

- Defines people.
- Defines exercises, default weights, default reps, and set plans.
- Supplies required exercise fields when Firestore exercise documents are partial.

### `scripts/seedWorkoutPlan.mjs`

Writes initial Firestore plan/configuration documents.

Primary responsibilities:

- Seeds the default `workoutGroups/mike-victoria` metadata document.
- Seeds `workoutGroups/mike-victoria/workoutPlans/default`.
- Seeds `workoutGroups/mike-victoria/exercises/*`.
- Merges selected movement weights into `workoutGroups/mike-victoria/userProfiles/*`.
- Seeds `currentBaselines/*` with `groupId`.

## App Startup Flow

When the app mounts, several effects run:

1. Subscribe to `workoutSessions/mike-victoria_demo` with `onSnapshot`.
2. Load completed workout summaries from `completedWorkouts` where `groupId` is `mike-victoria`.
3. Load the workout plan from Firestore and merge it with local fallback data.
4. Load user profiles from Firestore and merge them with local defaults.
5. Load current baselines from Firestore and merge them with local defaults.

The start button is disabled until the workout plan has loaded. User profiles and completed workouts load independently.

The home screen may show:

- `Loading Workout...` while the plan is loading.
- `Join Workout` if a live remote session is detected.
- `Start Workout` otherwise.

## Live Session Sync Flow

The app listens to the selected group's active session in the top-level runtime collection.

At runtime, the document id is group-specific through `src/firebase.ts`, so the default production path is:

```text
workoutSessions/mike-victoria_demo
```

When a snapshot arrives:

1. The incoming document is cast to `WorkoutSession`.
2. `latestLocalRevisionRef` is updated to the max of local and incoming revision.
3. The app checks whether the incoming session is active.
4. The app treats active sessions older than 12 hours as stale.

If the incoming session is completed:

- `activeRemoteSession` is cleared.
- If this client is currently in a workout and not viewing a past workout, local session is replaced with the completed incoming session.

If the incoming session is active and not stale:

- `activeRemoteSession` is set.
- If this client is currently in a workout and not complete, local session is replaced with the incoming session.

If the incoming session is cancelled:

- `activeRemoteSession` is cleared.
- Local session is reset to the initial home state.

After a local workout reaches `completed` or `cancelled`, the app attempts to delete event documents for all non-active sessions. This cleanup is best-effort and does not block the visible workout state; the durable session document remains enough to recover even when the event stream is empty.

## Local Session Commit Flow

Most navigation actions call `commitSession(nextSession, action)`.

That function:

1. Clears any pending debounced stepper save.
2. Adds a new `localRevision`.
3. Adds this client's `lastWriterId`.
4. Sets `pendingAction` for the button/action.
5. Appends a workout event and updates the durable session inside a Firestore transaction.
6. Updates local React state after the transaction resolves.
7. Clears `pendingAction` when the save finishes.

The important behavior is that major navigation actions wait for the Firestore transaction before local state is advanced. Stepper changes are still optimistic and debounced.

## Stepper Save Flow

Rep and weight plus/minus buttons use `updateStepperSession`.

That function:

1. Calculates the new session locally.
2. Adds a new `localRevision` and `lastWriterId`.
3. Updates React state immediately.
4. Queues a debounced Firestore save after 450 ms.

If another stepper change happens before the timeout, the previous timeout is cleared and replaced.

This is the most explicitly optimistic path in the app.

## Start Workout Flow

On the home screen, Start Workout:

1. Sets `pendingAction` to `start`.
2. Calls `joinActiveWorkout`.
3. If a joinable remote session exists, uses that remote session.
4. Otherwise creates a new active session from the current local state.
5. Stores `reorderedWorkout: baseWorkout` in the session.
6. Commits the session to Firestore.

Baseline progression is now applied at workout completion, not when starting the next workout.

## Warm-Up Flow

The first exercise is treated as warm-up.

If the warm-up timer is not running:

- Pressing the primary button stores `warmupStartedAt`.

If the warm-up timer is running:

- Pressing the primary button clears `warmupStartedAt`.
- Advances `exerciseIndex` to the first real exercise.
- Resets first-person/set state.

Both actions use `commitSession`.

## Choose-First Flow

Before every non-warm-up exercise, the app asks who goes first.

Choosing a person:

1. Sets the two-person order.
2. Sets `firstPerson`.
3. Sets current person index, movement index, and set number.
4. Reads the first target from the set plan.
5. Calculates initial reps.
6. Calculates initial weight from profile baseline plus pyramid offset when applicable.
7. Stores adjusted baseline values in the session.
8. Commits the session.

The current person's starting weight depends on `userProfiles`, the exercise or movement id, and the person's strategy.

### Tandem Selection

The "Who goes first?" screen also offers a Tandem dropdown when there are later exercises available.

Selecting a tandem exercise:

1. Moves the selected later exercise next to the current exercise in `reorderedWorkout`.
2. Stores a `tandem` cursor on the session.
3. Starts the current exercise with the selected first person.

Tandem is session-only state and does not alter Firestore exercise definitions or the default workout plan.

## Active Set Flow

The active set screen shows:

- Exercise progress.
- Exercise name.
- Current person.
- Current set number.
- Movement name for compound exercises.
- Rep stepper.
- Weight stepper.
- Skip button.
- Done / Next button.

Pressing Done or Skip calls `recordSet(status)`.

The function:

1. Builds a `SetResult` for the current person, set, exercise, movement, reps, and weight.
2. Appends it to `session.results`.
3. Advances to the next movement, person, set, exercise, or completion state.
4. Commits the new session.

For compound exercises, movement advances before switching people. For regular solo exercises, the flow alternates through both people for each set.

For tandem exercises, each set uses this turn order:

```text
first person / primary exercise
second person / tandem exercise
second person / primary exercise
first person / tandem exercise
```

Then the same pattern repeats for the next set. This alternates the exercise context in the UI, which makes data entry easier during a real workout.

When either exercise is compound, a person completes all movements for that exercise before moving to the next tandem turn. Compound movements are not interlaced between people.

## Postpone Exercise Flow

The Postpone button is shown on the "Who goes first?" screen.

Pressing it:

1. Copies the effective workout list.
2. Removes the current exercise at `exerciseIndex`.
3. Pushes that exercise to the end of the workout list.
4. Saves the new list into `session.reorderedWorkout`.
5. Commits the session.

The exercise index does not change. Because the current exercise was removed and another exercise now occupies the same index, the UI advances to the next exercise by changing the workout ordering.

## Cancel Flow

Cancel Workout:

1. Clears any pending stepper save.
2. Builds a cancelled version of the current session.
3. Clears local active remote session state.
4. Immediately resets the UI to the initial home state.
5. Saves the cancelled session in the background.

This is a fire-and-forget save path rather than an awaited `commitSession` path.

## Completion Flow

When the final set of the final exercise is recorded:

1. The session is marked `complete: true`.
2. The session status is set to `completed`.
3. `completedAt` is set.
4. Completed results are summarized.
5. Exercise outcomes are calculated.
6. Baseline progression is calculated from the planned-vs-actual work totals.
7. A completed workout summary is written to `completedWorkouts/{sessionId}` with `groupId`.
8. Updated `currentBaselines/*` documents are written with `groupId`.
9. The completed session is committed to `workoutSessions/mike-victoria_demo`.

Workout finalization is transactional and avoids duplicate completed-workout creation for the same session id.

## Summary And History Flow

The completed screen derives totals from the current session:

- Completed set count.
- Total weight lifted.
- Per-exercise details.

The chart uses `completedWorkouts` filtered by the active `groupId`, sorted by `completedAt`, and plots `totalWeightLifted`.

The home screen's "View Latest Workout Results" button sorts completed workouts by `completedAt`, selects the latest one, and builds a lightweight past session from its results.

## Sync Metadata

Each local prepared session receives:

- `localRevision`: incremented from the max known local/incoming revision.
- `lastWriterId`: a random client id generated at app load.

These fields identify write order and writer, but they are not currently used to reject stale incoming snapshots or resolve conflicts field-by-field.

## Current Latency Characteristics

The current app has three different interaction models:

- Fully awaited actions: start, warm-up, choose first, postpone, done, skip.
- Optimistic debounced actions: rep and weight steppers.
- Fire-and-forget actions: cancel workout, completed workout summary save, failed stepper save logging.
- Transactional finalization: completed workout summary, current baseline updates, and completed session state.

Because awaited actions keep `pendingAction` set until Firestore responds, slow network or Firestore latency can make buttons look disabled for several seconds.

## Current Failure Characteristics

If a Firestore write fails inside `commitSession`, local state has already advanced, but the error is only logged by the caller or browser console depending on the path.

If Firestore returns an active snapshot while the user is in a workout, the incoming snapshot replaces local session state. This is useful for cross-device sync, but it also means delayed snapshots can affect the visible local flow.

If profile documents contain missing or unexpected weight keys, the UI falls back through movement id, exercise id, exercise name, and finally `0`.

## Key Design Questions Raised By The Current Flow

- Should the app treat local UI progression as authoritative and sync in the background?
- Should the live session be split into smaller documents or event records instead of one mutable object?
- Should exercise definitions and default weights live entirely in Firestore, entirely in code, or in a clearer hybrid?
- Should baseline progression be explicit, reviewable, or versioned instead of automatically applied at workout completion?
- Should `Done / Next`, `Skip`, and `Postpone` ever be blocked by Firestore latency?
- Should incoming snapshots be ignored when they were written by the same client or have an older revision?
- Should completed workout history be built from immutable events rather than copied session results?
- Should the tandem selector eventually become a richer picker with search, descriptions, or disabled incompatible choices?
