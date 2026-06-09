export type BaselineProgressionStrategy = "straight" | "slow" | "medium" | "fast";

export type UserWeights = Record<string, number>;

export type UserBaseline = {
  weight: number;
  successStreak: number;
  weightStep?: number;
};

export type UserBaselines = Record<string, UserBaseline>;

export type SetTarget = {
  reps: number;
  weightOffset: number;
};

export type BaselineSetResult = {
  exerciseId?: string;
  exerciseName: string;
  movementId?: string;
  movementName?: string;
  person: string;
  setNumber: number;
  reps: number;
  weight: number;
  status: "completed" | "skipped";
};

export type BaselineWorkoutSummary = {
  results: BaselineSetResult[];
};

export type BaselineExercise = {
  id: string;
  name: string;
  setPlan: SetTarget[];
  movements?: Array<{
    id: string;
    name: string;
    setPlan?: SetTarget[];
  }>;
};

export type ProgressionReason = {
  person: string;
  exercise: string;
  oldWeight: number;
  newWeight: number;
  reason: string;
};

function progressionTargets(exercise: BaselineExercise) {
  if (exercise.movements && exercise.movements.length > 0) {
    return exercise.movements.map((movement) => ({
      id: movement.id,
      name: movement.name,
      label: `${exercise.name}: ${movement.name}`,
      setPlan: movement.setPlan ?? exercise.setPlan,
    }));
  }

  return [{
    id: exercise.id,
    name: exercise.name,
    label: exercise.name,
    setPlan: exercise.setPlan,
  }];
}

function resultMatchesProgressionTarget(result: BaselineSetResult, target: { id: string; name: string }) {
  return (
    result.movementId === target.id ||
    result.exerciseId === target.id ||
    result.movementName === target.name ||
    result.exerciseName === target.name
  );
}

function targetResultsForPerson(
  workoutEntry: BaselineWorkoutSummary,
  person: string,
  target: { id: string; name: string }
) {
  return workoutEntry.results.filter(
    (result) => result.person === person && resultMatchesProgressionTarget(result, target)
  );
}

function plannedTotalForTarget(
  baselineWeight: number,
  target: { setPlan: SetTarget[] },
  strategy: "pyramid" | "straight"
) {
  return target.setPlan.reduce((total, setTarget) => {
    const plannedReps = strategy === "straight" ? target.setPlan[0].reps : setTarget.reps;
    const plannedWeight = baselineWeight + (strategy === "pyramid" ? setTarget.weightOffset : 0);

    return total + plannedReps * plannedWeight;
  }, 0);
}

function actualTotalForResults(results: BaselineSetResult[]) {
  return results
    .filter((result) => result.status === "completed")
    .reduce((total, result) => total + result.reps * result.weight, 0);
}

function baselineProgressionThreshold(strategy: BaselineProgressionStrategy) {
  if (strategy === "fast") return 2;
  if (strategy === "medium") return 3;
  if (strategy === "slow") return 4;
  return Number.POSITIVE_INFINITY;
}

function roundBaselineIncrease(weight: number) {
  return Math.ceil((weight * 1.05) / 5) * 5;
}

function roundBaselineDecrease(weight: number) {
  return Math.max(0, Math.floor((weight * 0.95) / 5) * 5);
}

export function calculateProgressedBaselineStates({
  currentProfiles,
  currentBaselineStates,
  workoutPlan,
  completedWorkout,
  baselineProgressionStrategies,
  userStrategies,
}: {
  currentProfiles: Record<string, UserWeights>;
  currentBaselineStates: Record<string, UserBaselines>;
  workoutPlan: BaselineExercise[];
  completedWorkout: BaselineWorkoutSummary | null | undefined;
  baselineProgressionStrategies: Record<string, BaselineProgressionStrategy>;
  userStrategies: Record<string, "pyramid" | "straight">;
}): {
  updatedProfiles: Record<string, UserWeights>;
  updatedBaselineStates: Record<string, UserBaselines>;
  reasons: ProgressionReason[];
} {
  const updatedProfiles = JSON.parse(JSON.stringify(currentProfiles)) as Record<string, UserWeights>;
  const updatedBaselineStates = JSON.parse(JSON.stringify(currentBaselineStates)) as Record<string, UserBaselines>;
  const reasons: ProgressionReason[] = [];

  if (!completedWorkout) {
    return { updatedProfiles, updatedBaselineStates, reasons };
  }

  const people = Object.keys(updatedProfiles);

  for (const person of people) {
    if (!updatedProfiles[person]) continue;

    const exercises = workoutPlan.filter((exercise) => exercise.id !== "warm_up");

    for (const exercise of exercises) {
      for (const target of progressionTargets(exercise)) {
        const strategy = baselineProgressionStrategies[person] ?? "medium";
        const currentBaseline = updatedBaselineStates[person]?.[target.id] ?? {
          weight: updatedProfiles[person][target.id] ?? updatedProfiles[person][target.name] ?? 0,
          successStreak: 0,
        };
        const currentWeight = currentBaseline.weight;
        let newBaseline: UserBaseline = { ...currentBaseline };
        let reason: string | null = null;

        if (strategy !== "straight") {
          const targetResults = targetResultsForPerson(completedWorkout, person, target);
          const plannedTotal = plannedTotalForTarget(currentWeight, target, userStrategies[person]);

          if (targetResults.length > 0 && plannedTotal > 0) {
            const actualTotal = actualTotalForResults(targetResults);
            const ratio = actualTotal / plannedTotal;

            if (ratio < 0.95) {
              newBaseline = {
                ...currentBaseline,
                weight: roundBaselineDecrease(currentWeight),
                successStreak: 0,
              };
              reason = `actual work was ${Math.round(ratio * 100)}% of plan`;
            } else if (ratio > 1.05) {
              newBaseline = {
                ...currentBaseline,
                weight: roundBaselineIncrease(currentWeight),
                successStreak: 0,
              };
              reason = `actual work was ${Math.round(ratio * 100)}% of plan`;
            } else {
              const nextSuccessStreak = currentBaseline.successStreak + 1;
              const threshold = baselineProgressionThreshold(strategy);

              if (nextSuccessStreak >= threshold) {
                newBaseline = {
                  ...currentBaseline,
                  weight: roundBaselineIncrease(currentWeight),
                  successStreak: 0,
                };
                reason = `${strategy} baseline progression after ${nextSuccessStreak} successful workouts`;
              } else {
                newBaseline = {
                  ...currentBaseline,
                  weight: currentWeight,
                  successStreak: nextSuccessStreak,
                };
              }
            }
          }
        }

        if (!updatedBaselineStates[person]) {
          updatedBaselineStates[person] = {};
        }

        updatedBaselineStates[person][target.id] = newBaseline;
        updatedProfiles[person][target.id] = newBaseline.weight;

        if (newBaseline.weight !== currentWeight && reason) {
          reasons.push({
            person,
            exercise: target.label,
            oldWeight: currentWeight,
            newWeight: newBaseline.weight,
            reason,
          });
        }
      }
    }
  }

  return { updatedProfiles, updatedBaselineStates, reasons };
}
