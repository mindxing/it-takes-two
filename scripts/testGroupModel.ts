import assert from "node:assert/strict";
import {
  defaultActiveSessionId,
  defaultWorkoutGroup,
  defaultWorkoutGroupId,
  defaultWorkoutPlanId,
  activeSessionDocumentId,
  currentBaselineDocumentId,
  groupCollectionPath,
  groupDocumentPath,
  groupRootCollection,
  groupScopedDocumentPath,
  groupSessionEventsPath,
  legacyCollectionPath,
  prefixedCollectionName,
} from "../src/groupModel.ts";

assert.equal(defaultWorkoutGroupId, "mike-victoria");
assert.equal(defaultWorkoutPlanId, "default");
assert.equal(defaultActiveSessionId, "demo");

assert.deepEqual(defaultWorkoutGroup.memberIds, ["Mike", "Victoria"]);
assert.equal(defaultWorkoutGroup.members.Mike.displayName, "Mike");
assert.equal(defaultWorkoutGroup.members.Victoria.displayName, "Victoria");
assert.equal(defaultWorkoutGroup.defaultWorkoutPlanId, "default");
assert.equal(defaultWorkoutGroup.activeSessionId, "demo");

assert.equal(prefixedCollectionName("workoutSessions"), "workoutSessions");
assert.equal(prefixedCollectionName("workoutSessions", "tmp_"), "tmp_workoutSessions");
assert.equal(groupRootCollection(), "workoutGroups");
assert.equal(groupRootCollection("tmp_"), "tmp_workoutGroups");

assert.equal(groupDocumentPath("group-a"), "workoutGroups/group-a");
assert.equal(groupDocumentPath("group-a", "tmp_"), "tmp_workoutGroups/group-a");
assert.equal(
  groupCollectionPath("group-a", "workoutPlans"),
  "workoutGroups/group-a/workoutPlans"
);
assert.equal(
  groupScopedDocumentPath("group-a", "workoutPlans", "default"),
  "workoutGroups/group-a/workoutPlans/default"
);
assert.equal(
  groupSessionEventsPath("group-a"),
  "workoutSessions/group-a_demo/events"
);
assert.equal(
  groupSessionEventsPath("group-a", "session-2", "tmp_"),
  "tmp_workoutSessions/group-a_session-2/events"
);
assert.equal(activeSessionDocumentId("group-a"), "group-a_demo");
assert.equal(currentBaselineDocumentId("group-a", "Mike"), "group-a_Mike");

assert.equal(legacyCollectionPath("workoutSessions"), "workoutSessions");
assert.equal(legacyCollectionPath("workoutSessions", "tmp_"), "tmp_workoutSessions");

console.log("Group model tests passed.");
