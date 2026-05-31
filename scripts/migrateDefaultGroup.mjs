import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deleteApp, initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";

const defaultGroupId = "mike-victoria";
const defaultGroup = {
  id: defaultGroupId,
  name: "Mike & Victoria",
  memberIds: ["Mike", "Victoria"],
  members: {
    Mike: {
      id: "Mike",
      displayName: "Mike",
      role: "member",
      active: true,
    },
    Victoria: {
      id: "Victoria",
      displayName: "Victoria",
      role: "member",
      active: true,
    },
  },
  defaultWorkoutPlanId: "default",
  activeSessionId: "demo",
  active: true,
};

const groupScopedCollectionsToCopy = [
  "workoutPlans",
  "exercises",
  "userProfiles",
];

const topLevelStateCollectionsToCopy = [
  "currentBaselines",
  "completedWorkouts",
  "workoutSessions",
];

function argValue(name, fallback = "") {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

function readCollectionPrefix() {
  return argValue("collection-prefix", process.env.VITE_FIRESTORE_COLLECTION_PREFIX ?? "");
}

function collectionName(name, collectionPrefix) {
  return `${collectionPrefix}${name}`;
}

function groupRootCollection(collectionPrefix) {
  return collectionName("workoutGroups", collectionPrefix);
}

function groupPath(groupId, collectionPrefix) {
  return `${groupRootCollection(collectionPrefix)}/${groupId}`;
}

function groupCollectionPath(groupId, collectionNameValue, collectionPrefix) {
  return `${groupPath(groupId, collectionPrefix)}/${collectionNameValue}`;
}

function activeSessionDocumentId(groupId) {
  return `${groupId}_demo`;
}

function currentBaselineDocumentId(groupId, memberId) {
  return `${groupId}_${memberId}`;
}

function targetStateDocumentId(groupId, collectionNameValue, sourceDocumentId) {
  if (collectionNameValue === "workoutSessions" && sourceDocumentId === "demo") {
    return activeSessionDocumentId(groupId);
  }

  if (collectionNameValue === "currentBaselines") {
    return currentBaselineDocumentId(groupId, sourceDocumentId);
  }

  return sourceDocumentId;
}

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

async function copyGroupScopedCollection({ db, groupId, legacyCollection, collectionPrefix }) {
  const legacyPath = collectionName(legacyCollection, collectionPrefix);
  const targetPath = groupCollectionPath(groupId, legacyCollection, collectionPrefix);
  const snapshot = await getDocs(collection(db, legacyPath));

  for (const sourceDoc of snapshot.docs) {
    await setDoc(doc(db, targetPath, sourceDoc.id), sourceDoc.data());
    console.log(`Copied ${legacyPath}/${sourceDoc.id} -> ${targetPath}/${sourceDoc.id}`);
  }
}

async function copyTopLevelStateCollection({ db, groupId, legacyCollection, collectionPrefix }) {
  const legacyPath = collectionName(legacyCollection, collectionPrefix);
  const targetPath = collectionName(legacyCollection, collectionPrefix);
  const snapshot = await getDocs(collection(db, legacyPath));

  for (const sourceDoc of snapshot.docs) {
    const targetDocumentId = targetStateDocumentId(groupId, legacyCollection, sourceDoc.id);
    const preparedData = {
      ...sourceDoc.data(),
      groupId,
    };

    if (legacyCollection === "currentBaselines") {
      preparedData.memberId = sourceDoc.id;
      preparedData.userId = preparedData.userId ?? sourceDoc.id;
    }

    await setDoc(doc(db, targetPath, targetDocumentId), preparedData);
    console.log(`Copied ${legacyPath}/${sourceDoc.id} -> ${targetPath}/${targetDocumentId}`);

    if (legacyCollection === "workoutSessions") {
      const sourceEventsPath = `${legacyPath}/${sourceDoc.id}/events`;
      const targetEventsPath = `${targetPath}/${targetDocumentId}/events`;
      const eventsSnapshot = await getDocs(collection(db, sourceEventsPath));

      for (const eventDoc of eventsSnapshot.docs) {
        await setDoc(doc(db, targetEventsPath, eventDoc.id), {
          ...eventDoc.data(),
          groupId,
        });
        console.log(`Copied ${sourceEventsPath}/${eventDoc.id} -> ${targetEventsPath}/${eventDoc.id}`);
      }
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const groupId = argValue("group-id", defaultGroupId);
  const collectionPrefix = readCollectionPrefix();
  const root = groupRootCollection(collectionPrefix);
  const group = {
    ...defaultGroup,
    id: groupId,
  };

  if (dryRun) {
    console.log(`Dry run: would write ${root}/${groupId}`);
    console.log(JSON.stringify(group, null, 2));

    for (const collectionToCopy of groupScopedCollectionsToCopy) {
      console.log(
        `Dry run: would copy ${collectionName(collectionToCopy, collectionPrefix)}/* -> ${groupCollectionPath(groupId, collectionToCopy, collectionPrefix)}/*`
      );
    }

    for (const collectionToCopy of topLevelStateCollectionsToCopy) {
      console.log(
        `Dry run: would copy ${collectionName(collectionToCopy, collectionPrefix)}/* -> ${collectionName(collectionToCopy, collectionPrefix)}/* with groupId ${groupId}`
      );

      if (collectionToCopy === "workoutSessions") {
        console.log(
          `Dry run: would copy ${collectionName(collectionToCopy, collectionPrefix)}/*/events/* -> ${collectionName(collectionToCopy, collectionPrefix)}/*/events/* with groupId ${groupId}`
        );
      }
    }

    return;
  }

  const env = await loadEnv();
  const firebaseConfig = {
    apiKey: requireEnv(env, "VITE_FIREBASE_API_KEY"),
    authDomain: requireEnv(env, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv(env, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv(env, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv(env, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv(env, "VITE_FIREBASE_APP_ID"),
  };
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  await setDoc(doc(db, root, groupId), group);
  console.log(`Wrote ${root}/${groupId}`);

  for (const collectionToCopy of groupScopedCollectionsToCopy) {
    await copyGroupScopedCollection({
      db,
      groupId,
      legacyCollection: collectionToCopy,
      collectionPrefix,
    });
  }

  for (const collectionToCopy of topLevelStateCollectionsToCopy) {
    await copyTopLevelStateCollection({
      db,
      groupId,
      legacyCollection: collectionToCopy,
      collectionPrefix,
    });
  }

  await deleteApp(app);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
