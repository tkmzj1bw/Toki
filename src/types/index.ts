export type ModuleId =
  | 'overview'
  | 'studio'
  | 'machine'
  | 'monitoring'
  | 'projects'
  | 'system';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type OperatingState =
  | 'unknown'
  | 'idle'
  | 'homing'
  | 'jogging'
  | 'plotting'
  | 'paused'
  | 'stopped'
  | 'error';
export type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type DataOrigin = 'none' | 'demo' | 'hardware';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Telemetry {
  position: Vec3 | null;
  target: Vec3 | null;
  origin: DataOrigin;
  firmware: string | null;
  port: string | null;
  baud: number | null;
  motorsEnabled: boolean | null;
  lastContactAt: number | null;
  /** Leitura M105. null quando o sensor não reportou valor. */
  temperatures: { hotend: number | null; bed: number | null } | null;
  /** Estado *comandado* do fuso — nunca inferido como medição. */
  spindle: { active: boolean; rpm: number; direction: 'CW' | 'CCW' | null } | null;
}

export type RigMode = 'plotter' | 'printer3d' | 'cnc';
export type SafetyAckKey = 'spindleFirmware' | 'enclosure' | 'workholding' | 'thermalRunaway';

export interface RigTool {
  kind: 'pen' | 'hotend' | 'spindle';
  label: string;
  safeZ: number;
  workZ: number;
  rpmMin: number;
  rpmMax: number;
  rpmDefault: number;
  nozzleTempMax: number;
  bedTempMax: number;
  nozzleTarget: number;
  bedTarget: number;
  spindleEnabled: boolean;
}

export interface RigProfile {
  label: string;
  bed: { width: number; height: number; maxZ: number };
  feedRateMax: number;
  travelRateMax: number;
  tool: RigTool;
}

export interface RigState {
  mode: RigMode;
  profiles: Record<RigMode, RigProfile>;
  /** Confirmações físicas feitas pelo operador. Nunca presumidas pelo software. */
  acknowledged: Record<SafetyAckKey, boolean>;
  lastModeSwitchAt: number | null;
}

export const rigModeLabel: Record<RigMode, string> = {
  plotter: 'PEN PLOTTER',
  printer3d: 'IMPRESSORA 3D',
  cnc: 'CNC / FUSO',
};

export interface TokiEvent {
  id: string;
  ts: number;
  severity: Severity;
  code: string;
  module: string;
  message: string;
  details?: string;
}

export interface NotificationItem {
  id: string;
  ts: number;
  severity: Severity;
  code: string;
  title: string;
  description: string;
  module: string;
  read: boolean;
}

export type ShapeType = 'line' | 'rect' | 'ellipse' | 'polyline';
export type ToolId = 'select' | 'line' | 'rect' | 'ellipse' | 'polyline' | 'pan';

export interface Point2 {
  x: number;
  y: number;
}

export interface VectorShape {
  id: string;
  type: ShapeType;
  layerId: string;
  points: Point2[];
  stroke: string;
  width: number;
  locked?: boolean;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface DrawingSettings {
  feedRate: number;
  travelRate: number;
  penUp: number;
  penDown: number;
  passes: number;
}

export interface DrawingDoc {
  shapes: VectorShape[];
  layers: Layer[];
  bed: { width: number; height: number };
  settings: DrawingSettings;
}

export type ProjectStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'interrupted'
  | 'completed_real'
  | 'completed_virtual';

export interface Project {
  id: string;
  name: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
  status: ProjectStatus;
  doc: DrawingDoc;
  notes?: string;
}

export type ExecutionPhase =
  | 'idle'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed_virtual'
  | 'completed_real';

export interface ExecutionSession {
  projectId: string | null;
  phase: ExecutionPhase;
  mode: 'none' | 'demo' | 'hardware';
  elapsedMs: number;
  progressEstimated: number;
  progressConfirmed: number | null;
  startedAt: number | null;
  currentSegment: number;
  totalSegments: number;
}

export interface Preferences {
  theme: 'light' | 'dark';
  accent: string;
  density: 'compact' | 'comfortable';
  animationIntensity: number;
  notificationsEnabled: boolean;
  startupModule: ModuleId;
  showWelcome: boolean;
  consoleOpen: boolean;
  sidebarCollapsed: boolean;
  connection: {
    baudRate: number;
    autoReconnect: boolean;
    reconnectDelayMs: number;
    commandTimeoutMs: number;
  };
}

export interface PortInfo {
  id: string;
  label: string;
  available: boolean;
}

export interface HardwareCommandResult {
  ok: boolean;
  response: string;
  ts: number;
}
