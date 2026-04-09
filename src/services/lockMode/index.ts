import { AutomationEngine } from '../../engines/automationEngine';
import { EventEngine, FirebaseLike } from '../../engines/eventEngine';
import { createModePattern, PatternEngine } from '../../engines/patternEngine';
import { LockModeStore } from '../../state/lockModeStore';
import {
  LockEvent,
  LockModeCommand,
  LockModeType,
  LockTask,
  ModeConfig,
  PatternDefinition,
  SessionTimer,
} from '../../types/lockMode';
import { SimulatorDeviceService } from '../deviceService';

export class LockModeService {
  readonly store = new LockModeStore();
  readonly deviceService = new SimulatorDeviceService();
  readonly patternEngine = new PatternEngine(this.deviceService);
  readonly automationEngine = new AutomationEngine(this.patternEngine);
  readonly eventEngine: EventEngine;

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private checkInTimer: ReturnType<typeof setInterval> | null = null;
  private sessionStartedAt = Date.now();
  private lastCheckInAt = Date.now();
  private logs: LockEvent[] = [];

  constructor(firebase: FirebaseLike, private readonly sessionId: string) {
    this.eventEngine = new EventEngine(firebase, sessionId);
  }

  async startModeByType(mode: LockModeType, cfg: ModeConfig): Promise<void> {
    const pattern = createModePattern(mode, cfg);
    await this.startMode(pattern);
  }

  async startMode(modePattern: PatternDefinition): Promise<void> {
    await this.executeSafely(async () => {
      if (!this.checkSafetyGate(modePattern.intensity)) return;
      this.sessionStartedAt = Date.now();
      this.store.setMode(modePattern.type);
      this.store.setPatternQueue([modePattern]);
      await this.eventEngine.savePattern(modePattern);
      await this.logAndSync('pattern', `Starting ${modePattern.type}`, { modePattern });

      this.startCheckInLoop(this.defaultPunishmentPattern());
      this.patternEngine.start(modePattern, (step) => {
        this.store.setIntensity(step.intensity);
        this.touchInactivity();
        void this.syncRealtimeState();
      });
    }, 'Failed to start mode');
  }

  async stopMode(): Promise<void> {
    await this.executeSafely(async () => {
      this.patternEngine.stop();
      this.stopCheckInLoop();
      await this.deviceService.setIntensity(0);
      this.store.setIntensity(0);
      this.store.setMode(null);
      await this.logAndSync('command', 'Mode stopped');
    }, 'Failed to stop mode');
  }

  async emergencyStop(): Promise<void> {
    await this.executeSafely(async () => {
      this.store.setSafetyState({ emergencyStop: true });
      await this.stopMode();
      await this.logAndSync('safety', 'Emergency stop engaged');
    }, 'Failed to execute emergency stop');
  }

  async receiverToggle(enabled: boolean): Promise<void> {
    await this.executeSafely(async () => {
      this.store.setSafetyState({ receiverEnabled: enabled });
      if (!enabled) await this.stopMode();
      await this.syncRealtimeState();
    }, 'Failed to toggle receiver');
  }

  async remoteBurst(pattern: PatternDefinition): Promise<void> {
    await this.executeSafely(async () => {
      const safety = this.store.getState().safetyState;
      const now = Date.now();
      if (pattern.intensity >= 80 && now - safety.lastHighIntensityAt < safety.highIntensityCooldownMs) {
        await this.logAndSync('safety', 'Remote burst denied due to cooldown');
        return;
      }

      this.store.setSafetyState({ lastHighIntensityAt: pattern.intensity >= 80 ? now : safety.lastHighIntensityAt });
      await this.logAndSync('command', 'Remote burst executed', { pattern });
      this.patternEngine.start({ ...pattern, repetition: 1 });
    }, 'Failed remote burst');
  }

