# Proposed Sync Strategy

This document describes the target syncing strategy for the workout app. It assumes the proposed database model in `proposed-database-design.md`, where starting a workout creates a fresh `workoutSessions/{sessionId}` work order.

Status note: the app has implemented part of this strategy, but still uses a fixed live document for the default group: `workoutSessions/mike-victoria_demo`. Current major actions append ordered events under that session's `events/{sequence}` subcollection and update the durable session document in the same transaction.

The core idea is:

- The workout session document is the durable source of truth.
- A short-lived per-session event stream coordinates actions between clients.
- Clients optimistically apply their own actions locally.
- Other clients receive events, apply them, and converge on the same work order.

## Why The New Database Model Helps

Sync is easier when an active workout is self-contained.

Once `workoutSessions/{sessionId}` exists, clients should not need to consult live `exercises`, `workoutTemplates`, `userProfiles`, or `currentBaselines` to decide what happens next. The active session already contains:

- Copied exercise data.
- The current exercise order.
- Resolved per-user targets.
- Cursor/progress state.
- Completed or skipped set results.

That means syncing only has to coordinate changes to one active work order.

## Source Of Truth

### Durable Truth

`workoutSessions/{sessionId}` is the durable source of truth.

Reloading the app should be possible from this document alone.

### Event Transport

Events are not the durable truth. They are a coordination layer used to push recent actions between clients.

Events may be compressed, marked handled, and eventually deleted after the workout completes.

## Proposed Firestore Shape

```ts
workoutSessions/{sessionId}
  id
  status
  userIds
  currentCursor
  items
  revision
  createdAt
  updatedAt
  completedAt?
  cancelledAt?

workoutSessions/{sessionId}/events/{eventId}
  id
  sessionId
  clientId
  clientSeq
  userId?
  type
  payload
  sessionRevisionSeen
  createdAt
  appliedRevision?
  supersedesEventIds?
  handledBy
```

## Client Identity

Each running app instance should have a stable `clientId` for the lifetime of that local install/session.

Each client maintains its own monotonically increasing `clientSeq`.

Together, `clientId + clientSeq` uniquely identifies an event.

Recommended event id:

```ts
`${clientId}:${clientSeq}`
```

Odd/even sequence numbers are not required. `clientId` already separates streams, and this works if a third client appears or a browser reload creates a new client identity.

## Event Fields

Example event:

```ts
{
  id: "mike-phone:42",
  sessionId: "session_abc",
  clientId: "mike-phone",
  clientSeq: 42,
  userId: "Mike",
  type: "completeSet",
  payload: {
    itemId: "item_seated_row",
    userId: "Mike",
    setIndex: 1,
    movementId: null,
    reps: 10,
    weight: 55,
    resultId: "mike-phone:42:result"
  },
  sessionRevisionSeen: 17,
  createdAt: serverTimestamp(),
  appliedRevision: 18,
  handledBy: {
    "victoria-phone": "2026-05-17T..."
  }
}
```

### `clientSeq`

Orders one client's own event stream and makes retry/deduplication straightforward.

### `sessionRevisionSeen`

Records the durable session revision the client believed it was acting on.

This helps detect stale actions and reason about conflicts.

### `appliedRevision`

Records the durable session revision after this event was applied to `workoutSessions/{sessionId}`.

This gives a canonical cross-client ordering after events settle.

### `handledBy`

Handled state must be per client.

A single `handled: true` field is unsafe because one client could hide an event before another client has processed it.

Use:

```ts
handledBy: {
  [clientId]: timestamp
}
```

## Event Types

Initial useful event types:

```ts
type SyncEventType =
  | "chooseFirstUser"
  | "adjustCurrentSet"
  | "completeSet"
  | "skipSet"
  | "postponeExercise"
  | "startWarmup"
  | "completeWarmup"
  | "cancelWorkout"
  | "completeWorkout";
```

### `chooseFirstUser`

Selects the user order for the current exercise.

Payload should include:

- `itemId`
- `firstUserId`
- `userOrder`
- expected cursor/revision information

### `adjustCurrentSet`

Changes the current reps and/or weight.

Payload should include:

- `itemId`
- `userId`
- `setIndex`
- `movementId`
- `reps`
- `weight`

This event type can be compressed. Repeated plus/minus taps can be represented as one final `adjustCurrentSet` event.

