# Android Host Wiring Checklist (React Native MVP)

This repository is a modular subsystem, not a full RN app. Use this checklist to host it in an Android-capable React Native project and produce an APK.

## 1) Create host app

```bash
npx react-native@latest init FridayHost
cd FridayHost
```

Copy this repo's `src/` folder into the host project (or install as a local package).

## 2) Install host dependencies

At minimum in host app:
- `react`
- `react-native`
- navigation stack package of your choice (optional but recommended)

## 3) Add environment variables

Create host `.env`:

```bash
FIREBASE_DATABASE_URL=https://the-cage-ff434-default-rtdb.firebaseio.com
FIREBASE_AUTH_TOKEN=<your_id_token>

# Optional automatic token exchange
FIREBASE_API_KEY=<firebase_web_api_key>
FIREBASE_AUTH_EMAIL=<firebase_auth_email>
FIREBASE_AUTH_PASSWORD=<firebase_auth_password>
```

## 4) Bootstrap LockModeService

Create `src/bootstrap/lockMode.ts` in host app:

```ts
import { LockModeService } from './services/lockMode';
import {
  createFirebaseRestAdapterFromEnv,
  createFirebaseRestAdapterFromEnvAsync,
} from './services/lockMode/firebaseRestAdapter';

export const createLockModeService = async (): Promise<LockModeService> => {
  const firebase = process.env.FIREBASE_AUTH_TOKEN
    ? createFirebaseRestAdapterFromEnv()
    : await createFirebaseRestAdapterFromEnvAsync();

  const service = new LockModeService(firebase, 'session-demo-1');
  service.listenRealtime();
  return service;
};
```

## 5) Minimal screen wiring

In host `App.tsx`, wire existing components:

- `LockModeScreen`
- `TaskScreen`
- `TimerDashboard`
- `ActivityLogScreen`

Map callbacks to service methods:
- `startModeByType(...)`
- `stopMode()`
- `assignTask(...)`, `completeTask(...)`, `resolveTask(...)`
- `extendTimerRandomly(...)`
- `getLogs()`

## 6) Verify Firebase paths

After running host app, confirm RTDB writes to:
- `sessions/{sessionId}/lockMode`
- `sessions/{sessionId}/commands`
- `sessions/{sessionId}/patterns`
- `sessions/{sessionId}/timers`
- `sessions/{sessionId}/tasks`
- `sessions/{sessionId}/logs`

## 7) Android build

```bash
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

APK output:
- `android/app/build/outputs/apk/release/app-release.apk`

## 8) Pre-release sanity

- Confirm emergency stop sets intensity to zero.
- Confirm max intensity cap is enforced.
- Confirm cooldown blocks repeated high-intensity remote bursts.
- Confirm timer extension updates in both local state and Firebase.
- Confirm task approval/denial triggers reward/punishment patterns.
