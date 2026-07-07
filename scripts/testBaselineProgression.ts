import assert from "node:assert/strict";
import { calculateProgressedBaselineStates, type BaselineProgressionStrategy, type BaselineWorkoutSummary, type UserBaselines, type UserWeights } from "../src/baselineProgression.ts";

const workoutPlan = [{
  id: "leg_press",
  name: "Leg Press",
  setPlan: [
    { reps: 15, weightOffset: -10 },
    { reps: 12, weightOffset: 0 },
    { reps: 10, weightOffset: 10 },
  ],
}];

const compoundWorkoutPlan = [{
  id: "thigh_machine",
  name: "Thigh Machine",
  setPlan: [
    { reps: 12, weightOffset: -5 },
    { reps: 10, weightOffset: 0 },
  ],
  movements: [
    { id: "inner", name: "Inner" },
    { id: "outer", name: "Outer" },
  ],
}];

function completedWorkout(reps: number[], weights: number[]): BaselineWorkoutSummary {
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

function exactWorkout(weight: number): BaselineWorkoutSummary {
  return completedWorkout([15, 12, 10], [weight - 10, weight, weight + 10]);
}

function simulateWorkouts({
  strategy,
  workouts,
  weight = 100,
  successStreak = 0,
}: {
  strategy: BaselineProgressionStrategy;
  workouts: BaselineWorkoutSummary[];
  weight?: number;
  successStreak?: number;
}) {
  let currentProfiles: Record<string, UserWeights> = { Mike: { leg_press: weight } };
  let currentBaselineStates: Record<string, UserBaselines> = {
    Mike: { leg_press: { weight, successStreak } },
  };
  const reasons = [];

  for (const workout of workouts) {
    const result = calculateProgressedBaselineStates({
      currentProfiles,
      currentBaselineStates,
      workoutPlan,
      completedWorkout: workout,
      baselineProgressionStrategies: { Mike: strategy },
      userStrategies: { Mike: "pyramid" },
    });

    currentProfiles = result.updatedProfiles;
    currentBaselineStates = result.updatedBaselineStates;
    reasons.push(...result.reasons);
  }

  return {
    profiles: currentProfiles,
    baselines: currentBaselineStates,
    reasons,
  };
}

function calculate({
  weight = 100,
  successStreak = 0,
  workout = exactWorkout(weight),
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

{
  const result = simulateWorkouts({
    strategy: "fast",
    workouts: [
      exactWorkout(100),
      exactWorkout(100),
    ],
  });

  assert.equal(result.baselines.Mike.leg_press.weight, 105);
  assert.equal(result.baselines.Mike.leg_press.successStreak, 0);
  assert.equal(result.reasons[0].reason, "fast baseline progression after 2 successful workouts");
}

{
  const result = simulateWorkouts({
    strategy: "medium",
    workouts: [
      exactWorkout(100),
      exactWorkout(100),
      exactWorkout(100),
    ],
  });

  assert.equal(result.baselines.Mike.leg_press.weight, 105);
  assert.equal(result.baselines.Mike.leg_press.successStreak, 0);
  assert.equal(result.reasons[0].reason, "medium baseline progression after 3 successful workouts");
}

{
  const result = simulateWorkouts({
    strategy: "slow",
    workouts: [
      exactWorkout(100),
      exactWorkout(100),
      exactWorkout(100),
      exactWorkout(100),
    ],
  });

  assert.equal(result.baselines.Mike.leg_press.weight, 105);
  assert.equal(result.baselines.Mike.leg_press.successStreak, 0);
  assert.equal(result.reasons[0].reason, "slow baseline progression after 4 successful workouts");
}

{
  const result = simulateWorkouts({
    strategy: "medium",
    workouts: [
      exactWorkout(100),
      completedWorkout([15, 12, 10], [100, 110, 120]),
      exactWorkout(105),
      exactWorkout(105),
      exactWorkout(105),
    ],
  });

  assert.equal(result.baselines.Mike.leg_press.weight, 115);
  assert.equal(result.baselines.Mike.leg_press.successStreak, 0);
  assert.deepEqual(result.reasons.map((reason) => [reason.oldWeight, reason.newWeight]), [
    [100, 105],
    [105, 115],
  ]);
}

{
  const result = simulateWorkouts({
    strategy: "medium",
    successStreak: 2,
    workouts: [
      completedWorkout([10, 8, 6], [90, 100, 110]),
      exactWorkout(95),
    ],
  });

  assert.equal(result.baselines.Mike.leg_press.weight, 95);
  assert.equal(result.baselines.Mike.leg_press.successStreak, 1);
  assert.deepEqual(result.reasons.map((reason) => [reason.oldWeight, reason.newWeight]), [
    [100, 95],
  ]);
}

{
  const result = simulateWorkouts({
    strategy: "straight",
    successStreak: 2,
    workouts: [
      completedWorkout([15, 12, 10], [130, 140, 150]),
      completedWorkout([5, 5, 5], [50, 50, 50]),
      exactWorkout(100),
    ],
  });

  assert.equal(result.baselines.Mike.leg_press.weight, 100);
  assert.equal(result.baselines.Mike.leg_press.successStreak, 2);
  assert.equal(result.reasons.length, 0);
}

{
  const result = calculateProgressedBaselineStates({
    currentProfiles: { Mike: { inner: 50, outer: 70 } },
    currentBaselineStates: {
      Mike: {
        inner: { weight: 50, successStreak: 1 },
        outer: { weight: 70, successStreak: 1 },
      },
    },
    workoutPlan: compoundWorkoutPlan,
    completedWorkout: {
      results: [
        { exerciseId: "thigh_machine", exerciseName: "Thigh Machine", movementId: "inner", movementName: "Inner", person: "Mike", setNumber: 1, reps: 12, weight: 45, status: "completed" },
        { exerciseId: "thigh_machine", exerciseName: "Thigh Machine", movementId: "inner", movementName: "Inner", person: "Mike", setNumber: 2, reps: 10, weight: 50, status: "completed" },
        { exerciseId: "thigh_machine", exerciseName: "Thigh Machine", movementId: "outer", movementName: "Outer", person: "Mike", setNumber: 1, reps: 12, weight: 85, status: "completed" },
        { exerciseId: "thigh_machine", exerciseName: "Thigh Machine", movementId: "outer", movementName: "Outer", person: "Mike", setNumber: 2, reps: 10, weight: 90, status: "completed" },
      ],
    },
    baselineProgressionStrategies: { Mike: "fast" },
    userStrategies: { Mike: "pyramid" },
  });

  assert.equal(result.updatedBaselineStates.Mike.inner.weight, 55);
  assert.equal(result.updatedBaselineStates.Mike.inner.successStreak, 0);
  assert.equal(result.updatedBaselineStates.Mike.outer.weight, 75);
  assert.equal(result.updatedBaselineStates.Mike.outer.successStreak, 0);
  assert.deepEqual(result.reasons.map((reason) => reason.exercise), [
    "Thigh Machine: Inner",
    "Thigh Machine: Outer",
  ]);
}

{
  const result = calculateProgressedBaselineStates({
    currentProfiles: { Mike: { leg_press: 100 } },
    currentBaselineStates: { Mike: { leg_press: { weight: 100, successStreak: 1, weightStep: 15 } } },
    workoutPlan,
    completedWorkout: completedWorkout([15, 12, 10], [85, 100, 115]),
    baselineProgressionStrategies: { Mike: "fast" },
    userStrategies: { Mike: "pyramid" },
  });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 115);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.weightStep, 15);
}

{
  const result = calculateProgressedBaselineStates({
    currentProfiles: { Mike: { leg_press: 95 } },
    currentBaselineStates: { Mike: { leg_press: { weight: 95, successStreak: 2, weightStep: 20 } } },
    workoutPlan,
    completedWorkout: completedWorkout([10, 8, 6], [75, 95, 115]),
    baselineProgressionStrategies: { Mike: "medium" },
    userStrategies: { Mike: "pyramid" },
  });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 75);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.weightStep, 20);
}

