# Database Architecture

This document describes the Firestore data model currently used by the app. It is a description of the implemented architecture, not a recommendation for where it should end up.

## High-Level Shape

The app uses Firestore as a small shared state store for a two-person workout tracker. There are four active data areas:

- `workoutSessions/demo`: the current shared workout session.
- `workoutSessions/demo/events/{eventId}`: ordered event records for session-changing actions.
- `workoutPlans/default`: the active workout plan and exercise ordering.
- `exercises/{exerciseId}`: exercise metadata that can override or extend local fallback data.
- `userProfiles/{person}`: person-specific working weights.
- `currentBaselines/{person}`: per-person training baselines and success streaks.
- `completedWorkouts/{autoId}`: immutable-ish workout history records used for summaries and progression.

There is also a local fallback workout definition in `src/workoutData.ts`. The database does not currently own all workout defaults. Instead, Firestore documents are merged with local TypeScript data at runtime.

## Collection: workoutSessions

### Document: `workoutSessions/demo`

This is the single live session document. The app always reads and writes the fixed document id `demo`.

Primary fields:

```ts
{
  started: boolean;
  complete: boolean;
  status?: "active" | "completed" | "cancelled";

  exerciseIndex: number;
  reorderedWorkout?: Exercise[];

  exerciseOrder: Person[];
  firstPerson: Person | null;
  currentPersonIndex: number;
  currentSet: number;
  currentMovementIndex?: number;

  currentReps: number;
  currentWeight: number;

  results: SetResult[];

  warmupStartedAt?: string | null;

  adjustedBaselines?: Record<string, Partial<Record<Person, number>>>;
  adjustedRepBaselines?: Record<string, Partial<Record<Person, number>>>;

  tandem?: {
    primaryExerciseIndex: number;
    secondaryExerciseIndex: number;
    turnIndex: number;
  } | null;

  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;

  localRevision?: number;
  lastWriterId?: string;
  eventSequence?: number;
}
```

### Purpose

This document acts as both:

- The durable current workout checkpoint.
- The live cross-device sync object.

The current session is saved through transactional event/session writes for major workout actions. The transaction appends an event under `workoutSessions/demo/events/{sequence}` and updates `workoutSessions/demo` with the latest session state, `updatedAt`, and `eventSequence`.

### Results Shape

Each completed or skipped set is appended to `results`:

```ts
{
  exerciseId?: string;
  exerciseName: string;
  movementId?: string;
  movementName?: string;
  person: "Victoria" | "Mike";
  setNumber: number;
  reps: number;
  weight: number;
  status: "completed" | "skipped";
}
```

For compound exercises, `movementId` and `movementName` identify the movement inside the parent exercise.

For tandem exercises, the session stores a `tandem` cursor. Tandem is runtime session state only; no Firestore exercise/template schema change is required. The selected tandem exercise is moved next to the current exercise inside `reorderedWorkout` for that active session.

Tandem turn order alternates exercise context:

```text
first person / primary exercise / set N
second person / secondary exercise / set N
second person / primary exercise / set N
first person / secondary exercise / set N
```

For compound exercises, a person's movement sequence is completed before switching to the next tandem turn, so movements are not interlaced between people.

### Current Constraints

- There is only one live session id: `demo`.
- The full reordered workout may be embedded into the session document.
- Session state, UI cursor state, recorded set results, temporary weight overrides, and sync metadata live together in one document.
- `localRevision`, `lastWriterId`, and `eventSequence` exist, but the listener still converges by accepting the latest active session broadly instead of doing field-level conflict resolution.

## Collection: workoutPlans

### Document: `workoutPlans/default`

Primary fields:

```ts
{
  active?: boolean;
  name?: string;
  exerciseIds?: string[];
  items?: Array<Partial<Exercise> & {
    exerciseId?: string;
    active?: boolean;
  }>;
}
```

### Purpose

This document controls which exercises are in the workout and in what order.

The loader prefers:

1. `exerciseIds`, converted into plan items.
2. `items`, if `exerciseIds` is absent.
3. Local fallback workout if the plan is missing, inactive, or resolves to no valid exercises.

If `active === false`, the local fallback workout is used.

## Collection: exercises

### Document: `exercises/{exerciseId}`

These documents contain exercise metadata. The seeding script currently writes fields such as:

```ts
{
  active: boolean;
  type: "single" | "compound";
  name: string;
  notes?: string;
  movements?: Array<{
    id: string;
    name: string;
  }>;
}
```

### Merge Behavior

At runtime, each exercise is built from three layers:

1. Local fallback exercise from `src/workoutData.ts`.
2. Firestore exercise document from `exercises/{exerciseId}`.
3. Inline item override from `workoutPlans/default`.

