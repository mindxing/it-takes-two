import { db } from "./firebase";
import { addDoc, collection, getDocs, orderBy, query, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

export const demoSessionId = "demo";

export function saveWorkoutSession(session: unknown) {
  const now = new Date().toISOString();
  const prepared = {
    ...(session as Record<string, unknown>),
    updatedAt: now,
  } as Record<string, unknown>;

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

export function saveCompletedWorkoutSummary(summary: {
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: Record<string, Record<string, "exact" | "up" | "down" | "neutral">>;
  results: SetResult[];
}) {
  return addDoc(collection(db, "completedWorkouts"), summary);
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
  exerciseName: string;
  person: string;
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
  name: string;
  setPlan: SetTarget[];
};

export function calculateExerciseOutcomes(
  results: SetResult[],
  workout: Exercise[],
  userProfiles: Record<string, Record<string, number>>
): ExerciseOutcomes {
  const outcomes: ExerciseOutcomes = {};

  // Group results by person and exercise
  const groupedResults = new Map<string, Map<string, SetResult[]>>();

  for (const result of results) {
    if (result.exerciseName === "Warm-up") continue;

    if (!groupedResults.has(result.person)) {
      groupedResults.set(result.person, new Map());
    }

    const personResults = groupedResults.get(result.person)!;
    if (!personResults.has(result.exerciseName)) {
      personResults.set(result.exerciseName, []);
    }

    personResults.get(result.exerciseName)!.push(result);
  }

  // Calculate outcome for each person-exercise combination
  for (const [person, exercises] of groupedResults) {
    outcomes[person] = {};

    for (const [exerciseName, exerciseResults] of exercises) {
      // Find the exercise plan
      const exercise = workout.find((e) => e.name === exerciseName);
      if (!exercise) {
        outcomes[person][exerciseName] = "neutral";
        continue;
      }

      // Check if any set was skipped
      const hasSkipped = exerciseResults.some((r) => r.status === "skipped");
      if (hasSkipped) {
        outcomes[person][exerciseName] = "down";
        continue;
      }

      // All sets completed, check for modifications
      const completedResults = exerciseResults.filter(
        (r) => r.status === "completed"
      );

      if (completedResults.length === 0) {
        outcomes[person][exerciseName] = "neutral";
        continue;
      }

      // Sort by set number to match plan
      const sortedResults = [...completedResults].sort(
        (a, b) => a.setNumber - b.setNumber
      );

      // Get base weight for this person-exercise combo
      const baseWeight = userProfiles[person]?.[exerciseName] || 0;

      let isExact = true;
      let hasUp = false;
      let hasDown = false;

      for (let i = 0; i < sortedResults.length; i++) {
        const result = sortedResults[i];
        const planned = exercise.setPlan[i];

        if (!planned) {
          isExact = false;
          break;
        }

        const plannedWeight = baseWeight + planned.weightOffset;

        // Compare reps and weight
        if (result.reps === planned.reps && result.weight === plannedWeight) {
          // Exact match
          continue;
        } else if (
          result.reps > planned.reps ||
          result.weight > plannedWeight
        ) {
          hasUp = true;
          isExact = false;
        } else if (
          result.reps < planned.reps - 1 ||
          result.weight < plannedWeight - 5
        ) {
          // More than minor deviation
          hasDown = true;
          isExact = false;
        } else {
          // Minor deviation (1 rep or 5 lbs less)
          isExact = false;
        }
      }

      if (isExact) {
        outcomes[person][exerciseName] = "exact";
      } else if (hasDown) {
        outcomes[person][exerciseName] = "down";
      } else if (hasUp && !hasDown) {
        outcomes[person][exerciseName] = "up";
      } else {
        outcomes[person][exerciseName] = "neutral";
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
    const exercises = workoutPlan.filter((e) => e.name !== "Warm-up");

    for (const exercise of exercises) {
      const exerciseName = exercise.name;

      // Collect the last outcomes for this person-exercise
      const outcomes: ExerciseOutcome[] = [];

      for (let i = completedWorkoutHistory.length - 1; i >= 0 && outcomes.length < 3; i--) {
        const workoutEntry = completedWorkoutHistory[i];
        if (
          workoutEntry.exerciseOutcomes &&
          workoutEntry.exerciseOutcomes[person] &&
          workoutEntry.exerciseOutcomes[person][exerciseName]
        ) {
          outcomes.unshift(workoutEntry.exerciseOutcomes[person][exerciseName]);
        }
      }

      const currentWeight = updatedProfiles[person][exerciseName] || 0;

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
        updatedProfiles[person][exerciseName] = newWeight;
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