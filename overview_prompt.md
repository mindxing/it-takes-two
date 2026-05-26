I’m building a React + Vite + TypeScript workout app called “It Takes Two” with Firebase Firestore. I'd like to give you an overview of the app so that you understand it. Once you do, then I'll ask you some questions.

## App Overview

This is a 2-person synchronized workout app designed for couples working out together.

Core concept:

* Two people (Mike and Victoria) perform a shared workout
* Both devices stay in sync in real time via Firestore
* One shared session drives both UIs
* Firestore is the authoritative source of truth

---

# Current Features (Working)

## Real-time Sync

* Firestore is the source of truth
* All workout actions sync across devices using Firestore `onSnapshot`
* Both devices stay synchronized during workouts
* Session state mirrors Firestore state closely
* Minimal local-only state

Synced actions include:

* Start workout
* Join workout
* Warm-up
* Set completion
* Skipping sets
* Weight changes
* Rep changes
* Exercise postponing
* Workout cancellation
* Workout completion
* Tandem exercise selection and progression

---

## Workout Flow

### General Flow

* Start / Join workout (single-button logic)
* Warm-up → exercises → completion
* Alternating sets between two people
* Cancel and complete sync across devices

### Exercise Flow

Each exercise includes:

* Multiple sets
* Reps
* Weight
* Weight progression strategy

Compound exercises are supported.

Behavior:

* A compound exercise can contain multiple movements
* Each movement has its own movement ID and display name
* A person completes each movement before the workout switches to the other person
* Results store both the parent exercise ID and movement ID when applicable
* Movement IDs are used for movement-specific weights

Current compound exercise:

* Inner / Outer Thigh Machine
  * Inner Thigh
  * Outer Thigh

### Tandem Exercises

Tandem mode lets the current exercise be paired with a later exercise in the workout.

The user selects the tandem exercise on the "Who goes first?" screen. The selected exercise is moved next to the current exercise inside the active session's `reorderedWorkout`. This is session-only state and does not change the default workout plan or exercise database documents.

The tandem turn order alternates the exercise context:

* First person / primary exercise / set N
* Second person / tandem exercise / set N
* Second person / primary exercise / set N
* First person / tandem exercise / set N

Then the same pattern repeats for the next set.

For compound exercises, a person completes all movements for that exercise before moving to the next tandem turn. Movements are not interlaced between people.

### Weight Strategies

Per-user strategies supported:

* `"pyramid"`
* `"straight"`

Strategies are configurable per user.

### Temporary Weight Adjustments

Users can temporarily adjust weights during a workout.

Behavior:

* Weight modifications persist across later sets of the SAME exercise
* Adjustments are tracked separately per user
* Mike’s temporary adjustment does NOT affect Victoria
* Victoria’s temporary adjustment does NOT affect Mike
* Adjustments are temporary workout/session state only
* Permanent profile updates happen later via progression logic

### Temporary Rep Adjustments

Rep modifications:

* Persist across later sets of the same exercise
* Are tracked separately per user

---

## Exercise Reordering

Exercises can be postponed during a workout.

Current behavior:

* "Postpone exercise" moves the current exercise to the END of the remaining workout list
* Reordered exercises persist in Firestore and sync across devices
* New workout sessions snapshot the loaded workout plan into session state so the active session keeps the intended exercise order

---

## Warm-up System

Warm-up screen includes:

* Start Warmup button
* Complete Warmup button
* Live timer display

Implementation notes:

* Firestore stores timestamps only
* Timer ticks are calculated locally on each device
* No timer spam writes to Firestore

---

# Session Management

Session stored in Firestore.

Session fields include:

* `status: "active" | "completed" | "cancelled"`
* `createdAt`
* `updatedAt`
* `completedAt`
* `cancelledAt`

Behavior:

* App joins only active sessions
* Stale sessions are ignored
* Cancelled sessions return app to home state
* Completed sessions remain viewable later

---

# Results & Summary

Tracks all sets:

* completed
* skipped

Workout summary displays:

* Total sets
* Total weight lifted
* Detailed exercise breakdown

Detailed results are toggleable.

---

# History & Graph

Completed workouts saved to Firestore (`completedWorkouts`).

