import assert from "node:assert/strict";
import { calculateProgressedBaselineStates } from "../src/baselineProgression.ts";

const workoutPlan = [{
  id: "leg_press",
  name: "Leg Press",
  setPlan: [
    { reps: 15, weightOffset: -10 },
    { reps: 12, weightOffset: 0 },
    { reps: 10, weightOffset: 10 },
  ],
}];

function completedWorkout(reps: number[], weights: number[]) {
  return {
    results: reps.map((repsForSet, index) => ({
      exerciseId: "leg_press",
      exerciseName: "Leg Press",
      person: "Mike",
      setNumber: index + 1,
      reps: repsForSet,
      weight: weights[index],
      status: "completed" as const,
    })),
  };
}

function calculate({
  weight = 100,
  successStreak = 0,
  workout = completedWorkout([15, 12, 10], [90, 100, 110]),
  strategy = "medium" as const,
} = {}) {
  return calculateProgressedBaselineStates({
    currentProfiles: { Mike: { leg_press: weight } },
    currentBaselineStates: { Mike: { leg_press: { weight, successStreak } } },
    workoutPlan,
    completedWorkout: workout,
    baselineProgressionStrategies: { Mike: strategy },
    userStrategies: { Mike: "pyramid" },
  });
}

{
  const result = calculate();

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 100);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.successStreak, 1);
}

{
  const result = calculate({ successStreak: 2 });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 105);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.successStreak, 0);
}

{
  const result = calculate({
    workout: completedWorkout([15, 12, 10], [100, 110, 120]),
  });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 105);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.successStreak, 0);
}

{
  const result = calculate({
    workout: completedWorkout([10, 8, 6], [90, 100, 110]),
    successStreak: 2,
  });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 95);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.successStreak, 0);
}

{
  const result = calculate({
    workout: completedWorkout([15, 12, 10], [130, 140, 150]),
    strategy: "straight",
  });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 100);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.successStreak, 0);
}

console.log("Baseline progression tests passed.");
