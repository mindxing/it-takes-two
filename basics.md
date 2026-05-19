# Basics

Quick commands for building, running, and deploying the app.

## Project Folder

From PowerShell:

```powershell
cd D:\projects\it-takes-two\it-takes-two
```

## Install Dependencies

Run this if `node_modules` is missing or dependencies changed:

```powershell
npm install
```

## Run Locally

Start the Vite dev server:

```powershell
npm run dev
```

Open the local URL Vite prints, usually:

```text
http://localhost:5173
```

## Build

Create a production build in `dist`:

```powershell
npm run build
```

## Preview the Production Build Locally

After building, serve the built `dist` folder locally:

```powershell
npm run preview
```

Open the local URL Vite prints, usually:

```text
http://localhost:4173
```

## Deploy to Firebase Hosting

This project is configured for Firebase Hosting with:

```text
Project: it-takes-two-5794c
Public folder: dist
```

Build first:

```powershell
npm run build
```

Then deploy the built app:

```powershell
npx -y firebase-tools@latest deploy --only hosting
```

If Firebase asks you to sign in:

```powershell
npx -y firebase-tools@latest login
```

## Optional: Firebase Hosting Emulator

Build first:

```powershell
npm run build
```

Then serve Firebase Hosting locally:

```powershell
npx -y firebase-tools@latest emulators:start --only hosting
```

Open:

```text
http://localhost:5000
```

## Useful Checks

Check the current Git branch:

```powershell
git status --short --branch
```

Run lint:

```powershell
npm run lint
```
