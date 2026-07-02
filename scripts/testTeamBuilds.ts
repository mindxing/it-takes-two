import assert from "node:assert/strict";
import {
  applyWeightToTeamBuild,
  createInitialTeamBuildState,
  currentSubphaseProgressPercent,
  defaultTeamBuildTemplate,
  teamBuildProgressPercent,
  totalTemplateRequiredWeight,
} from "../src/teamBuildModel.ts";

const startedAt = "2026-06-30T12:00:00.000Z";
const updatedAt = "2026-06-30T12:10:00.000Z";

const initial = createInitialTeamBuildState({
  groupId: "mike-victoria",
  now: startedAt,
});

assert.equal(initial.themeId, "sunstone_pyramid");
assert.equal(initial.currentMajorId, "pyramid");
assert.equal(initial.currentPhaseId, "foundation");
assert.equal(initial.currentSubphaseId, "survey_site");
assert.equal(initial.currentSubphaseRequiredWeight, 20000);
assert.equal(initial.totalRequiredWeight, totalTemplateRequiredWeight(defaultTeamBuildTemplate));
assert.equal(teamBuildProgressPercent(initial), 0);

const partial = applyWeightToTeamBuild({
  state: initial,
  weight: 10000,
  now: updatedAt,
});

assert.equal(partial.currentSubphaseId, "survey_site");
assert.equal(partial.currentSubphaseContributedWeight, 10000);
assert.equal(currentSubphaseProgressPercent(partial), 50);
assert.deepEqual(partial.completedSubphaseIds, []);

const advanced = applyWeightToTeamBuild({
  state: partial,
  weight: 25000,
  now: updatedAt,
});

assert.equal(advanced.currentSubphaseId, "lay_foundation");
assert.equal(advanced.currentSubphaseContributedWeight, 15000);
assert.deepEqual(advanced.completedSubphaseIds, ["survey_site"]);
assert.deepEqual(advanced.completedPhaseIds, []);

const completed = applyWeightToTeamBuild({
  state: initial,
  weight: 1_000_000,
  now: updatedAt,
});

assert.equal(completed.status, "completed");
assert.equal(completed.completedAt, updatedAt);
assert.equal(completed.totalContributedWeight, completed.totalRequiredWeight);
assert.equal(completed.currentSubphaseId, "sunrise_finish");
assert.ok(completed.completedMajorIds.includes("pyramid"));
assert.equal(teamBuildProgressPercent(completed), 100);

console.log("Team build tests passed.");
