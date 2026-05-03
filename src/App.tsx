import { useEffect, useState } from "react";
import "./App.css";
import { people, workout, type Person } from "./workoutData";
import { listenToWorkoutSession, saveWorkoutSession } from "./workoutSession";
import { saveCompletedWorkoutSummary, loadCompletedWorkoutSummaries, loadUserProfiles, saveUserProfile, type UserWeights } from "./workoutSession";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type SetStatus = "completed" | "skipped";

type SetResult = {
  exerciseName: string;
  person: Person;
  setNumber: number;
  reps: number;
  weight: number;
  status: SetStatus;
};

type CompletedWorkout = {
  id: string;
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
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
};

type WorkoutProgressProps = {
  exerciseIndex: number;
};

function WorkoutProgress({ exerciseIndex }: WorkoutProgressProps) {
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
  const [showDetails, setShowDetails] = useState(false);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<Person, Record<string, number>>>(defaultUserProfiles);

  const exercise = workout[session.exerciseIndex];
  const currentPerson = session.firstPerson ? session.exerciseOrder[session.currentPersonIndex] : null;

  useEffect(() => {
    const unsubscribe = listenToWorkoutSession((data) => {
      setSession(data as WorkoutSession);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadCompletedWorkoutSummaries().then(setCompletedWorkouts);
  }, [session.complete]);

  useEffect(() => {
    loadUserProfiles().then((profiles) => {
      setUserProfiles({
        Mike: { ...defaultUserProfiles.Mike, ...profiles.Mike },
        Victoria: { ...defaultUserProfiles.Victoria, ...profiles.Victoria },
      });
    });
  }, []);

  async function resetWorkout() {
    await saveWorkoutSession(initialSession);
  }

  async function recordSet(status: SetStatus) {
    if (!session.firstPerson) return;

    const exercise = workout[session.exerciseIndex];
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
      if (session.exerciseIndex < workout.length - 1) {
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

        // Save summary (fire-and-forget is fine)
        saveCompletedWorkoutSummary({
          completedAt: new Date().toISOString(),
          totalSets,
          totalWeightLifted,
        });
      }
    }

    await saveWorkoutSession(newSession);
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
                const newSession = {
                  ...session,
                  started: true,
                };

                console.log("Saving session:", newSession);
                await saveWorkoutSession(newSession);
                console.log("Session saved");
              } catch (error) {
                console.error("Failed to save session:", error);
              }
            }}
          >
            Start Workout
          </button>

        </section>
      </main>
    );
  }

  if (session.complete) {

    const completedResults = session.results.filter(
      (r) => r.status === "completed"
    );

    const totalSets = completedResults.length;

    const totalWeightLifted = completedResults.reduce(
      (sum, r) => sum + r.weight * r.reps,
      0
    );

    const exercisesWithResults = workout
      .filter((exercise) => exercise.name !== "Warm-up")
      .map((exercise) => ({
        name: exercise.name,
        results: session.results.filter((r) => r.exerciseName === exercise.name),
      }))
      .filter((exercise) => exercise.results.length > 0);

    return (
      <main className="app">
        <section className="card summary-card">
          <h1>Workout Complete 🎉</h1>
          <p className="subtitle">Nice work, both of you.</p>

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
            onClick={resetWorkout}
          >
            Back to Home
          </button>
        </section>
      </main>
    );
  }

  if (session.exerciseIndex === 0) {
    return (
      <main className="app">
        <section className="card">
          <WorkoutProgress exerciseIndex={session.exerciseIndex} />
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

          <button
            className="primary-button"
            onClick={async () => {
              const newSession = {
                ...session,
                exerciseIndex: session.exerciseIndex + 1,
                firstPerson: null,
                currentPersonIndex: 0,
                currentSet: 1,
              };

              await saveWorkoutSession(newSession);
            }}
          >
            Done with Warm-up
          </button>
        </section>
      </main>
    );
  }

  if (!session.firstPerson) {
    return (
      <main className="app">
        <section className="card">
          <WorkoutProgress exerciseIndex={session.exerciseIndex} />
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

                await saveWorkoutSession({
                  ...session,
                  exerciseOrder: order,
                  firstPerson: "Victoria",
                  currentPersonIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: (userProfiles["Victoria"][exercise.name] || 0) + target.weightOffset,
                });
              }}
            >
              Victoria
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                const order: Person[] = ["Mike", "Victoria"];
                const target = exercise.setPlan[0];

                await saveWorkoutSession({
                  ...session,
                  exerciseOrder: order,
                  firstPerson: "Mike",
                  currentPersonIndex: 0,
                  currentSet: 1,
                  currentReps: target.reps,
                  currentWeight: (userProfiles["Mike"][exercise.name] || 0) + target.weightOffset,
                });
              }}
            >
              Mike
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="card">
        <WorkoutProgress exerciseIndex={session.exerciseIndex} />
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
          <button className="link-button" onClick={resetWorkout}>
            Cancel Workout
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;