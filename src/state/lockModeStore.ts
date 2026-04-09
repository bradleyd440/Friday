import {
  AutomationRules,
  LockEvent,
  LockModeState,
  PatternDefinition,
  SafetyState,
  SessionTimer,
} from '../types/lockMode';

export type StoreListener = (state: LockModeState) => void;

const defaultSafety: SafetyState = {
  emergencyStop: false,
  receiverEnabled: true,
  maxIntensityCap: 90,
  highIntensityCooldownMs: 15_000,
  inactivityAutoStopMs: 60_000,
  lastHighIntensityAt: 0,
};

const defaultAutomation: AutomationRules = {
  escalateCurve: 'linear',
  escalateEveryMs: 60_000,
  escalateBy: 2,
  streakMilestonesHours: [12, 24, 48],
  checkInIntervalMs: 10 * 60_000,
  thresholdMin: 25,
  thresholdMax: 80,
};

const initialState: LockModeState = {
  activeMode: null,
  intensity: 0,
  patternQueue: [],
  timers: [],
  automationRules: defaultAutomation,
  lastEvent: null,
  safetyState: defaultSafety,
};

export class LockModeStore {
  private state: LockModeState = structuredClone(initialState);
  private listeners = new Set<StoreListener>();

  getState(): LockModeState {
    return structuredClone(this.state);
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  setMode(mode: LockModeState['activeMode']): void {
    this.patch({ activeMode: mode });
  }

  setIntensity(intensity: number): void {
    this.patch({ intensity });
  }

  setPatternQueue(patternQueue: PatternDefinition[]): void {
    this.patch({ patternQueue });
  }

  enqueuePattern(pattern: PatternDefinition): void {
    this.patch({ patternQueue: [...this.state.patternQueue, pattern] });
  }

  dequeuePattern(): PatternDefinition | undefined {
    const [next, ...rest] = this.state.patternQueue;
    this.patch({ patternQueue: rest });
    return next;
  }

  pushTimer(timer: SessionTimer): void {
    this.patch({ timers: [...this.state.timers.filter((t) => t.id !== timer.id), timer] });
  }

  removeTimer(timerId: string): void {
    this.patch({ timers: this.state.timers.filter((t) => t.id !== timerId) });
  }

  setAutomationRules(automationRules: AutomationRules): void {
    this.patch({ automationRules });
  }

  setSafetyState(safetyState: Partial<SafetyState>): void {
    this.patch({ safetyState: { ...this.state.safetyState, ...safetyState } });
  }

  setLastEvent(event: LockEvent): void {
    this.patch({ lastEvent: event });
  }

  reset(): void {
    this.state = structuredClone(initialState);
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  private patch(patch: Partial<LockModeState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.getState()));
  }
}
