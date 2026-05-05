I’m building a React + Vite + TypeScript workout app called “It Takes Two” with Firebase Firestore. I'd like to give you an overview of the app so that you understand it. Once you do, then I'll ask you some questions.

## App Overview

This is a 2-person synchronized workout app designed for couples working out together.

Core concept:

* Two people (Mike and Victoria) perform a shared workout
* Both devices stay in sync in real time via Firestore
* One shared session drives both UIs

## Current Features (Working)

### Real-time Sync

* Firestore is the source of truth
* All workout actions (start, sets, reps, weight, progression, cancel, complete) sync across devices using onSnapshot

### Workout Flow

* Start / Join workout (single-button logic)
* Warm-up → exercises → sets → completion
* Alternating sets between two people
* Auto-skip for absent participant
* Cancel and complete sync across devices

### Session Management

* Session stored in Firestore
* Fields include:

  * status: "active" | "completed" | "cancelled"
  * createdAt, updatedAt, completedAt, cancelledAt
* App joins only active sessions
* Stale sessions are ignored

### Results & Summary

* Tracks all sets (completed/skipped)
* Displays:

  * Total sets
  * Total weight lifted
* Detailed breakdown available via toggle

### History & Graph

* Completed workouts saved to Firestore (`completedWorkouts`)
* Each record includes:

  * completedAt
  * totalSets
  * totalWeightLifted
* Line graph displays total weight over time

### User Profiles

* Separate Firestore collection (`userProfiles`)
* Stores base weights per person per exercise
* App loads profiles at startup
* Default weights fall back safely if missing

### Progression Algorithm

* Updates weights after each completed workout
* Based on:

  * completed vs skipped sets
  * reps achieved vs expected
* Writes updated weights back to Firestore

### Deployment

* App is deployed and accessible online
* Works across multiple devices (phones + desktop)

## Current Architecture

* React state mirrors Firestore session
* Firestore drives UI updates via listeners
* Minimal local-only state
* Deterministic logic (no randomness except test helpers)

## Constraints

* No authentication (single shared session model)
* No multi-user accounts yet
* No major refactors unless necessary
* Keep changes incremental and safe

## What I want help with

When responding:

* Do not rewrite the entire app
* Make minimal, targeted changes
* Preserve existing Firestore sync logic
* Prefer simple, deterministic solutions
* Call out risks (race conditions, sync issues)

## Current Focus

I am now in the phase of:

* Testing with real users/devices
* Improving reliability and UX
* Tightening Firestore rules and behavior
* Fixing edge cases and race conditions

---
