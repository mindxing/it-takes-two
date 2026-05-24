import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deleteApp, initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const exerciseIds = [
  "warm_up",
  "leg_press",
  "chest_press_machine",
  "seated_row_machine",
  "glute_machine",
  "bicep_curl_machine",
  "tricep_pushdown",
  "abs",
  "thigh_machine",
];

const standardPyramid = [
  { reps: 12, weightOffset: -10 },
  { reps: 10, weightOffset: 0 },
  { reps: 8, weightOffset: 10 },
];

const smallStepPyramid = [
  { reps: 15, weightOffset: -5 },
  { reps: 12, weightOffset: 0 },
  { reps: 10, weightOffset: 5 },
];

const straightSets = [
  { reps: 10, weightOffset: 0 },
  { reps: 10, weightOffset: 0 },
  { reps: 10, weightOffset: 0 },
];

const exercises = {
  warm_up: {
    active: true,
    type: "single",
    name: "Warm-up",
    sets: 1,
    reps: "5-8 min",
    defaultReps: 0,
    notes: "Treadmill or elliptical",
    setPlan: [{ reps: 0, weightOffset: 0 }],
  },
  leg_press: {
    active: true,
    type: "single",
    name: "Leg Press",
    sets: 3,
    reps: "8-12",
    defaultReps: 10,
    setPlan: standardPyramid,
  },
  chest_press_machine: {
    active: true,
    type: "single",
    name: "Chest Press Machine",
    sets: 3,
    reps: "8-12",
    defaultReps: 10,
    setPlan: standardPyramid,
  },
  seated_row_machine: {
    active: true,
    type: "single",
    name: "Seated Row Machine",
    sets: 3,
    reps: "8-12",
    defaultReps: 10,
    setPlan: standardPyramid,
  },
  glute_machine: {
    active: true,
    type: "single",
    name: "Glute Machine",
    sets: 3,
    reps: "10-15",
    defaultReps: 12,
    notes: "Kickback or abductor",
    setPlan: smallStepPyramid,
  },
  bicep_curl_machine: {
    active: true,
    type: "single",
    name: "Bicep Curl Machine",
    sets: 3,
    reps: "10-15",
    defaultReps: 12,
    setPlan: smallStepPyramid,
  },
  tricep_pushdown: {
    active: true,
    type: "single",
    name: "Tricep Pushdown",
    sets: 3,
    reps: "10-15",
    defaultReps: 12,
    setPlan: smallStepPyramid,
  },
  abs: {
    active: true,
    type: "single",
    name: "Abs",
    sets: 3,
    reps: "Machine or 20-45s plank",
    defaultReps: 12,
    setPlan: straightSets,
  },
  thigh_machine: {
    active: true,
    type: "compound",
    name: "Inner / Outer Thigh Machine",
    sets: 3,
    reps: "10-15",
    defaultReps: 12,
    notes: "Do inner then outer before switching people",
    setPlan: smallStepPyramid,
    movements: [
      {
        id: "thigh_machine_inner",
        name: "Inner Thigh",
      },
      {
        id: "thigh_machine_outer",
        name: "Outer Thigh",
      },
    ],
  },
  dumbbell_romanian_deadlift: {
    active: true,
    type: "single",
    name: "Dumbbell Romanian Deadlift",
    sets: 3,
    reps: "8-12",
    defaultReps: 10,
    notes: "RDL - hinge at hips, slight knee bend",
    setPlan: standardPyramid,
  },
};

const userProfiles = {
  Mike: {
    id: "Mike",
    displayName: "Mike",
    progressionStrategy: "pyramid",
    baselineProgressionStrategy: "medium",
    active: true,
  },
  Victoria: {
    id: "Victoria",
    displayName: "Victoria",
    progressionStrategy: "straight",
    baselineProgressionStrategy: "straight",
    active: true,
  },
};

