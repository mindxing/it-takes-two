import { useEffect, useState, useRef } from "react";
import "./App.css";
import { people, workout, type Person, type Exercise } from "./workoutData";
import { listenToWorkoutSession, loadCurrentWorkoutSession, saveWorkoutSession } from "./workoutSession";
import { finalizeCompletedWorkout, loadCompletedWorkoutSummaries, loadCurrentBaselineStates, loadUserProfileSettings, loadWorkoutPlan, calculateExerciseOutcomes, calculateProgressedUserProfilesFromHistory, type BaselineProgressionStrategy, type SetResult, type ExerciseOutcomes, type UserBaselines } from "./workoutSession";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

declare const __APP_VERSION__: string;

type SetStatus = "completed" | "skipped";

type WeightStrategy = "pyramid" | "straight";
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

type CompletedWorkout = {
  id: string;
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: ExerciseOutcomes;
  results: SetResult[];
};

type ActiveMovement = NonNullable<Exercise["movements"]>[number];

const defaultUserProfiles: Record<Person, Record<string, number>> = {
  Mike: {
    leg_press: 125,
    chest_press_machine: 65,
    seated_row_machine: 55,
    glute_machine: 55,
    bicep_curl_machine: 55,
    tricep_pushdown: 55,
    abs: 0,
    dumbbell_romanian_deadlift: 35,
  },
  Victoria: {
    leg_press: 95,
    chest_press_machine: 25,
    seated_row_machine: 35,
    glute_machine: 50,
    bicep_curl_machine: 10,
    tricep_pushdown: 30,
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

type WorkoutSession = {
  sessionId?: string;
  started: boolean;
  complete: boolean;
  exerciseIndex: number;
  exerciseOrder: Person[];
  firstPerson: Person | null;
  currentPersonIndex: number;
  currentSet: number;
  currentMovementIndex?: number;
  currentReps: number;
  currentWeight: number;
  results: SetResult[];
  reorderedWorkout?: Exercise[];
  warmupStartedAt?: string | null;
  adjustedBaselines?: Record<string, Partial<Record<Person, number>>>;
  adjustedRepBaselines?: Record<string, Partial<Record<Person, number>>>;
  status?: "active" | "completed" | "cancelled";
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  localRevision?: number;
  lastWriterId?: string;
};

type WorkoutProgressProps = {
  exerciseIndex: number;
  workout: Exercise[];
};

function exerciseKey(exercise: Exercise) {
  return exercise.id || exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function activeMovement(exercise: Exercise, movementIndex = 0) {
  return exercise.movements?.[movementIndex] ?? null;
}

function activeWeightKey(exercise: Exercise, movement: ActiveMovement | null) {
  return movement?.id ?? exerciseKey(exercise);
}

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

function getProfileWeight(
  profiles: Record<Person, Record<string, number>>,
  person: Person,
  exercise: Exercise,
  movement: ActiveMovement | null = null
) {
  return profiles[person][activeWeightKey(exercise, movement)] ?? profiles[person][exerciseKey(exercise)] ?? profiles[person][exercise.name] ?? 0;
}

function getPersonExerciseValue(
  values: Record<string, Partial<Record<Person, number>>> | undefined,
  exercise: Exercise,
  person: Person,
  movement: ActiveMovement | null = null
) {
  return values?.[activeWeightKey(exercise, movement)]?.[person] ?? values?.[exerciseKey(exercise)]?.[person] ?? values?.[exercise.name]?.[person];
}

function getSetPlan(exercise: Exercise, movement: ActiveMovement | null) {
  return movement?.setPlan ?? exercise.setPlan;
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

const initialSession: WorkoutSession = {
  started: false,
  complete: false,
  exerciseIndex: 0,
  exerciseOrder: people,
  firstPerson: null,
  currentPersonIndex: 0,
  currentSet: 1,
  currentReps: 10,
  currentWeight: 0,
  results: [],
  adjustedBaselines: {},
  adjustedRepBaselines: {},
};

function App() {
  const [session, setSession] = useState<WorkoutSession>(initialSession);
  const [baseWorkout, setBaseWorkout] = useState<Exercise[]>(workout);
  const [activeRemoteSession, setActiveRemoteSession] = useState<WorkoutSession | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBaselineChanges, setShowBaselineChanges] = useState(false);
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
  const [warmupSeconds, setWarmupSeconds] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [workoutPlanLoaded, setWorkoutPlanLoaded] = useState(false);
  const sessionRef = useRef(session);
  const activeRemoteSessionRef = useRef<WorkoutSession | null>(null);
  const viewingPastRef = useRef(viewingPast);
  const latestLocalRevisionRef = useRef(0);
  const pendingStepperSaveRef = useRef<number | null>(null);
  const pendingStepperSessionRef = useRef<WorkoutSession | null>(null);
  const clientIdRef = useRef(CLIENT_ID);

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

  function isJoinableRemoteSession(remoteSession: WorkoutSession | null) {
    return remoteSession?.status === "active" && !remoteSession.complete;
  }

  function setLocalSession(nextSession: WorkoutSession) {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }

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

  function clearPendingStepperSave() {
    if (pendingStepperSaveRef.current !== null) {
      window.clearTimeout(pendingStepperSaveRef.current);
      pendingStepperSaveRef.current = null;
    }

    pendingStepperSessionRef.current = null;
  }

  async function savePreparedSession(nextSession: WorkoutSession) {
    await saveWorkoutSession(nextSession);
  }

  async function commitSession(nextSession: WorkoutSession, action?: PendingAction) {
    clearPendingStepperSave();

    const prepared = prepareLocalSession(nextSession);
    setLocalSession(prepared);

    if (action) {
      setPendingAction(action);
    }

    try {
      await savePreparedSession(prepared);
    } finally {
      if (action) {
        setPendingAction((current) => current === action ? null : current);
      }
    }

    return prepared;
  }

  function queueStepperSave(nextSession: WorkoutSession) {
    pendingStepperSessionRef.current = nextSession;

    if (pendingStepperSaveRef.current !== null) {
      window.clearTimeout(pendingStepperSaveRef.current);
    }

    pendingStepperSaveRef.current = window.setTimeout(() => {
      const sessionToSave = pendingStepperSessionRef.current;
      pendingStepperSaveRef.current = null;
      pendingStepperSessionRef.current = null;

      if (!sessionToSave) return;

      savePreparedSession(sessionToSave).catch((error) => {
        console.error("Failed to save stepper update:", error);
      });
    }, 450);
  }

  function updateStepperSession(update: (current: WorkoutSession) => WorkoutSession) {
    const prepared = prepareLocalSession(update(sessionRef.current));
    setLocalSession(prepared);
    queueStepperSave(prepared);
  }

  useEffect(() => {
    return () => clearPendingStepperSave();
  }, []);

  useEffect(() => {
    const unsubscribe = listenToWorkoutSession((data) => {
      const incoming = data as WorkoutSession;
      const incomingRevision = incoming.localRevision ?? 0;

      latestLocalRevisionRef.current = Math.max(
        latestLocalRevisionRef.current,
        incomingRevision
      );

      const isActive = incoming.status === "active" && !incoming.complete;
      const isStale =
        isActive &&
        incoming.updatedAt &&
        new Date(incoming.updatedAt).getTime() <
        Date.now() - 12 * 60 * 60 * 1000;

      if (incoming.status === "completed" || incoming.complete) {
        setActiveRemoteSession(null);
        activeRemoteSessionRef.current = null;

        if (sessionRef.current.started && !viewingPastRef.current) {
          setLocalSession(incoming);
        }

        return;
      }

      if (isActive && !isStale) {
        setActiveRemoteSession(incoming);
        activeRemoteSessionRef.current = incoming;

        if (sessionRef.current.started && !sessionRef.current.complete) {
          setLocalSession(incoming);
        }
      } else {
        setActiveRemoteSession(null);
        activeRemoteSessionRef.current = null;

        if (incoming.status === "cancelled") {
          setLocalSession(initialSession);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadCompletedWorkoutSummaries().then(setCompletedWorkouts);
  }, [session.complete]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
    });
  }, []);

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
    clearPendingStepperSave();

    const cancelledSession = prepareLocalSession({
      ...sessionRef.current,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    setActiveRemoteSession(null);
    activeRemoteSessionRef.current = null;
    setLocalSession(initialSession);

    savePreparedSession(cancelledSession).catch((error) => {
      console.error("Failed to cancel workout:", error);
    });
  }

  function returnHome() {
    setLocalSession(initialSession);
  }

  async function joinActiveWorkout() {
    let remoteSession = activeRemoteSessionRef.current;

    try {
      remoteSession = (await loadCurrentWorkoutSession()) as WorkoutSession | null;
    } catch (error) {
      console.error("Failed to load latest workout session:", error);
    }

    if (remoteSession && isJoinableRemoteSession(remoteSession)) {
      setActiveRemoteSession(remoteSession);
      activeRemoteSessionRef.current = remoteSession;
      setLocalSession(remoteSession);
      return true;
    }

    setActiveRemoteSession(null);
    activeRemoteSessionRef.current = null;

    if (remoteSession?.status === "cancelled") {
      setLocalSession(initialSession);
    }

    return false;
  }

  async function recordSet(status: SetStatus) {
    const action = status === "skipped" ? "skip" : "done";

    if (pendingAction === action) return;

    const session = sessionRef.current;

    if (!session.firstPerson) return;

    const exercise = effectiveWorkout[session.exerciseIndex];
    const movement = activeMovement(exercise, session.currentMovementIndex ?? 0);
    const currentPerson = session.exerciseOrder[session.currentPersonIndex];

    const newResult: SetResult = {
      exerciseId: exerciseKey(exercise),
      exerciseName: exercise.name,
      person: currentPerson,
      setNumber: session.currentSet,
      reps: status === "skipped" ? 0 : session.currentReps,
      weight: session.currentWeight,
      status,
    };

    if (movement) {
      newResult.movementId = movement.id;
      newResult.movementName = movement.name;
    }

    // Start with updated results
    let newSession = {
      ...session,
      results: [...session.results, newResult],
    };

    // ---- Move to next step (inline your existing logic) ----

    if (movement && (session.currentMovementIndex ?? 0) < (exercise.movements?.length ?? 1) - 1) {
      const nextMovementIndex = (session.currentMovementIndex ?? 0) + 1;
      const nextMovement = activeMovement(exercise, nextMovementIndex);
      const nextSetPlan = getSetPlan(exercise, nextMovement);
      const target = nextSetPlan[session.currentSet - 1];
      const nextReps =
        userStrategies[currentPerson] === "straight"
          ? getPersonExerciseValue(session.adjustedRepBaselines, exercise, currentPerson, nextMovement) ?? target.reps
          : target.reps;
      const nextAdjustedRepBaselines =
        userStrategies[currentPerson] === "straight"
          ? {
            ...session.adjustedRepBaselines,
            [activeWeightKey(exercise, nextMovement)]: {
              ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, nextMovement)] || {}),
              [currentPerson]: nextReps,
            },
          }
          : session.adjustedRepBaselines;

      newSession = {
        ...newSession,
        currentMovementIndex: nextMovementIndex,
        currentReps: nextReps,
        currentWeight:
          (
            getPersonExerciseValue(session.adjustedBaselines, exercise, currentPerson, nextMovement) ??
            getProfileWeight(userProfiles, currentPerson, exercise, nextMovement) ??
            0
          ) + (userStrategies[currentPerson] === "pyramid" ? target.weightOffset : 0),
        adjustedRepBaselines: nextAdjustedRepBaselines,
      };
    } else if (session.currentPersonIndex === 0) {
      const nextPerson = session.exerciseOrder[1];
      const nextMovement = activeMovement(exercise, 0);
      const nextSetPlan = getSetPlan(exercise, nextMovement);
      const target = nextSetPlan[session.currentSet - 1];
      const nextReps =
        userStrategies[nextPerson] === "straight"
          ? getPersonExerciseValue(session.adjustedRepBaselines, exercise, nextPerson, nextMovement) ?? target.reps
          : target.reps;
      const nextAdjustedRepBaselines =
        userStrategies[nextPerson] === "straight"
          ? {
            ...session.adjustedRepBaselines,
            [activeWeightKey(exercise, nextMovement)]: {
              ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, nextMovement)] || {}),
              [nextPerson]: nextReps,
            },
          }
          : session.adjustedRepBaselines;

      newSession = {
        ...newSession,
        currentPersonIndex: 1,
        currentMovementIndex: 0,
        currentReps: nextReps,
        currentWeight:
          (
            getPersonExerciseValue(session.adjustedBaselines, exercise, nextPerson, nextMovement) ??
            getProfileWeight(userProfiles, nextPerson, exercise, nextMovement) ??
            0
          ) + (userStrategies[nextPerson] === "pyramid" ? target.weightOffset : 0),
        adjustedRepBaselines: nextAdjustedRepBaselines,
      };
    } else if (session.currentSet < exercise.sets) {
      const nextSet = session.currentSet + 1;
      const nextPerson = session.exerciseOrder[0];
      const nextMovement = activeMovement(exercise, 0);
      const nextSetPlan = getSetPlan(exercise, nextMovement);
      const target = nextSetPlan[nextSet - 1];
      const nextReps =
        userStrategies[nextPerson] === "straight"
          ? getPersonExerciseValue(session.adjustedRepBaselines, exercise, nextPerson, nextMovement) ?? target.reps
          : target.reps;
      const nextAdjustedRepBaselines =
        userStrategies[nextPerson] === "straight"
          ? {
            ...session.adjustedRepBaselines,
            [activeWeightKey(exercise, nextMovement)]: {
              ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, nextMovement)] || {}),
              [nextPerson]: nextReps,
            },
          }
          : session.adjustedRepBaselines;

      newSession = {
        ...newSession,
        currentPersonIndex: 0,
        currentMovementIndex: 0,
        currentSet: nextSet,
        currentReps: nextReps,
        currentWeight:
          (
            getPersonExerciseValue(session.adjustedBaselines, exercise, nextPerson, nextMovement) ??
            getProfileWeight(userProfiles, nextPerson, exercise, nextMovement) ??
            0
          ) + (userStrategies[nextPerson] === "pyramid" ? target.weightOffset : 0),
        adjustedRepBaselines: nextAdjustedRepBaselines,
      };
    } else {
      // move to next exercise
      if (session.exerciseIndex < effectiveWorkout.length - 1) {
        newSession = {
          ...newSession,
          exerciseIndex: session.exerciseIndex + 1,
          firstPerson: null,
          currentPersonIndex: 0,
          currentMovementIndex: 0,
          currentSet: 1,
        };
      } else {

        newSession = {
          ...newSession,
          sessionId: newSession.sessionId ?? createSessionId(),
          complete: true,
          status: "completed",
          completedAt: new Date().toISOString(),
        };

        // Calculate summary BEFORE saving
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
        const completedAt = new Date().toISOString();
        const completedSessionId = newSession.sessionId ?? createSessionId();
        newSession.sessionId = completedSessionId;
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
            session: newSession,
          });

          if (finalizeResult.created) {
            setUserBaselineStates(updatedBaselineStates);
            setUserProfiles(updatedProfiles);
            setBaselineChangeRows(changeRows);
            setShowBaselineChanges(true);
            setCompletedWorkouts((current) => [
              ...current.filter((workout) => workout.id !== newSession.sessionId),
              { id: completedSessionId, ...completedSummary },
            ]);
          } else {
            setBaselineChangeRows([]);
            setShowBaselineChanges(false);
          }
        } catch (error) {
          console.error("Failed to finalize workout:", error);
          return;
        }
      }
    }

    if (newSession.complete) {
      setLocalSession(prepareLocalSession(newSession));
      setPendingAction((current) => current === action ? null : current);
    } else {
      await commitSession(newSession, action);
    }
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
        <section className="card">
          <h1>It Takes Two</h1>
          <p className="subtitle">Mike & Victoria's workout tracker</p>
          <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>v{APP_VERSION}</p>

          <button
            className="primary-button"
            disabled={pendingAction === "start" || !workoutPlanLoaded}
            onClick={async () => {
              if (pendingAction === "start" || !workoutPlanLoaded) return;

              setPendingAction("start");

              try {
                if (await joinActiveWorkout()) {
                  return;
                }

                const newSession = {
                  ...initialSession,
                  sessionId: createSessionId(),
                  started: true,
                  status: "active" as const,
                  reorderedWorkout: baseWorkout,
                };

                await commitSession(newSession, "start");
              } catch (error) {
                console.error("Failed to save session:", error);
              } finally {
                setPendingAction((current) => current === "start" ? null : current);
              }
            }}
          >
            {!workoutPlanLoaded ? "Loading Workout..." : activeRemoteSession ? "Join Workout" : "Start Workout"}
          </button>

          {completedWorkouts.length > 0 && (
            <button
              className="link-button"
              onClick={() => {
                const latest = completedWorkouts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
                setPastSession({
                  ...initialSession,
                  complete: true,
                  status: "completed",
                  completedAt: latest.completedAt,
                  results: latest.results,
                });
                setViewingPast(true);
              }}
            >
              View Latest Workout Results
            </button>
          )}

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
                const newSession = {
                  ...sessionRef.current,
                  warmupStartedAt: new Date().toISOString(),
                };

                await commitSession(newSession, "warmup");
                return;
              }

              const newSession = {
                ...sessionRef.current,
                warmupStartedAt: null,
                exerciseIndex: session.exerciseIndex + 1,
                firstPerson: null,
                currentPersonIndex: 0,
                currentSet: 1,
              };

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

          <div className="button-row">

            <button
              className="primary-button"
              disabled={pendingAction === "choose-first"}
              onClick={async () => {
                if (pendingAction === "choose-first") return;

                const order: Person[] = ["Victoria", "Mike"];
                const firstMovement = activeMovement(exercise, 0);
                const target = getSetPlan(exercise, firstMovement)[0];

                const newSession = {
                  ...sessionRef.current,
                  exerciseOrder: order,
                  firstPerson: "Victoria" as Person,
                  currentPersonIndex: 0,
                  currentMovementIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: getProfileWeight(userProfiles, "Victoria", exercise, firstMovement) + (userStrategies["Victoria"] === "pyramid" ? target.weightOffset : 0),
                  adjustedBaselines: {
                    ...session.adjustedBaselines,
                    [activeWeightKey(exercise, firstMovement)]: {
                      ...(session.adjustedBaselines?.[activeWeightKey(exercise, firstMovement)] || {}),
                      Victoria: getProfileWeight(userProfiles, "Victoria", exercise, firstMovement),
                    },
                  },
                  adjustedRepBaselines: {
                    ...session.adjustedRepBaselines,
                    [activeWeightKey(exercise, firstMovement)]: {
                      ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, firstMovement)] || {}),
                      Victoria: target.reps,
                    },
                  },
                };

                await commitSession(newSession, "choose-first");
              }}
            >
              Victoria
            </button>
            <button
              className="primary-button"
              disabled={pendingAction === "choose-first"}
              onClick={async () => {
                if (pendingAction === "choose-first") return;

                const order: Person[] = ["Mike", "Victoria"];
                const firstMovement = activeMovement(exercise, 0);
                const target = getSetPlan(exercise, firstMovement)[0];

                const newSession = {
                  ...sessionRef.current,
                  exerciseOrder: order,
                  firstPerson: "Mike" as Person,
                  currentPersonIndex: 0,
                  currentMovementIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: getProfileWeight(userProfiles, "Mike", exercise, firstMovement) + (userStrategies["Mike"] === "pyramid" ? target.weightOffset : 0),
                  adjustedBaselines: {
                    ...session.adjustedBaselines,
                    [activeWeightKey(exercise, firstMovement)]: {
                      ...(session.adjustedBaselines?.[activeWeightKey(exercise, firstMovement)] || {}),
                      Mike: getProfileWeight(userProfiles, "Mike", exercise, firstMovement),
                    },
                  },
                  adjustedRepBaselines: {
                    ...session.adjustedRepBaselines,
                    [activeWeightKey(exercise, firstMovement)]: {
                      ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, firstMovement)] || {}),
                      Mike: target.reps,
                    },
                  },
                };

                await commitSession(newSession, "choose-first");
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

              if (session.exerciseIndex >= effectiveWorkout.length - 1) return;

              const currentWorkout = effectiveWorkout;
              const newWorkout = [...currentWorkout];

              // Remove current exercise
              const currentExercise = newWorkout.splice(session.exerciseIndex, 1)[0];

              // Push to end
              newWorkout.push(currentExercise);

              const newSession = {
                ...sessionRef.current,
                reorderedWorkout: newWorkout,
              };

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
        <h1>{exercise.name}</h1>
        <p className="subtitle">
          {currentPerson} — Set {session.currentSet} of {exercise.sets}
        </p>
        {movement && (
          <p className="subtitle">
            Movement {(session.currentMovementIndex ?? 0) + 1} of {exercise.movements?.length}: {movement.name}
          </p>
        )}

        <div className="stepper">
          <span>Reps</span>
          <button
            onClick={() => {
              updateStepperSession((currentSession) => {
                const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
                const currentMovement = activeMovement(currentExercise, currentSession.currentMovementIndex ?? 0);
                const currentSetPerson = currentSession.firstPerson
                  ? currentSession.exerciseOrder[currentSession.currentPersonIndex]
                  : null;

                if (!currentSetPerson) return currentSession;

                const newReps = Math.max(0, currentSession.currentReps - 1);

                return {
                  ...currentSession,
                  currentReps: newReps,
                  adjustedRepBaselines: {
                    ...currentSession.adjustedRepBaselines,
                    [activeWeightKey(currentExercise, currentMovement)]: {
                      ...(currentSession.adjustedRepBaselines?.[activeWeightKey(currentExercise, currentMovement)] || {}),
                      [currentSetPerson]: newReps,
                    },
                  },
                };
              });
            }}
          >
            -
          </button>
          <strong>{session.currentReps}</strong>
          <button
            onClick={() => {
              updateStepperSession((currentSession) => {
                const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
                const currentMovement = activeMovement(currentExercise, currentSession.currentMovementIndex ?? 0);
                const currentSetPerson = currentSession.firstPerson
                  ? currentSession.exerciseOrder[currentSession.currentPersonIndex]
                  : null;

                if (!currentSetPerson) return currentSession;

                const newReps = currentSession.currentReps + 1;

                return {
                  ...currentSession,
                  currentReps: newReps,
                  adjustedRepBaselines: {
                    ...currentSession.adjustedRepBaselines,
                    [activeWeightKey(currentExercise, currentMovement)]: {
                      ...(currentSession.adjustedRepBaselines?.[activeWeightKey(currentExercise, currentMovement)] || {}),
                      [currentSetPerson]: newReps,
                    },
                  },
                };
              });
            }}
          >
            +
          </button>
        </div>

        <div className="stepper">
          <span>Weight</span>
          <button
            onClick={() => {
              updateStepperSession((currentSession) => {
                const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
                const currentMovement = activeMovement(currentExercise, currentSession.currentMovementIndex ?? 0);
                const currentSetPerson = currentSession.firstPerson
                  ? currentSession.exerciseOrder[currentSession.currentPersonIndex]
                  : null;

                if (!currentSetPerson) return currentSession;

                const newWeight = Math.max(0, currentSession.currentWeight - 5);
                const target = getSetPlan(currentExercise, currentMovement)[currentSession.currentSet - 1];
                const adjustedBaseline =
                  newWeight -
                  (userStrategies[currentSetPerson] === "pyramid" ? target.weightOffset : 0);

                return {
                  ...currentSession,
                  currentWeight: newWeight,
                  adjustedBaselines: {
                    ...currentSession.adjustedBaselines,
                    [activeWeightKey(currentExercise, currentMovement)]: {
                      ...(currentSession.adjustedBaselines?.[activeWeightKey(currentExercise, currentMovement)] || {}),
                      [currentSetPerson]: adjustedBaseline,
                    },
                  },
                };
              });
            }}
          >
            -
          </button>
          <strong>{session.currentWeight} lbs</strong>
          <button
            onClick={() => {
              updateStepperSession((currentSession) => {
                const workoutForSession = currentSession.reorderedWorkout || baseWorkout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
                const currentMovement = activeMovement(currentExercise, currentSession.currentMovementIndex ?? 0);
                const currentSetPerson = currentSession.firstPerson
                  ? currentSession.exerciseOrder[currentSession.currentPersonIndex]
                  : null;

                if (!currentSetPerson) return currentSession;

                const newWeight = currentSession.currentWeight + 5;
                const target = getSetPlan(currentExercise, currentMovement)[currentSession.currentSet - 1];
                const adjustedBaseline =
                  newWeight -
                  (userStrategies[currentSetPerson] === "pyramid" ? target.weightOffset : 0);

                return {
                  ...currentSession,
                  currentWeight: newWeight,
                  adjustedBaselines: {
                    ...currentSession.adjustedBaselines,
                    [activeWeightKey(currentExercise, currentMovement)]: {
                      ...(currentSession.adjustedBaselines?.[activeWeightKey(currentExercise, currentMovement)] || {}),
                      [currentSetPerson]: adjustedBaseline,
                    },
                  },
                };
              });
            }}
          >
            +
          </button>
        </div>

        <div className="button-row">
          <button className="secondary-button" disabled={pendingAction === "skip"} onClick={() => recordSet("skipped")}>
            Skip
          </button>
          <button className="primary-button" disabled={pendingAction === "done"} onClick={() => recordSet("completed")}>
            Done / Next
          </button>
        </div>

        <div>
          <button className="link-button" onClick={cancelWorkout}>
            Cancel Workout
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
