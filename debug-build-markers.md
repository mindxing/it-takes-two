# Debug Build Markers

This app normally relies on Vite hot reload during local development. When two browser windows are open, it can be hard to tell whether both windows are running the same code. A temporary visual marker can make prototype testing much less confusing.

## Lightweight Hot-Reload Marker

For day-to-day debugging, prefer a marker that lives in normal app code and CSS. This updates through Vite hot reload without restarting the dev server.

In `src/App.tsx`, add a temporary revision string near the other constants:

```tsx
const DEBUG_REV = "sync-r1";
```

Render it somewhere visible on every top-level screen:

```tsx
<div className="debug-build-marker">{DEBUG_REV}</div>
```

In `src/App.css`, add temporary marker styling and optionally change the app background:

```css
.app {
  background: #dbeafe;
}

.debug-build-marker {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 10;
  padding: 6px 8px;
  border-radius: 6px;
  background: #1e3a8a;
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}
```

When you make another prototype change, bump the string and color, for example `sync-r2` with a teal background. Both browser windows should update without restarting `npm run dev`.

## Vite Startup Build Label

If you need a label that includes the current git commit or server start time, define it in `vite.config.ts`. This only updates when the Vite dev server restarts.

```ts
import { execSync } from "node:child_process";

const gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
const buildTime = new Date().toLocaleString("en-US", {
  dateStyle: "short",
  timeStyle: "medium",
});

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_LABEL__: JSON.stringify(`prototype ${gitCommit} ${buildTime}`),
  },
});
```

Then declare and render `__BUILD_LABEL__` in `src/App.tsx`.

Use this when you specifically want to know which dev-server process is serving the app. For quick hot-reload confirmation, the lightweight marker is faster.

## Cleanup Before Merge

Before merging or deploying, remove:

- Temporary revision constants such as `DEBUG_REV`.
- Temporary marker elements in `src/App.tsx`.
- Temporary marker CSS and prototype background colors in `src/App.css`.
- Vite startup labels such as `__BUILD_LABEL__` unless they are intentionally becoming a product feature.
