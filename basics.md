# Basics

Quick commands for building, running, seeding, and deploying the app.

## Project Folder

From bash:

```bash
cd /d/projects/it-takes-two/it-takes-two
```

## Install Dependencies

Run this if `node_modules` is missing or dependencies changed:

```bash
npm install
```

## Run Locally

Start the Vite dev server using the normal production collections:

```bash
npm run dev
```

Open the local URL Vite prints, usually:

```text
http://localhost:5173
```

For sync/database redesign work, run against the `tmp_` Firestore collections:

```bash
npm run dev:tmp
```

The tmp script automatically uses collection names like `tmp_workoutSessions`,
`tmp_workoutPlans`, `tmp_userProfiles`, and `tmp_currentBaselines`.

## Build

Create a production build in `dist` using the normal production collections:

```bash
npm run build
```

Create a production-style build using the `tmp_` Firestore collections:

```bash
npm run build:tmp
```

## Preview the Production Build Locally

After building, serve the built `dist` folder locally:

```bash
npm run preview
```

Open the local URL Vite prints, usually:

```text
http://localhost:4173
```

Build and preview the `tmp_` version locally:

```bash
npm run preview:tmp
```

## Deploy to Firebase Hosting

This project is configured for Firebase Hosting with:

```text
Project: it-takes-two-5794c
Public folder: dist
```

Deploy the normal production app:

```bash
npm run deploy
```

Deploy Firestore rules after data path changes:

```bash
npm run deploy:rules
```

Deploy the `tmp_` sync-work version to a Firebase Hosting preview channel:

```bash
npm run deploy:tmp-preview
```

## Seed Workout Plan Data

Seed the normal production collections:

```bash
npm run seed:workout-plan
```

Seed the `tmp_` collections for sync/database redesign work:

```bash
npm run seed:workout-plan:tmp
```

Reset runtime workout data and seed production from a pristine setup:

```bash
npm run seed:workout-plan:reset
```

Reset runtime workout data and seed the `tmp_` collections:

```bash
npm run seed:workout-plan:tmp:reset
```

The seed scripts write group setup data under `workoutGroups/mike-victoria`,
and write current baselines into top-level `currentBaselines` docs with
`groupId`. The reset scripts delete top-level `workoutSessions` and
`completedWorkouts` for that group, then rewrite the group metadata, workout
plan, exercises, user profiles, and current baselines.

## Prepare Default Workout Group Data

Phase A of the groups work added a non-destructive migration script. It copies
older global one-couple setup collections into `workoutGroups/mike-victoria`
and tags top-level state collections with `groupId`. You usually do not need
this after using the current seed scripts.

Preview the production migration:

```bash
npm run migrate:default-group:dry-run
```

Run the production migration:

```bash
npm run migrate:default-group
```

Preview the `tmp_` migration:

```bash
npm run migrate:default-group:tmp:dry-run
```

Run the `tmp_` migration:

```bash
npm run migrate:default-group:tmp
```

The migration writes/copies:

```text
workoutGroups/{groupId}
workoutGroups/{groupId}/workoutPlans/*
workoutGroups/{groupId}/exercises/*
workoutGroups/{groupId}/userProfiles/*
currentBaselines/* with groupId
workoutSessions/* with groupId and nested events
completedWorkouts/* with groupId
```

After the groups runtime switch, the app reads setup data from the default group
and runtime/history data from top-level collections:

```text
workoutGroups/mike-victoria/...
workoutSessions/mike-victoria_demo
currentBaselines/mike-victoria_*
completedWorkouts/* where groupId == "mike-victoria"
```

You can point a build at a different group id later with:

```bash
VITE_WORKOUT_GROUP_ID=some-group-id npm run dev
```

Until Firebase Auth exists, local development assumes the user is Mike. To test
the temporary Victoria path:

```bash
VITE_ASSUMED_USER_ID=Victoria npm run dev
```

If Firebase asks you to sign in:

```bash
firebase login
```

## Optional: Firebase Hosting Emulator

Build first:

```bash
npm run build
```

Then serve Firebase Hosting locally:

```bash
firebase emulators:start --only hosting
```

Open:

```text
http://localhost:5000
```

## Useful Checks

Check the current Git branch:

```bash
git status --short --branch
```

Run lint:

```bash
npm run lint
```
