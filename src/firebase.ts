import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  activeSessionDocumentId,
  currentBaselineDocumentId,
  defaultWorkoutGroupId,
  groupCollectionPath,
  topLevelCollectionPath,
  type GroupScopedCollection,
  type TopLevelStateCollection,
} from "./groupModel";


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

const collectionPrefix = import.meta.env.VITE_FIRESTORE_COLLECTION_PREFIX ?? "";
const workoutGroupId = import.meta.env.VITE_WORKOUT_GROUP_ID ?? defaultWorkoutGroupId;
const groupScopedCollections = new Set<string>(["workoutPlans", "exercises", "userProfiles"]);

export function collectionName(name: string) {
  if (groupScopedCollections.has(name)) {
    return groupCollectionPath(workoutGroupId, name as GroupScopedCollection, collectionPrefix);
  }

  return topLevelCollectionPath(name as TopLevelStateCollection, collectionPrefix);
}

export function activeWorkoutGroupId() {
  return workoutGroupId;
}

export function activeWorkoutSessionDocumentId() {
  return activeSessionDocumentId(workoutGroupId);
}

export function activeCurrentBaselineDocumentId(memberId: string) {
  return currentBaselineDocumentId(workoutGroupId, memberId);
}
