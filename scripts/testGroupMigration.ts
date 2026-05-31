import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const output = execFileSync(
  process.execPath,
  ["scripts/migrateDefaultGroup.mjs", "--dry-run"],
  { encoding: "utf8" }
);

assert.match(output, /Dry run: would write workoutGroups\/mike-victoria/);
assert.match(output, /"memberIds": \[/);
assert.match(output, /"Mike"/);
assert.match(output, /"Victoria"/);
assert.match(output, /workoutPlans\/\* -> workoutGroups\/mike-victoria\/workoutPlans\/\*/);
assert.match(output, /currentBaselines\/\* -> currentBaselines\/\* with groupId mike-victoria/);
assert.match(output, /workoutSessions\/\*\/events\/\* -> workoutSessions\/\*\/events\/\* with groupId mike-victoria/);

const tmpOutput = execFileSync(
  process.execPath,
  ["scripts/migrateDefaultGroup.mjs", "--dry-run", "--collection-prefix=tmp_", "--group-id=test-group"],
  { encoding: "utf8" }
);

assert.match(tmpOutput, /Dry run: would write tmp_workoutGroups\/test-group/);
assert.match(tmpOutput, /tmp_workoutPlans\/\* -> tmp_workoutGroups\/test-group\/workoutPlans\/\*/);
assert.match(tmpOutput, /tmp_workoutSessions\/\* -> tmp_workoutSessions\/\* with groupId test-group/);

console.log("Group migration tests passed.");
