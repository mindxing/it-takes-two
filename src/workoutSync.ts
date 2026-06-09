import { initialSession, type WorkoutSession } from "./workoutEngine.ts";

export const staleActiveSessionMs = 12 * 60 * 60 * 1000;

export type SyncState = {
  session: WorkoutSession;
  activeRemoteSession: WorkoutSession | null;
  latestLocalRevision: number;
  latestEventSequence: number;
};

export function isStaleActiveSession(incoming: WorkoutSession, nowMs: number) {
  return (
    incoming.status === "active" &&
    !incoming.complete &&
    !!incoming.updatedAt &&
    new Date(incoming.updatedAt).getTime() < nowMs - staleActiveSessionMs
  );
}

export function isJoinableRemoteSession(remoteSession: WorkoutSession | null, nowMs = Date.now()) {
  return (
    remoteSession?.status === "active" &&
    !remoteSession.complete &&
    !isStaleActiveSession(remoteSession, nowMs)
  );
}

export function shouldIgnoreStaleActiveSessionForCompletedLocal(
  incoming: WorkoutSession,
  locallyCompletedSessionIds: ReadonlySet<string>
) {
  return (
    !!incoming.sessionId &&
    locallyCompletedSessionIds.has(incoming.sessionId) &&
    incoming.status === "active" &&
    !incoming.complete
  );
}

export function applyIncomingSessionState({
  state,
  incoming,
  viewingPast,
  nowMs,
}: {
  state: SyncState;
  incoming: WorkoutSession;
  viewingPast: boolean;
  nowMs: number;
}): SyncState {
  const latestLocalRevision = Math.max(
    state.latestLocalRevision,
    incoming.localRevision ?? 0
  );
  const latestEventSequence = Math.max(
    state.latestEventSequence,
    incoming.eventSequence ?? 0
  );
  const sameSession = !!state.session.sessionId && incoming.sessionId === state.session.sessionId;
  const incomingRevision = incoming.localRevision ?? 0;
  const currentRevision = state.session.localRevision ?? 0;

  if (sameSession && incomingRevision < currentRevision) {
    return {
      session: state.session,
      activeRemoteSession: state.activeRemoteSession,
      latestLocalRevision,
      latestEventSequence,
    };
  }

  if (incoming.status === "completed" || incoming.complete) {
    return {
      session: state.session.started && !viewingPast ? incoming : state.session,
      activeRemoteSession: null,
      latestLocalRevision,
      latestEventSequence,
    };
  }

  if (isJoinableRemoteSession(incoming, nowMs)) {
    return {
      session: state.session.started && !state.session.complete ? incoming : state.session,
      activeRemoteSession: incoming,
      latestLocalRevision,
      latestEventSequence,
    };
  }

  return {
    session: incoming.status === "cancelled" ? initialSession : state.session,
    activeRemoteSession: null,
    latestLocalRevision,
    latestEventSequence,
  };
}

export function shouldApplyWorkoutEvent(currentSession: WorkoutSession, eventSession: WorkoutSession | null | undefined) {
  if (!eventSession) return false;
  if (currentSession.sessionId && eventSession.sessionId !== currentSession.sessionId) return false;
  return true;
}

export function shouldAcceptClientEventSequence({
  clientId,
  clientSequence,
  lastClientSequences,
}: {
  clientId?: string;
  clientSequence?: number;
  lastClientSequences: Record<string, unknown>;
}) {
  if (!clientId || !clientSequence) return true;

  return clientSequence > Number(lastClientSequences[clientId] ?? 0);
}

export function shouldCleanupWorkoutSessionEvents(
  session: Partial<Pick<WorkoutSession, "status" | "complete">> | null | undefined
) {
  return session?.status !== "active" || session.complete === true;
}

export function joinRemoteSessionState({
  state,
  remoteSession,
  nowMs,
}: {
  state: SyncState;
  remoteSession: WorkoutSession | null;
  nowMs: number;
}): { joined: boolean; state: SyncState } {
  if (remoteSession && isJoinableRemoteSession(remoteSession, nowMs)) {
    return {
      joined: true,
      state: {
        ...state,
        session: remoteSession,
        activeRemoteSession: remoteSession,
      },
    };
  }

  return {
    joined: false,
    state: {
      ...state,
      session: remoteSession?.status === "cancelled" ? initialSession : state.session,
      activeRemoteSession: null,
    },
  };
}

export function cancelWorkoutState({
  session,
  cancelledAt,
}: {
  session: WorkoutSession;
  cancelledAt: string;
}): { localSession: WorkoutSession; cancelledSession: WorkoutSession; activeRemoteSession: null } {
  return {
    localSession: initialSession,
    activeRemoteSession: null,
    cancelledSession: {
      ...session,
      status: "cancelled",
      cancelledAt,
    },
  };
}