Each completed workout includes:

* completedAt
* totalSets
* totalWeightLifted
* results
* exerciseOutcomes

History graph:

* Line graph of total weight lifted over time
* Uses Recharts

---

# User Profiles And Baselines

Separate Firestore collections:

* `userProfiles`
* `currentBaselines`

`userProfiles` stores:

* User display/preference data
* Set progression strategy
* Baseline progression strategy

`currentBaselines` stores:

* Baseline weight per exercise or movement
* Success streak per exercise or movement

Behavior:

* Profiles and baselines load at startup
* Safe fallback defaults exist
* Baselines persist across sessions

---

# Progression Algorithm

Weights progress automatically after completed workouts.

Progression logic compares planned total work against actual total work for each exercise/movement:

* `actual / planned < 0.95`: decrease baseline 5%, rounded down to nearest 5 lb.
* `actual / planned > 1.05`: increase baseline 5%, rounded up to nearest 5 lb.
* Within 0.95-1.05: increment success streak.
* `fast`: increase after 2 successful workouts.
* `medium`: increase after 3 successful workouts.
* `slow`: increase after 4 successful workouts.
* `straight`: no automatic baseline changes.

Baseline updates are written back to `currentBaselines`.

---

# Deployment

* App is deployed online
* Works across phones and desktop browsers
* Multiple-device testing is active

---

# UI / UX Notes

## Mobile Support

* Mobile-friendly layout
* Responsive stepper controls
* Responsive button stacking
* Progress indicator dots

## Visual Reliability

Recent fixes include:

* Explicit text colors to avoid device/browser dark-mode rendering issues
* Explicit foreground/background colors for consistent visibility across devices

---

# Current Architecture

## Design Philosophy

* Deterministic logic
* Minimal local-only state
* Incremental evolution
* Keep the GUI thin where practical
* Put workout rules and sync decisions in testable modules

## Testable Logic

Core behavior is covered by direct automated tests:

* `src/workoutEngine.ts`
  * set/person/exercise advancement
  * compound movement order
  * tandem order
  * warmup, skip, postpone, completion
* `src/baselineProgression.ts`
  * multi-workout baseline progression
  * fast/medium/slow/straight strategies
  * immediate up/down adjustments
* `src/workoutSync.ts`
  * join/cancel/stale-session behavior
  * incoming active/completed/cancelled sessions
  * event session-id filtering

## State Model

* React state mirrors Firestore session state
* Firestore listeners drive UI updates
* Firestore is authoritative
* Local state is mostly presentation-only

## Data-Driven Workout Plan

Firestore stores the default workout plan.

Collections/documents:

* `workoutPlans/default`
  * `exerciseIds` controls workout order
* `exercises/{exerciseId}`
  * stores active state, type, display name, and lightweight metadata
* `userProfiles/{person}`
  * stores person-level preferences and progression strategies
* `currentBaselines/{person}`
  * stores exercise and movement baseline weights and success streaks

The app still keeps canonical local workout definitions as a fallback and to provide complete set/rep/default data for known exercises. Firestore can keep exercise documents minimal.

The seed script `scripts/seedWorkoutPlan.mjs` writes:

* `workoutPlans/default`
* `exercises/*`
* `userProfiles/*`
* `currentBaselines/*`

The current seeded default plan includes Inner / Outer Thigh Machine and Lat Pulldown.

---

# Constraints

* No authentication yet
* Single shared session model
* No multi-user accounts yet
* No major refactors unless necessary
* Keep changes incremental and safe
* Preserve existing Firestore sync logic

---

# Preferred Assistance Style

When responding:

* Do NOT rewrite the entire app
* Make minimal targeted changes
* Preserve working sync behavior
* Prefer deterministic solutions
* Avoid unnecessary abstractions
* Call out risks:
  * race conditions
  * stale listeners
  * sync timing issues
  * duplicate writes
  * mobile lifecycle edge cases

---

# Current Focus

Current development phase:

* Real-world device testing
* Reliability hardening
* UX refinement
* Firestore rule tightening
* Edge-case handling
* Synchronization bug fixes
* Multi-device consistency improvements
* Tandem usability testing

---
