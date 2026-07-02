import {
  activeCurrentBaselineDocumentId,
  activeWorkoutGroupId,
  activeWorkoutSessionDocumentId,
  collectionName,
  db,
} from "./firebase";
import { addDoc, collection, deleteDoc, getDocs, orderBy, query, doc, onSnapshot, setDoc, getDoc, runTransaction, where } from "firebase/firestore";
import type { Person, Exercise as WorkoutExercise } from "./workoutData";
import { shouldAcceptClientEventSequence, shouldCleanupWorkoutSessionEvents } from "./workoutSync";
import {
  calculateProgressedBaselineStates,
  type BaselineProgressionStrategy,
  type ProgressionReason,
  type UserBaselines,
  type UserWeights,
} from "./baselineProgression";
import {
  applyWeightToTeamBuild,
  createInitialTeamBuildState,
  defaultTeamBuildId,
  parseTeamBuildState,
} from "./teamBuildModel";

export type {
  BaselineProgressionStrategy,
  ProgressionReason,
  UserBaselines,
  UserWeights,
} from "./baselineProgression";

export const demoSessionId = "demo";
export type WorkoutEventType =
  | "startWorkout"
  | "updateSession"
  | "adjustSet"
  | "completeSet"
  | "skipSet"
  | "cancelWorkout"
  | "completeWorkout";

export type WorkoutEvent = {
  id: string;
  sequence: number;
  clientSequence?: number;
  type: WorkoutEventType;
  sessionId?: string;
  actorId?: string;
  clientId?: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

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
    groupId: activeWorkoutGroupId(),
    updatedAt: now,
  }) as Record<string, unknown>;

  if (!prepared.createdAt) {
    prepared.createdAt = now;
  }

  return setDoc(doc(db, collectionName("workoutSessions"), activeWorkoutSessionDocumentId()), prepared, { merge: true });
}

export function appendWorkoutEvent(
  type: WorkoutEventType,
  event: {
    sessionId?: string;
    actorId?: string;
    clientId?: string;
    clientSequence?: number;
    payload?: Record<string, unknown>;
    session?: unknown;
  }
) {
  const sessionRef = doc(db, collectionName("workoutSessions"), activeWorkoutSessionDocumentId());
  const now = new Date().toISOString();
  const groupId = activeWorkoutGroupId();

  return runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);
    const currentSequence = sessionSnapshot.exists()
      ? Number(sessionSnapshot.data().eventSequence ?? 0)
      : 0;
    const currentRevision = sessionSnapshot.exists()
      ? Number(sessionSnapshot.data().localRevision ?? 0)
      : 0;
    const currentClientSequences = sessionSnapshot.exists()
      ? (sessionSnapshot.data().lastClientSequences ?? {}) as Record<string, unknown>
      : {};
    const incomingRevision = event.session
      ? Number((event.session as { localRevision?: unknown }).localRevision ?? 0)
      : 0;
    if (event.session && incomingRevision < currentRevision) {
      return { sequence: currentSequence, eventId: "", skipped: true };
    }

    if (!shouldAcceptClientEventSequence({
      clientId: event.clientId,
      clientSequence: event.clientSequence,
      lastClientSequences: currentClientSequences,
    })) {
      return { sequence: currentSequence, eventId: "", skipped: true };
    }

    const sequence = currentSequence + 1;
    const eventId = String(sequence).padStart(8, "0");
    const eventPayload = removeUndefinedValues({
      ...(event.payload ?? {}),
      session: event.session,
    }) as Record<string, unknown>;
    const preparedSession = event.session
      ? removeUndefinedValues({
        ...(event.session as Record<string, unknown>),
        groupId,
        eventSequence: sequence,
        lastClientSequences: event.clientId && event.clientSequence
          ? {
            ...currentClientSequences,
            [event.clientId]: event.clientSequence,
          }
          : currentClientSequences,
        updatedAt: now,
      }) as Record<string, unknown>
      : null;

    transaction.set(doc(collection(sessionRef, "events"), eventId), removeUndefinedValues({
      sequence,
      type,
      sessionId: event.sessionId,
      groupId,
      actorId: event.actorId,
      clientId: event.clientId,
      clientSequence: event.clientSequence,
      createdAt: now,
      payload: eventPayload,
    }) as Record<string, unknown>);

    if (preparedSession) {
      if (!preparedSession.createdAt) {
        preparedSession.createdAt = now;
      }

      transaction.set(sessionRef, preparedSession, { merge: true });
    } else {
      transaction.set(sessionRef, removeUndefinedValues({
        groupId,
        eventSequence: sequence,
        lastClientSequences: event.clientId && event.clientSequence
          ? {
            ...currentClientSequences,
            [event.clientId]: event.clientSequence,
          }
          : currentClientSequences,
        updatedAt: now,
      }) as Record<string, unknown>, { merge: true });
    }

    return { sequence, eventId };
  });
}