Later layers override earlier layers.

The final merged exercise must pass a runtime shape check requiring:

- `id`
- `name`
- `sets`
- `reps`
- `defaultReps`
- `defaultWeight`
- `setPlan`

This means Firestore exercise documents can be partial only because local fallback data supplies the missing required fields.

## Collection: userProfiles

### Documents: `userProfiles/Mike`, `userProfiles/Victoria`

Primary fields:

```ts
{
  displayName?: string;
  progressionStrategy: "pyramid" | "straight";
  baselineProgressionStrategy: "straight" | "slow" | "medium" | "fast";
}
```

### Purpose

Profiles store person-level preferences and strategies. Current training weights are no longer owned by this collection.

## Collection: currentBaselines

### Documents: `currentBaselines/Mike`, `currentBaselines/Victoria`

Primary fields:

```ts
{
  userId: string;
  baselines: Record<string, {
    weight: number;
    successStreak: number;
  }>;
  updatedAt?: string;
}
```

The baseline keys are exercise ids or movement ids. Some older/alternate code paths also look up by exercise name.

Examples:

```ts
{
  userId: "Mike",
  baselines: {
    leg_press: 125,
    seated_row_machine: { weight: 55, successStreak: 0 },
    thigh_machine_inner: { weight: 55, successStreak: 0 },
    thigh_machine_outer: { weight: 75, successStreak: 0 }
  }
}
```

### Purpose

Current baselines store each person's baseline weight and success streak for each exercise or movement. The UI uses those baselines to calculate the displayed target weight for the current set.

For pyramid strategy users, the displayed set weight is:

```ts
profile baseline + setPlan weightOffset
```

For straight strategy users, the displayed set weight is the profile baseline.

## Collection: completedWorkouts

### Documents: `completedWorkouts/{sessionId}`

Primary fields:

```ts
{
  completedAt: string;
  finalizedAt?: string;
  sessionId?: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: Record<
    string,
    Record<string, "exact" | "up" | "down" | "neutral">
  >;
  results: SetResult[];
}
```

### Purpose

Completed workout documents are history records. They support:

- The workout completion summary.
- The "View Latest Workout Results" flow.
- The total weight chart.
- Future workout progression calculations.

The app loads this collection ordered by `completedAt` ascending. Workout finalization writes the completed workout and updated current baselines in a transaction, and avoids creating a duplicate completed workout if the session id was already finalized.

## Local Fallback Data

`src/workoutData.ts` defines:

- People: `Victoria`, `Mike`.
- Local workout exercises.
- Default weights.
- Set plans such as standard pyramid, small-step pyramid, and straight sets.
- Compound movement defaults for the thigh machine.
- Lat Pulldown in place of the retired Glute Machine.

This local data is part of the effective database architecture because Firestore exercise documents are currently partial and depend on these local defaults.

## Seed Script

`scripts/seedWorkoutPlan.mjs` writes:

- `workoutPlans/default`
- `exercises/*`
- `userProfiles/Mike`
- `userProfiles/Victoria`
- `currentBaselines/Mike`
- `currentBaselines/Victoria`

The script can also reset runtime collections (`workoutSessions` and `completedWorkouts`) before reseeding static/current-baseline data. It supports both production collections and the older `tmp_` collection prefix.

## Derived Data

Exercise outcomes are derived at workout completion from:

- Recorded `results`.
- The effective workout plan.
- User profile baselines.
- Per-person strategies.

Progressed current baselines are derived at workout completion from the just-completed workout:

- `straight`: never changes automatically.
- `fast`: increase after 2 successful workouts.
- `medium`: increase after 3 successful workouts.
- `slow`: increase after 4 successful workouts.
- If actual work is below 95% of planned work, decrease baseline by 5%.
- If actual work is above 105% of planned work, increase baseline by 5%.
- Baseline increases round up to the nearest 5 lb.
- Baseline decreases round down to the nearest 5 lb and never go below 0.

When progression changes a baseline, the app writes updated `currentBaselines/Mike` and `currentBaselines/Victoria`.

## Important Architectural Observations

- Firestore is currently both configuration storage and live app state storage.
- The current session document is a large shared mutable object.
- The data model relies on local fallback data for required exercise fields.
- Current baselines are not versioned and do not yet distinguish manual edits from automatic progression.
- Completed workout records duplicate the full `results` array from the session.
- There is no explicit user/account model; person names are hard-coded document ids.
- There is no multi-session history collection for active sessions; only one active document exists.
- There is no explicit schema validation at the Firestore boundary beyond local runtime checks during workout plan loading.
- Core workout progression, baseline progression, and sync state decisions now have direct automated tests under `scripts/test*.ts`.
