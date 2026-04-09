import {
  LockEvent,
  LockModeCommand,
  LockModeState,
  LockTask,
  PatternDefinition,
  SessionTimer,
} from '../types/lockMode';

export interface FirebaseLike {
  set(path: string, value: unknown): Promise<void>;
  push(path: string, value: unknown): Promise<string>;
  onValue(path: string, listener: (value: unknown) => void): () => void;
}

const parentPaths = (path: string): string[] => {
  const chunks = path.split('/');
  const paths = [path];
  for (let i = chunks.length - 1; i > 0; i -= 1) {
    paths.push(chunks.slice(0, i).join('/'));
  }
  return paths;
};

export class InMemoryFirebase implements FirebaseLike {
  private store = new Map<string, unknown>();
  private listeners = new Map<string, Set<(value: unknown) => void>>();

  async set(path: string, value: unknown): Promise<void> {
    this.store.set(path, value);
    this.emit(path, value);
  }

  async push(path: string, value: unknown): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextPath = `${path}/${id}`;
    this.store.set(nextPath, value);
    this.emit(nextPath, value);
    return id;
  }

  onValue(path: string, listener: (value: unknown) => void): () => void {
    if (!this.listeners.has(path)) this.listeners.set(path, new Set());
    this.listeners.get(path)?.add(listener);
    return () => this.listeners.get(path)?.delete(listener);
  }

  private emit(path: string, value: unknown): void {
    for (const candidate of parentPaths(path)) {
      this.listeners.get(candidate)?.forEach((listener) => listener(value));
    }
  }
}

export class EventEngine {
  constructor(private readonly firebase: FirebaseLike, private readonly sessionId: string) {}

  async syncState(state: LockModeState): Promise<void> {
    await this.firebase.set(`sessions/${this.sessionId}/lockMode`, state);
  }

  async log(event: LockEvent): Promise<void> {
    await this.firebase.push(`sessions/${this.sessionId}/logs`, event);
  }

  async publishCommand(command: LockModeCommand): Promise<void> {
    await this.firebase.push(`sessions/${this.sessionId}/commands`, command);
  }

  async saveTask(task: LockTask): Promise<void> {
    await this.firebase.push(`sessions/${this.sessionId}/tasks`, task);
  }

  async savePattern(pattern: PatternDefinition): Promise<void> {
    await this.firebase.push(`sessions/${this.sessionId}/patterns`, pattern);
  }

  async saveTimer(timer: SessionTimer): Promise<void> {
    await this.firebase.set(`sessions/${this.sessionId}/timers/${timer.id}`, timer);
  }

  onState(listener: (state: LockModeState) => void): () => void {
    return this.firebase.onValue(`sessions/${this.sessionId}/lockMode`, (state) => listener(state as LockModeState));
  }

  onCommand(listener: (command: LockModeCommand) => void): () => void {
    return this.firebase.onValue(`sessions/${this.sessionId}/commands`, (command) => listener(command as LockModeCommand));
  }

  onTasks(listener: (task: LockTask) => void): () => void {
    return this.firebase.onValue(`sessions/${this.sessionId}/tasks`, (task) => listener(task as LockTask));
  }

  onTimers(listener: (timer: SessionTimer) => void): () => void {
    return this.firebase.onValue(`sessions/${this.sessionId}/timers`, (timer) => listener(timer as SessionTimer));
  }

  onPatterns(listener: (pattern: PatternDefinition) => void): () => void {
    return this.firebase.onValue(`sessions/${this.sessionId}/patterns`, (pattern) => listener(pattern as PatternDefinition));
  }

  onLogs(listener: (event: LockEvent) => void): () => void {
    return this.firebase.onValue(`sessions/${this.sessionId}/logs`, (event) => listener(event as LockEvent));
  }
}
