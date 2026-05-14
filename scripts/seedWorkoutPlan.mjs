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
  "dumbbell_romanian_deadlift",
];

const exercises = {
  warm_up: { active: true, name: "Warm-up" },
  leg_press: { active: true, name: "Leg Press" },
  chest_press_machine: { active: true, name: "Chest Press Machine" },
  seated_row_machine: { active: true, name: "Seated Row Machine" },
  glute_machine: { active: true, name: "Glute Machine" },
  bicep_curl_machine: { active: true, name: "Bicep Curl Machine" },
  tricep_pushdown: { active: true, name: "Tricep Pushdown" },
  abs: { active: true, name: "Abs" },
  dumbbell_romanian_deadlift: {
    active: true,
    name: "Dumbbell Romanian Deadlift",
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
    console.log("Dry run: would write workoutPlans/default");
    console.log(JSON.stringify(workoutPlan, null, 2));
    console.log("Dry run: would write exercises/*");
    console.log(JSON.stringify(exercises, null, 2));
    return;
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  await setDoc(doc(db, "workoutPlans", "default"), workoutPlan);
  console.log("Wrote workoutPlans/default");

  for (const [exerciseId, exercise] of Object.entries(exercises)) {
    await setDoc(doc(db, "exercises", exerciseId), exercise);
    console.log(`Wrote exercises/${exerciseId}`);
  }

  await deleteApp(app);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