{
  const result = calculateProgressedBaselineStates({
    currentProfiles: { Victoria: { leg_press: 95 } },
    currentBaselineStates: { Victoria: { leg_press: { weight: 95, reps: 12, successStreak: 3, weightStep: 20 } } },
    workoutPlan,
    completedWorkout: {
      results: [
        {
          exerciseId: "leg_press",
          exerciseName: "Leg Press",
          person: "Victoria",
          setNumber: 1,
          reps: 13,
          weight: 100,
          status: "completed",
        },
        {
          exerciseId: "leg_press",
          exerciseName: "Leg Press",
          person: "Victoria",
          setNumber: 2,
          reps: 11,
          weight: 120,
          status: "completed",
        },
      ],
    },
    baselineProgressionStrategies: { Victoria: "manual" },
    userStrategies: { Victoria: "straight" },
  });

  assert.equal(result.updatedBaselineStates.Victoria.leg_press.weight, 120);
  assert.equal(result.updatedBaselineStates.Victoria.leg_press.reps, 11);
  assert.equal(result.updatedBaselineStates.Victoria.leg_press.successStreak, 0);
  assert.equal(result.updatedBaselineStates.Victoria.leg_press.weightStep, 20);
  assert.equal(result.updatedProfiles.Victoria.leg_press, 120);
}

{
  const result = calculate({
    workout: { results: [] },
    successStreak: 2,
  });

  assert.equal(result.updatedBaselineStates.Mike.leg_press.weight, 100);
  assert.equal(result.updatedBaselineStates.Mike.leg_press.successStreak, 2);
  assert.equal(result.reasons.length, 0);
}

console.log("Baseline progression tests passed.");
