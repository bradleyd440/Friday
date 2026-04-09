import { FirebaseLike } from '../../engines/eventEngine';

interface FirebaseRestAdapterOptions {
  databaseUrl: string;
  authToken?: string;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

const normalizePath = (path: string): string => path.replace(/^\/+/, '').replace(/\/+$/, '');

export class FirebaseRestAdapter implements FirebaseLike {
  private readonly databaseUrl: string;
  private readonly authToken?: string;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FirebaseRestAdapterOptions) {
    this.databaseUrl = options.databaseUrl.replace(/\/+$/, '');
    this.authToken = options.authToken;
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async set(path: string, value: unknown): Promise<void> {
    const res = await this.fetchImpl(this.pathToUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });

    if (!res.ok) {
      throw new Error(`Firebase set failed (${res.status}) for path ${path}`);
    }
  }

  async push(path: string, value: unknown): Promise<string> {
    const res = await this.fetchImpl(this.pathToUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });

    if (!res.ok) {
      throw new Error(`Firebase push failed (${res.status}) for path ${path}`);
    }

    const payload = (await res.json()) as { name?: string };
    if (!payload.name) {
      throw new Error(`Firebase push response missing generated key for path ${path}`);
    }

    return payload.name;
  }

  onValue(path: string, listener: (value: unknown) => void): () => void {
    let stopped = false;
    let lastSerialized = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async (): Promise<void> => {
      if (stopped) return;

      try {
        const res = await this.fetchImpl(this.pathToUrl(path));
        if (!res.ok) {
          throw new Error(`Firebase read failed (${res.status}) for path ${path}`);
        }

        const payload = await res.json();
        const serialized = JSON.stringify(payload);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          listener(payload);
        }
      } catch {
        // swallow polling errors; next poll may recover
      } finally {
        if (!stopped) {
          timer = setTimeout(() => {
            void poll();
          }, this.pollIntervalMs);
        }
      }
    };

    void poll();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  private pathToUrl(path: string): string {
    const normalized = normalizePath(path);
    const auth = this.authToken ? `?auth=${encodeURIComponent(this.authToken)}` : '';
    return `${this.databaseUrl}/${normalized}.json${auth}`;
  }
}

export const createFirebaseRestAdapterFromEnv = (): FirebaseRestAdapter => {
  const databaseUrl = process.env.FIREBASE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing FIREBASE_DATABASE_URL for FirebaseRestAdapter');
  }

  return new FirebaseRestAdapter({
    databaseUrl,
    authToken: process.env.FIREBASE_AUTH_TOKEN,
  });
};