export function listenToWorkoutEvents(onEvent: (event: WorkoutEvent) => void) {
  const eventsQuery = query(
    collection(db, collectionName("workoutSessions"), activeWorkoutSessionDocumentId(), "events"),
    orderBy("sequence", "asc")
  );

  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const data = change.doc.data() as Omit<WorkoutEvent, "id">;
        onEvent({
          id: change.doc.id,
          ...data,
        });
      });
    },
    (error) => {
      console.error("Failed to listen to workout events:", error);
    }
  );
}

export function listenToWorkoutSession(
  onSessionChange: (session: unknown) => void
) {
  return onSnapshot(
    doc(db, collectionName("workoutSessions"), activeWorkoutSessionDocumentId()),
    (snapshot) => {
      if (snapshot.exists()) {
        onSessionChange(snapshot.data());
      }
    },
    (error) => {
      console.error("Failed to listen to workout session:", error);
    }
  );
}

export async function loadCurrentWorkoutSession() {
  const snapshot = await getDoc(doc(db, collectionName("workoutSessions"), activeWorkoutSessionDocumentId()));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function cleanupEventsForNonActiveWorkoutSessions() {
  const sessionsSnapshot = await getDocs(collection(db, collectionName("workoutSessions")));
  const deletes: Promise<void>[] = [];

  for (const sessionSnapshot of sessionsSnapshot.docs) {
    if (!shouldCleanupWorkoutSessionEvents(sessionSnapshot.data())) continue;

    const eventsSnapshot = await getDocs(collection(sessionSnapshot.ref, "events"));

    for (const eventSnapshot of eventsSnapshot.docs) {
      deletes.push(deleteDoc(eventSnapshot.ref));
    }
  }

  await Promise.all(deletes);
  return deletes.length;
}

export function saveCompletedWorkoutSummary(summary: {
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: Record<string, Record<string, "exact" | "up" | "down" | "neutral">>;
  results: SetResult[];
}) {
  return addDoc(collection(db, collectionName("completedWorkouts")), {
    ...summary,
    groupId: activeWorkoutGroupId(),
  });
}

export async function loadWorkoutPlan(fallbackWorkout: WorkoutExercise[]): Promise<WorkoutExercise[]> {
  const planDoc = await getDoc(doc(db, collectionName("workoutPlans"), "default"));

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

        const exerciseDoc = await getDoc(doc(db, collectionName("exercises"), exerciseId));
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
  sessionId?: string;
  groupId?: string;
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
  exerciseOutcomes?: ExerciseOutcomes;
  results: SetResult[];
};

export async function loadCompletedWorkoutSummaries() {
  const q = query(
    collection(db, collectionName("completedWorkouts")),
    where("groupId", "==", activeWorkoutGroupId())
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as CompletedWorkoutSummary),
  })).sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
}

export type UserProgressionStrategy = "pyramid" | "straight";
export type UserProfileSettings = {
  progressionStrategies: Record<string, UserProgressionStrategy>;
  baselineProgressionStrategies: Record<string, BaselineProgressionStrategy>;
};
type StoredBaselineValue = number | { weight?: unknown; successStreak?: unknown; weightStep?: unknown };

function isUserProgressionStrategy(value: unknown): value is UserProgressionStrategy {
  return value === "pyramid" || value === "straight";
}

function isBaselineProgressionStrategy(value: unknown): value is BaselineProgressionStrategy {
  return value === "straight" || value === "slow" || value === "medium" || value === "fast";
}

export async function loadUserProfiles(defaults: Record<string, UserWeights>): Promise<Record<string, UserWeights>> {
  return loadCurrentBaselines(defaults);
}

function defaultProgressionStrategy(person: string): UserProgressionStrategy {
  return person === "Victoria" ? "straight" : "pyramid";
}

function defaultBaselineProgressionStrategy(person: string): BaselineProgressionStrategy {
  return person === "Victoria" ? "straight" : "medium";
}

