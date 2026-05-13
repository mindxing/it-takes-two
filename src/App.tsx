import { useEffect, useState, useRef } from "react";
import "./App.css";
import { people, workout, type Person, type Exercise } from "./workoutData";
import { listenToWorkoutSession, saveWorkoutSession } from "./workoutSession";
import { saveCompletedWorkoutSummary, loadCompletedWorkoutSummaries, loadUserProfiles, saveUserProfile, calculateExerciseOutcomes, calculateProgressedUserProfilesFromHistory, type SetResult, type ExerciseOutcomes } from "./workoutSession";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

declare const __APP_VERSION__: string;

type SetStatus = "completed" | "skipped";

type WeightStrategy = "pyramid" | "straight";

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

const defaultUserProfiles: Record<Person, Record<string, number>> = {
  Mike: {
    "Leg Press": 125,
    "Chest Press Machine": 65,
    "Seated Row Machine": 55,
    "Glute Machine": 55,
    "Bicep Curl Machine": 55,
    "Tricep Pushdown": 55,
    "Abs": 0,
    "Dumbbell Romanian Deadlift": 35,
  },
  Victoria: {
    "Leg Press": 95,
    "Chest Press Machine": 25,
    "Seated Row Machine": 35,
    "Glute Machine": 50,
    "Bicep Curl Machine": 10,
    "Tricep Pushdown": 30,
    "Abs": 0,
    "Dumbbell Romanian Deadlift": 20,
  },
};

const userStrategies: Record<Person, WeightStrategy> = {
  Mike: "pyramid",
  Victoria: "straight",
};

