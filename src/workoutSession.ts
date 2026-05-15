import { db } from "./firebase";
import { addDoc, collection, getDocs, orderBy, query, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import type { Person, Exercise as WorkoutExercise } from "./workoutData";

export const demoSessionId = "demo";

function removeUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedValues);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, itemValue]) => itemValue !== undefined)
        .map(([key, itemValue]) => [key, removeUndefinedValues(itemValue)])
    );
  }

  return value;
}

export function saveWorkoutSession(session: unknown) {
  const now = new Date().toISOString();
  const prepared = removeUndefinedValues({
    ...(session as Record<string, unknown>),
    updatedAt: now,
  }) as Record<string, unknown>;

  if (!prepared.createdAt) {
    prepared.createdAt = now;
  }

  return setDoc(doc(db, "workoutSessions", demoSessionId), prepared, { merge: true });
}

export function listenToWorkoutSession(
  onSessionChange: (session: unknown) => void
) {
  return onSnapshot(doc(db, "workoutSessions", demoSessionId), (snapshot) => {
    if (snapshot.exists()) {
      onSessionChange(snapshot.data());
    }
  });
}

export async function loadCurrentWorkoutSession() {
  const snapshot = await getDoc(doc(db, "workoutSessions", demoSessionId));
  return snapshot.exists() ? snapshot.data() : null;
}

export function saveCompletedWorkoutSummary(summary: {
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: Record<string, Record<string, "exact" | "up" | "down" | "neutral">>;
  results: SetResult[];
}) {
  return addDoc(collection(db, "completedWorkouts"), summary);
}

export async function loadWorkoutPlan(fallbackWorkout: WorkoutExercise[]): Promise<WorkoutExercise[]> {
  const planDoc = await getDoc(doc(db, "workoutPlans", "default"));

  if (!planDoc.exists()) {
    return fallbackWorkout;
  }

  const plan = planDoc.data() as {
    active?: boolean;
    exerciseIds?: string[];
    items?: Array<Partial<WorkoutExercise> & { exerciseId?: string; active?: boolean }>;
  };

  if (plan.active === false) {
    return fallbackWorkout;
  }

  const fallbackById = new Map(fallbackWorkout.map((exercise) => [exercise.id, exercise]));
  const planItems: Array<Partial<WorkoutExercise> & { exerciseId?: string; active?: boolean }> =
    plan.exerciseIds?.map((exerciseId) => ({ exerciseId })) ??
    plan.items ??
    [];

  if (planItems.length === 0) {
    return fallbackWorkout;
  }

  const exercises = await Promise.all(
    planItems
      .filter((item) => item.active !== false)
      .map(async (item) => {
        const exerciseId = item.exerciseId ?? item.id;

        if (!exerciseId) return null;

        const exerciseDoc = await getDoc(doc(db, "exercises", exerciseId));
        const exerciseData = exerciseDoc.exists()
          ? (exerciseDoc.data() as Partial<WorkoutExercise> & { active?: boolean })
          : {};

        if (exerciseData.active === false) return null;

        const fallback = fallbackById.get(exerciseId);
        const merged = {
          ...fallback,
          ...exerciseData,
          ...item,
          id: exerciseId,
        };

        return isWorkoutExercise(merged) ? merged : null;
      })
  );

  const prepared = exercises.filter((exercise): exercise is WorkoutExercise => exercise !== null);

  return prepared.length > 0 ? prepared : fallbackWorkout;
}

export type ExerciseOutcome = "exact" | "up" | "down" | "neutral";

export type ExerciseOutcomes = Record<string, Record<string, ExerciseOutcome>>;

export type CompletedWorkoutSummary = {
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: ExerciseOutcomes;
  results: SetResult[];
};

export async function loadCompletedWorkoutSummaries() {
  const q = query(
    collection(db, "completedWorkouts"),
    orderBy("completedAt", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as CompletedWorkoutSummary),
  }));
}

export type UserWeights = Record<string, number>;

export async function loadUserProfiles(defaults: Record<string, UserWeights>): Promise<Record<string, UserWeights>> {
  const profiles: Record<string, UserWeights> = {};

  const mikeDoc = await getDoc(doc(db, "userProfiles", "Mike"));
  if (mikeDoc.exists()) {
    profiles.Mike = mikeDoc.data().weights || {};
  } else {
    await saveUserProfile("Mike", defaults.Mike);
    profiles.Mike = defaults.Mike;
  }

  const victoriaDoc = await getDoc(doc(db, "userProfiles", "Victoria"));
  if (victoriaDoc.exists()) {
    profiles.Victoria = victoriaDoc.data().weights || {};
  } else {
    await saveUserProfile("Victoria", defaults.Victoria);
    profiles.Victoria = defaults.Victoria;
  }

  return profiles;
}

