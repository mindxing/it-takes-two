import { people, type Exercise, type Person } from "./workoutData.ts";
import type { SetResult } from "./workoutSession.ts";

export type SetStatus = "completed" | "skipped";
export type WeightStrategy = "pyramid" | "straight";

export type ActiveMovement = NonNullable<Exercise["movements"]>[number];

export type WorkoutSession = {
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
  eventSequence?: number;
};

export const initialSession: WorkoutSession = {
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

export function exerciseKey(exercise: Exercise) {
  return exercise.id || exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function activeMovement(exercise: Exercise, movementIndex = 0) {
  return exercise.movements?.[movementIndex] ?? null;
}

export function activeWeightKey(exercise: Exercise, movement: ActiveMovement | null) {
  return movement?.id ?? exerciseKey(exercise);
}

export function getSetPlan(exercise: Exercise, movement: ActiveMovement | null) {
  return movement?.setPlan ?? exercise.setPlan;
}

export function getProfileWeight(
  profiles: Record<Person, Record<string, number>>,
  person: Person,
  exercise: Exercise,
  movement: ActiveMovement | null = null
) {
  return profiles[person][activeWeightKey(exercise, movement)] ?? profiles[person][exerciseKey(exercise)] ?? profiles[person][exercise.name] ?? 0;
}

export function getPersonExerciseValue(
  values: Record<string, Partial<Record<Person, number>>> | undefined,
  exercise: Exercise,
  person: Person,
  movement: ActiveMovement | null = null
) {
  return values?.[activeWeightKey(exercise, movement)]?.[person] ?? values?.[exerciseKey(exercise)]?.[person] ?? values?.[exercise.name]?.[person];
}

export function startWorkoutSession(sessionId: string, workoutPlan: Exercise[]): WorkoutSession {
  return {
    ...initialSession,
    sessionId,
    started: true,
    status: "active",
    reorderedWorkout: workoutPlan,
  };
}

export function startWarmup(session: WorkoutSession, startedAt: string): WorkoutSession {
  return {
    ...session,
    warmupStartedAt: startedAt,
  };
}

export function completeWarmup(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    warmupStartedAt: null,
    exerciseIndex: session.exerciseIndex + 1,
    firstPerson: null,
    currentPersonIndex: 0,
    currentSet: 1,
  };
}

export function chooseFirstPerson({
  session,
  workout,
  userProfiles,
  userStrategies,
  firstPerson,
}: {
  session: WorkoutSession;
  workout: Exercise[];
  userProfiles: Record<Person, Record<string, number>>;
  userStrategies: Record<Person, WeightStrategy>;
  firstPerson: Person;
}): WorkoutSession {
  const exercise = workout[session.exerciseIndex];
  const order = firstPerson === "Victoria" ? ["Victoria", "Mike"] as Person[] : ["Mike", "Victoria"] as Person[];
  const firstMovement = activeMovement(exercise, 0);
  const target = getSetPlan(exercise, firstMovement)[0];

  return {
    ...session,
    exerciseOrder: order,
    firstPerson,
    currentPersonIndex: 0,
    currentMovementIndex: 0,
    currentSet: 1,
    currentReps: target.reps,
    currentWeight: getProfileWeight(userProfiles, firstPerson, exercise, firstMovement) + (userStrategies[firstPerson] === "pyramid" ? target.weightOffset : 0),
    adjustedBaselines: {
      ...session.adjustedBaselines,
      [activeWeightKey(exercise, firstMovement)]: {
        ...(session.adjustedBaselines?.[activeWeightKey(exercise, firstMovement)] || {}),
        [firstPerson]: getProfileWeight(userProfiles, firstPerson, exercise, firstMovement),
      },
    },
    adjustedRepBaselines: {
      ...session.adjustedRepBaselines,
      [activeWeightKey(exercise, firstMovement)]: {
        ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, firstMovement)] || {}),
        [firstPerson]: target.reps,
      },
    },
  };
}

