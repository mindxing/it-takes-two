# Proposed Database Design

This document describes the target database model for the workout app. It intentionally differs from the current implementation described in `database-architecture.md`.

Status note: the implemented app now uses the same broad ownership split for `userProfiles` versus `currentBaselines`, and runtime data is scoped under `workoutGroups/mike-victoria`. It still uses the fixed live session document `workoutGroups/mike-victoria/workoutSessions/demo` instead of creating fresh `workoutSessions/{sessionId}` documents per workout.

The central design idea is clear ownership of information. Static data defines reusable facts and preferences. Starting a workout creates a dynamic "work order" that copies the needed static data and resolves the correct targets for that workout.

## Design Principles

- Each piece of information has one authoritative owner.
- Static data is edited only through explicit future edit/preference UIs.
- Dynamic workout state is created fresh for each workout.
- Active workouts do not depend on live exercise/template/profile documents while the workout is in progress.
- Completed workouts preserve what actually happened, even if static definitions change later.
- Current baselines are training state, separate from user preferences.

## Static Data

### `workoutGroups`

Workout groups are the ownership boundary for a two-person workout partnership.

Implementation status: the app has a default group model, a migration script that copies the current global one-couple data under `workoutGroups/mike-victoria`, and runtime Firestore access now uses the default group-scoped paths.

Example document: `workoutGroups/{groupId}`

```ts
{
  id: string;
  name: string;
  memberIds: string[];
  members: Record<string, {
    id: string;
    displayName: string;
    role: "member";
    active: boolean;
  }>;
  defaultWorkoutPlanId: string;
  activeSessionId: string;
  active: boolean;
}
```

Recommended group-scoped collections:

```text
workoutGroups/{groupId}/workoutPlans/{planId}
workoutGroups/{groupId}/exercises/{exerciseId}
workoutGroups/{groupId}/userProfiles/{memberId}
workoutGroups/{groupId}/currentBaselines/{memberId}
workoutGroups/{groupId}/workoutSessions/{sessionId}
workoutGroups/{groupId}/workoutSessions/{sessionId}/events/{eventId}
workoutGroups/{groupId}/completedWorkouts/{sessionId}
```

Ownership:

- Which two members belong to the workout partnership.
- The group's default workout plan.
- The group's active session pointer.
- The security boundary for future Firestore rules.

### `exercises`

Canonical library of all known exercise units.

Exercises are static definitions. They are edited only when users manage the exercise list.

Example document: `exercises/{exerciseId}`

