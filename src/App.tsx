import { useCallback, useEffect, useState, useRef } from "react";
import "./App.css";
import { CompletedMonumentsView, MonumentDashboard, MonumentMapView, TeamBuildProgress } from "./TeamBuildProgress";
import { people, workout, type Person, type Exercise } from "./workoutData";
import { setActiveWorkoutGroupId } from "./firebase";
import { loadWorkoutGroupsForUser } from "./groupData";
import { defaultWorkoutGroup, type WorkoutGroup } from "./groupModel";
import { chooseWorkoutGroup, defaultAssumedUserId, isAssumedUserId, type AssumedUserId } from "./groupSelection";
import { appendWorkoutEvent, cleanupEventsForNonActiveWorkoutSessions, listenToWorkoutEvents, listenToWorkoutSession, loadCurrentWorkoutSession } from "./workoutSession";
import { finalizeCompletedWorkout, loadCompletedWorkoutSummaries, loadCurrentBaselineStates, loadUserProfileSettings, loadWorkoutPlan, calculateExerciseOutcomes, calculateProgressedUserProfilesFromHistory, saveCurrentBaselineStates, type BaselineProgressionStrategy, type SetResult, type ExerciseOutcomes, type UserBaselines, type WorkoutEventType } from "./workoutSession";
import {
  activeWeightKey,
  activeMovement,
  adjustCurrentReps,
  adjustCurrentWeight,
  chooseFirstPerson,
  completeWarmup,
  exerciseKey,
  initialSession,
  postponeCurrentExercise,
  recordSetAndAdvance,
  startWarmup,
  startWorkoutSession,
  switchToTandemCompanion,
  tandemCompanionPrompt,
  type SetStatus,
  type WeightStrategy,
  type WorkoutSession,
} from "./workoutEngine";
import {
  applyIncomingSessionState,
  cancelWorkoutState,
  joinRemoteSessionState,
  shouldApplyWorkoutEvent,
  shouldIgnoreStaleActiveSessionForCompletedLocal,
} from "./workoutSync";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { loadActiveTeamBuild, type TeamBuildState } from "./teamBuilds";

declare const __APP_VERSION__: string;

type PendingAction =
  | "start"
  | "warmup"
  | "choose-first"
  | "postpone"
  | "skip"
  | "done";

