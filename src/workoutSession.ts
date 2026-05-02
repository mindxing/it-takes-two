import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

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
