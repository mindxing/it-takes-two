import { useEffect, useState } from "react";
import "./App.css";
import { people, workout, type Person, type Exercise } from "./workoutData";
import { listenToWorkoutSession, saveWorkoutSession } from "./workoutSession";
import { saveCompletedWorkoutSummary, loadCompletedWorkoutSummaries, loadUserProfiles, saveUserProfile, calculateExerciseOutcomes, calculateProgressedUserProfilesFromHistory, type SetResult } from "./workoutSession";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type SetStatus = "completed" | "skipped";

type CompletedWorkout = {
  id: string;
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: Record<string, any>;
  results: SetResult[];
};

const defaultUserProfiles: Record<Person, Record<string, number>> = {
  Mike: {
    "Leg Press": 140,
    "Chest Press Machine": 80,
    "Seated Row Machine": 80,
    "Glute Machine": 70,
    "Bicep Curl Machine": 30,
    "Tricep Pushdown": 50,
    "Abs": 0,
    "Dumbbell Romanian Deadlift": 35,
  },
  Victoria: {
    "Leg Press": 100,
    "Chest Press Machine": 50,
    "Seated Row Machine": 50,
    "Glute Machine": 50,
    "Bicep Curl Machine": 20,
    "Tricep Pushdown": 30,
    "Abs": 0,
    "Dumbbell Romanian Deadlift": 20,
  },
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
  status?: "active" | "completed" | "cancelled";
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
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

  const effectiveWorkout = session.reorderedWorkout || workout;
  const warmupRunning = !!session.warmupStartedAt && session.exerciseIndex === 0;
  const exercise = effectiveWorkout[session.exerciseIndex];
  const currentPerson = session.firstPerson ? session.exerciseOrder[session.currentPersonIndex] : null;

  useEffect(() => {
    const unsubscribe = listenToWorkoutSession((data) => {
      const incoming = data as WorkoutSession;

      const isActive = incoming.status === "active" && !incoming.complete;
      const isStale =
        isActive &&
        incoming.updatedAt &&
        new Date(incoming.updatedAt).getTime() <
        Date.now() - 12 * 60 * 60 * 1000;

      if (incoming.status === "completed" || incoming.complete) {
        setActiveRemoteSession(null);

        if (session.started && !viewingPast) {
          setSession(incoming);
        }

        return;
      }

      if (isActive && !isStale) {
        setActiveRemoteSession(incoming);

        if (session.started && !session.complete) {
          setSession(incoming);
        }
      } else {
        setActiveRemoteSession(null);

        if (incoming.status === "cancelled") {
          setSession(initialSession);
        }
      }
    });

    return () => unsubscribe();
  }, [session.started, session.complete, viewingPast]);

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
      setWarmupSeconds(0);
      return;
    }

    const startTime = new Date(session.warmupStartedAt).getTime();
    const updateSeconds = () => {
      setWarmupSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    };

    updateSeconds();
    const intervalId = window.setInterval(updateSeconds, 1000);
    return () => window.clearInterval(intervalId);
  }, [session.warmupStartedAt, session.exerciseIndex]);

  async function cancelWorkout() {
    await saveWorkoutSession({
      ...session,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    setSession(initialSession);
  }

  function returnHome() {
    setSession(initialSession);
  }

  async function recordSet(status: SetStatus) {
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

      newSession = {
        ...newSession,
        currentPersonIndex: 1,
        currentReps: target.reps,
        currentWeight:
          (userProfiles[nextPerson][exercise.name] || 0) + target.weightOffset,
      };
    } else if (session.currentSet < exercise.sets) {
      const nextSet = session.currentSet + 1;
      const nextPerson = session.exerciseOrder[0];
      const target = exercise.setPlan[nextSet - 1];

      newSession = {
        ...newSession,
        currentPersonIndex: 0,
        currentSet: nextSet,
        currentReps: target.reps,
        currentWeight:
          (userProfiles[nextPerson][exercise.name] || 0) + target.weightOffset,
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

        const exerciseOutcomes = calculateExerciseOutcomes(newSession.results, effectiveWorkout, userProfiles);

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

    await saveWorkoutSession(newSession);
    setSession(newSession);
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

          <button
            className="primary-button"
            onClick={async () => {
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
                  setSession(activeRemoteSession);
                  return;
                }

                const newSession = {
                  ...session,
                  started: true,
                  status: "active" as const,
                };

                console.log("Saving session:", newSession);
                await saveWorkoutSession(newSession);
                setSession(newSession);
                console.log("Session saved");
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
            onClick={async () => {
              if (!warmupRunning) {
                const newSession = {
                  ...session,
                  warmupStartedAt: new Date().toISOString(),
                };

                await saveWorkoutSession(newSession);
                setSession(newSession);
                return;
              }

              const newSession = {
                ...session,
                warmupStartedAt: null,
                exerciseIndex: session.exerciseIndex + 1,
                firstPerson: null,
                currentPersonIndex: 0,
                currentSet: 1,
              };

              await saveWorkoutSession(newSession);
              setSession(newSession);
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
              onClick={async () => {
                const order: Person[] = ["Victoria", "Mike"];
                const target = exercise.setPlan[0];

                const newSession = {
                  ...session,
                  exerciseOrder: order,
                  firstPerson: "Victoria" as Person,
                  currentPersonIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: (userProfiles["Victoria"][exercise.name] || 0) + target.weightOffset,
                };

                await saveWorkoutSession(newSession);
                setSession(newSession);
              }}
            >
              Victoria
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                const order: Person[] = ["Mike", "Victoria"];
                const target = exercise.setPlan[0];

                const newSession = {
                  ...session,
                  exerciseOrder: order,
                  firstPerson: "Mike" as Person,
                  currentPersonIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: (userProfiles["Mike"][exercise.name] || 0) + target.weightOffset,
                };

                await saveWorkoutSession(newSession);
                setSession(newSession);
              }}
            >
              Mike
            </button>
          </div>

          <button
            className="link-button"
            onClick={async () => {
              if (session.exerciseIndex >= effectiveWorkout.length - 1) return; // can't postpone last exercise

              const currentWorkout = effectiveWorkout;
              const newWorkout = [...currentWorkout];
              const currentExercise = newWorkout.splice(session.exerciseIndex, 1)[0];
              newWorkout.splice(session.exerciseIndex + 1, 0, currentExercise);

              const newSession = {
                ...session,
                reorderedWorkout: newWorkout,
              };

              await saveWorkoutSession(newSession);
              setSession(newSession);
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
            onClick={async () => {
              await saveWorkoutSession({
                ...session,
                currentReps: Math.max(0, session.currentReps - 1),
              });
            }}>
            −
          </button>
          <strong>{session.currentReps}</strong>
          <button onClick={async () => {
            await saveWorkoutSession({
              ...session,
              currentReps: session.currentReps + 1,
            });
          }}>+</button>
        </div>

        <div className="stepper">
          <span>Weight</span>
          <button
            onClick={async () => {
              await saveWorkoutSession({
                ...session,
                currentWeight: Math.max(0, session.currentWeight - 5),
              });
            }}
          >
            −
          </button>
          <strong>{session.currentWeight} lbs</strong>
          <button onClick={async () => {
            await saveWorkoutSession({
              ...session,
              currentWeight: session.currentWeight + 5,
            });
          }}>+</button>
        </div>

        <div className="button-row">
          <button className="secondary-button" onClick={() => recordSet("skipped")}>
            Skip
          </button>
          <button className="primary-button" onClick={() => recordSet("completed")}>
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