# Basics

Quick commands for building, running, and deploying the app.

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

For sync/database redesign work, run against the `_tmp` Firestore collections:

```bash
npm run dev:tmp
```

The tmp script automatically uses collection names like `workoutSessions_tmp`,
`workoutPlans_tmp`, and `userProfiles_tmp`.

## Build

Create a production build in `dist` using the normal production collections:

```bash
npm run build
```

Create a production-style build using the `_tmp` Firestore collections:

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

Build and preview the `_tmp` version locally:

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

Deploy the `_tmp` sync-work version to a Firebase Hosting preview channel:

```bash
npm run deploy:tmp-preview
```

## Seed Workout Plan Data

Seed the normal production collections:

```bash
npm run seed:workout-plan
```

Seed the `_tmp` collections for sync/database redesign work:

```bash
npm run seed:workout-plan:tmp
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