const currentBaselines = {
  Mike: {
    userId: "Mike",
    baselines: {
      warm_up: { weight: 0, successStreak: 0 },
      leg_press: { weight: 125, successStreak: 0 },
      chest_press_machine: { weight: 65, successStreak: 0 },
      seated_row_machine: { weight: 55, successStreak: 0 },
      glute_machine: { weight: 55, successStreak: 0 },
      bicep_curl_machine: { weight: 55, successStreak: 0 },
      tricep_pushdown: { weight: 55, successStreak: 0 },
      abs: { weight: 0, successStreak: 0 },
      thigh_machine_inner: { weight: 55, successStreak: 0 },
      thigh_machine_outer: { weight: 75, successStreak: 0 },
      dumbbell_romanian_deadlift: { weight: 35, successStreak: 0 },
    },
  },
  Victoria: {
    userId: "Victoria",
    baselines: {
      warm_up: { weight: 0, successStreak: 0 },
      leg_press: { weight: 95, successStreak: 0 },
      chest_press_machine: { weight: 25, successStreak: 0 },
      seated_row_machine: { weight: 35, successStreak: 0 },
      glute_machine: { weight: 50, successStreak: 0 },
      bicep_curl_machine: { weight: 10, successStreak: 0 },
      tricep_pushdown: { weight: 30, successStreak: 0 },
      abs: { weight: 0, successStreak: 0 },
      thigh_machine_inner: { weight: 50, successStreak: 0 },
      thigh_machine_outer: { weight: 65, successStreak: 0 },
      dumbbell_romanian_deadlift: { weight: 20, successStreak: 0 },
    },
  },
};

const workoutPlan = {
  active: true,
  name: "Default Workout",
  exerciseIds,
};

async function loadEnv() {
  const envPath = resolve(".env");
  const envText = await readFile(envPath, "utf8");
  const env = {};

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    env[key] = value;
  }

  return env;
}

function requireEnv(env, key) {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing ${key} in .env`);
  }

  return value;
}

function readCollectionPrefix() {
  const prefixArg = process.argv.find((item) => item.startsWith("--collection-prefix="));

  if (prefixArg) {
    return prefixArg.slice("--collection-prefix=".length);
  }

  return process.env.VITE_FIRESTORE_COLLECTION_PREFIX ?? "";
}

const collectionPrefix = readCollectionPrefix();

function collectionName(name) {
  return `${collectionPrefix}${name}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = await loadEnv();

  const firebaseConfig = {
    apiKey: requireEnv(env, "VITE_FIREBASE_API_KEY"),
    authDomain: requireEnv(env, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv(env, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv(env, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv(env, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv(env, "VITE_FIREBASE_APP_ID"),
  };

  if (dryRun) {
    console.log(`Dry run: would write ${collectionName("workoutPlans")}/default`);
    console.log(JSON.stringify(workoutPlan, null, 2));
    console.log(`Dry run: would write ${collectionName("exercises")}/*`);
    console.log(JSON.stringify(exercises, null, 2));
    console.log(`Dry run: would write ${collectionName("userProfiles")}/*`);
    console.log(JSON.stringify(userProfiles, null, 2));
    console.log(`Dry run: would write ${collectionName("currentBaselines")}/*`);
    console.log(JSON.stringify(currentBaselines, null, 2));
    return;
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  await setDoc(doc(db, collectionName("workoutPlans"), "default"), workoutPlan);
  console.log(`Wrote ${collectionName("workoutPlans")}/default`);

  for (const [exerciseId, exercise] of Object.entries(exercises)) {
    await setDoc(doc(db, collectionName("exercises"), exerciseId), exercise);
    console.log(`Wrote ${collectionName("exercises")}/${exerciseId}`);
  }

  for (const [person, profileUpdate] of Object.entries(userProfiles)) {
    await setDoc(doc(db, collectionName("userProfiles"), person), profileUpdate);
    console.log(`Wrote ${collectionName("userProfiles")}/${person}`);
  }

  for (const [person, baselineUpdate] of Object.entries(currentBaselines)) {
    await setDoc(doc(db, collectionName("currentBaselines"), person), baselineUpdate);
    console.log(`Wrote ${collectionName("currentBaselines")}/${person}`);
  }

  await deleteApp(app);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
