import { DeviceService, LockModeType, ModeConfig, PatternDefinition, PatternStep } from '../types/lockMode';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export const curve = (kind: 'linear' | 'exponential', progress: number): number => {
  const p = clamp(progress, 0, 1);
  return kind === 'exponential' ? p ** 2 : p;
};

export const createModePattern = (mode: LockModeType, cfg: ModeConfig): PatternDefinition => {
  const base: PatternDefinition = {
    id: `pattern-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: mode,
    intensity: cfg.intensity,
    durationMs: cfg.durationMs,
    intervalMs: cfg.intervalMs,
    repetition: cfg.repetition ?? 1,
    randomnessFactor: cfg.randomnessFactor,
    rampUpCurve: 'linear',
    rampDownCurve: 'linear',
    seed: cfg.seed,
  };

  if (mode === 'tease') return { ...base, intensity: clamp(cfg.intensity, 10, 55), randomnessFactor: Math.max(cfg.randomnessFactor, 0.25) };
  if (mode === 'punishment') return { ...base, intensity: clamp(cfg.intensity, 70, 100), intervalMs: Math.min(cfg.intervalMs, 300), repetition: Math.max(2, cfg.repetition ?? 2) };
  if (mode === 'timed') return { ...base, type: 'steady', repetition: Number.MAX_SAFE_INTEGER };
  if (mode === 'random') return { ...base, type: 'random', minIntensity: 5, maxIntensity: clamp(cfg.intensity, 20, 95), seed: cfg.seed ?? 1337 };
  if (mode === 'edging') return { ...base, type: 'wave', minIntensity: 10, maxIntensity: clamp(cfg.intensity, 40, 95), rampUpCurve: 'exponential' };

  return base;
};

export class PatternEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private steps: PatternStep[] = [];

  constructor(private readonly deviceService: DeviceService) {}

  generateSteps(pattern: PatternDefinition): PatternStep[] {
    const random = seededRandom(pattern.seed ?? Date.now());
    const steps: PatternStep[] = [];
    const repetitions = Math.max(1, pattern.repetition);

    for (let rep = 0; rep < repetitions; rep += 1) {
      for (let t = 0; t <= pattern.durationMs; t += Math.max(20, pattern.intervalMs)) {
        const progress = t / pattern.durationMs;
        const baseCurve = progress <= 0.5
          ? curve(pattern.rampUpCurve, progress * 2)
          : 1 - curve(pattern.rampDownCurve, (progress - 0.5) * 2);

        let intensity = pattern.intensity * baseCurve;
        if (pattern.type === 'steady') intensity = pattern.intensity;
        if (pattern.type === 'pulse') intensity = (Math.floor(t / pattern.intervalMs) % 2 === 0 ? pattern.intensity : 0);
        if (pattern.type === 'wave') intensity = (pattern.minIntensity ?? 0) + (pattern.maxIntensity ?? pattern.intensity) * (0.5 + 0.5 * Math.sin((Math.PI * 2 * t) / pattern.durationMs));
        if (pattern.type === 'tease') intensity *= 0.3 + random() * 0.5;
        if (pattern.type === 'punishment') intensity = pattern.intensity * (0.75 + random() * 0.25);
        if (pattern.type === 'random') {
          const min = pattern.minIntensity ?? 5;
          const max = pattern.maxIntensity ?? pattern.intensity;
          intensity = min + random() * (max - min);
        }

        const randomOffset = (random() - 0.5) * pattern.randomnessFactor * pattern.intensity;
        steps.push({
          atMs: rep * (pattern.durationMs + pattern.intervalMs) + t,
          intensity: clamp(intensity + randomOffset, 0, 100),
        });
      }
    }

    return steps;
  }

  start(pattern: PatternDefinition, onStep?: (step: PatternStep) => void): void {
    this.stop();
    this.steps = this.generateSteps(pattern);
    this.startedAt = Date.now();
    let idx = 0;

    this.timer = setInterval(() => {
      if (idx >= this.steps.length) {
        this.stop();
        void this.deviceService.setIntensity(0);
        return;
      }

      const elapsed = Date.now() - this.startedAt;
      const step = this.steps[idx];
      if (elapsed >= step.atMs) {
        idx += 1;
        void this.deviceService.setIntensity(step.intensity);
        onStep?.(step);
      }
    }, Math.max(20, Math.floor(pattern.intervalMs / 2)));
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