export function postponeCurrentExercise(session: WorkoutSession, workout: Exercise[]): WorkoutSession {
  if (session.exerciseIndex >= workout.length - 1) {
    return session;
  }

  const newWorkout = [...workout];
  const currentExercise = newWorkout.splice(session.exerciseIndex, 1)[0];

  newWorkout.push(currentExercise);

  return {
    ...session,
    reorderedWorkout: newWorkout,
  };
}

export function adjustCurrentReps(session: WorkoutSession, workout: Exercise[], delta: number): WorkoutSession {
  const currentExercise = workout[session.exerciseIndex];
  const currentMovement = activeMovement(currentExercise, session.currentMovementIndex ?? 0);
  const currentSetPerson = session.firstPerson
    ? session.exerciseOrder[session.currentPersonIndex]
    : null;

  if (!currentSetPerson) return session;

  const newReps = Math.max(0, session.currentReps + delta);

  return {
    ...session,
    currentReps: newReps,
    adjustedRepBaselines: {
      ...session.adjustedRepBaselines,
      [activeWeightKey(currentExercise, currentMovement)]: {
        ...(session.adjustedRepBaselines?.[activeWeightKey(currentExercise, currentMovement)] || {}),
        [currentSetPerson]: newReps,
      },
    },
  };
}

export function adjustCurrentWeight({
  session,
  workout,
  userStrategies,
  delta,
}: {
  session: WorkoutSession;
  workout: Exercise[];
  userStrategies: Record<Person, WeightStrategy>;
  delta: number;
}): WorkoutSession {
  const currentExercise = workout[session.exerciseIndex];
  const currentMovement = activeMovement(currentExercise, session.currentMovementIndex ?? 0);
  const currentSetPerson = session.firstPerson
    ? session.exerciseOrder[session.currentPersonIndex]
    : null;

  if (!currentSetPerson) return session;

  const newWeight = Math.max(0, session.currentWeight + delta);
  const target = getSetPlan(currentExercise, currentMovement)[session.currentSet - 1];
  const adjustedBaseline =
    newWeight -
    (userStrategies[currentSetPerson] === "pyramid" ? target.weightOffset : 0);

  return {
    ...session,
    currentWeight: newWeight,
    adjustedBaselines: {
      ...session.adjustedBaselines,
      [activeWeightKey(currentExercise, currentMovement)]: {
        ...(session.adjustedBaselines?.[activeWeightKey(currentExercise, currentMovement)] || {}),
        [currentSetPerson]: adjustedBaseline,
      },
    },
  };
}

function prepareNextSetValues({
  session,
  exercise,
  movement,
  person,
  setNumber,
  userProfiles,
  userStrategies,
}: {
  session: WorkoutSession;
  exercise: Exercise;
  movement: ActiveMovement | null;
  person: Person;
  setNumber: number;
  userProfiles: Record<Person, Record<string, number>>;
  userStrategies: Record<Person, WeightStrategy>;
}) {
  const setPlan = getSetPlan(exercise, movement);
  const target = setPlan[setNumber - 1];
  const nextReps =
    userStrategies[person] === "straight"
      ? getPersonExerciseValue(session.adjustedRepBaselines, exercise, person, movement) ?? target.reps
      : target.reps;
  const nextAdjustedRepBaselines =
    userStrategies[person] === "straight"
      ? {
        ...session.adjustedRepBaselines,
        [activeWeightKey(exercise, movement)]: {
          ...(session.adjustedRepBaselines?.[activeWeightKey(exercise, movement)] || {}),
          [person]: nextReps,
        },
      }
      : session.adjustedRepBaselines;

  return {
    reps: nextReps,
    weight:
      (
        getPersonExerciseValue(session.adjustedBaselines, exercise, person, movement) ??
        getProfileWeight(userProfiles, person, exercise, movement) ??
        0
      ) + (userStrategies[person] === "pyramid" ? target.weightOffset : 0),
    adjustedRepBaselines: nextAdjustedRepBaselines,
  };
}

