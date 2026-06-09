import assert from "node:assert/strict";
import {
  adjustCurrentReps,
  adjustCurrentWeight,
  chooseFirstPerson,
  completeWarmup,
  currentWorkoutPrompt,
  postponeCurrentExercise,
  recordSetAndAdvance,
  startWarmup,
  startWorkoutSession,
  switchToTandemCompanion,
  tandemCompanionPrompt,
  type WorkoutSession,
} from "../src/workoutEngine.ts";
import type { Exercise, Person } from "../src/workoutData.ts";

const profiles: Record<Person, Record<string, number>> = {
  Mike: {
    press: 100,
    row: 80,
    pulldown: 90,
    combo_inner: 50,
    combo_outer: 60,
  },
  Victoria: {
    press: 40,
    row: 30,
    pulldown: 45,
    combo_inner: 20,
    combo_outer: 25,
  },
};

const strategies = {
  Mike: "pyramid",
  Victoria: "straight",
} as const;

const press: Exercise = {
  id: "press",
  name: "Press",
  sets: 2,
  reps: "8-12",
  defaultReps: 10,
  setPlan: [
    { reps: 12, weightOffset: -10 },
    { reps: 10, weightOffset: 0 },
  ],
};

const row: Exercise = {
  id: "row",
  name: "Row",
  sets: 1,
  reps: "8-12",
  defaultReps: 10,
  setPlan: [
    { reps: 12, weightOffset: -10 },
  ],
};

const pulldown: Exercise = {
  id: "pulldown",
  name: "Pulldown",
  sets: 2,
  reps: "8-12",
  defaultReps: 10,
  setPlan: [
    { reps: 12, weightOffset: -10 },
    { reps: 10, weightOffset: 0 },
  ],
};

const combo: Exercise = {
  id: "combo",
  name: "Combo",
  type: "compound",
  sets: 1,
  reps: "10-15",
  defaultReps: 12,
  setPlan: [
    { reps: 12, weightOffset: 0 },
  ],
  movements: [
    {
      id: "combo_inner",
      name: "Inner",
    },
    {
      id: "combo_outer",
      name: "Outer",
    },
  ],
};

function complete(session: WorkoutSession, workout: Exercise[], status: "completed" | "skipped" = "completed") {
  return recordSetAndAdvance({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    status,
    completedAt: "2026-05-25T12:00:00.000Z",
    createSessionId: () => "generated-session",
  });
}

function effectiveWorkout(session: WorkoutSession, fallback: Exercise[]) {
  return session.reorderedWorkout ?? fallback;
}

{
  const workout = [press, row];
  let session = startWorkoutSession("session-1", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
  });

  assert.deepEqual(currentWorkoutPrompt(session, workout), {
    person: "Mike",
    exerciseId: "press",
    exerciseName: "Press",
    movementId: null,
    movementName: null,
    setNumber: 1,
    reps: 12,
    weight: 90,
  });

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Victoria");
  assert.equal(currentWorkoutPrompt(session, workout).setNumber, 1);
  assert.equal(currentWorkoutPrompt(session, workout).reps, 12);
  assert.equal(currentWorkoutPrompt(session, workout).weight, 40);

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Mike");
  assert.equal(currentWorkoutPrompt(session, workout).setNumber, 2);
  assert.equal(currentWorkoutPrompt(session, workout).reps, 10);
  assert.equal(currentWorkoutPrompt(session, workout).weight, 100);

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Victoria");
  assert.equal(currentWorkoutPrompt(session, workout).setNumber, 2);

  session = complete(session, workout);
  assert.equal(session.exerciseIndex, 1);
  assert.equal(session.firstPerson, null);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Victoria",
  });

  session = complete(session, workout);
  session = complete(session, workout);

  assert.equal(session.complete, true);
  assert.equal(session.status, "completed");
  assert.equal(session.results.length, 6);
}

{
  const workout = [combo];
  let session = startWorkoutSession("session-2", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
  });

  assert.equal(currentWorkoutPrompt(session, workout).person, "Mike");
  assert.equal(currentWorkoutPrompt(session, workout).movementId, "combo_inner");

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Mike");
  assert.equal(currentWorkoutPrompt(session, workout).movementId, "combo_outer");

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Victoria");
  assert.equal(currentWorkoutPrompt(session, workout).movementId, "combo_inner");

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Victoria");
  assert.equal(currentWorkoutPrompt(session, workout).movementId, "combo_outer");

  session = complete(session, workout);
  assert.equal(session.complete, true);
  assert.equal(session.results.map((result) => `${result.person}:${result.movementId}`).join(","), [
    "Mike:combo_inner",
    "Mike:combo_outer",
    "Victoria:combo_inner",
    "Victoria:combo_outer",
  ].join(","));
}

{
  const workout = [press, row];
  let session = startWorkoutSession("session-warmup", workout);

  session = startWarmup(session, "2026-05-25T12:00:00.000Z");
  assert.equal(session.warmupStartedAt, "2026-05-25T12:00:00.000Z");
  assert.equal(session.exerciseIndex, 0);

  session = completeWarmup(session);
  assert.equal(session.warmupStartedAt, null);
  assert.equal(session.exerciseIndex, 1);
  assert.equal(session.firstPerson, null);
  assert.equal(session.currentSet, 1);
}

