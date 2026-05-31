import { defaultWorkoutGroup, type WorkoutGroup } from "./groupModel.ts";

export type AssumedUserId = "Mike" | "Victoria";

export type GroupSelection =
  | { status: "selected"; group: WorkoutGroup; groups: WorkoutGroup[] }
  | { status: "needs-selection"; groups: WorkoutGroup[] }
  | { status: "empty"; groups: WorkoutGroup[] };

export const defaultAssumedUserId: AssumedUserId = "Mike";

export function isAssumedUserId(value: string | undefined): value is AssumedUserId {
  return value === "Mike" || value === "Victoria";
}

export function activeGroupsForUser(groups: WorkoutGroup[], userId: string) {
  return groups.filter((group) => {
    const member = group.members[userId];
    return group.active !== false && group.memberIds.includes(userId) && member?.active !== false;
  });
}

export function chooseWorkoutGroup(groups: WorkoutGroup[], userId: string): GroupSelection {
  const eligibleGroups = activeGroupsForUser(groups, userId);

  if (eligibleGroups.length === 1) {
    return { status: "selected", group: eligibleGroups[0], groups: eligibleGroups };
  }

  if (eligibleGroups.length > 1) {
    return { status: "needs-selection", groups: eligibleGroups };
  }

  return { status: "empty", groups: eligibleGroups };
}

export function defaultGroupSelection(userId: string): GroupSelection {
  return chooseWorkoutGroup([defaultWorkoutGroup], userId);
}
