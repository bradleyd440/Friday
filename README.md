# Friday – Lock Mode Engine MVP

This repository currently contains:
- a legacy Python assistant entrypoint (`main.py`), and
- a TypeScript Lock Mode subsystem under `src/`.

The Lock Mode subsystem is modular and simulator-friendly. It provides:
- programmable pattern playback,
- automation/escalation helpers,
- realtime Firebase-like sync abstraction,
- task/timer/request workflows,
- safety controls (cap, cooldown, emergency stop, inactivity stop, receiver toggle), and
- UI components for lock mode controls, tasks, timer dashboard, and activity logs.

## Project structure

- `src/types/lockMode.ts`: domain types
- `src/state/lockModeStore.ts`: store and state updates
- `src/engines/patternEngine.ts`: pattern generation/playback
- `src/engines/automationEngine.ts`: escalation/check-in/task/timer helpers
- `src/engines/eventEngine.ts`: Firebase-like sync and in-memory adapter
- `src/services/lockMode/index.ts`: orchestration service
- `src/services/deviceService.ts`: `SimulatorDeviceService`
- `src/ui/*.tsx`: Lock Mode UI components
- `src/__tests__/lockMode.test.ts`: unit tests

## Fresh machine setup

### 1) Prerequisites
- Node.js 20+
- npm 10+
- Python 3.10+ (for legacy `main.py` validation)

### 2) Clone and install
```bash
git clone <your-repo-url>
cd Friday
npm install
```

### 3) Run checks
```bash
npm test
npm run build
python -m py_compile main.py
```

## Environment variables

Copy `.env.example` to `.env` and fill values as needed:
```bash
cp .env.example .env
```

For the current codebase:
- `OPENAI_API_KEY` and `WEATHER_API_KEY` are used by `main.py`.
- Firebase variables are documented for future real Firebase wiring to replace the in-memory adapter.

## Lock Mode integration notes

1. Instantiate `LockModeService` with a Firebase adapter (`InMemoryFirebase` for local).
2. Call `listenRealtime()` to start command/log/state listeners.
3. Use `startModeByType(...)` or `startMode(...)` to begin sessions.
4. Route all device intensity outputs through `SimulatorDeviceService` (already wired).


### Firebase production adapter (Option 1)

A production-ready REST adapter is now included at:
- `src/services/lockMode/firebaseRestAdapter.ts`

Usage example:
```ts
import { LockModeService } from './src/services/lockMode';
import { createFirebaseRestAdapterFromEnv } from './src/services/lockMode/firebaseRestAdapter';

const firebase = createFirebaseRestAdapterFromEnv();
const lockMode = new LockModeService(firebase, 'session-123');
const stopListening = lockMode.listenRealtime();
```

The adapter implements the same `FirebaseLike` interface as the in-memory adapter, so swapping environments is straightforward.

## Android APK build steps (explicit and realistic)

> Important: this repo does **not** currently include an Android app module (`android/`) or React Native runtime project files. APK generation is not possible until those are added.

To produce an APK, you must first integrate this subsystem into an Android-capable app shell:

1. Create or import a React Native (or native Android) project that hosts these screens/services.
2. Add Android tooling files (`android/`, Gradle wrapper, app module, signing configs).
3. Wire navigation/routes to:
   - `LockModeScreen`
   - `TaskScreen`
   - `TimerDashboard`
   - `ActivityLogScreen`
4. Replace `InMemoryFirebase` with real Firebase SDK wiring.
5. Build debug APK:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
6. Build release APK:
   ```bash
   ./gradlew assembleRelease
   ```
7. Output path (typical):
   - `android/app/build/outputs/apk/release/app-release.apk`

If signing is configured, distribute the release APK.

## Known environment caveat in this execution sandbox

If npm registry access is blocked (HTTP 403), `npm install` and `npm test` will fail in this environment. In that case, run the same commands in CI or on a machine with normal npm access.
