# Database Architecture

This document describes the Firestore data model currently used by the app. It is a description of the implemented architecture, not a recommendation for where it should end up.

## High-Level Shape

The app uses Firestore as a small shared state store for a two-person workout tracker. There are four active data areas:

- `workoutSessions/demo`: the current shared workout session.
- `workoutPlans/default`: the active workout plan and exercise ordering.
- `exercises/{exerciseId}`: exercise metadata that can override or extend local fallback data.
- `userProfiles/{person}`: person-specific working weights.
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

  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;

  localRevision?: number;
  lastWriterId?: string;
}
```

### Purpose

This document acts as both:

- The durable current workout checkpoint.
- The live cross-device sync object.

The whole current session is saved back with `setDoc(..., { merge: true })`. Before saving, undefined values are recursively removed and `updatedAt` is set. If the document has no `createdAt`, the save helper adds one.

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

### Current Constraints

- There is only one live session id: `demo`.
- The full reordered workout may be embedded into the session document.
- Session state, UI cursor state, recorded set results, temporary weight overrides, and sync metadata live together in one document.
- `localRevision` and `lastWriterId` exist, but the listener currently accepts incoming active sessions broadly instead of doing strict conflict resolution.

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
  weights: Record<string, number>;
}
```

The keys are exercise ids or movement ids. Some older/alternate code paths also look up by exercise name.

Examples:

```ts
{
  weights: {
    leg_press: 125,
    seated_row_machine: 55,
    thigh_machine_inner: 55,
    thigh_machine_outer: 75
  }
}
```

### Purpose

Profiles store each person's baseline weight for each exercise or movement. The UI uses those baselines to calculate the displayed target weight for the current set.

For pyramid strategy users, the displayed set weight is:

```ts
profile baseline + setPlan weightOffset
```

For straight strategy users, the displayed set weight is the profile baseline.

### Creation Behavior

If a profile document is missing, the app writes a default profile document. If a profile exists, the app reads `weights` and merges it into local defaults in React state.

## Collection: completedWorkouts

### Documents: `completedWorkouts/{autoId}`

Primary fields:

```ts
{
  completedAt: string;
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

The app loads this collection ordered by `completedAt` ascending.

## Local Fallback Data

`src/workoutData.ts` defines:

- People: `Victoria`, `Mike`.
- Local workout exercises.
- Default weights.
- Set plans such as standard pyramid, small-step pyramid, and straight sets.
- Compound movement defaults for the thigh machine.

This local data is part of the effective database architecture because Firestore exercise documents are currently partial and depend on these local defaults.

## Seed Script

`scripts/seedWorkoutPlan.mjs` writes:

- `workoutPlans/default`
- `exercises/*`
- partial `userProfiles/Mike`
- partial `userProfiles/Victoria`

The profile writes use `{ merge: true }`, so the script can add movement weights without replacing the whole profile document.

## Derived Data

Exercise outcomes are derived at workout completion from:

- Recorded `results`.
- The effective workout plan.
- User profile baselines.
- Per-person strategies.

Progressed user profiles are derived on workout start by looking at recent completed workout outcomes:

- Last 3 `exact` outcomes: increase baseline by 5.
- Last 2 `up` outcomes: increase baseline by 5.
- Last 2 `down` outcomes: decrease baseline by 5, not below 0.

When progression changes a profile, the app writes updated `userProfiles/Mike` and `userProfiles/Victoria`.

## Important Architectural Observations

- Firestore is currently both configuration storage and live app state storage.
- The current session document is a large shared mutable object.
- The data model relies on local fallback data for required exercise fields.
- Profile weights are not versioned and do not distinguish manual edits from automatic progression.
- Completed workout records duplicate the full `results` array from the session.
- There is no explicit user/account model; person names are hard-coded document ids.
- There is no multi-session history collection for active sessions; only one active document exists.
- There is no explicit schema validation at the Firestore boundary beyond local runtime checks during workout plan loading.