export function saveUserProfile(person: string, weights: UserWeights) {
  return setDoc(doc(db, "userProfiles", person), { weights });
}

export type SetResult = {
  exerciseId?: string;
  exerciseName: string;
  movementId?: string;
  movementName?: string;
  person: Person;
  setNumber: number;
  reps: number;
  weight: number;
  status: "completed" | "skipped";
};

export type SetTarget = {
  reps: number;
  weightOffset: number;
};

export type Exercise = {
  id: string;
  name: string;
  setPlan: SetTarget[];
  movements?: Array<{
    id: string;
    name: string;
    setPlan?: SetTarget[];
  }>;
};

function isWorkoutExercise(exercise: Partial<WorkoutExercise>): exercise is WorkoutExercise {
  return (
    typeof exercise.id === "string" &&
    typeof exercise.name === "string" &&
    typeof exercise.sets === "number" &&
    typeof exercise.reps === "string" &&
    typeof exercise.defaultReps === "number" &&
    !!exercise.defaultWeight &&
    Array.isArray(exercise.setPlan)
  );
}

function exerciseKey(exercise: Exercise) {
  return exercise.id;
}

function resultOutcomeKey(result: SetResult) {
  return result.movementId ?? result.exerciseId ?? result.exerciseName;
}

function isWarmupKey(key: string, workout: Exercise[]) {
  const exercise = workout.find((item) => item.id === key || item.name === key);
  return exercise?.id === "warm_up" || key === "Warm-up";
}

function profileWeight(
  userProfiles: Record<string, Record<string, number>>,
  person: string,
  exercise: Exercise,
  movement?: { id: string } | null
) {
  return userProfiles[person]?.[movement?.id ?? ""] ?? userProfiles[person]?.[exercise.id] ?? userProfiles[person]?.[exercise.name] ?? 0;
}

function findExerciseAndMovement(workout: Exercise[], resultKey: string) {
  for (const exercise of workout) {
    if (exercise.id === resultKey || exercise.name === resultKey) {
      return { exercise, movement: null };
    }

    const movement = exercise.movements?.find((movement) => movement.id === resultKey || movement.name === resultKey);

    if (movement) {
      return { exercise, movement };
    }
  }

  return { exercise: null, movement: null };
}

export function calculateExerciseOutcomes(
  results: SetResult[],
  workout: Exercise[],
  userProfiles: Record<string, Record<string, number>>,
  userStrategies: Record<Person, "pyramid" | "straight">
): ExerciseOutcomes {
  const outcomes: ExerciseOutcomes = {};

  // Group results by person and exercise
  const groupedResults = new Map<string, Map<string, SetResult[]>>();

  for (const result of results) {
    const key = resultOutcomeKey(result);

    if (isWarmupKey(key, workout)) continue;

    if (!groupedResults.has(result.person)) {
      groupedResults.set(result.person, new Map());
    }

    const personResults = groupedResults.get(result.person)!;

    if (!personResults.has(key)) {
      personResults.set(key, []);
    }

    personResults.get(key)!.push(result);
  }

  // Calculate outcome for each person-exercise combination
  for (const [person, exercises] of groupedResults) {
    outcomes[person] = {};

    for (const [exerciseResultKey, exerciseResults] of exercises) {
      // Find the exercise plan
      const { exercise, movement } = findExerciseAndMovement(workout, exerciseResultKey);
      const outcomeKey = movement?.id ?? (exercise ? exerciseKey(exercise) : exerciseResultKey);

      if (!exercise) {
        outcomes[person][outcomeKey] = "neutral";
        continue;
      }

      // Check if any set was skipped
      const hasSkipped = exerciseResults.some(
        (r) => r.status === "skipped"
      );

      if (hasSkipped) {
        outcomes[person][outcomeKey] = "down";
        continue;
      }

      // All sets completed
      const completedResults = exerciseResults.filter(
        (r) => r.status === "completed"
      );

      if (completedResults.length === 0) {
        outcomes[person][outcomeKey] = "neutral";
        continue;
      }

      // Sort by set number
      const sortedResults = [...completedResults].sort(
        (a, b) => a.setNumber - b.setNumber
      );

      // Base weight for this person/exercise
      const baseWeight = profileWeight(userProfiles, person, exercise, movement);

      let isExact = true;
      let hasUp = false;
      let hasDown = false;

      for (let i = 0; i < sortedResults.length; i++) {
        const result = sortedResults[i];
        const setPlan = movement?.setPlan ?? exercise.setPlan;
        const planned = setPlan[i];

        if (!planned) {
          isExact = false;
          break;
        }

        const strategy = userStrategies[result.person];

        const plannedReps =
          strategy === "straight"
            ? setPlan[0].reps
            : planned.reps;

        const plannedWeight =
          baseWeight +
          (strategy === "pyramid"
            ? planned.weightOffset
            : 0);

        // Compare actual vs expected
        if (
          result.reps === plannedReps &&
          result.weight === plannedWeight
        ) {
          // Exact match
          continue;
        } else if (
          result.reps > plannedReps ||
          result.weight > plannedWeight
        ) {
          hasUp = true;
          isExact = false;
        } else if (
          result.reps < plannedReps - 1 ||
          result.weight < plannedWeight - 5
        ) {
          // Significant decrease
          hasDown = true;
          isExact = false;
        } else {
          // Minor deviation
          isExact = false;
        }
      }

      if (isExact) {
        outcomes[person][outcomeKey] = "exact";
      } else if (hasDown) {
        outcomes[person][outcomeKey] = "down";
      } else if (hasUp && !hasDown) {
        outcomes[person][outcomeKey] = "up";
      } else {
        outcomes[person][outcomeKey] = "neutral";
      }
    }
  }

  return outcomes;
}

