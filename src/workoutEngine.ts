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
  tandem?: {
    primaryExerciseIndex: number;
    secondaryExerciseIndex: number;
    turnIndex: number;
  } | null;
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
  tandemExerciseId,
}: {
  session: WorkoutSession;
  workout: Exercise[];
  userProfiles: Record<Person, Record<string, number>>;
  userStrategies: Record<Person, WeightStrategy>;
  firstPerson: Person;
  tandemExerciseId?: string | null;
}): WorkoutSession {
  const prepared = prepareTandemWorkout(session, workout, tandemExerciseId);
  const exercise = prepared.workout[prepared.session.exerciseIndex];
  const order = firstPerson === "Victoria" ? ["Victoria", "Mike"] as Person[] : ["Mike", "Victoria"] as Person[];
  const firstMovement = activeMovement(exercise, 0);
  const target = getSetPlan(exercise, firstMovement)[0];

  return {
    ...prepared.session,
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

function prepareTandemWorkout(session: WorkoutSession, workout: Exercise[], tandemExerciseId: string | null | undefined) {
  if (!tandemExerciseId) {
    return {
      session: {
        ...session,
        tandem: null,
      },
      workout,
    };
  }

  const currentIndex = session.exerciseIndex;
  const selectedIndex = workout.findIndex((exercise, index) => index > currentIndex && exerciseKey(exercise) === tandemExerciseId);

  if (selectedIndex < 0) {
    return {
      session: {
        ...session,
        tandem: null,
      },
      workout,
    };
  }

  const reorderedWorkout = [...workout];
  const selected = reorderedWorkout.splice(selectedIndex, 1)[0];
  reorderedWorkout.splice(currentIndex + 1, 0, selected);

  return {
    session: {
      ...session,
      exerciseIndex: currentIndex,
      reorderedWorkout,
      tandem: {
        primaryExerciseIndex: currentIndex,
        secondaryExerciseIndex: currentIndex + 1,
        turnIndex: 0,
      },
    },
    workout: reorderedWorkout,
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

  if (session.tandem) {
    return advanceTandemTurn({
      session: newSession,
      workout,
      userProfiles,
      userStrategies,
      completedAt,
      createSessionId,
    });
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

function tandemTurnFor(session: WorkoutSession, turnIndex: number) {
  if (!session.tandem) {
    return null;
  }

  const firstPersonIndex = 0;
  const secondPersonIndex = 1;

  if (turnIndex === 0) {
    return {
      exerciseIndex: session.tandem.primaryExerciseIndex,
      personIndex: firstPersonIndex,
    };
  }

  if (turnIndex === 1) {
    return {
      exerciseIndex: session.tandem.secondaryExerciseIndex,
      personIndex: secondPersonIndex,
    };
  }

  if (turnIndex === 2) {
    return {
      exerciseIndex: session.tandem.primaryExerciseIndex,
      personIndex: secondPersonIndex,
    };
  }

  return {
    exerciseIndex: session.tandem.secondaryExerciseIndex,
    personIndex: firstPersonIndex,
  };
}

function nextTandemPosition(session: WorkoutSession, workout: Exercise[]) {
  if (!session.tandem) return null;

  let nextTurnIndex = session.tandem.turnIndex + 1;
  let nextSet = session.currentSet;

  while (nextSet <= maxTandemSets(session, workout)) {
    if (nextTurnIndex > 3) {
      nextTurnIndex = 0;
      nextSet += 1;
    }

    const turn = tandemTurnFor(session, nextTurnIndex);
    const exercise = turn ? workout[turn.exerciseIndex] : null;

    if (turn && exercise && nextSet <= exercise.sets) {
      return {
        ...turn,
        turnIndex: nextTurnIndex,
        setNumber: nextSet,
      };
    }

    nextTurnIndex += 1;
  }

  return null;
}

function maxTandemSets(session: WorkoutSession, workout: Exercise[]) {
  if (!session.tandem) return 0;

  return Math.max(
    workout[session.tandem.primaryExerciseIndex]?.sets ?? 0,
    workout[session.tandem.secondaryExerciseIndex]?.sets ?? 0
  );
}

function advanceTandemTurn({
  session,
  workout,
  userProfiles,
  userStrategies,
  completedAt,
  createSessionId,
}: {
  session: WorkoutSession;
  workout: Exercise[];
  userProfiles: Record<Person, Record<string, number>>;
  userStrategies: Record<Person, WeightStrategy>;
  completedAt: string;
  createSessionId: () => string;
}) {
  const nextPosition = nextTandemPosition(session, workout);

  if (nextPosition) {
    const exercise = workout[nextPosition.exerciseIndex];
    const person = session.exerciseOrder[nextPosition.personIndex];
    const movement = activeMovement(exercise, 0);
    const next = prepareNextSetValues({
      session,
      exercise,
      movement,
      person,
      setNumber: nextPosition.setNumber,
      userProfiles,
      userStrategies,
    });

    return {
      ...session,
      exerciseIndex: nextPosition.exerciseIndex,
      currentPersonIndex: nextPosition.personIndex,
      currentMovementIndex: 0,
      currentSet: nextPosition.setNumber,
      currentReps: next.reps,
      currentWeight: next.weight,
      adjustedRepBaselines: next.adjustedRepBaselines,
      tandem: session.tandem
        ? {
          ...session.tandem,
          turnIndex: nextPosition.turnIndex,
        }
        : session.tandem,
    };
  }

  const nextExerciseIndex = session.tandem ? session.tandem.secondaryExerciseIndex + 1 : session.exerciseIndex + 1;

  if (nextExerciseIndex < workout.length) {
    return {
      ...session,
      exerciseIndex: nextExerciseIndex,
      firstPerson: null,
      currentPersonIndex: 0,
      currentMovementIndex: 0,
      currentSet: 1,
      tandem: null,
    };
  }

  return {
    ...session,
    sessionId: session.sessionId ?? createSessionId(),
    complete: true,
    status: "completed" as const,
    completedAt,
    tandem: null,
  };
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
