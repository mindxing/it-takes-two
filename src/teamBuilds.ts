import { doc, getDoc, runTransaction } from "firebase/firestore";
import { activeWorkoutGroupId, collectionName, db } from "./firebase";
import {
  applyWeightToTeamBuild,
  createInitialTeamBuildState,
  defaultTeamBuildId,
  parseTeamBuildState,
  type TeamBuildState,
} from "./teamBuildModel";

export type { TeamBuildState } from "./teamBuildModel";

export type TeamBuildContribution = {
  id: string;
  workoutSessionId: string;
  completedWorkoutId: string;
  contributedByUserIds: string[];
  weight: number;
  appliedToMajorId?: string;
  appliedToPhaseId?: string;
  appliedToSubphaseId?: string;
  createdAt: string;
};

export async function loadActiveTeamBuild() {
  const groupId = activeWorkoutGroupId();
  const buildRef = doc(db, collectionName("teamBuilds"), defaultTeamBuildId);
  const snapshot = await getDoc(buildRef);
  const now = new Date().toISOString();

  if (snapshot.exists()) {
    return parseTeamBuildState(snapshot.data()) ?? createInitialTeamBuildState({ groupId, now });
  }

  return createInitialTeamBuildState({ groupId, now });
}

export async function applyWorkoutToActiveTeamBuild({
  completedWorkoutId,
  workoutSessionId,
  contributedByUserIds,
  weight,
}: {
  completedWorkoutId: string;
  workoutSessionId: string;
  contributedByUserIds: string[];
  weight: number;
}) {
  const groupId = activeWorkoutGroupId();
  const buildRef = doc(db, collectionName("teamBuilds"), defaultTeamBuildId);
  const contributionRef = doc(db, collectionName("teamBuilds"), defaultTeamBuildId, "contributions", completedWorkoutId);
  const now = new Date().toISOString();

  return runTransaction(db, async (transaction) => {
    const buildSnapshot = await transaction.get(buildRef);
    const contributionSnapshot = await transaction.get(contributionRef);

    if (contributionSnapshot.exists()) {
      return { created: false };
    }

    const existingState = buildSnapshot.exists()
      ? parseTeamBuildState(buildSnapshot.data())
      : null;
    const initialState = existingState ?? createInitialTeamBuildState({ groupId, now });
    const appliedState: TeamBuildState = applyWeightToTeamBuild({
      state: initialState,
      weight,
      now,
    });

    transaction.set(buildRef, appliedState);
    transaction.set(contributionRef, {
      id: completedWorkoutId,
      workoutSessionId,
      completedWorkoutId,
      contributedByUserIds,
      weight: Math.max(0, Math.floor(weight)),
      appliedToMajorId: initialState.currentMajorId,
      appliedToPhaseId: initialState.currentPhaseId,
      appliedToSubphaseId: initialState.currentSubphaseId,
      createdAt: now,
    } satisfies TeamBuildContribution);

    return { created: true, state: appliedState };
  });
}
