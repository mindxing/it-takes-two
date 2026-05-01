export type SetPlanType = "straight" | "pyramid" | "reversePyramid";

export type SetTarget = {
  reps: number;
  weightOffset: number;
};

export type Person = "Victoria" | "Mike";

export type Exercise = {
  name: string;
  sets: number;
  reps: string;
  defaultReps: number;
  defaultWeight: Record<Person, number>;
  setPlan: SetTarget[];
  notes?: string;
};

const standardPyramid: SetTarget[] = [
  { reps: 12, weightOffset: -10 },
  { reps: 10, weightOffset: 0 },
  { reps: 8, weightOffset: 10 },
];

const smallStepPyramid: SetTarget[] = [
  { reps: 15, weightOffset: -5 },
  { reps: 12, weightOffset: 0 },
  { reps: 10, weightOffset: 5 },
];

const straightSets: SetTarget[] = [
  { reps: 10, weightOffset: 0 },
  { reps: 10, weightOffset: 0 },
  { reps: 10, weightOffset: 0 },
];

const reversePyramid: SetTarget[] = [
  { reps: 8, weightOffset: 10 },
  { reps: 10, weightOffset: 0 },
  { reps: 12, weightOffset: -10 },
];

export const people: Person[] = ["Victoria", "Mike"];

export const workout: Exercise[] = [
  {
    name: "Warm-up",
    sets: 1,
    reps: "5–8 min",
    defaultReps: 0,
    defaultWeight: { Victoria: 0, Mike: 0 },
    notes: "Treadmill or elliptical",
    setPlan: [{ reps: 0, weightOffset: 0 }],

  },
  {
  name: "Leg Press",
  sets: 3,
  reps: "8–12",
  defaultReps: 10,
  defaultWeight: { Victoria: 100, Mike: 140 },
  setPlan: standardPyramid,
},
  {
    name: "Chest Press Machine",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 50, Mike: 80 },
    setPlan: standardPyramid,
  },
  {
    name: "Seated Row Machine",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 50, Mike: 80 },
    setPlan: standardPyramid,
  },
  {
    name: "Glute Machine",
    sets: 3,
    reps: "10–15",
    defaultReps: 12,
    defaultWeight: { Victoria: 50, Mike: 70 },
    notes: "Kickback or abductor",
    setPlan: smallStepPyramid,
  },
  {
    name: "Bicep Curl Machine",
    sets: 3,
    reps: "10–15",
    defaultReps: 12,
    defaultWeight: { Victoria: 20, Mike: 30 },
    setPlan: smallStepPyramid,
  },
  {
    name: "Tricep Pushdown",
    sets: 3,
    reps: "10–15",
    defaultReps: 12,
    defaultWeight: { Victoria: 30, Mike: 50 },
    setPlan: smallStepPyramid,
  },
  {
    name: "Abs",
    sets: 3,
    reps: "Machine or 20–45s plank",
    defaultReps: 12,
    defaultWeight: { Victoria: 0, Mike: 0 },
    setPlan: straightSets,
  },
  {
    name: "Dumbbell Romanian Deadlift",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 20, Mike: 35 },
    notes: "RDL — hinge at hips, slight knee bend",
    setPlan: standardPyramid,
  },
];