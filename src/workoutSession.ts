import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const createDemoWorkoutSession = async () => {
  await setDoc(doc(db, "workoutSessions", "demo"), {
    status: "not_started",
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    currentPerson: "Mike",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};
