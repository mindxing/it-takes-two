import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const output = execFileSync(
  process.execPath,
  ["scripts/seedWorkoutPlan.mjs", "--dry-run"],
  { encoding: "utf8" }
);

assert.match(output, /Dry run: would write workoutGroups\/mike-victoria/);
assert.match(output, /"memberIds": \[/);
assert.match(output, /"Mike"/);
assert.match(output, /"Victoria"/);
assert.match(output, /Dry run: would write workoutGroups\/mike-victoria\/workoutPlans\/default/);
assert.match(output, /Dry run: would write workoutGroups\/mike-victoria\/exercises\/\*/);
assert.match(output, /Dry run: would write workoutGroups\/mike-victoria\/userProfiles\/\*/);
assert.match(output, /Dry run: would write currentBaselines\/\* for group mike-victoria/);

const resetOutput = execFileSync(
  process.execPath,
  ["scripts/seedWorkoutPlan.mjs", "--dry-run", "--reset-runtime", "--collection-prefix=tmp_", "--group-id=test-group"],
  { encoding: "utf8" }
);

assert.match(resetOutput, /Dry run: would delete tmp_workoutSessions\/\* for group test-group and nested events/);
assert.match(resetOutput, /Dry run: would delete tmp_completedWorkouts\/\* for group test-group/);
assert.match(resetOutput, /Dry run: would write tmp_workoutGroups\/test-group/);
assert.match(resetOutput, /Dry run: would write tmp_workoutGroups\/test-group\/workoutPlans\/default/);

console.log("Seed workout plan tests passed.");
