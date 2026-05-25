import assert from "node:assert/strict";
import {
  adjustCurrentReps,
  adjustCurrentWeight,
  chooseFirstPerson,
  currentWorkoutPrompt,
  initialSession,
  recordSetAndAdvance,
  startWorkoutSession,
} from "../src/workoutEngine.ts";
import type { Exercise, Person } from "../src/workoutData.ts";

const profiles: Record<Person, Record<string, number>> = {
  Mike: {
    press: 100,
    row: 80,
    combo_inner: 50,
    combo_outer: 60,
  },
  Victoria: {
    press: 40,
    row: 30,
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

function complete(session: typeof initialSession, workout: Exercise[]) {
  return recordSetAndAdvance({
    session,
    workout,
    userProfiles: profiles,
    userStrategies: strategies,
    status: "completed",
    completedAt: "2026-05-25T12:00:00.000Z",
    createSessionId: () => "generated-session",
  });
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

console.log("Workout engine tests passed.");
