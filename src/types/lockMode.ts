export type LockModeType =
  | 'tease'
  | 'punishment'
  | 'timed'
  | 'random'
  | 'edging'
  | 'steady'
  | 'pulse'
  | 'wave';

export type CurveType = 'linear' | 'exponential';

export interface SafetyState {
  emergencyStop: boolean;
  receiverEnabled: boolean;
  maxIntensityCap: number;
  highIntensityCooldownMs: number;
  inactivityAutoStopMs: number;
  lastHighIntensityAt: number;
}

export interface PatternDefinition {
  id: string;
  type: LockModeType;
  intensity: number;
  durationMs: number;
  intervalMs: number;
  repetition: number;
  randomnessFactor: number;
  rampUpCurve: CurveType;
  rampDownCurve: CurveType;
  minIntensity?: number;
  maxIntensity?: number;
  seed?: number;
}

export interface PatternStep {
  atMs: number;
  intensity: number;
}

export interface SessionTimer {
  id: string;
  label: string;
  startAt: number;
  endAt: number;
  controllerOnly: boolean;
}

export interface AutomationRules {
  escalateCurve: CurveType;
  escalateEveryMs: number;
  escalateBy: number;
  streakMilestonesHours: number[];
  checkInIntervalMs: number;
  thresholdMin: number;
  thresholdMax: number;
}

export interface LockEvent {
  id: string;
  type:
    | 'command'
    | 'pattern'
    | 'timer'
    | 'task'
    | 'approval'
    | 'request'
    | 'behavior'
    | 'safety';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type TaskStatus =
  | 'pending'
  | 'completedByReceiver'
  | 'approved'
  | 'denied'
  | 'timedOut';

export interface LockTask {
  id: string;
  title: string;
  description: string;
  deadline: number;
  rewardPattern: PatternDefinition;
  punishmentPattern: PatternDefinition;
  status: TaskStatus;
}

export interface LockModeState {
  activeMode: LockModeType | null;
  intensity: number;
  patternQueue: PatternDefinition[];
  timers: SessionTimer[];
  automationRules: AutomationRules;
  lastEvent: LockEvent | null;
  safetyState: SafetyState;
}

export interface LockModeCommand {
  type:
    | 'startMode'
    | 'stopMode'
    | 'remoteBurst'
    | 'request'
    | 'approveRequest'
    | 'denyRequest'
    | 'setTimer'
    | 'extendTimer'
    | 'createTask'
    | 'completeTask'
    | 'approveTask'
    | 'denyTask'
    | 'behavior'
    | 'emergencyStop';
  payload?: Record<string, unknown>;
  issuedBy: 'controller' | 'receiver' | 'system';
  issuedAt: number;
}

export interface DeviceService {
  setIntensity(value: number): Promise<void>;
  getIntensity(): number;
}

export interface ModeConfig {
  intensity: number;
  durationMs: number;
  intervalMs: number;
  randomnessFactor: number;
  repetition?: number;
  seed?: number;
}