const APP_VERSION = __APP_VERSION__;
const CLIENT_ID =
  globalThis.crypto?.randomUUID?.() ??
  `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ASSUMED_USER_ID: AssumedUserId = isAssumedUserId(import.meta.env.VITE_ASSUMED_USER_ID)
  ? import.meta.env.VITE_ASSUMED_USER_ID
  : defaultAssumedUserId;
const SYNC_LATENCY_DELAY_MS = configuredSyncLatencyDelayMs();

type CompletedWorkout = {
  id: string;
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: ExerciseOutcomes;
  results: SetResult[];
};

type OutboundSessionEvent = {
  eventType: WorkoutEventType;
  session: WorkoutSession;
  clientSequence: number;
};

function configuredSyncLatencyDelayMs() {
  const params = new URLSearchParams(globalThis.location.search);
  const queryValue = params.get("syncDelayMs");

  if (queryValue !== null) {
    const delayMs = Math.max(0, Number(queryValue) || 0);

    if (delayMs > 0) {
      globalThis.localStorage.setItem("syncDelayMs", String(delayMs));
    } else {
      globalThis.localStorage.removeItem("syncDelayMs");
    }

    return delayMs;
  }

  return Math.max(0, Number(globalThis.localStorage.getItem("syncDelayMs")) || 0);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function simulateSyncLatency() {
  if (SYNC_LATENCY_DELAY_MS <= 0) return;
  await wait(SYNC_LATENCY_DELAY_MS);
}

const defaultUserProfiles: Record<Person, Record<string, number>> = {
  Mike: {
    leg_press: 200,
    chest_press_machine: 65,
    seated_row_machine: 55,
    lat_pulldown: 105,
    bicep_curl_machine: 35,
    tricep_pushdown: 85,
    seated_dip: 85,
    abs: 50,
    dumbbell_romanian_deadlift: 35,
  },
  Victoria: {
    leg_press: 95,
    chest_press_machine: 25,
    seated_row_machine: 35,
    lat_pulldown: 50,
    bicep_curl_machine: 10,
    tricep_pushdown: 30,
    seated_dip: 30,
    abs: 0,
    dumbbell_romanian_deadlift: 20,
  },
};

function baselineStatesFromWeights(weights: Record<Person, Record<string, number>>): Record<Person, UserBaselines> {
  return {
    Mike: Object.fromEntries(
      Object.entries(weights.Mike).map(([exerciseId, weight]) => [exerciseId, { weight, successStreak: 0 }])
    ),
    Victoria: Object.fromEntries(
      Object.entries(weights.Victoria).map(([exerciseId, weight]) => [exerciseId, { weight, successStreak: 0 }])
    ),
  };
}

function weightsFromBaselineStates(baselines: Record<Person, UserBaselines>) {
  return {
    Mike: Object.fromEntries(
      Object.entries(baselines.Mike).map(([exerciseId, baseline]) => [exerciseId, baseline.weight])
    ),
    Victoria: Object.fromEntries(
      Object.entries(baselines.Victoria).map(([exerciseId, baseline]) => [exerciseId, baseline.weight])
    ),
  } as Record<Person, Record<string, number>>;
}

const defaultUserStrategies: Record<Person, WeightStrategy> = {
  Mike: "pyramid",
  Victoria: "straight",
};
const defaultBaselineProgressionStrategies: Record<Person, BaselineProgressionStrategy> = {
  Mike: "medium",
  Victoria: "straight",
};
const weightStepOptions = [1, 2.5, 5, 10, 15, 20];
type BaselineChangeSymbol = "up" | "same" | "down";
type BaselineChangeDetail = {
  symbol: BaselineChangeSymbol;
  text: string;
};
type BaselineChangeRow = {
  id: string;
  label: string;
  changes: Record<Person, BaselineChangeDetail>;
};

type WorkoutProgressProps = {
  exerciseIndex: number;
  workout: Exercise[];
};

function baselineTargetsForWorkout(workoutPlan: Exercise[]) {
  return workoutPlan
    .filter((item) => exerciseKey(item) !== "warm_up")
    .flatMap((item) => {
      if (item.movements && item.movements.length > 0) {
        return item.movements.map((movement) => ({
          id: movement.id,
          label: `${item.name}: ${movement.name}`,
        }));
      }

      return [{
        id: exerciseKey(item),
        label: item.name,
      }];
    });
}

function baselineChangeSymbol(oldWeight: number, newWeight: number): BaselineChangeSymbol {
  if (newWeight > oldWeight) return "up";
  if (newWeight < oldWeight) return "down";
  return "same";
}

function baselineChangeLabel(change: BaselineChangeSymbol) {
  if (change === "up") return "+";
  if (change === "down") return "-";
  return "=";
}

function baselineSuccessTarget(strategy: BaselineProgressionStrategy) {
  if (strategy === "fast") return 2;
  if (strategy === "medium") return 3;
  if (strategy === "slow") return 4;
  return null;
}

function formatBaselineChangeDetail(
  oldWeight: number,
  oldStreak: number,
  newWeight: number,
  newStreak: number,
  strategy: BaselineProgressionStrategy
): BaselineChangeDetail {
  const symbol = baselineChangeSymbol(oldWeight, newWeight);

  if (symbol !== "same") {
    return {
      symbol,
      text: `${oldWeight} -> ${newWeight} lb`,
    };
  }

  const target = baselineSuccessTarget(strategy);

  if (!target) {
    return {
      symbol,
      text: "No auto change",
    };
  }

  if (newStreak > oldStreak) {
    return {
      symbol,
      text: `Streak ${newStreak}/${target}`,
    };
  }

  return {
    symbol,
    text: `Streak ${newStreak}/${target}`,
  };
}

function resultMatchesExercise(result: SetResult, exercise: Exercise) {
  return result.exerciseId === exerciseKey(exercise) || (!result.exerciseId && result.exerciseName === exercise.name);
}

function formatWeightStep(step: number) {
  return Number.isInteger(step) ? String(step) : String(step).replace(/\.0$/, "");
}

function WorkoutProgress({ exerciseIndex, workout }: WorkoutProgressProps) {
  const totalExercises = workout.length;
  const currentNumber = exerciseIndex + 1;

  return (
    <div className="progress-block">
      <div className="progress-text">
        Exercise {currentNumber} of {totalExercises}
      </div>

      <div className="progress-dots">
        {workout.map((item, index) => (
          <span
            key={exerciseKey(item)}
            className={
              index === exerciseIndex
                ? "progress-dot current"
                : index < exerciseIndex
                  ? "progress-dot done"
                  : "progress-dot"
            }
          />
        ))}
      </div>
    </div>
  );
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function createSessionId() {
  return `workout-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${CLIENT_ID.slice(-6)}`;
}

function App() {
  const [session, setSession] = useState<WorkoutSession>(initialSession);
  const [baseWorkout, setBaseWorkout] = useState<Exercise[]>(workout);
  const [activeRemoteSession, setActiveRemoteSession] = useState<WorkoutSession | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBaselineChanges, setShowBaselineChanges] = useState(false);
  const [showWeightStepPicker, setShowWeightStepPicker] = useState(false);
  const [baselineChangeRows, setBaselineChangeRows] = useState<BaselineChangeRow[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<Person, Record<string, number>>>(defaultUserProfiles);
  const [userBaselineStates, setUserBaselineStates] =
    useState<Record<Person, UserBaselines>>(baselineStatesFromWeights(defaultUserProfiles));
  const [userStrategies, setUserStrategies] = useState<Record<Person, WeightStrategy>>(defaultUserStrategies);
  const [baselineProgressionStrategies, setBaselineProgressionStrategies] =
    useState<Record<Person, BaselineProgressionStrategy>>(defaultBaselineProgressionStrategies);
  const [viewingPast, setViewingPast] = useState(false);
  const [pastSession, setPastSession] = useState<WorkoutSession | null>(null);
  const [viewingTeamBuild, setViewingTeamBuild] = useState(false);
  const [monumentView, setMonumentView] = useState<"home" | "completed" | "map">("home");
  const [teamBuild, setTeamBuild] = useState<TeamBuildState | null>(null);
  const [warmupSeconds, setWarmupSeconds] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [completionError, setCompletionError] = useState("");
  const [workoutPlanLoaded, setWorkoutPlanLoaded] = useState(false);
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);
  const [tandemExerciseId, setTandemExerciseId] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<WorkoutGroup | null>(null);
  const [availableGroups, setAvailableGroups] = useState<WorkoutGroup[]>([]);
  const [groupStatus, setGroupStatus] = useState<"loading" | "ready" | "needs-selection">("loading");
  const sessionRef = useRef(session);
  const activeRemoteSessionRef = useRef<WorkoutSession | null>(null);
  const viewingPastRef = useRef(viewingPast);
  const latestLocalRevisionRef = useRef(0);
  const latestEventSequenceRef = useRef(0);
  const clientEventSequenceRef = useRef(0);
  const outboundEventsRef = useRef<OutboundSessionEvent[]>([]);
  const outboundFlushTimerRef = useRef<number | null>(null);
  const outboundFlushInFlightRef = useRef(false);
  const clientIdRef = useRef(CLIENT_ID);
  const locallyCompletedSessionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    viewingPastRef.current = viewingPast;
  }, [viewingPast]);

  useEffect(() => {
    activeRemoteSessionRef.current = activeRemoteSession;
  }, [activeRemoteSession]);

  const effectiveWorkout = session.reorderedWorkout || baseWorkout;
  const warmupRunning = !!session.warmupStartedAt && session.exerciseIndex === 0;
  const exercise = effectiveWorkout[session.exerciseIndex];
  const movement = exercise ? activeMovement(exercise, session.currentMovementIndex ?? 0) : null;
  const currentPerson = session.firstPerson ? session.exerciseOrder[session.currentPersonIndex] : null;
  const currentWeightKey = exercise ? activeWeightKey(exercise, movement) : "";
  const currentWeightStep = currentPerson && currentWeightKey
    ? userBaselineStates[currentPerson]?.[currentWeightKey]?.weightStep ?? 5
    : 5;
  const tandemCompanion = session.tandem
    ? tandemCompanionPrompt({
      session,
      workout: effectiveWorkout,
      userProfiles,
      userStrategies,
    })
    : null;
  const availableTandemExercises = session.started && !session.firstPerson && session.exerciseIndex > 0
    ? effectiveWorkout.slice(session.exerciseIndex + 1).filter((item) => exerciseKey(item) !== "warm_up")
    : [];
  const activeGroupId = selectedGroup?.id ?? "";
  const readyToStart = workoutPlanLoaded && userSettingsLoaded;

  const setLocalSession = useCallback((nextSession: WorkoutSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const chooseGroup = useCallback((group: WorkoutGroup) => {
    clearPendingOutboundFlush();
    outboundEventsRef.current = [];
    setActiveWorkoutGroupId(group.id);
    latestLocalRevisionRef.current = 0;
    latestEventSequenceRef.current = 0;
    clientEventSequenceRef.current = 0;
    locallyCompletedSessionIdsRef.current.clear();
    activeRemoteSessionRef.current = null;
    setActiveRemoteSession(null);
    setViewingPast(false);
    setPastSession(null);
    setViewingTeamBuild(false);
    setMonumentView("home");
    setTeamBuild(null);
    setTandemExerciseId("");
    setCompletionError("");
    setCompletedWorkouts([]);
    setWorkoutPlanLoaded(false);
    setUserSettingsLoaded(false);
    setUserBaselineStates(baselineStatesFromWeights(defaultUserProfiles));
    setUserProfiles(defaultUserProfiles);
    setUserStrategies(defaultUserStrategies);
    setBaselineProgressionStrategies(defaultBaselineProgressionStrategies);
    setLocalSession(initialSession);
    setSelectedGroup(group);
    setGroupStatus("ready");
  }, [setLocalSession]);

  function prepareLocalSession(nextSession: WorkoutSession) {
    const nextRevision =
      Math.max(nextSession.localRevision ?? 0, latestLocalRevisionRef.current) + 1;

    latestLocalRevisionRef.current = nextRevision;

    return {
      ...nextSession,
      localRevision: nextRevision,
      lastWriterId: clientIdRef.current,
    };
  }

  function clearPendingOutboundFlush() {
    if (outboundFlushTimerRef.current !== null) {
      window.clearTimeout(outboundFlushTimerRef.current);
      outboundFlushTimerRef.current = null;
    }
  }

  const applyIncomingSession = useCallback((incoming: WorkoutSession) => {
    if (shouldIgnoreStaleActiveSessionForCompletedLocal(incoming, locallyCompletedSessionIdsRef.current)) {
      return;
    }

    const next = applyIncomingSessionState({
      state: {
        session: sessionRef.current,
        activeRemoteSession: activeRemoteSessionRef.current,
        latestLocalRevision: latestLocalRevisionRef.current,
        latestEventSequence: latestEventSequenceRef.current,
      },
      incoming,
      viewingPast: viewingPastRef.current,
      nowMs: Date.now(),
    });

    latestLocalRevisionRef.current = next.latestLocalRevision;
    latestEventSequenceRef.current = next.latestEventSequence;
    activeRemoteSessionRef.current = next.activeRemoteSession;
    setActiveRemoteSession(next.activeRemoteSession);

    if (next.session !== sessionRef.current) {
      setLocalSession(next.session);
    }
  }, [setLocalSession]);

  function nextClientSequence() {
    clientEventSequenceRef.current += 1;
    return clientEventSequenceRef.current;
  }

  async function flushOutboundEvents() {
    clearPendingOutboundFlush();

    if (outboundFlushInFlightRef.current) return;
    outboundFlushInFlightRef.current = true;

    try {
      await simulateSyncLatency();

      while (outboundEventsRef.current.length > 0) {
        const nextEvent = outboundEventsRef.current[0];
        const actorId = nextEvent.session.firstPerson
          ? nextEvent.session.exerciseOrder[nextEvent.session.currentPersonIndex]
          : undefined;

        const savedEvent = await appendWorkoutEvent(nextEvent.eventType, {
          sessionId: nextEvent.session.sessionId,
          actorId,
          clientId: clientIdRef.current,
          clientSequence: nextEvent.clientSequence,
          session: nextEvent.session,
        });

        latestEventSequenceRef.current = Math.max(latestEventSequenceRef.current, savedEvent.sequence);
        outboundEventsRef.current.shift();
      }
    } catch (error) {
      console.error("Failed to flush workout events:", error);
      scheduleOutboundFlush();
    } finally {
      outboundFlushInFlightRef.current = false;
    }
  }

  function scheduleOutboundFlush(delayMs = 2000) {
    if (outboundFlushTimerRef.current !== null) {
      window.clearTimeout(outboundFlushTimerRef.current);
    }

    outboundFlushTimerRef.current = window.setTimeout(() => {
      flushOutboundEvents();
    }, delayMs);
  }

  function enqueuePreparedSession(nextSession: WorkoutSession, eventType: WorkoutEventType = "updateSession", delayMs = 2000) {
    outboundEventsRef.current.push({
      eventType,
      session: nextSession,
      clientSequence: nextClientSequence(),
    });
    scheduleOutboundFlush(delayMs);
  }

  async function savePreparedSession(nextSession: WorkoutSession, eventType: WorkoutEventType = "updateSession") {
    const actorId = nextSession.firstPerson
      ? nextSession.exerciseOrder[nextSession.currentPersonIndex]
      : undefined;

    await simulateSyncLatency();

    const event = await appendWorkoutEvent(eventType, {
      sessionId: nextSession.sessionId,
      actorId,
      clientId: clientIdRef.current,
      clientSequence: nextClientSequence(),
      session: nextSession,
    });

    latestEventSequenceRef.current = Math.max(latestEventSequenceRef.current, event.sequence);
  }

  async function commitSession(nextSession: WorkoutSession, action?: PendingAction, eventType: WorkoutEventType = "updateSession") {
    const prepared = prepareLocalSession(nextSession);

    if (action) {
      setPendingAction(action);
    }

    setLocalSession(prepared);
    enqueuePreparedSession(prepared, eventType);

    if (action) {
      setPendingAction((current) => current === action ? null : current);
    }

    return prepared;
  }

  function updateStepperSession(update: (current: WorkoutSession) => WorkoutSession) {
    const prepared = prepareLocalSession(update(sessionRef.current));
    setLocalSession(prepared);
    enqueuePreparedSession(prepared, "adjustSet");
  }

  function chooseCurrentWeightStep(nextStep: number) {
    if (!currentPerson || !currentWeightKey) return;

    const nextBaselineStates = {
      ...userBaselineStates,
      [currentPerson]: {
        ...userBaselineStates[currentPerson],
        [currentWeightKey]: {
          weight: userBaselineStates[currentPerson]?.[currentWeightKey]?.weight ?? userProfiles[currentPerson]?.[currentWeightKey] ?? 0,
          successStreak: userBaselineStates[currentPerson]?.[currentWeightKey]?.successStreak ?? 0,
          weightStep: nextStep,
        },
      },
    };

    setUserBaselineStates(nextBaselineStates);
    setShowWeightStepPicker(false);

    saveCurrentBaselineStates(currentPerson, nextBaselineStates[currentPerson]).catch((error) => {
      console.error("Failed to save weight step:", error);
    });
  }

  async function swapTandemTarget() {
    if (!sessionRef.current.tandem || pendingAction) return;

    const workoutForSession = sessionRef.current.reorderedWorkout || baseWorkout;
    const nextSession = switchToTandemCompanion({
      session: sessionRef.current,
      workout: workoutForSession,
      userProfiles,
      userStrategies,
    });

    if (nextSession !== sessionRef.current) {
      await commitSession(nextSession, undefined, "updateSession");
    }
  }

  useEffect(() => {
    return () => clearPendingOutboundFlush();
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadWorkoutGroupsForUser(ASSUMED_USER_ID)
      .then((groups) => {
        if (cancelled) return;

        const selection = chooseWorkoutGroup(groups, ASSUMED_USER_ID);

        if (selection.status === "selected") {
          chooseGroup(selection.group);
        } else if (selection.status === "needs-selection") {
          setAvailableGroups(selection.groups);
          setGroupStatus("needs-selection");
        } else {
          chooseGroup(defaultWorkoutGroup);
        }
      })
      .catch((error) => {
        console.error("Failed to load workout groups, using default group:", error);

        if (!cancelled) {
          chooseGroup(defaultWorkoutGroup);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chooseGroup]);

  useEffect(() => {
    if (!selectedGroup) return;

    const unsubscribe = listenToWorkoutSession((data) => {
      const incoming = data as WorkoutSession;
      applyIncomingSession(incoming);
    });

    return () => unsubscribe();
  }, [applyIncomingSession, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) return;

    const unsubscribe = listenToWorkoutEvents((event) => {
      const eventSession = event.payload.session as WorkoutSession | undefined;

      if (!eventSession) return;
      if (!shouldApplyWorkoutEvent(sessionRef.current, eventSession)) return;

      applyIncomingSession({
        ...eventSession,
        eventSequence: event.sequence,
      });
    });

    return () => unsubscribe();
  }, [applyIncomingSession, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) return;

    loadCompletedWorkoutSummaries()
      .then(setCompletedWorkouts)
      .catch((error) => {
        console.error("Failed to load completed workouts:", error);
        setCompletedWorkouts([]);
      });
  }, [activeGroupId, selectedGroup, session.complete]);

  useEffect(() => {
    if (!selectedGroup) return;

    loadActiveTeamBuild()
      .then(setTeamBuild)
      .catch((error) => {
        console.error("Failed to load team build:", error);
        setTeamBuild(null);
      });
  }, [activeGroupId, selectedGroup, session.complete]);

  useEffect(() => {
    if (!selectedGroup) return;

    loadWorkoutPlan(workout)
      .then((loadedWorkout) => {
        setBaseWorkout(loadedWorkout);
        setWorkoutPlanLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load workout plan, using local fallback:", error);
        setBaseWorkout(workout);
        setWorkoutPlanLoaded(true);
      });
  }, [activeGroupId, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) return;

    const defaultBaselineStates = baselineStatesFromWeights(defaultUserProfiles);

    Promise.all([
      loadCurrentBaselineStates(defaultUserProfiles),
      loadUserProfileSettings({
        progressionStrategies: defaultUserStrategies,
        baselineProgressionStrategies: defaultBaselineProgressionStrategies,
      }),
    ]).then(([baselineStates, { progressionStrategies, baselineProgressionStrategies }]) => {
      const nextBaselineStates = {
        Mike: { ...defaultBaselineStates.Mike, ...baselineStates.Mike },
        Victoria: { ...defaultBaselineStates.Victoria, ...baselineStates.Victoria },
      };

      setUserBaselineStates(nextBaselineStates);
      setUserProfiles(weightsFromBaselineStates(nextBaselineStates));
      setUserStrategies({
        Mike: progressionStrategies.Mike ?? defaultUserStrategies.Mike,
        Victoria: progressionStrategies.Victoria ?? defaultUserStrategies.Victoria,
      });
      setBaselineProgressionStrategies({
        Mike: baselineProgressionStrategies.Mike ?? defaultBaselineProgressionStrategies.Mike,
        Victoria: baselineProgressionStrategies.Victoria ?? defaultBaselineProgressionStrategies.Victoria,
      });
    }).catch((error) => {
      console.error("Failed to load user settings, using defaults:", error);
    }).finally(() => {
      setUserSettingsLoaded(true);
    });
  }, [activeGroupId, selectedGroup]);

  useEffect(() => {
    if (!session.warmupStartedAt || session.exerciseIndex !== 0) {
      return;
    }

    const updateWarmupSeconds = () => {
      setWarmupSeconds(
        Math.max(0, Math.floor((Date.now() - new Date(session.warmupStartedAt!).getTime()) / 1000))
      );
    };

    updateWarmupSeconds();

    const intervalId = window.setInterval(() => {
      updateWarmupSeconds();
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [session.warmupStartedAt, session.exerciseIndex]);

  async function cancelWorkout() {
    if (pendingAction) return;

    clearPendingOutboundFlush();
    outboundEventsRef.current = [];
    setCompletionError("");

    const cancelled = cancelWorkoutState({
      session: sessionRef.current,
      cancelledAt: new Date().toISOString(),
    });
    const cancelledSession = prepareLocalSession(cancelled.cancelledSession);

    setActiveRemoteSession(cancelled.activeRemoteSession);
    activeRemoteSessionRef.current = cancelled.activeRemoteSession;
    setLocalSession(cancelled.localSession);
    setTandemExerciseId("");

    savePreparedSession(cancelledSession, "cancelWorkout")
      .then(() => cleanupEventsForNonActiveWorkoutSessions().catch((error) => {
        console.error("Failed to clean up workout events:", error);
      }))
      .catch((error) => {
        console.error("Failed to cancel workout:", error);
      });
  }

  function returnHome() {
    activeRemoteSessionRef.current = null;
    setActiveRemoteSession(null);
    setLocalSession(initialSession);
    setTandemExerciseId("");
    setCompletionError("");
  }

  async function joinActiveWorkout() {
    let remoteSession = activeRemoteSessionRef.current;

    try {
      remoteSession = (await loadCurrentWorkoutSession()) as WorkoutSession | null;
    } catch (error) {
      console.error("Failed to load latest workout session:", error);
    }

    const joined = joinRemoteSessionState({
      state: {
        session: sessionRef.current,
        activeRemoteSession: activeRemoteSessionRef.current,
        latestLocalRevision: latestLocalRevisionRef.current,
        latestEventSequence: latestEventSequenceRef.current,
      },
      remoteSession,
      nowMs: Date.now(),
    });

    setActiveRemoteSession(joined.state.activeRemoteSession);
    activeRemoteSessionRef.current = joined.state.activeRemoteSession;

    if (joined.state.session !== sessionRef.current) {
      setLocalSession(joined.state.session);
    }

    return joined.joined;
  }

  async function recordSet(status: SetStatus) {
    const action = status === "skipped" ? "skip" : "done";

    if (pendingAction === action) return;
    setCompletionError("");

    const completedAt = new Date().toISOString();
    const newSession = recordSetAndAdvance({
      session: sessionRef.current,
      workout: effectiveWorkout,
      userProfiles,
      userStrategies,
      status,
      completedAt,
      createSessionId,
    });

    if (newSession.complete) {
      setPendingAction(action);

      const completedResults = newSession.results.filter(
        (r) => r.status === "completed"
      );
      const totalSets = completedResults.length;
      const totalWeightLifted = completedResults.reduce(
        (sum, r) => sum + r.weight * r.reps,
        0
      );
      const exerciseOutcomes = calculateExerciseOutcomes(
        newSession.results,
        effectiveWorkout,
        userProfiles,
        userStrategies
      );
      const completedSessionId = newSession.sessionId ?? createSessionId();
      newSession.sessionId = completedSessionId;
      const preparedCompletedSession = prepareLocalSession(newSession);

      const completedSummary = {
        sessionId: completedSessionId,
        completedAt,
        totalSets,
        totalWeightLifted,
        exerciseOutcomes,
        results: newSession.results,
      };
      const { updatedProfiles, updatedBaselineStates } = calculateProgressedUserProfilesFromHistory(
        userProfiles,
        userBaselineStates,
        effectiveWorkout,
        [...completedWorkouts, completedSummary],
        baselineProgressionStrategies,
        userStrategies
      );
      const changeRows = baselineTargetsForWorkout(effectiveWorkout).map((target) => ({
        id: target.id,
        label: target.label,
        changes: {
          Mike: formatBaselineChangeDetail(
            userBaselineStates.Mike[target.id]?.weight ?? userProfiles.Mike[target.id] ?? 0,
            userBaselineStates.Mike[target.id]?.successStreak ?? 0,
            updatedBaselineStates.Mike[target.id]?.weight ?? updatedProfiles.Mike[target.id] ?? userProfiles.Mike[target.id] ?? 0,
            updatedBaselineStates.Mike[target.id]?.successStreak ?? 0,
            baselineProgressionStrategies.Mike
          ),
          Victoria: formatBaselineChangeDetail(
            userBaselineStates.Victoria[target.id]?.weight ?? userProfiles.Victoria[target.id] ?? 0,
            userBaselineStates.Victoria[target.id]?.successStreak ?? 0,
            updatedBaselineStates.Victoria[target.id]?.weight ?? updatedProfiles.Victoria[target.id] ?? userProfiles.Victoria[target.id] ?? 0,
            updatedBaselineStates.Victoria[target.id]?.successStreak ?? 0,
            baselineProgressionStrategies.Victoria
          ),
        },
      }));

      try {
        const finalizeResult = await finalizeCompletedWorkout({
          sessionId: completedSessionId,
          summary: completedSummary,
          baselineStates: updatedBaselineStates,
          session: preparedCompletedSession,
          teamBuildContribution: {
            contributedByUserIds: people,
            weight: totalWeightLifted,
          },
        });
        cleanupEventsForNonActiveWorkoutSessions().catch((error) => {
          console.error("Failed to clean up workout events:", error);
        });

        locallyCompletedSessionIdsRef.current.add(completedSessionId);
        activeRemoteSessionRef.current = null;
        setActiveRemoteSession(null);
        setLocalSession(preparedCompletedSession);

        if (finalizeResult.created) {
          setUserBaselineStates(updatedBaselineStates);
          setUserProfiles(updatedProfiles);
          setBaselineChangeRows(changeRows);
          setShowBaselineChanges(true);
          setCompletedWorkouts((current) => [
            ...current.filter((workout) => workout.id !== completedSessionId),
            { id: completedSessionId, ...completedSummary },
          ]);
          loadActiveTeamBuild()
            .then(setTeamBuild)
            .catch((error) => {
              console.error("Failed to reload team build:", error);
            });
        } else {
          setBaselineChangeRows([]);
          setShowBaselineChanges(false);
        }
      } catch (error) {
        console.error("Failed to finalize workout:", error);
        setCompletionError("Workout was not saved. Keep this screen open and tap Done / Next again.");
        return;
      } finally {
        setPendingAction((current) => current === action ? null : current);
      }
    } else {
      await commitSession(newSession, action, status === "skipped" ? "skipSet" : "completeSet");
    }
  }

  if (groupStatus === "loading") {
    return (
      <main className="app">
        <section className="card">
          <h1>It Takes Two</h1>
          <p className="subtitle">Loading workout group...</p>
        </section>
      </main>
    );
  }

  if (groupStatus === "needs-selection") {
    return (
      <main className="app">
        <section className="card">
          <h1>It Takes Two</h1>
          <p className="subtitle">Choose a workout group</p>

          <div className="group-list">
            {availableGroups.map((group) => (
              <button
                key={group.id}
                className="secondary-button"
                onClick={() => chooseGroup(group)}
              >
                {group.name}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (viewingTeamBuild && teamBuild) {
    return (
      <TeamBuildProgress
        state={teamBuild}
        onBack={() => setViewingTeamBuild(false)}
      />
    );
  }

  if (monumentView === "completed" && teamBuild) {
    return (
      <CompletedMonumentsView
        state={teamBuild}
        onBack={() => setMonumentView("home")}
      />
    );
  }

  if (monumentView === "map" && teamBuild) {
    return (
      <MonumentMapView
        state={teamBuild}
        onBack={() => setMonumentView("home")}
      />
    );
  }

  if (session.complete || viewingPast) {
    const currentSession = viewingPast && pastSession ? pastSession : session;

    const completedResults = currentSession.results.filter(
      (r) => r.status === "completed"
    );

    const totalSets = completedResults.length;

    const totalWeightLifted = completedResults.reduce(
      (sum, r) => sum + r.weight * r.reps,
      0
    );

    const workoutForSummary = currentSession.reorderedWorkout || baseWorkout;
    const exercisesWithResults = workoutForSummary
      .filter((exercise) => exerciseKey(exercise) !== "warm_up")
      .map((exercise) => ({
        name: exercise.name,
        results: currentSession.results.filter((r) => resultMatchesExercise(r, exercise)),
      }))
      .filter((exercise) => exercise.results.length > 0);

    return (
      <main className="app">
        <section className="card summary-card">
          <h1>{viewingPast ? "Workout Results" : "Workout Complete 🎉"}</h1>
          <p className="subtitle">{viewingPast ? "Past workout summary" : "Nice work, both of you."}</p>

          {!viewingPast && showBaselineChanges && (
            <div className="modal-backdrop" role="presentation">
              <div className="modal" role="dialog" aria-modal="true" aria-labelledby="baseline-changes-title">
                <h2 id="baseline-changes-title">Baseline Updates</h2>

                <table className="baseline-table">
                  <thead>
                    <tr>
                      <th>Exercise</th>
                      {people.map((person) => (
                        <th key={person}>{person}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {baselineChangeRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        {people.map((person) => (
                          <td key={person} className={`baseline-change ${row.changes[person].symbol}`}>
                            <div className="baseline-symbol">
                              {baselineChangeLabel(row.changes[person].symbol)}
                            </div>
                            <div className="baseline-detail">
                              {row.changes[person].text}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  className="primary-button"
                  onClick={() => setShowBaselineChanges(false)}
                >
                  OK
                </button>
              </div>
            </div>
          )}

          <div className="workout-detail">
            <p>
              <strong>Total sets:</strong> {totalSets}
            </p>
            <p>
              <strong>Total weight lifted:</strong> {totalWeightLifted} lbs!
            </p>
          </div>

          <p>Debug: {completedWorkouts.length} completed workouts loaded</p>

          {completedWorkouts.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={completedWorkouts
                  .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
                  .map((workout) => ({
                    date: new Date(workout.completedAt).toLocaleDateString(),
                    totalWeightLifted: workout.totalWeightLifted,
                  }))}
              >
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="totalWeightLifted" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          )}

          <button
            className="link-button"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>

          {showDetails && (
            <div className="summary-details">
              {exercisesWithResults.map((exercise) => (
                <div className="summary-exercise" key={exercise.name}>
                  <h2>{exercise.name}</h2>

                  {(["Victoria", "Mike"] as Person[]).map((person) => {
                    const personResults = exercise.results.filter(
                      (r) => r.person === person
                    );

                    if (personResults.length === 0) return null;

                    return (
                      <p key={person}>
                        <strong>{person}:</strong>{" "}
                        {personResults
                          .map((r) =>
                            r.status === "skipped"
                              ? `Set ${r.setNumber}: skipped`
                              : `${r.movementName ? `${r.movementName} ` : ""}${r.weight}x${r.reps}`
                          )
                          .join(", ")}
                      </p>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <button
            className="primary-button"
            onClick={() => {
              if (viewingPast) {
                setViewingPast(false);
                setPastSession(null);
              } else {
                returnHome();
              }
            }}
          >
            Back to Home
          </button>
        </section>
      </main>
    );
  }

  if (!session.started) {
    return (
      <main className="app">
        <section className="card monument-card home-monument-card">
          {teamBuild ? (
            <MonumentDashboard state={teamBuild} groupName={selectedGroup?.name ?? "Mike & Victoria"} />
          ) : (
            <>
              <h1>It Takes Two</h1>
              <p className="subtitle">{selectedGroup?.name ?? "Mike & Victoria"} workout tracker</p>
            </>
          )}

          <button
            className={teamBuild ? "primary-button home-start-button" : "primary-button"}
            disabled={pendingAction === "start" || !readyToStart}
            onClick={async () => {
              if (pendingAction === "start" || !readyToStart) return;

              setPendingAction("start");

              try {
                if (await joinActiveWorkout()) {
                  return;
                }

                const newSession = startWorkoutSession(createSessionId(), baseWorkout);

                await commitSession(newSession, "start", "startWorkout");
              } catch (error) {
                console.error("Failed to save session:", error);
              } finally {
                setPendingAction((current) => current === "start" ? null : current);
              }
            }}
          >
            {!readyToStart ? "Loading Workout..." : activeRemoteSession ? "Join Workout" : "Start Workout"}
          </button>

          <button
            className="secondary-button home-progress-button"
            disabled={!teamBuild}
            onClick={() => setViewingTeamBuild(true)}
          >
            View Progress
          </button>

          <p className="app-version">v{APP_VERSION}</p>
        </section>
      </main>
    );
  }

  if (session.started && session.exerciseIndex === 0) {
    return (
      <main className="app">
        <section className="card">
          <WorkoutProgress exerciseIndex={session.exerciseIndex} workout={effectiveWorkout} />
          <h1>{exercise.name}</h1>
          <p className="subtitle">{exercise.notes}</p>

          <div className="workout-detail">
            <p>
              <strong>Time:</strong> {exercise.reps}
            </p>
            <p>
              <strong>Goal:</strong> Easy pace, just get warm
            </p>
          </div>

          {warmupRunning && (
            <div className="warmup-timer">
              Warmup timer: {formatSeconds(warmupSeconds)}
            </div>
          )}

          <button
            className="primary-button"
            disabled={pendingAction === "warmup"}
            onClick={async () => {
              if (pendingAction === "warmup") return;

              if (!warmupRunning) {
                const newSession = startWarmup(sessionRef.current, new Date().toISOString());

                await commitSession(newSession, "warmup");
                return;
              }

              const newSession = completeWarmup(sessionRef.current);

              await commitSession(newSession, "warmup");
            }}
          >
            {warmupRunning ? "Complete warmup" : "Start warmup"}
          </button>
        </section>
      </main>
    );
  }

  if (session.started && !session.firstPerson && session.exerciseIndex > 0) {
    return (
      <main className="app">
        <section className="card">
          <WorkoutProgress exerciseIndex={session.exerciseIndex} workout={effectiveWorkout} />
          <h1>{exercise.name}</h1>
          <p className="subtitle">
            {exercise.movements?.length
              ? `${exercise.sets} rounds x ${exercise.movements.map((movement) => movement.name).join(" + ")}`
              : `${exercise.sets} sets x ${exercise.reps} reps`}
          </p>

          <h2>Who goes first?</h2>

          {availableTandemExercises.length > 0 && (
            <label className="select-field">
              <span>Tandem</span>
              <select
                value={tandemExerciseId}
                disabled={pendingAction === "choose-first"}
                onChange={(event) => setTandemExerciseId(event.target.value)}
              >
                <option value="">Solo exercise</option>
                {availableTandemExercises.map((item) => (
                  <option key={exerciseKey(item)} value={exerciseKey(item)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="button-row">

            <button
              className="primary-button"
              disabled={pendingAction === "choose-first"}
              onClick={async () => {
                if (pendingAction === "choose-first") return;

                const newSession = chooseFirstPerson({
                  session: sessionRef.current,
                  workout: effectiveWorkout,
                  userProfiles,
                  userStrategies,
                  firstPerson: "Victoria",
                  tandemExerciseId,
                });

                await commitSession(newSession, "choose-first");
                setTandemExerciseId("");
              }}
            >
              Victoria
            </button>
            <button
              className="primary-button"
              disabled={pendingAction === "choose-first"}
              onClick={async () => {
                if (pendingAction === "choose-first") return;

                const newSession = chooseFirstPerson({
                  session: sessionRef.current,
                  workout: effectiveWorkout,
                  userProfiles,
                  userStrategies,
                  firstPerson: "Mike",
                  tandemExerciseId,
                });

                await commitSession(newSession, "choose-first");
                setTandemExerciseId("");
              }}
            >
              Mike
            </button>
          </div>

          <button
            className="link-button"
            disabled={pendingAction === "postpone"}

            onClick={async () => {
              if (pendingAction === "postpone") return;

              const newSession = postponeCurrentExercise(sessionRef.current, effectiveWorkout);

              await commitSession(newSession, "postpone");
            }}
          >
            Postpone this exercise
          </button>

          <button className="link-button" onClick={cancelWorkout}>
            Cancel Workout
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="card">
        <WorkoutProgress exerciseIndex={session.exerciseIndex} workout={effectiveWorkout} />
        {tandemCompanion && (
          <div className="tandem-companion-strip">
            <div className="tandem-companion-copy">
              <span>
                <strong>Partner:</strong> {tandemCompanion.person} | {tandemCompanion.exerciseName}
                {tandemCompanion.movementName ? `: ${tandemCompanion.movementName}` : ""}
              </span>
              <span>
                Set {tandemCompanion.setNumber} | {tandemCompanion.weight} lb x {tandemCompanion.reps}
              </span>
            </div>
            <button
              className="tandem-swap-button"
              type="button"
              aria-label="Swap to partner target"
              onClick={swapTandemTarget}
            >
              <img src="/swap-target-icon.svg" alt="" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="exercise-title-row">
          <h1>{exercise.name}</h1>
        </div>
        <p className={session.tandem ? "subtitle primary-target-line" : "subtitle"}>
          {currentPerson} — Set {session.currentSet} of {exercise.sets}
        </p>
        {movement && (
          <p className="subtitle">
            Movement {(session.currentMovementIndex ?? 0) + 1} of {exercise.movements?.length}: {movement.name}
          </p>
        )}

        <div className="active-lift-stage">
          {currentPerson && (
            <img
              className={`active-worker-avatar active-worker-avatar-${currentPerson.toLowerCase()}`}
              src={currentPerson === "Victoria" ? "/avatar-victoria-v3.png?v=20260703-v3" : "/avatar-mike.png?v=20260703-clean"}
              alt=""
              aria-hidden="true"
            />
          )}
          <div className="compact-lift-control" aria-label={`${session.currentWeight} pounds by ${session.currentReps} reps`}>
            <div className="lift-control-main">
              <div className="lift-control-column">
                <button
                  type="button"
                  aria-label={`Increase weight by ${formatWeightStep(currentWeightStep)} pounds`}
                  onClick={() => {
                    updateStepperSession((currentSession) => {
                      const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                      return adjustCurrentWeight({
                        session: currentSession,
                        workout: workoutForSession,
                        userStrategies,
                        delta: currentWeightStep,
                      });
                    });
                  }}
                >
                  +
                </button>
                <strong>
                  {session.currentWeight}<span>lbs</span>
                </strong>
                <button
                  type="button"
                  aria-label={`Decrease weight by ${formatWeightStep(currentWeightStep)} pounds`}
                  onClick={() => {
                    updateStepperSession((currentSession) => {
                      const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                      return adjustCurrentWeight({
                        session: currentSession,
                        workout: workoutForSession,
                        userStrategies,
                        delta: -currentWeightStep,
                      });
                    });
                  }}
                >
                  -
                </button>
              </div>
              <span className="lift-times" aria-hidden="true">x</span>
              <div className="lift-control-column">
                <button
                  type="button"
                  aria-label="Increase reps"
                  onClick={() => {
                    updateStepperSession((currentSession) => {
                      const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                      return adjustCurrentReps(currentSession, workoutForSession, 1);
                    });
                  }}
                >
                  +
                </button>
                <strong>
                  {session.currentReps}<span>reps</span>
                </strong>
                <button
                  type="button"
                  aria-label="Decrease reps"
                  onClick={() => {
                    updateStepperSession((currentSession) => {
                      const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                      return adjustCurrentReps(currentSession, workoutForSession, -1);
                    });
                  }}
                >
                  -
                </button>
              </div>
            </div>
            <button
              className="weight-step-icon-button lift-step-button"
              type="button"
              aria-label={`Weight step: ${formatWeightStep(currentWeightStep)} lb`}
              onClick={() => setShowWeightStepPicker(true)}
            >
              <img src="/weight-step-icon.svg" alt="" aria-hidden="true" />
            </button>
          </div>
        </div>
        {showWeightStepPicker && (
          <div className="modal-backdrop" role="presentation" onClick={() => setShowWeightStepPicker(false)}>
            <div
              className="modal weight-step-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="weight-step-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="weight-step-title">Weight Step</h2>
              <div className="weight-step-options">
                {weightStepOptions.map((step) => (
                  <button
                    key={step}
                    className={step === currentWeightStep ? "weight-step-option selected" : "weight-step-option"}
                    type="button"
                    onClick={() => chooseCurrentWeightStep(step)}
                  >
                    {formatWeightStep(step)} lb
                  </button>
                ))}
              </div>
              <button className="link-button modal-close-button" type="button" onClick={() => setShowWeightStepPicker(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="button-row workout-action-row">
          <button className="secondary-button" disabled={pendingAction !== null} onClick={() => recordSet("skipped")}>
            Skip
          </button>
          <button className="primary-button" disabled={pendingAction !== null} onClick={() => recordSet("completed")}>
            {pendingAction === "done" ? "Saving..." : "Next"}
          </button>
        </div>

        {completionError && (
          <div className="inline-error" role="alert">
            {completionError}
          </div>
        )}

        <div>
          <button className="link-button" disabled={pendingAction !== null} onClick={cancelWorkout}>
            Cancel Workout
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
