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
  active: true,
};

export type GroupScopedCollection =
  | "workoutPlans"
  | "exercises"
  | "userProfiles"
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
  return `${groupScopedDocumentPath(groupId, "workoutSessions", sessionId, collectionPrefix)}/events`;
}

export function legacyCollectionPath(collectionName: GroupScopedCollection, collectionPrefix = "") {
  return prefixedCollectionName(collectionName, collectionPrefix);
}