function parseStoredBaselines(baselines: Record<string, StoredBaselineValue> | undefined): UserBaselines {
  const parsedBaselines: UserBaselines = {};

  if (!baselines) {
    return parsedBaselines;
  }

  for (const [exerciseId, baseline] of Object.entries(baselines)) {
    if (typeof baseline === "number") {
      parsedBaselines[exerciseId] = { weight: baseline, successStreak: 0 };
    } else if (baseline && typeof baseline.weight === "number") {
      parsedBaselines[exerciseId] = {
        weight: baseline.weight,
        successStreak: typeof baseline.successStreak === "number" ? baseline.successStreak : 0,
        ...(typeof baseline.weightStep === "number" && baseline.weightStep > 0 ? { weightStep: baseline.weightStep } : {}),
      };
    }
  }

  return parsedBaselines;
}

export async function loadCurrentBaselines(defaults: Record<string, UserWeights>): Promise<Record<string, UserWeights>> {
  const baselineStates = await loadCurrentBaselineStates(defaults);
  const weights: Record<string, UserWeights> = {};

  for (const [person, baselines] of Object.entries(baselineStates)) {
    weights[person] = Object.fromEntries(
      Object.entries(baselines).map(([exerciseId, baseline]) => [exerciseId, baseline.weight])
    );
  }

  return weights;
}

export async function loadCurrentBaselineStates(defaults: Record<string, UserWeights>): Promise<Record<string, UserBaselines>> {
  const baselineStates: Record<string, UserBaselines> = {};

  for (const person of Object.keys(defaults)) {
    const baselineDoc = await getDoc(doc(db, collectionName("currentBaselines"), activeCurrentBaselineDocumentId(person)));

    if (baselineDoc.exists()) {
      const baselineData = baselineDoc.data() as {
        baselines?: Record<string, StoredBaselineValue>;
      };

      baselineStates[person] = parseStoredBaselines(baselineData.baselines);
    } else {
      baselineStates[person] = {};
    }
  }

  return baselineStates;
}

export async function loadUserProfileSettings(defaults: {
  progressionStrategies: Record<string, UserProgressionStrategy>;
  baselineProgressionStrategies: Record<string, BaselineProgressionStrategy>;
}): Promise<UserProfileSettings> {
  const progressionStrategies: Record<string, UserProgressionStrategy> = {};
  const baselineProgressionStrategies: Record<string, BaselineProgressionStrategy> = {};

  for (const person of Object.keys(defaults.progressionStrategies)) {
    const profileDoc = await getDoc(doc(db, collectionName("userProfiles"), person));

    if (profileDoc.exists()) {
      const profile = profileDoc.data() as {
        progressionStrategy?: unknown;
        baselineProgressionStrategy?: unknown;
      };

      progressionStrategies[person] = isUserProgressionStrategy(profile.progressionStrategy)
        ? profile.progressionStrategy
        : defaults.progressionStrategies[person] ?? defaultProgressionStrategy(person);
      baselineProgressionStrategies[person] = isBaselineProgressionStrategy(profile.baselineProgressionStrategy)
        ? profile.baselineProgressionStrategy
        : defaults.baselineProgressionStrategies[person] ?? defaultBaselineProgressionStrategy(person);
    } else {
      progressionStrategies[person] = defaults.progressionStrategies[person] ?? defaultProgressionStrategy(person);
      baselineProgressionStrategies[person] = defaults.baselineProgressionStrategies[person] ?? defaultBaselineProgressionStrategy(person);
    }
  }

  return { progressionStrategies, baselineProgressionStrategies };
}

function prepareStoredBaselines(baselines: UserBaselines) {
  return Object.fromEntries(
    Object.entries(baselines).map(([exerciseId, baseline]) => [
      exerciseId,
      {
        weight: baseline.weight,
        successStreak: baseline.successStreak,
        ...(typeof baseline.weightStep === "number" && baseline.weightStep > 0 ? { weightStep: baseline.weightStep } : {}),
      },
    ])
  );
}

export function saveCurrentBaselineStates(person: string, baselines: UserBaselines) {
  return setDoc(doc(db, collectionName("currentBaselines"), activeCurrentBaselineDocumentId(person)), {
    groupId: activeWorkoutGroupId(),
    userId: person,
    memberId: person,
    baselines: prepareStoredBaselines(baselines),
  });
}

