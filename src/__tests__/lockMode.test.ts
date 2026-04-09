import { describe, expect, it } from 'vitest';
import { AutomationEngine } from '../engines/automationEngine';
import { EventEngine, InMemoryFirebase } from '../engines/eventEngine';
import { createModePattern, PatternEngine } from '../engines/patternEngine';
import { LockModeService } from '../services/lockMode';
import { SimulatorDeviceService } from '../services/deviceService';
import { PatternDefinition } from '../types/lockMode';

const basePattern: PatternDefinition = {
  id: 'p1',
  type: 'random',
  intensity: 60,
  durationMs: 1000,
  intervalMs: 100,
  repetition: 2,
  randomnessFactor: 0.1,
  rampUpCurve: 'linear',
  rampDownCurve: 'linear',
  minIntensity: 20,
  maxIntensity: 70,
  seed: 42,
};

describe('pattern generation logic', () => {
  it('generates deterministic random steps for same seed', () => {
    const engine = new PatternEngine(new SimulatorDeviceService());
    const a = engine.generateSteps(basePattern);
    const b = engine.generateSteps(basePattern);
    expect(a).toEqual(b);
  });

  it('creates punishment mode with aggressive defaults', () => {
    const pattern = createModePattern('punishment', {
      intensity: 30,
      durationMs: 500,
      intervalMs: 900,
      randomnessFactor: 0,
    });

    expect(pattern.intensity).toBeGreaterThanOrEqual(70);
    expect(pattern.intervalMs).toBeLessThanOrEqual(300);
  });
});

describe('escalation curves', () => {
  it('exponential escalates less than linear early on', () => {
    const auto = new AutomationEngine(new PatternEngine(new SimulatorDeviceService()));
    const linear = auto.getEscalatedIntensity(20, 10 * 60_000, {
      escalateCurve: 'linear',
      escalateEveryMs: 60_000,
      escalateBy: 2,
      streakMilestonesHours: [12],
      checkInIntervalMs: 1000,
      thresholdMin: 20,
      thresholdMax: 90,
    });
    const expo = auto.getEscalatedIntensity(20, 10 * 60_000, {
      escalateCurve: 'exponential',
      escalateEveryMs: 60_000,
      escalateBy: 2,
      streakMilestonesHours: [12],
      checkInIntervalMs: 1000,
      thresholdMin: 20,
      thresholdMax: 90,
    });
    expect(expo).toBeLessThan(linear);
  });
});

describe('random mode reproducibility', () => {
  it('supports reproducible spin-wheel extension by seed', () => {
    const auto = new AutomationEngine(new PatternEngine(new SimulatorDeviceService()));
    expect(auto.spinWheelExtension(123)).toEqual(auto.spinWheelExtension(123));
  });
});

describe('task flow', () => {
  it('returns punishment on timeout', () => {
    const auto = new AutomationEngine(new PatternEngine(new SimulatorDeviceService()));
    const task = {
      id: 't1',
      title: 'Check In',
      description: 'Do it now',
      deadline: Date.now() - 1,
      rewardPattern: basePattern,
      punishmentPattern: { ...basePattern, id: 'punish', type: 'punishment', intensity: 90 },
      status: 'pending' as const,
    };
    expect(auto.resolveTaskOutcome(task, Date.now())).toBe('punishment');
  });
});

describe('timer calculations', () => {
  it('extends timer in 1-24h range', async () => {
    const service = new LockModeService(new InMemoryFirebase(), 's1');
    await service.setCountdownTimer({
      id: 'timer-1',
      label: 'session',
      startAt: Date.now(),
      endAt: Date.now() + 1000,
      controllerOnly: true,
    }, 'controller');

    const extension = await service.extendTimerRandomly('timer-1', 42);
    expect(extension).toBeGreaterThanOrEqual(3_600_000);
    expect(extension).toBeLessThanOrEqual(24 * 3_600_000);
  });
});

describe('firebase path consistency', () => {
  it('notifies parent path listeners when writing child path', async () => {
    const mem = new InMemoryFirebase();
    const events: number[] = [];
    const ee = new EventEngine(mem, 'abc');
    ee.onTimers(() => {
      events.push(1);
    });

    await ee.saveTimer({ id: 't', label: 'l', startAt: 1, endAt: 2, controllerOnly: true });
    expect(events.length).toBe(1);
  });
});

describe('safety flow', () => {
  it('blocks mode start when intensity exceeds cap', async () => {
    const service = new LockModeService(new InMemoryFirebase(), 's2');
    service.store.setSafetyState({ maxIntensityCap: 20 });

    await service.startMode({ ...basePattern, type: 'steady', intensity: 60 });
    expect(service.store.getState().activeMode).toBeNull();
  });
});