export function recordSetAndAdvance({
  session,
  workout,
  userProfiles,
  userStrategies,
  status,
  completedAt,
  createSessionId,
}: {
  session: WorkoutSession;
  workout: Exercise[];
  userProfiles: Record<Person, Record<string, number>>;
  userStrategies: Record<Person, WeightStrategy>;
  status: SetStatus;
  completedAt: string;
  createSessionId: () => string;
}): WorkoutSession {
  if (!session.firstPerson) return session;

  const exercise = workout[session.exerciseIndex];
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

  let newSession = {
    ...session,
    results: [...session.results, newResult],
  };

  if (movement && (session.currentMovementIndex ?? 0) < (exercise.movements?.length ?? 1) - 1) {
    const nextMovementIndex = (session.currentMovementIndex ?? 0) + 1;
    const nextMovement = activeMovement(exercise, nextMovementIndex);
    const next = prepareNextSetValues({
      session,
      exercise,
      movement: nextMovement,
      person: currentPerson,
      setNumber: session.currentSet,
      userProfiles,
      userStrategies,
    });

    return {
      ...newSession,
      currentMovementIndex: nextMovementIndex,
      currentReps: next.reps,
      currentWeight: next.weight,
      adjustedRepBaselines: next.adjustedRepBaselines,
    };
  }

  if (session.currentPersonIndex === 0) {
    const nextPerson = session.exerciseOrder[1];
    const nextMovement = activeMovement(exercise, 0);
    const next = prepareNextSetValues({
      session,
      exercise,
      movement: nextMovement,
      person: nextPerson,
      setNumber: session.currentSet,
      userProfiles,
      userStrategies,
    });

    return {
      ...newSession,
      currentPersonIndex: 1,
      currentMovementIndex: 0,
      currentReps: next.reps,
      currentWeight: next.weight,
      adjustedRepBaselines: next.adjustedRepBaselines,
    };
  }

  if (session.currentSet < exercise.sets) {
    const nextSet = session.currentSet + 1;
    const nextPerson = session.exerciseOrder[0];
    const nextMovement = activeMovement(exercise, 0);
    const next = prepareNextSetValues({
      session,
      exercise,
      movement: nextMovement,
      person: nextPerson,
      setNumber: nextSet,
      userProfiles,
      userStrategies,
    });

    return {
      ...newSession,
      currentPersonIndex: 0,
      currentMovementIndex: 0,
      currentSet: nextSet,
      currentReps: next.reps,
      currentWeight: next.weight,
      adjustedRepBaselines: next.adjustedRepBaselines,
    };
  }

  if (session.exerciseIndex < workout.length - 1) {
    return {
      ...newSession,
      exerciseIndex: session.exerciseIndex + 1,
      firstPerson: null,
      currentPersonIndex: 0,
      currentMovementIndex: 0,
      currentSet: 1,
    };
  }

  newSession = {
    ...newSession,
    sessionId: newSession.sessionId ?? createSessionId(),
    complete: true,
    status: "completed",
    completedAt,
  };

  return newSession;
}

export function currentWorkoutPrompt(session: WorkoutSession, workout: Exercise[]) {
  const exercise = workout[session.exerciseIndex];
  const movement = exercise ? activeMovement(exercise, session.currentMovementIndex ?? 0) : null;
  const person = session.firstPerson ? session.exerciseOrder[session.currentPersonIndex] : null;

  return {
    person,
    exerciseId: exercise ? exerciseKey(exercise) : null,
    exerciseName: exercise?.name ?? null,
    movementId: movement?.id ?? null,
    movementName: movement?.name ?? null,
    setNumber: session.currentSet,
    reps: session.currentReps,
    weight: session.currentWeight,
  };
}
