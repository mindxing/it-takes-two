import { useState } from "react";
import "./App.css";
import { people, workout, type Person } from "./workoutData";

type SetStatus = "completed" | "skipped";

type SetResult = {
  exerciseName: string;
  person: Person;
  setNumber: number;
  reps: number;
  weight: number;
  status: SetStatus;
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

  const exercise = workout[session.exerciseIndex];
  const currentPerson = session.firstPerson ? session.exerciseOrder[session.currentPersonIndex] : null;

  function WorkoutProgress() {
    const totalExercises = workout.length;
    const currentNumber = session.exerciseIndex + 1;

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
                index === session.exerciseIndex
                  ? "progress-dot current"
                  : index < session.exerciseIndex
                  ? "progress-dot done"
                  : "progress-dot"
              }
            />
          ))}
        </div>
      </div>
    );
  }

  function resetWorkout() {
    setSession(initialSession);
  }

  function startExercise(person: Person) {
    const order: Person[] =
      person === "Victoria" ? ["Victoria", "Mike"] : ["Mike", "Victoria"];

    const target = exercise.setPlan[0];

    setSession({
      ...session,
      exerciseOrder: order,
      firstPerson: person,
      currentPersonIndex: 0,
      currentSet: 1,
      currentReps: target.reps,
      currentWeight: exercise.defaultWeight[order[0]] + target.weightOffset,
    });
  }

  function goToNextExercise() {
    if (session.exerciseIndex < workout.length - 1) {
      setSession({
        ...session,
        exerciseIndex: session.exerciseIndex + 1,
        firstPerson: null,
        currentPersonIndex: 0,
        currentSet: 1,
      });
    } else {
      setSession({
        ...session,
        complete: true,
      });
    }
  }

  function recordSet(status: SetStatus) {
    if (!currentPerson) return;

    // Calculate next state in one go to avoid stale closure
    let nextPersonIndex = session.currentPersonIndex;
    let nextSet = session.currentSet;
    let nextReps = session.currentReps;
    let nextWeight = session.currentWeight;

    // Move from first person to second person on the same set
    if (session.currentPersonIndex === 0) {
      const nextPerson = session.exerciseOrder[1];
      const target = exercise.setPlan[session.currentSet - 1];
      nextPersonIndex = 1;
      nextReps = target.reps;
      nextWeight = exercise.defaultWeight[nextPerson] + target.weightOffset;
    }
    // Move from second person to first person on the next set
    else if (session.currentSet < exercise.sets) {
      const nextPerson = session.exerciseOrder[0];
      const target = exercise.setPlan[session.currentSet];
      nextPersonIndex = 0;
      nextSet = session.currentSet + 1;
      nextReps = target.reps;
      nextWeight = exercise.defaultWeight[nextPerson] + target.weightOffset;
    }
    // Finished all sets for both people - go to next exercise
    else if (session.exerciseIndex < workout.length - 1) {
      setSession({
        ...session,
        results: [
          ...session.results,
          {
            exerciseName: exercise.name,
            person: currentPerson,
            setNumber: session.currentSet,
            reps: status === "skipped" ? 0 : session.currentReps,
            weight: session.currentWeight,
            status,
          },
        ],
        exerciseIndex: session.exerciseIndex + 1,
        firstPerson: null,
        currentPersonIndex: 0,
        currentSet: 1,
      });
      return;
    }
    // Workout complete
    else {
      setSession({
        ...session,
        results: [
          ...session.results,
          {
            exerciseName: exercise.name,
            person: currentPerson,
            setNumber: session.currentSet,
            reps: status === "skipped" ? 0 : session.currentReps,
            weight: session.currentWeight,
            status,
          },
        ],
        complete: true,
      });
      return;
    }

    setSession({
      ...session,
      results: [
        ...session.results,
        {
          exerciseName: exercise.name,
          person: currentPerson,
          setNumber: session.currentSet,
          reps: status === "skipped" ? 0 : session.currentReps,
          weight: session.currentWeight,
          status,
        },
      ],
      currentPersonIndex: nextPersonIndex,
      currentSet: nextSet,
      currentReps: nextReps,
      currentWeight: nextWeight,
    });
  }

  if (!session.started) {
    return (
      <main className="app">
        <section className="card">
          <h1>It Takes Two</h1>
          <p className="subtitle">Mike & Victoria's workout tracker</p>

          <button className="primary-button" onClick={() => setSession({ ...session, started: true })}>
            Start Workout
          </button>
        </section>
      </main>
    );
  }

  if (session.complete) {
    const completedSets = session.results.filter((r) => r.status === "completed").length;
    const skippedSets = session.results.filter((r) => r.status === "skipped").length;

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
            <p><strong>Completed sets:</strong> {completedSets}</p>
            <p><strong>Skipped sets:</strong> {skippedSets}</p>
          </div>

          <div className="summary-list">
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
          <WorkoutProgress />
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

          <button className="primary-button" onClick={goToNextExercise}>
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
          <WorkoutProgress />
          <h1>{exercise.name}</h1>
          <p className="subtitle">
            {exercise.sets} sets × {exercise.reps} reps
          </p>

          <h2>Who goes first?</h2>

          <div className="button-row">
            <button
              className="primary-button"
              onClick={() => startExercise("Victoria")}
            >
              Victoria
            </button>
            <button
              className="primary-button"
              onClick={() => startExercise("Mike")}
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
        <WorkoutProgress />
        <h1>{exercise.name}</h1>
        <p className="subtitle">
          {currentPerson} — Set {session.currentSet} of {exercise.sets}
        </p>

        <div className="stepper">
          <span>Reps</span>
          <button onClick={() => setSession({ ...session, currentReps: Math.max(0, session.currentReps - 1) })}>
            −
          </button>
          <strong>{session.currentReps}</strong>
          <button onClick={() => setSession({ ...session, currentReps: session.currentReps + 1 })}>+</button>
        </div>

        <div className="stepper">
          <span>Weight</span>
          <button
            onClick={() => setSession({ ...session, currentWeight: Math.max(0, session.currentWeight - 5) })}
          >
            −
          </button>
          <strong>{session.currentWeight} lbs</strong>
          <button onClick={() => setSession({ ...session, currentWeight: session.currentWeight + 5 })}>+</button>
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