export type ProgressionReason = {
  person: string;
  exercise: string;
  oldWeight: number;
  newWeight: number;
  reason: string;
};

export function calculateProgressedUserProfilesFromHistory(
  currentProfiles: Record<string, UserWeights>,
  workoutPlan: Exercise[],
  completedWorkoutHistory: CompletedWorkoutSummary[]
): {
  updatedProfiles: Record<string, UserWeights>;
  reasons: ProgressionReason[];
} {
  const updatedProfiles = JSON.parse(JSON.stringify(currentProfiles));
  const reasons: ProgressionReason[] = [];

  // Get people from profiles
  const people = Object.keys(updatedProfiles) as string[];

  for (const person of people) {
    if (!updatedProfiles[person]) continue;

    // Get all exercises except warm-up
    const exercises = workoutPlan.filter((e) => e.id !== "warm_up");

    for (const exercise of exercises) {
      const exerciseId = exercise.id;
      const exerciseName = exercise.name;

      // Collect the last outcomes for this person-exercise
      const outcomes: ExerciseOutcome[] = [];

      for (let i = completedWorkoutHistory.length - 1; i >= 0 && outcomes.length < 3; i--) {
        const workoutEntry = completedWorkoutHistory[i];
        if (
          workoutEntry.exerciseOutcomes &&
          workoutEntry.exerciseOutcomes[person] &&
          (workoutEntry.exerciseOutcomes[person][exerciseId] ||
            workoutEntry.exerciseOutcomes[person][exerciseName])
        ) {
          outcomes.unshift(
            workoutEntry.exerciseOutcomes[person][exerciseId] ??
            workoutEntry.exerciseOutcomes[person][exerciseName]
          );
        }
      }

      const currentWeight = updatedProfiles[person][exerciseId] ?? updatedProfiles[person][exerciseName] ?? 0;

      // Apply progression rules
      let newWeight = currentWeight;
      let reason: string | null = null;

      // Rule 1: Last 3 are all "exact" -> +5
      if (outcomes.length >= 3 && outcomes.slice(-3).every((o) => o === "exact")) {
        newWeight = currentWeight + 5;
        reason = "last 3 outcomes exact";
      }
      // Rule 2: Last 2 are all "up" -> +5
      else if (outcomes.length >= 2 && outcomes.slice(-2).every((o) => o === "up")) {
        newWeight = currentWeight + 5;
        reason = "last 2 outcomes up";
      }
      // Rule 3: Last 2 are all "down" -> -5
      else if (outcomes.length >= 2 && outcomes.slice(-2).every((o) => o === "down")) {
        newWeight = Math.max(0, currentWeight - 5);
        reason = "last 2 outcomes down";
      }

      if (newWeight !== currentWeight && reason) {
        updatedProfiles[person][exerciseId] = newWeight;
        reasons.push({
          person,
          exercise: exerciseName,
          oldWeight: currentWeight,
          newWeight,
          reason,
        });
      }
    }
  }

  return { updatedProfiles, reasons };
}
