import { collection, getDocs } from "firebase/firestore";
import { db, firestoreCollectionPrefix } from "./firebase";
import { defaultWorkoutGroup, groupRootCollection, type WorkoutGroup } from "./groupModel";
import { activeGroupsForUser } from "./groupSelection";

function isWorkoutGroup(value: unknown): value is WorkoutGroup {
  if (!value || typeof value !== "object") return false;

  const group = value as Partial<WorkoutGroup>;
  return (
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    Array.isArray(group.memberIds) &&
    !!group.members &&
    typeof group.members === "object"
  );
}

export async function loadWorkoutGroupsForUser(userId: string): Promise<WorkoutGroup[]> {
  const snapshot = await getDocs(collection(db, groupRootCollection(firestoreCollectionPrefix())));
  const groups = snapshot.docs
    .map((groupDoc) => {
      const data = {
        id: groupDoc.id,
        ...groupDoc.data(),
      };

      return isWorkoutGroup(data) ? data : null;
    })
    .filter((group): group is WorkoutGroup => group !== null);
  const eligibleGroups = activeGroupsForUser(groups, userId);

  return eligibleGroups.length > 0 ? eligibleGroups : [defaultWorkoutGroup];
}