  async submitRequest(message: string): Promise<void> {
    await this.executeSafely(async () => {
      await this.eventEngine.publishCommand({
        type: 'request',
        payload: { message },
        issuedBy: 'receiver',
        issuedAt: Date.now(),
      });
      await this.logAndSync('request', 'Receiver request submitted', { message });
    }, 'Failed request submission');
  }

  async handleRequest(approved: boolean, reward: PatternDefinition, punishment: PatternDefinition): Promise<void> {
    await this.executeSafely(async () => {
      const pattern = approved ? reward : punishment;
      await this.logAndSync('approval', approved ? 'Request approved' : 'Request denied', { pattern });
      this.patternEngine.start(pattern);
    }, 'Failed request handling');
  }

  async assignTask(task: LockTask): Promise<void> {
    await this.executeSafely(async () => {
      await this.eventEngine.saveTask(task);
      await this.logAndSync('task', 'Task assigned', { taskId: task.id });
    }, 'Failed task assignment');
  }

  async completeTask(task: LockTask): Promise<void> {
    await this.executeSafely(async () => {
      const updated = { ...task, status: 'completedByReceiver' as const };
      await this.eventEngine.saveTask(updated);
      await this.logAndSync('task', 'Task marked complete', { taskId: task.id });
    }, 'Failed task completion');
  }

  async resolveTask(task: LockTask): Promise<void> {
    await this.executeSafely(async () => {
      const outcome = this.automationEngine.resolveTaskOutcome(task);
      if (outcome === 'reward') this.patternEngine.start(task.rewardPattern);
      if (outcome === 'punishment') this.patternEngine.start(task.punishmentPattern);
      await this.logAndSync('task', 'Task resolved', { taskId: task.id, outcome });
    }, 'Failed task resolution');
  }

  async setCountdownTimer(timer: SessionTimer, by: 'controller' | 'receiver'): Promise<void> {
    await this.executeSafely(async () => {
      if (by !== 'controller') return;
      this.store.pushTimer(timer);
      await this.eventEngine.saveTimer(timer);
      await this.logAndSync('timer', 'Timer updated', { timer });
    }, 'Failed timer update');
  }

  async extendTimerRandomly(timerId: string, seed: number): Promise<number> {
    return this.executeSafely(async () => {
      const extension = this.automationEngine.spinWheelExtension(seed);
      const timer = this.store.getState().timers.find((t) => t.id === timerId);
      if (!timer) return 0;

      timer.endAt += extension;
      await this.setCountdownTimer(timer, 'controller');
      await this.logAndSync('timer', 'Random extension applied', { timerId, extension });
      return extension;
    }, 'Failed timer extension', 0);
  }

  schedulePattern(pattern: PatternDefinition, executeAt: number): () => void {
    const ms = Math.max(0, executeAt - Date.now());
    const timeout = setTimeout(() => {
      this.patternEngine.start(pattern);
      void this.logAndSync('pattern', 'Scheduled wake-up pattern fired', { patternId: pattern.id });
    }, ms);
    return () => clearTimeout(timeout);
  }

  scheduleSurpriseAlert(pattern: PatternDefinition, minDelayMs = 10_000, maxDelayMs = 30_000, seed = Date.now()): () => void {
    const random = ((seed * 1103515245 + 12345) % 2_147_483_648) / 2_147_483_648;
    const delay = Math.floor(minDelayMs + random * (maxDelayMs - minDelayMs));
    return this.schedulePattern(pattern, Date.now() + delay);
  }

  async trackBehavior(behavior: 'positive' | 'negative'): Promise<void> {
    await this.executeSafely(async () => {
      const state = this.store.getState();
      if (behavior === 'negative') {
        await this.remoteBurst(this.defaultPunishmentPattern());
      } else {
        const reduced = Math.max(0, state.intensity - 10);
        await this.deviceService.setIntensity(reduced);
        this.store.setIntensity(reduced);
      }

      await this.logAndSync('behavior', 'Behavior tracked', { behavior });
    }, 'Failed behavior tracking');
  }