### `completeSet` / `skipSet`

Records a result and advances the cursor.

Payload should include:

- `resultId`
- `itemId`
- `userId`
- `setIndex`
- `movementId`
- `reps`
- `weight`
- `status`

These events must be idempotent. Applying the same event twice must not create two results.

### `postponeExercise`

Moves an exercise item later in the session order.

Payload should include:

- `itemId`
- previous order or index
- new order or index
- expected cursor/revision information

### `cancelWorkout` / `completeWorkout`

Lifecycle events.

Payload should include:

- expected status
- final timestamp
- optional summary fields

## Event Application Model

When a client performs an action:

1. Build an event with `clientId`, `clientSeq`, and `sessionRevisionSeen`.
2. Apply the event locally immediately.
3. Write the event to `workoutSessions/{sessionId}/events`.
4. Apply the event to `workoutSessions/{sessionId}` as the durable source of truth.
5. Increment the session `revision`.
6. Store `appliedRevision` on the event when known.

When another client receives an event:

1. Ignore events from its own `clientId` that it has already applied locally.
2. Check whether this client has already handled the event.
3. Apply the event locally if needed.
4. Optionally reload or patch from the durable session if revisions do not line up.
5. Mark the event handled under `handledBy[clientId]`.

## Ordering

There are three useful orderings:

- Per-client order: `clientSeq`.
- Approximate arrival/creation order: `createdAt`.
- Canonical durable order: `appliedRevision`.

The canonical order should be `appliedRevision`, because that reflects the order in which events changed the durable work order.

## Conflict Handling

Events should include enough identity to apply to the intended target, not just "whatever is currently on screen."

For example, a `completeSet` event should target:

- `itemId`
- `userId`
- `setIndex`
- `movementId`
- `resultId`

This allows another client to apply the event even if its local cursor is temporarily behind or ahead.

If an event's `sessionRevisionSeen` is older than the current durable session revision, the app can still apply it if the targeted item/set has not already been changed. If the target has already been changed, the event should be treated as a conflict and the app should prefer the durable session.

## Idempotency Rules

Every event should be safe to process more than once.

Important rules:

- `completeSet` and `skipSet` must include a stable `resultId`.
- A result with the same `resultId` should not be inserted twice.
- `postponeExercise` should move a specific `itemId`, not "the current item."
- `adjustCurrentSet` should set final values, not apply increments, when sent across sync.
- Lifecycle events should be no-ops if the session is already in the target status.

## Compression

Some events are noisy and should be compressed before sending or before durable application.

Good compression candidate:

- Repeated rep/weight stepper taps.

Recommended compressed event:

```ts
{
  type: "adjustCurrentSet",
  payload: {
    itemId,
    userId,
    setIndex,
    movementId,
    reps,
    weight
  },
  supersedesEventIds: [...]
}
```

Do not compress semantic actions like completing a set, skipping a set, postponing an exercise, or cancelling a workout.

## Reconnect And Reload

On app load or reconnect:

1. Load `workoutSessions/{sessionId}`.
2. Render from the durable session.
3. Subscribe to unhandled events newer than this client's last known point.
4. Apply relevant events if they are not already reflected in the session.

The app should always be able to recover from the session document even if the event stream is empty.

## Cleanup

Events are temporary.

Implemented behavior: after a workout is completed or cancelled, the client best-effort deletes event documents for all sessions that are no longer active. Sweeping all non-active sessions lets a later workout completion clean up event data left behind by an earlier failed cleanup.

Potential cleanup rule:

- Delete event docs for sessions with `status in ["completed", "cancelled"]` after a short retention window.

## Implementation Notes

For the first implementation, prefer correctness over cleverness:

- Use one event subcollection per workout session.
- Use deterministic event ids from `clientId + clientSeq`.
- Keep session `revision` on the durable session document.
- Apply major semantic events to the durable session immediately.
- Use `handledBy` per client.
- Make `adjustCurrentSet` set absolute values, not increments.

## Open Design Choices

- Whether durable event application happens directly in the client or through a Cloud Function.
- Whether session updates and event writes must be in a Firestore transaction.
- How long to retain handled events after workout completion.
- Whether clients need a persistent local store for `clientId`, `clientSeq`, and last handled event metadata.
- How much UI should be shown for conflicts versus silently converging to the durable session.
