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

---

## Workout Flow

### General Flow

* Start / Join workout (single-button logic)
* Warm-up → exercises → completion
* Alternating sets between two people
* Auto-skip support for absent participant
* Cancel and complete sync across devices

### Exercise Flow

Each exercise includes:

* Multiple sets
* Reps
* Weight
* Weight progression strategy

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

# User Profiles

Separate Firestore collection: `userProfiles`

Stores:

* Base weight per exercise
* Per-user exercise defaults

Behavior:

* Profiles load at startup
* Safe fallback defaults exist
* Profiles persist across sessions

---

# Progression Algorithm

Weights progress automatically after completed workouts.

Progression logic considers:

* completed vs skipped sets
* reps achieved vs expected
* workout history

Profile updates are written back to Firestore.

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
* Avoid major refactors

## State Model

* React state mirrors Firestore session state
* Firestore listeners drive UI updates
* Firestore is authoritative
* Local state is mostly presentation-only

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

---