export async function finalizeCompletedWorkout({
  sessionId,
  summary,
  baselineStates,
  session,
  teamBuildContribution,
}: {
  sessionId: string;
  summary: CompletedWorkoutSummary;
  baselineStates: Record<string, UserBaselines>;
  session: unknown;
  teamBuildContribution?: {
    contributedByUserIds: string[];
    weight: number;
  };
}) {
  const groupId = activeWorkoutGroupId();
  const completedRef = doc(db, collectionName("completedWorkouts"), sessionId);
  const sessionRef = doc(db, collectionName("workoutSessions"), activeWorkoutSessionDocumentId());
  const teamBuildRef = doc(db, collectionName("teamBuilds"), defaultTeamBuildId);
  const teamBuildContributionRef = doc(db, collectionName("teamBuilds"), defaultTeamBuildId, "contributions", sessionId);
  const now = new Date().toISOString();
  const preparedSession = removeUndefinedValues({
    ...(session as Record<string, unknown>),
    sessionId,
    groupId,
    status: "completed",
    complete: true,
    updatedAt: now,
  }) as Record<string, unknown>;

  return runTransaction(db, async (transaction) => {
    const completedSnapshot = await transaction.get(completedRef);
    const sessionSnapshot = await transaction.get(sessionRef);
    const teamBuildSnapshot = teamBuildContribution
      ? await transaction.get(teamBuildRef)
      : null;
    const teamBuildContributionSnapshot = teamBuildContribution
      ? await transaction.get(teamBuildContributionRef)
      : null;
    const sequence = (sessionSnapshot.exists() ? Number(sessionSnapshot.data().eventSequence ?? 0) : 0) + 1;

    if (completedSnapshot.exists()) {
      transaction.set(sessionRef, { ...preparedSession, eventSequence: sequence }, { merge: true });
      return { created: false };
    }

    transaction.set(completedRef, {
      ...summary,
      sessionId,
      groupId,
      finalizedAt: now,
    });

    for (const [person, baselines] of Object.entries(baselineStates)) {
      transaction.set(doc(db, collectionName("currentBaselines"), activeCurrentBaselineDocumentId(person)), {
        groupId,
        userId: person,
        memberId: person,
        baselines: prepareStoredBaselines(baselines),
        updatedAt: now,
      });
    }

    if (teamBuildContribution && !teamBuildContributionSnapshot?.exists()) {
      const currentTeamBuild = teamBuildSnapshot?.exists()
        ? parseTeamBuildState(teamBuildSnapshot.data())
        : null;
      const initialTeamBuild = currentTeamBuild ?? createInitialTeamBuildState({ groupId, now });
      const updatedTeamBuild = applyWeightToTeamBuild({
        state: initialTeamBuild,
        weight: teamBuildContribution.weight,
        now,
      });

      transaction.set(teamBuildRef, updatedTeamBuild);
      transaction.set(teamBuildContributionRef, {
        id: sessionId,
        workoutSessionId: sessionId,
        completedWorkoutId: sessionId,
        contributedByUserIds: teamBuildContribution.contributedByUserIds,
        weight: Math.max(0, Math.floor(teamBuildContribution.weight)),
        appliedToMajorId: initialTeamBuild.currentMajorId,
        appliedToPhaseId: initialTeamBuild.currentPhaseId,
        appliedToSubphaseId: initialTeamBuild.currentSubphaseId,
        createdAt: now,
      });
    }

    transaction.set(sessionRef, { ...preparedSession, eventSequence: sequence }, { merge: true });
    transaction.set(doc(collection(sessionRef, "events"), String(sequence).padStart(8, "0")), removeUndefinedValues({
      type: "completeWorkout",
      sequence,
      sessionId,
      groupId,
      createdAt: now,
      payload: {
        session: preparedSession,
      },
    }) as Record<string, unknown>);

    return { created: true };
  });
}

export function saveCurrentBaselines(person: string, weights: UserWeights) {
  return saveCurrentBaselineStates(
    person,
    Object.fromEntries(
      Object.entries(weights).map(([exerciseId, weight]) => [
        exerciseId,
        { weight, successStreak: 0 },
      ])
    )
  );
}

export function saveUserProfile(person: string, weights: UserWeights) {
  return saveCurrentBaselines(person, weights);
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

export function calculateProgressedUserProfilesFromHistory(
  currentProfiles: Record<string, UserWeights>,
  currentBaselineStates: Record<string, UserBaselines>,
  workoutPlan: Exercise[],
  completedWorkoutHistory: CompletedWorkoutSummary[],
  baselineProgressionStrategies: Record<string, BaselineProgressionStrategy>,
  userStrategies: Record<string, "pyramid" | "straight">
): {
  updatedProfiles: Record<string, UserWeights>;
  updatedBaselineStates: Record<string, UserBaselines>;
  reasons: ProgressionReason[];
} {
  return calculateProgressedBaselineStates({
    currentProfiles,
    currentBaselineStates,
    workoutPlan,
    completedWorkout: completedWorkoutHistory.at(-1),
    baselineProgressionStrategies,
    userStrategies,
  });
}