{
  const workout = [press, row, combo];
  const session = {
    ...startWorkoutSession("session-postpone", workout),
    exerciseIndex: 1,
    reorderedWorkout: workout,
  };
  const postponed = postponeCurrentExercise(session, workout);

  assert.deepEqual(postponed.reorderedWorkout?.map((exercise) => exercise.id), [
    "press",
    "combo",
    "row",
  ]);

  const finalExerciseSession = {
    ...session,
    exerciseIndex: 2,
  };

  assert.equal(postponeCurrentExercise(finalExerciseSession, workout), finalExerciseSession);
}

{
  const workout = [press];
  let session = startWorkoutSession("session-skip", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
  });

  session = complete(session, workout, "skipped");

  assert.equal(session.results[0].status, "skipped");
  assert.equal(session.results[0].reps, 0);
  assert.equal(session.results[0].weight, 90);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Victoria");
}

{
  const workout = [press];
  let session = startWorkoutSession("session-straight", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Victoria",
  });

  session = adjustCurrentReps(session, workout, 3);
  assert.equal(session.currentReps, 15);

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Mike");
  assert.equal(currentWorkoutPrompt(session, workout).reps, 12);

  session = complete(session, workout);
  assert.equal(currentWorkoutPrompt(session, workout).person, "Victoria");
  assert.equal(currentWorkoutPrompt(session, workout).setNumber, 2);
  assert.equal(currentWorkoutPrompt(session, workout).reps, 15);
  assert.equal(currentWorkoutPrompt(session, workout).weight, 40);
}

{
  const workout = [press];
  let session = startWorkoutSession("session-3", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
  });

  session = adjustCurrentReps(session, workout, -20);
  assert.equal(session.currentReps, 0);
  assert.equal(session.adjustedRepBaselines?.press?.Mike, 0);

  session = adjustCurrentWeight({ session, workout, userStrategies: strategies, delta: -500 });
  assert.equal(session.currentWeight, 0);
  assert.equal(session.adjustedBaselines?.press?.Mike, 10);
}

{
  const workout = [press, pulldown];
  let session = startWorkoutSession("session-tandem", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
    tandemExerciseId: "pulldown",
  });

  const prompts = [];

  for (let i = 0; i < 8; i += 1) {
    const currentWorkout = effectiveWorkout(session, workout);
    const prompt = currentWorkoutPrompt(session, currentWorkout);
    prompts.push(`${prompt.person}:${prompt.exerciseId}:S${prompt.setNumber}`);
    session = complete(session, currentWorkout);
  }

  assert.deepEqual(prompts, [
    "Mike:press:S1",
    "Victoria:pulldown:S1",
    "Victoria:press:S1",
    "Mike:pulldown:S1",
    "Mike:press:S2",
    "Victoria:pulldown:S2",
    "Victoria:press:S2",
    "Mike:pulldown:S2",
  ]);
  assert.equal(session.complete, true);
}

{
  const workout = [press, pulldown];
  let session = startWorkoutSession("session-tandem-swap", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
    tandemExerciseId: "pulldown",
  });

  const currentWorkout = effectiveWorkout(session, workout);
  const companion = tandemCompanionPrompt({
    session,
    workout: currentWorkout,
    userProfiles: profiles,
    userStrategies: strategies,
  });

  assert.equal(companion?.person, "Victoria");
  assert.equal(companion?.exerciseId, "pulldown");
  assert.equal(companion?.setNumber, 1);

  session = switchToTandemCompanion({
    session,
    workout: currentWorkout,
    userProfiles: profiles,
    userStrategies: strategies,
  });

  assert.equal(currentWorkoutPrompt(session, currentWorkout).person, "Victoria");
  assert.equal(currentWorkoutPrompt(session, currentWorkout).exerciseId, "pulldown");

  session = complete(session, currentWorkout);

  assert.equal(currentWorkoutPrompt(session, currentWorkout).person, "Mike");
  assert.equal(currentWorkoutPrompt(session, currentWorkout).exerciseId, "press");
}

{
  const curl: Exercise = {
    id: "curl",
    name: "Curl",
    sets: 1,
    reps: "8-12",
    defaultReps: 10,
    setPlan: [{ reps: 10, weightOffset: 0 }],
  };
  const workout = [combo, curl];
  let session = startWorkoutSession("session-compound-tandem", workout);

  session = chooseFirstPerson({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    firstPerson: "Mike",
    tandemExerciseId: "curl",
  });

  const steps = [];

  while (!session.complete) {
    const currentWorkout = effectiveWorkout(session, workout);
    const prompt = currentWorkoutPrompt(session, currentWorkout);
    steps.push(`${prompt.person}:${prompt.exerciseId}:${prompt.movementId ?? "single"}:S${prompt.setNumber}`);
    session = complete(session, currentWorkout);
  }

  assert.deepEqual(steps, [
    "Mike:combo:combo_inner:S1",
    "Mike:combo:combo_outer:S1",
    "Victoria:curl:single:S1",
    "Victoria:combo:combo_inner:S1",
    "Victoria:combo:combo_outer:S1",
    "Mike:curl:single:S1",
  ]);
}

console.log("Workout engine tests passed.");
