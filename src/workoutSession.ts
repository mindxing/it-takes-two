import { db } from "./firebase";
import { addDoc, collection, getDocs, orderBy, query, doc, onSnapshot, setDoc} from "firebase/firestore";

export const demoSessionId = "demo";

export function saveWorkoutSession(session: unknown) {
  console.log("Writing to Firestore doc:", demoSessionId);

  return setDoc(doc(db, "workoutSessions", demoSessionId), {
    ...session,
    updatedAt: new Date().toISOString(),
  });
}

export function listenToWorkoutSession(
  onSessionChange: (session: unknown) => void
) {
  return onSnapshot(doc(db, "workoutSessions", demoSessionId), (snapshot) => {
    if (snapshot.exists()) {
      onSessionChange(snapshot.data());
    }
  });
}

export function saveCompletedWorkoutSummary(summary: {
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
}) {
  return addDoc(collection(db, "completedWorkouts"), summary);
}

export type CompletedWorkoutSummary = {
  completedAt: string;
  totalSets: number;
  totalWeightLifted: number;
};

export async function loadCompletedWorkoutSummaries() {
  const q = query(
    collection(db, "completedWorkouts"),
    orderBy("completedAt", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as CompletedWorkoutSummary),
  }));
}