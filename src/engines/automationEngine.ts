import { curve, PatternEngine } from './patternEngine';
import { AutomationRules, LockEvent, LockTask, PatternDefinition, SessionTimer } from '../types/lockMode';

export class AutomationEngine {
  constructor(private readonly patternEngine: PatternEngine) {}

  getEscalatedIntensity(base: number, elapsedMs: number, rules: AutomationRules): number {
    const ticks = Math.max(0, Math.floor(elapsedMs / rules.escalateEveryMs));
    const progressed = curve(rules.escalateCurve, ticks / 100);
    return Math.min(100, base + progressed * rules.escalateBy * ticks);
  }

  computeStreakMilestones(startAt: number, now: number, milestonesHours: number[]): number[] {
    const elapsedHours = (now - startAt) / 3_600_000;
    return milestonesHours.filter((h) => elapsedHours >= h);
  }

  evaluateCheckIn(lastCheckInAt: number, now: number, intervalMs: number): boolean {
    return now - lastCheckInAt > intervalMs;
  }

  calculateRemainingMs(timer: SessionTimer, now: number): number {
    return Math.max(0, timer.endAt - now);
  }

  handleBehaviorEvent(
    behavior: 'positive' | 'negative',
    positivePattern: PatternDefinition,
    negativePattern: PatternDefinition,
  ): PatternDefinition {
    return behavior === 'negative' ? negativePattern : positivePattern;
  }

  runPattern(pattern: PatternDefinition): void {
    this.patternEngine.start(pattern);
  }

  spinWheelExtension(seed: number): number {
    const hour = 3_600_000;
    const value = ((seed * 9301 + 49297) % 233280) / 233280;
    return Math.max(hour, Math.floor(value * 24 * hour));
  }

  resolveTaskOutcome(task: LockTask, now = Date.now()): 'reward' | 'punishment' | 'none' {
    if (task.status === 'approved') return 'reward';
    if (task.status === 'denied' || task.status === 'timedOut') return 'punishment';
    if (now > task.deadline && task.status !== 'approved') return 'punishment';
    return 'none';
  }

  buildEvent(type: LockEvent['type'], message: string, metadata?: Record<string, unknown>): LockEvent {
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      metadata,
      timestamp: Date.now(),
    };
  }
}