```ts
{
  id: string;
  name: string;
  type: "single" | "compound";
  notes?: string;

  defaultSets?: number;
  defaultRepRange?: string;
  defaultSetPlan?: Array<{
    reps: number;
    weightOffset: number;
  }>;

  movements?: Array<{
    id: string;
    name: string;
    notes?: string;
    defaultSetPlan?: Array<{
      reps: number;
      weightOffset: number;
    }>;
  }>;

  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Ownership:

- Exercise identity.
- Exercise display name.
- Movement structure.
- Default notes and default set/rep structure.
- Whether the exercise is available for future workout templates.

Does not own:

- A user's current working weight.
- A user's progression strategy.
- The order of exercises in a specific workout template.
- Results from a performed workout.

### `userProfiles`

User identity and preference/configuration data.

Profiles are static preference documents. They are edited only when users manage their preferences.

Example document: `userProfiles/{userId}`

```ts
{
  id: string;
  displayName: string;

  progressionStrategy: "pyramid" | "straight";

  preferences?: {
    weightStep?: number;
    defaultRestSeconds?: number;
  };

  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Ownership:

- User display identity.
- Training preferences.
- Progression strategy.

Does not own:

- Current exercise baselines.
- In-flight workout state.
- Workout results.

### `workoutTemplates`

Reusable workout definitions.

A workout template pairs users with an ordered list of exercises. It is the recipe for creating a future workout, not the live workout itself.

Example document: `workoutTemplates/{templateId}`

```ts
{
  id: string;
  name: string;

  userIds: string[];

  items: Array<{
    id: string;
    exerciseId: string;

    active: boolean;
    order: number;

    sets?: number;
    repRange?: string;
    setPlan?: Array<{
      reps: number;
      weightOffset: number;
    }>;

    movementOverrides?: Record<string, {
      active?: boolean;
      setPlan?: Array<{
        reps: number;
        weightOffset: number;
      }>;
    }>;

    notes?: string;
  }>;

  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Ownership:

- Which users the workout is for.
- Which exercises are included.
- Exercise order for future workouts.
- Template-level overrides, such as sets, rep plan, enabled movements, or workout-specific notes.

Does not own:

- Canonical exercise names/movement definitions.
- Current user baselines.
- In-flight exercise order after postponing.
- Performed results.

## Dynamic Training State

### `currentBaselines`

Current per-user training baselines.

Baselines are dynamic training state, but they are not in-flight workout state. They represent the current starting point to use when creating the next workout work order.

Example document: `currentBaselines/{userId}`

```ts
{
  userId: string;

  baselines: Record<string, {
    weight: number;
    reps?: number;
    successStreak: number;
    updatedAt: string;
    lastAdjustmentId?: string;
  }>;
}
```

The baseline key should refer to the smallest targetable unit:

- For single exercises: `exerciseId`.
- For compound exercise movements: `movementId`.

Ownership:

- Current baseline weight/reps per user and exercise/movement.
- The values used to generate the next active workout.

Update timing in the target design:

- Updated when progression is applied.
- The implemented app currently applies progression at workout finalization.
- Progression rules compare actual work against the planned work generated from the prior baseline.

Does not own:

- User preferences.
- The resolved target weights inside an already-started workout.
- Completed set results.

### Optional `baselineAdjustments`

Audit trail for automatic baseline changes.

Example document: `baselineAdjustments/{adjustmentId}`

```ts
{
  id: string;
  userId: string;
  baselineKey: string;

  oldWeight: number;
  newWeight: number;
  oldReps?: number;
  newReps?: number;

  reason: "ratio_low" | "ratio_high" | "success_streak" | "manual";
  sourceWorkoutIds?: string[];

  createdAt: string;
}
```

This collection is optional, but useful for debugging unexpected starting values.

## Active Workout Work Orders

### `workoutSessions`

Each started workout creates a fresh workout session document.

This is the dynamic work order. It is generated from:

- The selected workout template.
- The exercise library.
- User profiles.
- Current baselines after applying beginning-of-workout progression.

Example document: `workoutSessions/{sessionId}`

```ts
{
  id: string;

  sourceTemplateId: string;
  userIds: string[];

  status: "active" | "completed" | "cancelled";

  currentCursor: {
    exerciseIndex: number;
    userIndex?: number;
    setIndex?: number;
    movementIndex?: number;
  };

  items: Array<{
    id: string;
    sourceExerciseId: string;
    sourceTemplateItemId: string;

    order: number;
    status: "pending" | "in_progress" | "completed" | "skipped" | "postponed";

    name: string;
    type: "single" | "compound";
    notes?: string;

    sets: number;
    repRange: string;

    setPlan: Array<{
      reps: number;
      weightOffset: number;
    }>;

    movements?: Array<{
      id: string;
      sourceMovementId: string;
      name: string;
      notes?: string;
      setPlan: Array<{
        reps: number;
        weightOffset: number;
      }>;
    }>;

    targets: Record<string, {
      baselineKey: string;
      baselineWeight: number;
      baselineReps?: number;
      strategy: "pyramid" | "straight";

      sets: Array<{
        setIndex: number;
        movementId?: string;
        targetReps: number;
        targetWeight: number;
      }>;
    }>;

    results?: Array<{
      id: string;
      userId: string;
      setIndex: number;
      movementId?: string;
      reps: number;
      weight: number;
      status: "completed" | "skipped";
      completedAt: string;
    }>;
  }>;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
}
```

Ownership:

- The exact workout being performed today.
- The copied exercise information as it existed when the workout started.
- The resolved per-user targets for today.
- The mutable exercise order during the workout.
- Completed/skipped set results while the workout is in flight.
- Final completed workout record, if sessions are retained as history.

Does not own:

- Future exercise definitions.
- Future workout templates.
- Future user preference changes.
- Future baseline values.

## Work Order Creation Flow

Starting a workout should be a deliberate creation step:

1. User selects a workout template.
2. App loads the template.
3. App loads the users' profiles.
4. App loads the users' current baselines.
5. App creates a new `workoutSessions/{sessionId}` document.
6. The session contains copied exercise/template data and resolved targets.
7. The workout UI runs from this session document.

In the current implementation, baseline progression is applied at workout finalization instead of at the next workout start.

After step 7, the active workout should not need to query `exercises`, `workoutTemplates`, or `currentBaselines` to decide what the next set should be.

## Completion Model

There are two reasonable options for completed workout history:

### Option A: Retain `workoutSessions`

The same `workoutSessions/{sessionId}` document remains the historical record after `status` becomes `completed`.

Pros:

- No duplicate completed-workout write.
- The work order is already the historical record.
- Easy to inspect one document for the full workout.

### Option B: Copy to `completedWorkouts`

When complete, copy the finalized session into `completedWorkouts/{sessionId}` or `completedWorkouts/{autoId}`.

Pros:

- Separates active operational data from historical records.
- Allows different retention/security/indexing rules.

Recommendation for this app: prefer Option A unless there is a concrete reason to split active and completed records. A completed work order is already a durable record of what happened.

## Static vs Dynamic Ownership Summary

| Data | Owner | Mutated During Workout? |
| --- | --- | --- |
| Exercise id/name/movements/defaults | `exercises` | No |
| User display name/preferences/strategy | `userProfiles` | No |
| Workout recipe/order/users | `workoutTemplates` | No |
| Current per-user baseline weight/reps | `currentBaselines` | Only at workout start |
| Today's copied exercise list | `workoutSessions` | Yes |
| Today's resolved target weights/reps | `workoutSessions` | Generally no, except user adjustments |
| Today's exercise order/postponing | `workoutSessions` | Yes |
| Today's set results | `workoutSessions` | Yes |

## Why This Model Helps

- Exercise definitions have a single owner.
- User preferences are not mixed with training baselines.
- Workout templates are clean recipes, not live sessions.
- Starting a workout produces an inspectable work order with all targets resolved.
- Bad starting values can be debugged by inspecting the session's copied targets and the baseline adjustment that produced them.
- Static edits only affect future workouts.
- Active and completed workouts remain stable even if exercise definitions or templates are edited later.

## Open Design Choices

- Whether completed sessions remain in `workoutSessions` or are copied to `completedWorkouts`.
- Whether `currentBaselines` should be one document per user or one document per user/exercise.
- Whether baseline adjustments are required from the start or added later.
- Whether workout session `results` should live inline on each item or in a subcollection.
- How much of the resolved target plan should be precomputed at session creation versus calculated from copied baselines and set plans.
