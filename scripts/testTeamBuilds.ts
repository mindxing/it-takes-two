import assert from "node:assert/strict";
import {
  applyWeightToTeamBuild,
  createInitialTeamBuildState,
  currentSubphaseProgressPercent,
  teamBuildProgressPercent,
  themeParkTemplate,
  totalTemplateRequiredWeight,
} from "../src/teamBuildModel.ts";

const startedAt = "2026-06-30T12:00:00.000Z";
const updatedAt = "2026-06-30T12:10:00.000Z";

const initial = createInitialTeamBuildState({
  groupId: "mike-victoria",
  now: startedAt,
});

assert.equal(initial.themeId, "theme_park");
assert.equal(initial.currentMajorId, "main_entrance");
assert.equal(initial.currentPhaseId, "foundation");
assert.equal(initial.currentSubphaseId, "front_path");
assert.equal(initial.currentSubphaseRequiredWeight, 8000);
assert.equal(initial.totalRequiredWeight, totalTemplateRequiredWeight(themeParkTemplate));
assert.equal(teamBuildProgressPercent(initial), 0);

const partial = applyWeightToTeamBuild({
  state: initial,
  weight: 4000,
  now: updatedAt,
});

assert.equal(partial.currentSubphaseId, "front_path");
assert.equal(partial.currentSubphaseContributedWeight, 4000);
assert.equal(currentSubphaseProgressPercent(partial), 50);
assert.deepEqual(partial.completedSubphaseIds, []);

const advanced = applyWeightToTeamBuild({
  state: partial,
  weight: 7000,
  now: updatedAt,
});

assert.equal(advanced.currentSubphaseId, "ticket_booth");
assert.equal(advanced.currentSubphaseContributedWeight, 3000);
assert.deepEqual(advanced.completedSubphaseIds, ["front_path"]);
assert.deepEqual(advanced.completedPhaseIds, []);

const completed = applyWeightToTeamBuild({
  state: initial,
  weight: 1_000_000,
  now: updatedAt,
});

assert.equal(completed.status, "completed");
assert.equal(completed.completedAt, updatedAt);
assert.equal(completed.totalContributedWeight, completed.totalRequiredWeight);
assert.equal(completed.currentSubphaseId, "wheel_complete");
assert.ok(completed.completedMajorIds.includes("main_entrance"));
assert.ok(completed.completedMajorIds.includes("midway"));
assert.ok(completed.completedMajorIds.includes("ferris_wheel"));
assert.equal(teamBuildProgressPercent(completed), 100);

console.log("Team build tests passed.");
