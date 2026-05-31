import assert from "node:assert/strict";
import { defaultWorkoutGroup, type WorkoutGroup } from "../src/groupModel.ts";
import { activeGroupsForUser, chooseWorkoutGroup, defaultGroupSelection, isAssumedUserId } from "../src/groupSelection.ts";

function group(id: string, overrides: Partial<WorkoutGroup> = {}): WorkoutGroup {
  return {
    ...defaultWorkoutGroup,
    id,
    name: id,
    ...overrides,
  };
}

{
  const selection = chooseWorkoutGroup([group("one")], "Mike");

  assert.equal(selection.status, "selected");
  assert.equal(selection.groups.length, 1);
  if (selection.status === "selected") {
    assert.equal(selection.group.id, "one");
  }
}

{
  const selection = chooseWorkoutGroup([group("one"), group("two")], "Mike");

  assert.equal(selection.status, "needs-selection");
  assert.deepEqual(selection.groups.map((item) => item.id), ["one", "two"]);
}

{
  const inactive = group("inactive", { active: false });
  const selection = chooseWorkoutGroup([inactive], "Mike");

  assert.equal(selection.status, "empty");
  assert.deepEqual(activeGroupsForUser([inactive], "Mike"), []);
}

{
  const victoriaOnly = group("victoria-only", {
    memberIds: ["Victoria"],
    members: {
      Victoria: defaultWorkoutGroup.members.Victoria,
    },
  });

  assert.equal(chooseWorkoutGroup([victoriaOnly], "Mike").status, "empty");
  assert.equal(chooseWorkoutGroup([victoriaOnly], "Victoria").status, "selected");
}

assert.equal(defaultGroupSelection("Mike").status, "selected");
assert.equal(isAssumedUserId("Mike"), true);
assert.equal(isAssumedUserId("Victoria"), true);
assert.equal(isAssumedUserId("Alex"), false);

console.log("Group selection tests passed.");
