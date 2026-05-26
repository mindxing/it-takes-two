import assert from "node:assert/strict";
import { initialSession, startWorkoutSession, type WorkoutSession } from "../src/workoutEngine.ts";
import {
  applyIncomingSessionState,
  cancelWorkoutState,
  isJoinableRemoteSession,
  joinRemoteSessionState,
  shouldApplyWorkoutEvent,
  shouldCleanupWorkoutSessionEvents,
  type SyncState,
} from "../src/workoutSync.ts";
import type { Exercise } from "../src/workoutData.ts";

const nowMs = new Date("2026-05-25T12:00:00.000Z").getTime();
const workout: Exercise[] = [{
  id: "press",
  name: "Press",
  sets: 1,
  reps: "8-12",
  defaultReps: 10,
  setPlan: [{ reps: 10, weightOffset: 0 }],
}];

function activeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    ...startWorkoutSession("session-1", workout),
    updatedAt: "2026-05-25T11:59:00.000Z",
    localRevision: 3,
    eventSequence: 7,
    ...overrides,
  };
}

function syncState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    session: initialSession,
    activeRemoteSession: null,
    latestLocalRevision: 0,
    latestEventSequence: 0,
    ...overrides,
  };
}

{
  const incoming = activeSession();
  const result = applyIncomingSessionState({
    state: syncState(),
    incoming,
    viewingPast: false,
    nowMs,
  });

  assert.equal(result.session, initialSession);
  assert.equal(result.activeRemoteSession, incoming);
  assert.equal(result.latestLocalRevision, 3);
  assert.equal(result.latestEventSequence, 7);
}

{
  const local = activeSession({ sessionId: "session-1", localRevision: 1, eventSequence: 1 });
  const incoming = activeSession({ currentSet: 2, localRevision: 5, eventSequence: 9 });
  const result = applyIncomingSessionState({
    state: syncState({ session: local, activeRemoteSession: local }),
    incoming,
    viewingPast: false,
    nowMs,
  });

  assert.equal(result.session.currentSet, 2);
  assert.equal(result.activeRemoteSession, incoming);
  assert.equal(result.latestLocalRevision, 5);
  assert.equal(result.latestEventSequence, 9);
}

{
  const local = activeSession({ sessionId: "local-session" });
  const stale = activeSession({
    sessionId: "stale-session",
    updatedAt: "2026-05-24T23:59:59.000Z",
  });
  const result = applyIncomingSessionState({
    state: syncState({ session: local, activeRemoteSession: local }),
    incoming: stale,
    viewingPast: false,
    nowMs,
  });

  assert.equal(isJoinableRemoteSession(stale, nowMs), false);
  assert.equal(result.session, local);
  assert.equal(result.activeRemoteSession, null);
}

{
  const local = activeSession();
  const completed = activeSession({
    status: "completed",
    complete: true,
    completedAt: "2026-05-25T12:05:00.000Z",
  });
  const result = applyIncomingSessionState({
    state: syncState({ session: local, activeRemoteSession: local }),
    incoming: completed,
    viewingPast: false,
    nowMs,
  });

  assert.equal(result.session, completed);
  assert.equal(result.activeRemoteSession, null);
}

{
  const local = activeSession();
  const completed = activeSession({
    status: "completed",
    complete: true,
    completedAt: "2026-05-25T12:05:00.000Z",
  });
  const result = applyIncomingSessionState({
    state: syncState({ session: local, activeRemoteSession: local }),
    incoming: completed,
    viewingPast: true,
    nowMs,
  });

  assert.equal(result.session, local);
  assert.equal(result.activeRemoteSession, null);
}

{
  const local = activeSession();
  const cancelled = activeSession({
    status: "cancelled",
    cancelledAt: "2026-05-25T12:03:00.000Z",
  });
  const result = applyIncomingSessionState({
    state: syncState({ session: local, activeRemoteSession: local }),
    incoming: cancelled,
    viewingPast: false,
    nowMs,
  });

  assert.deepEqual(result.session, initialSession);
  assert.equal(result.activeRemoteSession, null);
}

{
  const remote = activeSession();
  const result = joinRemoteSessionState({
    state: syncState(),
    remoteSession: remote,
    nowMs,
  });

  assert.equal(result.joined, true);
  assert.equal(result.state.session, remote);
  assert.equal(result.state.activeRemoteSession, remote);
}

{
  const cancelled = activeSession({ status: "cancelled" });
  const result = joinRemoteSessionState({
    state: syncState({ session: activeSession({ sessionId: "local" }) }),
    remoteSession: cancelled,
    nowMs,
  });

  assert.equal(result.joined, false);
  assert.deepEqual(result.state.session, initialSession);
  assert.equal(result.state.activeRemoteSession, null);
}

{
  const current = activeSession({ sessionId: "session-1" });

  assert.equal(shouldApplyWorkoutEvent(current, activeSession({ sessionId: "session-1" })), true);
  assert.equal(shouldApplyWorkoutEvent(current, activeSession({ sessionId: "session-2" })), false);
  assert.equal(shouldApplyWorkoutEvent(initialSession, activeSession({ sessionId: "session-2" })), true);
  assert.equal(shouldApplyWorkoutEvent(current, null), false);
}

{
  assert.equal(shouldCleanupWorkoutSessionEvents(activeSession()), false);
  assert.equal(shouldCleanupWorkoutSessionEvents(activeSession({ status: "completed", complete: true })), true);
  assert.equal(shouldCleanupWorkoutSessionEvents(activeSession({ status: "cancelled" })), true);
  assert.equal(shouldCleanupWorkoutSessionEvents({ status: "active", complete: true }), true);
  assert.equal(shouldCleanupWorkoutSessionEvents({ complete: false }), true);
}

{
  const clientAStarted = activeSession({ sessionId: "shared-session", currentSet: 1 });
  const clientB = applyIncomingSessionState({
    state: syncState(),
    incoming: clientAStarted,
    viewingPast: false,
    nowMs,
  });
  const joinedB = joinRemoteSessionState({
    state: clientB,
    remoteSession: clientB.activeRemoteSession,
    nowMs,
  });
  const clientAAdvanced = activeSession({ sessionId: "shared-session", currentSet: 2, eventSequence: 8 });
  const syncedB = applyIncomingSessionState({
    state: joinedB.state,
    incoming: clientAAdvanced,
    viewingPast: false,
    nowMs,
  });

  assert.equal(joinedB.joined, true);
  assert.equal(syncedB.session.currentSet, 2);
  assert.equal(syncedB.latestEventSequence, 8);
}

{
  const session = activeSession();
  const cancelled = cancelWorkoutState({
    session,
    cancelledAt: "2026-05-25T12:04:00.000Z",
  });

  assert.deepEqual(cancelled.localSession, initialSession);
  assert.equal(cancelled.activeRemoteSession, null);
  assert.equal(cancelled.cancelledSession.status, "cancelled");
  assert.equal(cancelled.cancelledSession.cancelledAt, "2026-05-25T12:04:00.000Z");
  assert.equal(cancelled.cancelledSession.sessionId, session.sessionId);
}

console.log("Workout sync tests passed.");
