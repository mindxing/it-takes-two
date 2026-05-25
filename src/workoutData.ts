export type SetPlanType = "straight" | "pyramid" | "reversePyramid";

export type SetTarget = {
  reps: number;
  weightOffset: number;
};

export type Person = "Victoria" | "Mike";

export type Movement = {
  id: string;
  name: string;
  defaultReps?: number;
  defaultWeight?: Record<Person, number>;
  setPlan?: SetTarget[];
  reps?: string;
  notes?: string;
};

export type Exercise = {
  id: string;
  name: string;
  type?: "single" | "compound";
  sets: number;
  reps: string;
  defaultReps: number;
  defaultWeight?: Record<Person, number>;
  setPlan: SetTarget[];
  notes?: string;
  movements?: Movement[];
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

export const people: Person[] = ["Victoria", "Mike"];

export const workout: Exercise[] = [
  {
    id: "warm_up",
    name: "Warm-up",
    sets: 1,
    reps: "5–8 min",
    defaultReps: 0,
    defaultWeight: { Victoria: 0, Mike: 0 },
    notes: "Treadmill or elliptical",
    setPlan: [{ reps: 0, weightOffset: 0 }],

  },
  {
    id: "leg_press",
  name: "Leg Press",
  sets: 3,
  reps: "8–12",
  defaultReps: 10,
  defaultWeight: { Victoria: 100, Mike: 140 },
  setPlan: standardPyramid,
},
  {
    id: "chest_press_machine",
    name: "Chest Press Machine",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 50, Mike: 80 },
    setPlan: standardPyramid,
  },
  {
    id: "seated_row_machine",
    name: "Seated Row Machine",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 50, Mike: 80 },
    setPlan: standardPyramid,
  },
  {
    id: "lat_pulldown",
    name: "Lat Pulldown",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 50, Mike: 70 },
    setPlan: standardPyramid,
  },
  {
    id: "bicep_curl_machine",
    name: "Bicep Curl Machine",
    sets: 3,
    reps: "10–15",
    defaultReps: 12,
    defaultWeight: { Victoria: 20, Mike: 30 },
    setPlan: smallStepPyramid,
  },
  {
    id: "tricep_pushdown",
    name: "Tricep Pushdown",
    sets: 3,
    reps: "10–15",
    defaultReps: 12,
    defaultWeight: { Victoria: 30, Mike: 50 },
    setPlan: smallStepPyramid,
  },
  {
    id: "abs",
    name: "Abs",
    sets: 3,
    reps: "Machine or 20–45s plank",
    defaultReps: 12,
    defaultWeight: { Victoria: 0, Mike: 0 },
    setPlan: straightSets,
  },
  {
    id: "thigh_machine",
    name: "Inner / Outer Thigh Machine",
    type: "compound",
    sets: 3,
    reps: "10â€“15",
    defaultReps: 12,
    defaultWeight: { Victoria: 0, Mike: 0 },
    notes: "Do inner then outer before switching people",
    setPlan: smallStepPyramid,
    movements: [
      {
        id: "thigh_machine_inner",
        name: "Inner Thigh",
        defaultWeight: { Victoria: 50, Mike: 55 },
      },
      {
        id: "thigh_machine_outer",
        name: "Outer Thigh",
        defaultWeight: { Victoria: 65, Mike: 75 },
      },
    ],
  },
  {
    id: "dumbbell_romanian_deadlift",
    name: "Dumbbell Romanian Deadlift",
    sets: 3,
    reps: "8–12",
    defaultReps: 10,
    defaultWeight: { Victoria: 20, Mike: 35 },
    notes: "RDL — hinge at hips, slight knee bend",
    setPlan: standardPyramid,
  },
];