type WorkoutSession = {
  started: boolean;
  complete: boolean;
  exerciseIndex: number;
  exerciseOrder: Person[];
  firstPerson: Person | null;
  currentPersonIndex: number;
  currentSet: number;
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
            key={item.name}
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
  const [activeRemoteSession, setActiveRemoteSession] = useState<WorkoutSession | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<Person, Record<string, number>>>(defaultUserProfiles);
  const [viewingPast, setViewingPast] = useState(false);
  const [pastSession, setPastSession] = useState<WorkoutSession | null>(null);
  const [warmupSeconds, setWarmupSeconds] = useState(0);
  const [savingCount, setSavingCount] = useState(0);
  const sessionRef = useRef(session);
  const viewingPastRef = useRef(viewingPast);
  const latestLocalRevisionRef = useRef(0);
  const pendingStepperSaveRef = useRef<number | null>(null);
  const pendingStepperSessionRef = useRef<WorkoutSession | null>(null);
  const clientIdRef = useRef(CLIENT_ID);

  const isSaving = savingCount > 0;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    viewingPastRef.current = viewingPast;
  }, [viewingPast]);

  const effectiveWorkout = session.reorderedWorkout || workout;
  const warmupRunning = !!session.warmupStartedAt && session.exerciseIndex === 0;
  const exercise = effectiveWorkout[session.exerciseIndex];
  const currentPerson = session.firstPerson ? session.exerciseOrder[session.currentPersonIndex] : null;

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
    setSavingCount((count) => count + 1);

    try {
      await saveWorkoutSession(nextSession);
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  }

  async function commitSession(nextSession: WorkoutSession) {
    clearPendingStepperSave();

    const prepared = prepareLocalSession(nextSession);
    setLocalSession(prepared);
    await savePreparedSession(prepared);

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

      if (incomingRevision < latestLocalRevisionRef.current) {
        return;
      }

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

        if (sessionRef.current.started && !viewingPastRef.current) {
          setLocalSession(incoming);
        }

        return;
      }

      if (isActive && !isStale) {
        setActiveRemoteSession(incoming);

        if (sessionRef.current.started && !sessionRef.current.complete) {
          setLocalSession(incoming);
        }
      } else {
        setActiveRemoteSession(null);

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
    loadUserProfiles(defaultUserProfiles).then((profiles) => {
      setUserProfiles({
        Mike: { ...defaultUserProfiles.Mike, ...profiles.Mike },
        Victoria: { ...defaultUserProfiles.Victoria, ...profiles.Victoria },
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
    if (isSaving) return;

    await commitSession({
      ...sessionRef.current,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    setLocalSession(initialSession);
  }

  function returnHome() {
    setLocalSession(initialSession);
  }

  async function recordSet(status: SetStatus) {
    if (isSaving) return;

    const session = sessionRef.current;

    if (!session.firstPerson) return;

    const exercise = effectiveWorkout[session.exerciseIndex];
    const currentPerson = session.exerciseOrder[session.currentPersonIndex];

    const newResult = {
      exerciseName: exercise.name,
      person: currentPerson,
      setNumber: session.currentSet,
      reps: status === "skipped" ? 0 : session.currentReps,
      weight: session.currentWeight,
      status,
    };

    // Start with updated results
    let newSession = {
      ...session,
      results: [...session.results, newResult],
    };

    // ---- Move to next step (inline your existing logic) ----

    if (session.currentPersonIndex === 0) {
      const nextPerson = session.exerciseOrder[1];
      const target = exercise.setPlan[session.currentSet - 1];
      const nextReps =
        userStrategies[nextPerson] === "straight"
          ? session.adjustedRepBaselines?.[exercise.name]?.[nextPerson] ?? target.reps
          : target.reps;
      const nextAdjustedRepBaselines =
        userStrategies[nextPerson] === "straight"
          ? {
            ...session.adjustedRepBaselines,
            [exercise.name]: {
              ...(session.adjustedRepBaselines?.[exercise.name] || {}),
              [nextPerson]: nextReps,
            },
          }
          : session.adjustedRepBaselines;

      newSession = {
        ...newSession,
        currentPersonIndex: 1,
        currentReps: nextReps,
        currentWeight:
          (
            session.adjustedBaselines?.[exercise.name]?.[nextPerson] ??
            userProfiles[nextPerson][exercise.name] ??
            0
          ) + (userStrategies[nextPerson] === "pyramid" ? target.weightOffset : 0),
        adjustedRepBaselines: nextAdjustedRepBaselines,
      };
    } else if (session.currentSet < exercise.sets) {
      const nextSet = session.currentSet + 1;
      const nextPerson = session.exerciseOrder[0];
      const target = exercise.setPlan[nextSet - 1];
      const nextReps =
        userStrategies[nextPerson] === "straight"
          ? session.adjustedRepBaselines?.[exercise.name]?.[nextPerson] ?? target.reps
          : target.reps;
      const nextAdjustedRepBaselines =
        userStrategies[nextPerson] === "straight"
          ? {
            ...session.adjustedRepBaselines,
            [exercise.name]: {
              ...(session.adjustedRepBaselines?.[exercise.name] || {}),
              [nextPerson]: nextReps,
            },
          }
          : session.adjustedRepBaselines;

      newSession = {
        ...newSession,
        currentPersonIndex: 0,
        currentSet: nextSet,
        currentReps: nextReps,
        currentWeight:
          (
            session.adjustedBaselines?.[exercise.name]?.[nextPerson] ??
            userProfiles[nextPerson][exercise.name] ??
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
          currentSet: 1,
        };
      } else {

        newSession = {
          ...newSession,
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

        // Save summary (fire-and-forget is fine)
        saveCompletedWorkoutSummary({
          completedAt: new Date().toISOString(),
          totalSets,
          totalWeightLifted,
          exerciseOutcomes,
          results: newSession.results,
        });
      }
    }

    await commitSession(newSession);
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

    const workoutForSummary = currentSession.reorderedWorkout || workout;
    const exercisesWithResults = workoutForSummary
      .filter((exercise) => exercise.name !== "Warm-up")
      .map((exercise) => ({
        name: exercise.name,
        results: currentSession.results.filter((r) => r.exerciseName === exercise.name),
      }))
      .filter((exercise) => exercise.results.length > 0);

    return (
      <main className="app">
        <section className="card summary-card">
          <h1>{viewingPast ? "Workout Results" : "Workout Complete 🎉"}</h1>
          <p className="subtitle">{viewingPast ? "Past workout summary" : "Nice work, both of you."}</p>

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
                              : `${r.weight}×${r.reps}`
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
            disabled={isSaving}
            onClick={async () => {
              if (isSaving) return;

              try {
                // Calculate weight progression based on history
                const { updatedProfiles } = calculateProgressedUserProfilesFromHistory(
                  userProfiles,
                  workout,
                  completedWorkouts
                );

                // If weights changed, update state and save to Firestore
                let profilesChanged = false;
                for (const person of ["Mike", "Victoria"] as const) {
                  for (const exercise of workout) {
                    const oldWeight = userProfiles[person][exercise.name] || 0;
                    const newWeight = updatedProfiles[person][exercise.name] || 0;
                    if (oldWeight !== newWeight) {
                      profilesChanged = true;
                      break;
                    }
                  }
                  if (profilesChanged) break;
                }

                if (profilesChanged) {
                  setUserProfiles(updatedProfiles);
                  await saveUserProfile("Mike", updatedProfiles.Mike);
                  await saveUserProfile("Victoria", updatedProfiles.Victoria);
                }

                if (activeRemoteSession) {
                  setLocalSession(activeRemoteSession);
                  return;
                }

                const newSession = {
                  ...sessionRef.current,
                  started: true,
                  status: "active" as const,
                };

                await commitSession(newSession);
              } catch (error) {
                console.error("Failed to save session:", error);
              }
            }}
          >
            {activeRemoteSession ? "Join Workout" : "Start Workout"}
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
            disabled={isSaving}
            onClick={async () => {
              if (isSaving) return;

              if (!warmupRunning) {
                const newSession = {
                  ...sessionRef.current,
                  warmupStartedAt: new Date().toISOString(),
                };

                await commitSession(newSession);
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

              await commitSession(newSession);
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
            {exercise.sets} sets × {exercise.reps} reps
          </p>

          <h2>Who goes first?</h2>

          <div className="button-row">

            <button
              className="primary-button"
              disabled={isSaving}
              onClick={async () => {
                if (isSaving) return;

                const order: Person[] = ["Victoria", "Mike"];
                const target = exercise.setPlan[0];

                const newSession = {
                  ...sessionRef.current,
                  exerciseOrder: order,
                  firstPerson: "Victoria" as Person,
                  currentPersonIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: (userProfiles["Victoria"][exercise.name] || 0) + (userStrategies["Victoria"] === "pyramid" ? target.weightOffset : 0),
                  adjustedBaselines: {
                    ...session.adjustedBaselines,
                    [exercise.name]: {
                      ...(session.adjustedBaselines?.[exercise.name] || {}),
                      Victoria: userProfiles["Victoria"][exercise.name] || 0,
                    },
                  },
                  adjustedRepBaselines: {
                    ...session.adjustedRepBaselines,
                    [exercise.name]: {
                      ...(session.adjustedRepBaselines?.[exercise.name] || {}),
                      Victoria: target.reps,
                    },
                  },
                };

                await commitSession(newSession);
              }}
            >
              Victoria
            </button>
            <button
              className="primary-button"
              disabled={isSaving}
              onClick={async () => {
                if (isSaving) return;

                const order: Person[] = ["Mike", "Victoria"];
                const target = exercise.setPlan[0];

                const newSession = {
                  ...sessionRef.current,
                  exerciseOrder: order,
                  firstPerson: "Mike" as Person,
                  currentPersonIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: (userProfiles["Mike"][exercise.name] || 0) + (userStrategies["Mike"] === "pyramid" ? target.weightOffset : 0),
                  adjustedBaselines: {
                    ...session.adjustedBaselines,
                    [exercise.name]: {
                      ...(session.adjustedBaselines?.[exercise.name] || {}),
                      Mike: userProfiles["Mike"][exercise.name] || 0,
                    },
                  },
                  adjustedRepBaselines: {
                    ...session.adjustedRepBaselines,
                    [exercise.name]: {
                      ...(session.adjustedRepBaselines?.[exercise.name] || {}),
                      Mike: target.reps,
                    },
                  },
                };

                await commitSession(newSession);
              }}
            >
              Mike
            </button>
          </div>

          <button
            className="link-button"
            disabled={isSaving}

            onClick={async () => {
              if (isSaving) return;

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

              await commitSession(newSession);
            }}
          >
            Postpone this exercise
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

        <div className="stepper">
          <span>Reps</span>
          <button
            onClick={() => {
              updateStepperSession((currentSession) => {
                const workoutForSession = currentSession.reorderedWorkout || workout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
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
                    [currentExercise.name]: {
                      ...(currentSession.adjustedRepBaselines?.[currentExercise.name] || {}),
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
                const workoutForSession = currentSession.reorderedWorkout || workout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
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
                    [currentExercise.name]: {
                      ...(currentSession.adjustedRepBaselines?.[currentExercise.name] || {}),
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
                const workoutForSession = currentSession.reorderedWorkout || workout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
                const currentSetPerson = currentSession.firstPerson
                  ? currentSession.exerciseOrder[currentSession.currentPersonIndex]
                  : null;

                if (!currentSetPerson) return currentSession;

                const newWeight = Math.max(0, currentSession.currentWeight - 5);
                const target = currentExercise.setPlan[currentSession.currentSet - 1];
                const adjustedBaseline =
                  newWeight -
                  (userStrategies[currentSetPerson] === "pyramid" ? target.weightOffset : 0);

                return {
                  ...currentSession,
                  currentWeight: newWeight,
                  adjustedBaselines: {
                    ...currentSession.adjustedBaselines,
                    [currentExercise.name]: {
                      ...(currentSession.adjustedBaselines?.[currentExercise.name] || {}),
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
                const workoutForSession = currentSession.reorderedWorkout || workout;
                const currentExercise = workoutForSession[currentSession.exerciseIndex];
                const currentSetPerson = currentSession.firstPerson
                  ? currentSession.exerciseOrder[currentSession.currentPersonIndex]
                  : null;

                if (!currentSetPerson) return currentSession;

                const newWeight = currentSession.currentWeight + 5;
                const target = currentExercise.setPlan[currentSession.currentSet - 1];
                const adjustedBaseline =
                  newWeight -
                  (userStrategies[currentSetPerson] === "pyramid" ? target.weightOffset : 0);

                return {
                  ...currentSession,
                  currentWeight: newWeight,
                  adjustedBaselines: {
                    ...currentSession.adjustedBaselines,
                    [currentExercise.name]: {
                      ...(currentSession.adjustedBaselines?.[currentExercise.name] || {}),
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
          <button className="secondary-button" disabled={isSaving} onClick={() => recordSet("skipped")}>
            Skip
          </button>
          <button className="primary-button" disabled={isSaving} onClick={() => recordSet("completed")}>
            Done / Next
          </button>
        </div>

        <div>
          <button className="link-button" disabled={isSaving} onClick={cancelWorkout}>
            Cancel Workout
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