  applyEscalation(base: number, now = Date.now()): number {
    const { automationRules } = this.store.getState();
    return this.automationEngine.getEscalatedIntensity(base, now - this.sessionStartedAt, automationRules);
  }

  computeStreakMilestones(now = Date.now()): number[] {
    const { streakMilestonesHours } = this.store.getState().automationRules;
    return this.automationEngine.computeStreakMilestones(this.sessionStartedAt, now, streakMilestonesHours);
  }

  checkInNow(): void {
    this.lastCheckInAt = Date.now();
  }

  getLogs(): LockEvent[] {
    return [...this.logs].sort((a, b) => a.timestamp - b.timestamp);
  }

  handleIncomingCommand(command: LockModeCommand): Promise<void> {
    if (command.type === 'emergencyStop') return this.emergencyStop();
    if (command.type === 'stopMode') return this.stopMode();
    if (command.type === 'behavior') {
      return this.trackBehavior((command.payload?.behavior as 'positive' | 'negative') ?? 'negative');
    }
    return Promise.resolve();
  }

  listenRealtime(): () => void {
    const unsubs = [
      this.eventEngine.onCommand((command) => void this.handleIncomingCommand(command)),
      this.eventEngine.onLogs((event) => {
        this.logs.push(event);
        this.store.setLastEvent(event);
      }),
      this.eventEngine.onState((state) => {
        if (state.activeMode !== this.store.getState().activeMode) {
          this.store.setMode(state.activeMode);
        }
      }),
      this.store.subscribe(() => void this.syncRealtimeState()),
    ];

    return () => unsubs.forEach((u) => u());
  }

  private async syncRealtimeState(): Promise<void> {
    await this.eventEngine.syncState(this.store.getState());
  }

  private startCheckInLoop(missedCheckInPattern: PatternDefinition): void {
    this.stopCheckInLoop();
    const interval = this.store.getState().automationRules.checkInIntervalMs;
    this.lastCheckInAt = Date.now();

    this.checkInTimer = setInterval(() => {
      const missed = this.automationEngine.evaluateCheckIn(this.lastCheckInAt, Date.now(), interval);
      if (missed) {
        this.patternEngine.start(missedCheckInPattern);
        void this.logAndSync('safety', 'Missed check-in triggered auto pattern');
        this.lastCheckInAt = Date.now();
      }
    }, interval);
  }

  private stopCheckInLoop(): void {
    if (this.checkInTimer) {
      clearInterval(this.checkInTimer);
      this.checkInTimer = null;
    }
  }

  private async logAndSync(type: LockEvent['type'], message: string, metadata?: Record<string, unknown>): Promise<void> {
    const event = this.automationEngine.buildEvent(type, message, metadata);
    this.logs.push(event);
    this.store.setLastEvent(event);
    await this.eventEngine.log(event);
    await this.syncRealtimeState();
  }

  private checkSafetyGate(nextIntensity: number): boolean {
    const safety = this.store.getState().safetyState;
    if (safety.emergencyStop || !safety.receiverEnabled) return false;
    return nextIntensity <= safety.maxIntensityCap;
  }

  private touchInactivity(): void {
    const { inactivityAutoStopMs } = this.store.getState().safetyState;
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => void this.stopMode(), inactivityAutoStopMs);
  }

  private defaultPunishmentPattern(): PatternDefinition {
    return createModePattern('punishment', {
      intensity: 90,
      durationMs: 2_000,
      intervalMs: 250,
      randomnessFactor: 0.2,
      repetition: 2,
    });
  }

  private async executeSafely<T>(fn: () => Promise<T>, errorMessage: string, fallback?: T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const payload = error instanceof Error ? { name: error.name, message: error.message } : { error };
      const event = this.automationEngine.buildEvent('safety', errorMessage, payload as Record<string, unknown>);
      this.logs.push(event);
      this.store.setLastEvent(event);
      await this.eventEngine.log(event);
      if (fallback !== undefined) return fallback;
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }
}
