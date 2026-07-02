export type WorkoutGroupMember = {
  id: string;
  displayName: string;
  role: "member";
  active: boolean;
};

export type WorkoutGroup = {
  id: string;
  name: string;
  memberIds: string[];
  members: Record<string, WorkoutGroupMember>;
  defaultWorkoutPlanId: string;
  activeSessionId: string;
  activeTeamBuildId?: string;
  active: boolean;
};

export const defaultWorkoutGroupId = "mike-victoria";
export const defaultWorkoutPlanId = "default";
export const defaultActiveSessionId = "demo";

export const defaultWorkoutGroup: WorkoutGroup = {
  id: defaultWorkoutGroupId,
  name: "Mike & Victoria",
  memberIds: ["Mike", "Victoria"],
  members: {
    Mike: {
      id: "Mike",
      displayName: "Mike",
      role: "member",
      active: true,
    },
    Victoria: {
      id: "Victoria",
      displayName: "Victoria",
      role: "member",
      active: true,
    },
  },
  defaultWorkoutPlanId,
  activeSessionId: defaultActiveSessionId,
  activeTeamBuildId: "theme_park_001",
  active: true,
};

export type GroupScopedCollection =
  | "workoutPlans"
  | "exercises"
  | "userProfiles"
  | "teamBuilds";

export type TopLevelStateCollection =
  | "currentBaselines"
  | "workoutSessions"
  | "completedWorkouts";

export function prefixedCollectionName(collectionName: string, collectionPrefix = "") {
  return `${collectionPrefix}${collectionName}`;
}

export function groupRootCollection(collectionPrefix = "") {
  return prefixedCollectionName("workoutGroups", collectionPrefix);
}

export function groupDocumentPath(groupId: string, collectionPrefix = "") {
  return `${groupRootCollection(collectionPrefix)}/${groupId}`;
}

export function groupCollectionPath(
  groupId: string,
  collectionName: GroupScopedCollection,
  collectionPrefix = ""
) {
  return `${groupDocumentPath(groupId, collectionPrefix)}/${collectionName}`;
}

export function groupScopedDocumentPath(
  groupId: string,
  collectionName: GroupScopedCollection,
  documentId: string,
  collectionPrefix = ""
) {
  return `${groupCollectionPath(groupId, collectionName, collectionPrefix)}/${documentId}`;
}

export function groupSessionEventsPath(
  groupId: string,
  sessionId = defaultActiveSessionId,
  collectionPrefix = ""
) {
  return `${topLevelDocumentPath("workoutSessions", activeSessionDocumentId(groupId, sessionId), collectionPrefix)}/events`;
}

export function topLevelCollectionPath(collectionName: TopLevelStateCollection, collectionPrefix = "") {
  return prefixedCollectionName(collectionName, collectionPrefix);
}

export function topLevelDocumentPath(
  collectionName: TopLevelStateCollection,
  documentId: string,
  collectionPrefix = ""
) {
  return `${topLevelCollectionPath(collectionName, collectionPrefix)}/${documentId}`;
}

export function activeSessionDocumentId(groupId: string, sessionId = defaultActiveSessionId) {
  return `${groupId}_${sessionId}`;
}

export function currentBaselineDocumentId(groupId: string, memberId: string) {
  return `${groupId}_${memberId}`;
}

export function legacyCollectionPath(
  collectionName: GroupScopedCollection | TopLevelStateCollection,
  collectionPrefix = ""
) {
  return prefixedCollectionName(collectionName, collectionPrefix);
}
