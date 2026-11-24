import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ConnectionState,
  DataOrigin,
  DrawingDoc,
  ExecutionSession,
  ModuleId,
  NotificationItem,
  OperatingState,
  Point2,
  PortInfo,
  Preferences,
  Project,
  ProjectStatus,
  RigMode,
  RigProfile,
  RigState,
  RigTool,
  SafetyAckKey,
  Severity,
  Telemetry,
  TokiEvent,
  VectorShape,
} from '@/types';
import { rigModeLabel } from '@/types';
import { connectionManager, type ConnectionMode, type ConnectionSnapshot } from '@/hardware/ConnectionManager';
import { validateCommand } from '@/hardware/commands';
import type { HardwareEvent } from '@/hardware/types';
import { createDemoProject, createEmptyDoc, defaultPreferences, defaultRigState } from '@/lib/defaults';
import { buildSegments, documentStats, pointOnSegment, segmentLength } from '@/lib/geometry';
import { clamp, round, uid } from '@/lib/utils';

export interface ConfirmationRequest {
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: 'default' | 'danger';
  detail?: string;
  onConfirm: () => void | Promise<void>;
}

export interface SimulationState {
  running: boolean;
  elapsedMs: number;
  durationMs: number;
  progress: number;
  segmentIndex: number;
  totalSegments: number;
  playhead: Point2 | null;
  speed: number;
}

interface HistoryState {
  past: DrawingDoc[];
  future: DrawingDoc[];
}

interface TokiState {
  prefs: Preferences;
  booted: boolean;
  activeModule: ModuleId;
  connection: { state: ConnectionState; mode: ConnectionMode; error: string | null };
  telemetry: Telemetry;
  operatingState: OperatingState;
  rig: RigState;
  /** Estado de fuso por comando enviado (a telemetria não mede rotação). */
  spindleCommand: { active: boolean; rpm: number; direction: 'CW' | 'CCW' | null; origin: DataOrigin };
  thermalTarget: { nozzle: number | null; bed: number | null };
  extruderE: number;
  ports: PortInfo[];
  events: TokiEvent[];
  notifications: NotificationItem[];
  consoleFilter: Severity | 'ALL';
  confirmation: ConfirmationRequest | null;
  connectionDrawerOpen: boolean;

  projects: Project[];
  activeProjectId: string | null;
  studioDoc: DrawingDoc;
  activeLayerId: string;
  selectedShapeIds: string[];
  activeTool: string;
  history: HistoryState;
  simulation: SimulationState;
  studioViewMode: '3d' | '2d' | 'dual';
  studioMaximized: '3d' | '2d' | null;
  studioSplit: number;
  execution: ExecutionSession;

  setBooted: (value: boolean) => void;
  setActiveModule: (module: ModuleId) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  updateConnectionPreferences: (patch: Partial<Preferences['connection']>) => void;
  resetPreferences: () => void;
  toggleSidebar: () => void;
  setConsoleOpen: (open: boolean) => void;
  setConsoleFilter: (filter: Severity | 'ALL') => void;
  setConnectionDrawerOpen: (open: boolean) => void;

  pushEvent: (event: Omit<TokiEvent, 'id' | 'ts'> & { notify?: boolean }) => void;
  clearEvents: () => void;
  dismissNotification: (id: string) => void;
  markAllNotificationsRead: () => void;
  requestConfirmation: (request: Omit<ConfirmationRequest, 'id'>) => void;
  closeConfirmation: () => void;
  applyConnectionSnapshot: (snapshot: ConnectionSnapshot) => void;
  applyHardwareEvent: (event: HardwareEvent) => void;
  refreshPorts: (mode: ConnectionMode) => Promise<void>;
  connect: (mode: ConnectionMode, baudRate: number, portId?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<{ ok: boolean; response: string; ts: number }>;
  setOperatingState: (state: OperatingState) => void;

  requestRigMode: (mode: RigMode) => void;
  applyRigMode: (mode: RigMode) => Promise<boolean>;
  updateRigProfile: (mode: RigMode, patch: Partial<RigProfile>) => void;
  updateRigTool: (mode: RigMode, patch: Partial<RigTool>) => void;
  setSafetyAck: (key: SafetyAckKey, value: boolean) => void;
  resetRig: () => void;
  setSpindle: (rpm: number, direction: 'CW' | 'CCW') => Promise<void>;
  stopSpindle: () => Promise<{ ok: boolean }>;
  setThermalTarget: (kind: 'nozzle' | 'bed', value: number) => Promise<void>;
  cooldown: () => Promise<void>;
  queryTemperatures: () => Promise<void>;
  extrude: (mm: number) => Promise<void>;

  jog: (axis: 'X' | 'Y' | 'Z', delta: number) => Promise<void>;
  moveTool: (target: 'safe' | 'work') => Promise<void>;
  setPen: (down: boolean) => Promise<void>;
  home: () => Promise<void>;
  toggleMotors: (enable: boolean) => Promise<void>;
  queryPosition: () => Promise<void>;
  queryFirmware: () => Promise<void>;
  quickStop: () => Promise<void>;
  emergencyStop: () => Promise<void>;

  setActiveTool: (tool: string) => void;
  setActiveLayer: (id: string) => void;
  selectShapes: (ids: string[]) => void;
  applyDoc: (doc: DrawingDoc, recordHistory?: boolean) => void;
  addShape: (shape: VectorShape) => void;
  updateShape: (id: string, patch: Partial<VectorShape>, recordHistory?: boolean) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  addLayer: () => void;
  updateLayer: (id: string, patch: Partial<DrawingDoc['layers'][number]>) => void;
  removeLayer: (id: string) => void;

  setStudioViewMode: (mode: '3d' | '2d' | 'dual') => void;
  setStudioMaximized: (mode: '3d' | '2d' | null) => void;
  setStudioSplit: (value: number) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  advanceSimulation: (deltaMs: number) => void;
  setSimulationSpeed: (speed: number) => void;

  createProject: (name: string, doc?: DrawingDoc) => string;
  saveActiveProject: () => void;
  setActiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  setProjectStatus: (id: string, status: ProjectStatus) => boolean;
  enqueueProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  startExecution: (projectId: string, mode: 'demo' | 'hardware') => boolean;
  advanceExecution: (deltaMs: number) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelExecution: () => void;
  completeExecution: (kind: 'virtual' | 'real') => void;
}

const demoProject = createDemoProject();
const emptyTelemetry = (): Telemetry => ({
  position: null,
  target: null,
  origin: 'none',
  firmware: null,
  port: null,
  baud: null,
  motorsEnabled: null,
  lastContactAt: null,
  temperatures: null,
  spindle: null,
});

const emptyExecution = (): ExecutionSession => ({
  projectId: null,
  phase: 'idle',
  mode: 'none',
  elapsedMs: 0,
  progressEstimated: 0,
  progressConfirmed: null,
  startedAt: null,
  currentSegment: 0,
  totalSegments: 0,
});

const emptySimulation = (): SimulationState => ({
  running: false,
  elapsedMs: 0,
  durationMs: 0,
  progress: 0,
  segmentIndex: 0,
  totalSegments: 0,
  playhead: null,
  speed: 1,
});

export const useTokiStore = create<TokiState>()(
  persist(
    (set, get) => ({
      prefs: defaultPreferences,
      booted: false,
      activeModule: defaultPreferences.startupModule,
      connection: { state: 'disconnected', mode: 'demo', error: null },
      telemetry: emptyTelemetry(),
      operatingState: 'unknown',
      rig: defaultRigState,
      spindleCommand: { active: false, rpm: 0, direction: null, origin: 'none' },
      thermalTarget: { nozzle: null, bed: null },
      extruderE: 0,
      ports: [],
      events: [],
      notifications: [],
      consoleFilter: 'ALL',
      confirmation: null,
      connectionDrawerOpen: false,

      projects: [demoProject],
      activeProjectId: demoProject.id,
      studioDoc: demoProject.doc,
      activeLayerId: demoProject.doc.layers[0]?.id ?? 'layer_01',
      selectedShapeIds: [],
      activeTool: 'select',
      history: { past: [], future: [] },
      simulation: emptySimulation(),
      studioViewMode: 'dual',
      studioMaximized: null,
      studioSplit: 52,
      execution: emptyExecution(),

      setBooted: (booted) => set({ booted }),
      setActiveModule: (activeModule) => set({ activeModule }),
      updatePreferences: (patch) => set((state) => ({ prefs: { ...state.prefs, ...patch } })),
      updateConnectionPreferences: (patch) =>
        set((state) => ({ prefs: { ...state.prefs, connection: { ...state.prefs.connection, ...patch } } })),
      resetPreferences: () => set({ prefs: { ...defaultPreferences, showWelcome: false } }),
      toggleSidebar: () => set((state) => ({ prefs: { ...state.prefs, sidebarCollapsed: !state.prefs.sidebarCollapsed } })),
      setConsoleOpen: (consoleOpen) => set((state) => ({ prefs: { ...state.prefs, consoleOpen } })),
      setConsoleFilter: (consoleFilter) => set({ consoleFilter }),
      setConnectionDrawerOpen: (connectionDrawerOpen) => set({ connectionDrawerOpen }),

      pushEvent: ({ notify, ...payload }) => {
        const event: TokiEvent = { ...payload, id: uid('evt'), ts: Date.now() };
        set((state) => ({ events: [...state.events, event].slice(-400) }));
        if (notify && get().prefs.notificationsEnabled && ['WARNING', 'ERROR', 'CRITICAL'].includes(payload.severity)) {
          const notification: NotificationItem = {
            id: uid('notif'),
            ts: event.ts,
            severity: event.severity,
            code: event.code,
            title: payload.message,
            description: payload.details ?? payload.module,
            module: payload.module,
            read: false,
          };
          set((state) => ({ notifications: [...state.notifications, notification].slice(-30) }));
        }
      },
      clearEvents: () => set({ events: [], notifications: [] }),
      dismissNotification: (id) =>
        set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
      markAllNotificationsRead: () =>
        set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) })),
      requestConfirmation: (request) => set({ confirmation: { ...request, id: uid('confirm') } }),
      closeConfirmation: () => set({ confirmation: null }),

      applyConnectionSnapshot: (snapshot) =>
        set((state) => {
          const disconnected = snapshot.state === 'disconnected';
          return {
            connection: {
              state: snapshot.state,
              mode: snapshot.mode,
              error: snapshot.error,
            },
            telemetry: snapshot.telemetry,
            spindleCommand: disconnected
              ? { active: false, rpm: 0, direction: null, origin: 'none' }
              : state.spindleCommand,
            thermalTarget: disconnected ? { nozzle: null, bed: null } : state.thermalTarget,
            operatingState: disconnected ? 'unknown' : snapshot.state === 'connected' ? 'idle' : state.operatingState,
          };
        }),
      applyHardwareEvent: (event) => get().pushEvent({ ...event, module: 'HARDWARE', notify: true }),
      refreshPorts: async (mode) => {
        const ports = await connectionManager.listPorts(mode);
        set({ ports });
      },
      connect: async (mode, baudRate, portId) => {
        set((state) => ({
          connection: { ...state.connection, mode, state: 'connecting', error: null },
        }));
        const ok = await connectionManager.connect(mode, { baudRate, portId });
        return ok;
      },
      disconnect: async () => {
        await connectionManager.disconnect();
      },
      sendCommand: async (command) => {
        const state = get();
        const validation = validateCommand(command, {
          doc: state.studioDoc,
          connected: state.connection.state === 'connected',
          mode: state.connection.mode,
          rig: state.rig,
          nozzleTemp: state.telemetry.temperatures?.hotend ?? null,
        });
        if (!validation.ok) {
          get().pushEvent({
            severity: 'WARNING',
            code: 'CMD_REJECTED_LOCAL',
            module: 'MACHINE',
            message: validation.reason ?? 'Comando rejeitado.',
            details: command,
          });
          return { ok: false, response: validation.reason ?? 'Comando rejeitado', ts: Date.now() };
        }
        const result = await connectionManager.send(validation.command);
        get().pushEvent({
          severity: result.ok ? 'INFO' : 'ERROR',
          code: result.ok ? 'CMD_OK' : 'CMD_FAILED',
          module: 'MACHINE',
          message: result.ok ? `Comando ${validation.command} executado.` : `Falha ao executar ${validation.command}.`,
          details: result.response,
        });
        return result;
      },
      setOperatingState: (operatingState) => set({ operatingState }),

      requestRigMode: (mode) => {
        const state = get();
        if (mode === state.rig.mode) return;
        if (state.execution.phase === 'running' || state.execution.phase === 'paused') {
          get().pushEvent({
            severity: 'ERROR',
            code: 'RIG_SWITCH_BUSY',
            module: 'RIG',
            message: 'Interrompa a execução antes de trocar o modo da máquina.',
            notify: true,
          });
          return;
        }
        const previous = state.rig.mode;
        const temps = state.telemetry.temperatures;
        if (previous === 'printer3d' && ((temps?.hotend ?? 0) > 60 || (temps?.bed ?? 0) > 60)) {
          get().pushEvent({
            severity: 'ERROR',
            code: 'RIG_SWITCH_HOT',
            module: 'RIG',
            message: 'Resfrie bico e mesa abaixo de 60 °C antes de trocar de modo.',
            details: `Bico ${temps?.hotend ?? '—'} °C · Mesa ${temps?.bed ?? '—'} °C`,
            notify: true,
          });
          return;
        }
        const warnings: string[] = [];
        if (previous === 'cnc' && (state.spindleCommand.active || state.telemetry.spindle?.active)) warnings.push('O fuso será parado com M5 antes da troca.');
        if (previous === 'printer3d') warnings.push('Aquecimentos serão desligados com M104/M140 S0.');
        if (previous === 'printer3d' && !temps) warnings.push('Sem leitura de temperatura: o resfriamento não pôde ser confirmado.');
        if (mode === 'cnc') {
          if (!state.rig.acknowledged.spindleFirmware) warnings.push('CNC: suporte a M3/M4/M5 não confirmado no firmware.');
          if (!state.rig.acknowledged.enclosure || !state.rig.acknowledged.workholding) warnings.push('CNC: envelope e fixação da peça não confirmados.');
        }
        get().requestConfirmation({
          title: `Ativar ${rigModeLabel[mode]}`,
          description:
            'A máquina será estacionada na altura segura antes da troca. Todo movimento é enviado somente se houver conexão confirmada. No modo demo nada é acionado fisicamente.',
          confirmLabel: 'TROCAR MODO',
          tone: mode === 'cnc' ? 'danger' : 'default',
          detail: warnings.length ? warnings.join(' ') : `${rigModeLabel[previous]} → ${rigModeLabel[mode]}`,
          onConfirm: () => void get().applyRigMode(mode),
        });
      },

      applyRigMode: async (mode) => {
        const state = get();
        if (state.execution.phase === 'running' || state.execution.phase === 'paused') return false;
        const previous = state.rig.mode;
        if (previous === mode) return true;

        if (state.connection.state === 'connected') {
          if (previous === 'cnc' && (state.spindleCommand.active || state.telemetry.spindle?.active)) {
            const stopped = await get().stopSpindle();
            if (!stopped.ok) {
              get().pushEvent({
                severity: 'ERROR',
                code: 'RIG_SWITCH_SPINDLE',
                module: 'RIG',
                message: 'Não foi possível parar o fuso. Troca de modo abortada.',
                notify: true,
              });
              return false;
            }
          }
          if (previous === 'printer3d') {
            await get().sendCommand('M104 S0');
            await get().sendCommand('M140 S0');
          }
          const currentProfile = state.rig.profiles[previous];
          const targetSafeZ = state.rig.profiles[mode].tool.safeZ;
          const parkZ = Math.min(targetSafeZ, currentProfile.tool.safeZ);
          await get().sendCommand(`G0 Z${parkZ}`);
          await get().sendCommand('M400');
        }

        set((current) => ({
          rig: { ...current.rig, mode, lastModeSwitchAt: Date.now() },
          spindleCommand: { active: false, rpm: 0, direction: null, origin: 'none' },
          thermalTarget: { nozzle: null, bed: null },
          operatingState: current.connection.state === 'connected' ? 'idle' : current.operatingState,
        }));
        get().pushEvent({
          severity: mode === 'cnc' ? 'WARNING' : 'INFO',
          code: 'RIG_MODE_CHANGED',
          module: 'RIG',
          message: `Configuração da máquina alterada para ${rigModeLabel[mode]}.`,
          details: `Ferramenta: ${state.rig.profiles[mode].tool.label}`,
        });
        if (mode === 'printer3d' && get().connection.state === 'connected') await get().queryTemperatures();
        return true;
      },

      updateRigProfile: (mode, patch) =>
        set((state) => ({
          rig: {
            ...state.rig,
            profiles: {
              ...state.rig.profiles,
              [mode]: { ...state.rig.profiles[mode], ...patch },
            },
          },
        })),
      updateRigTool: (mode, patch) =>
        set((state) => {
          const profile = state.rig.profiles[mode];
          return {
            rig: {
              ...state.rig,
              profiles: {
                ...state.rig.profiles,
                [mode]: { ...profile, tool: { ...profile.tool, ...patch } },
              },
            },
          };
        }),
      setSafetyAck: (key, value) =>
        set((state) => ({
          rig: { ...state.rig, acknowledged: { ...state.rig.acknowledged, [key]: value } },
        })),
      resetRig: () =>
        set({
          rig: defaultRigState,
          spindleCommand: { active: false, rpm: 0, direction: null, origin: 'none' },
          thermalTarget: { nozzle: null, bed: null },
          extruderE: 0,
        }),

      setSpindle: async (rpm, direction) => {
        const state = get();
        const tool = state.rig.profiles.cnc.tool;
        const value = clamp(round(rpm, 0), tool.rpmMin, tool.rpmMax);
        const result = await get().sendCommand(`${direction === 'CW' ? 'M3' : 'M4'} S${value}`);
        if (!result.ok) return;
        set({
          spindleCommand: {
            active: true,
            rpm: value,
            direction,
            origin: state.connection.mode === 'demo' ? 'demo' : 'hardware',
          },
          operatingState: 'plotting',
        });
      },
      stopSpindle: async () => {
        const result = await get().sendCommand('M5');
        if (result.ok) {
          set({
            spindleCommand: { active: false, rpm: 0, direction: null, origin: get().connection.mode === 'demo' ? 'demo' : 'hardware' },
            operatingState: get().operatingState === 'plotting' ? 'idle' : get().operatingState,
          });
        }
        return { ok: result.ok };
      },
      setThermalTarget: async (kind, value) => {
        const state = get();
        const tool = state.rig.profiles.printer3d.tool;
        const max = kind === 'nozzle' ? tool.nozzleTempMax : tool.bedTempMax;
        const target = clamp(round(value, 0), 0, max);
        const result = await get().sendCommand(kind === 'nozzle' ? `M104 S${target}` : `M140 S${target}`);
        if (!result.ok) return;
        set((current) => ({ thermalTarget: { ...current.thermalTarget, [kind]: target } }));
      },
      cooldown: async () => {
        const nozzle = await get().sendCommand('M104 S0');
        const bed = await get().sendCommand('M140 S0');
        if (nozzle.ok && bed.ok) set({ thermalTarget: { nozzle: 0, bed: 0 } });
      },
      queryTemperatures: async () => {
        const state = get();
        if (state.connection.state !== 'connected') return;
        const result = await connectionManager.send('M105');
        if (!result.ok) {
          get().pushEvent({
            severity: 'WARNING',
            code: 'TEMP_QUERY_FAILED',
            module: 'RIG',
            message: 'Leitura de temperatura (M105) não confirmada pela controladora.',
            details: result.response,
          });
        }
      },
      extrude: async (mm) => {
        const state = get();
        const nozzleTemp = state.telemetry.temperatures?.hotend ?? null;
        if (state.connection.mode === 'hardware' && (nozzleTemp === null || nozzleTemp < 180)) {
          get().pushEvent({
            severity: 'WARNING',
            code: 'EXTRUDE_COLD',
            module: 'RIG',
            message: 'Extrusão bloqueada: bico abaixo de 180 °C ou sensor indisponível.',
            notify: true,
          });
          return;
        }
        const amount = clamp(round(mm, 1), 0.1, 100);
        const next = round(state.extruderE + amount, 2);
        const result = await get().sendCommand(`G1 E${next} F300`);
        if (result.ok) set({ extruderE: next });
      },

      jog: async (axis, delta) => {
        const state = get();
        const base = state.telemetry.position;
        if (!base) {
          get().pushEvent({
            severity: 'WARNING',
            code: 'JOG_NO_POSITION',
            module: 'MACHINE',
            message: 'Posição confirmada indisponível. Consulte a posição antes de mover.',
          });
          return;
        }
        const tool = state.rig.profiles[state.rig.mode].tool;
        if (axis !== 'Z' && base.z <= tool.workZ + 0.5) {
          set({ operatingState: 'jogging' });
          await get().sendCommand(`G0 Z${tool.safeZ}`);
        }
        const target = round(base[axis.toLowerCase() as 'x' | 'y' | 'z'] + delta, 2);
        set({ operatingState: 'jogging' });
        await get().sendCommand(`G0 ${axis}${target}`);
        set({ operatingState: 'idle' });
      },
      moveTool: async (target) => {
        const state = get();
        const tool = state.rig.profiles[state.rig.mode].tool;
        set({ operatingState: 'jogging' });
        const result = await get().sendCommand(`G0 Z${target === 'work' ? tool.workZ : tool.safeZ}`);
        set({ operatingState: result.ok ? 'idle' : 'error' });
      },
      setPen: async (down) => {
        const state = get();
        const tool = state.rig.profiles.plotter.tool;
        set({ operatingState: 'jogging' });
        const result = await get().sendCommand(`G0 Z${down ? tool.workZ : tool.safeZ}`);
        set({ operatingState: result.ok ? 'idle' : 'error' });
      },
      home: async () => {
        set({ operatingState: 'homing' });
        const result = await get().sendCommand('G28');
        await get().queryPosition();
        set({ operatingState: result.ok ? 'idle' : 'error' });
      },
      toggleMotors: async (enable) => {
        await get().sendCommand(enable ? 'M17' : 'M18');
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        set((state) => ({
          telemetry: { ...state.telemetry, motorsEnabled: state.connection.state === 'connected' ? enable : null },
        }));
      },
      queryPosition: async () => {
        await get().sendCommand('M114');
      },
      queryFirmware: async () => {
        await get().sendCommand('M115');
      },
      quickStop: async () => {
        const result = await get().sendCommand('M410');
        set({ operatingState: result.ok ? 'stopped' : 'error' });
        if (result.ok) get().pauseExecution();
      },
      emergencyStop: async () => {
        const result = await get().sendCommand('M112');
        set({
          operatingState: result.ok ? 'stopped' : 'error',
          spindleCommand: { active: false, rpm: 0, direction: null, origin: 'none' },
          thermalTarget: { nozzle: null, bed: null },
        });
        if (result.ok) get().cancelExecution();
      },

      setActiveTool: (activeTool) => set({ activeTool }),
      setActiveLayer: (activeLayerId) => set({ activeLayerId }),
      selectShapes: (selectedShapeIds) => set({ selectedShapeIds }),
      applyDoc: (doc, recordHistory = true) =>
        set((state) => ({
          studioDoc: doc,
          history: recordHistory
            ? { past: [...state.history.past, state.studioDoc].slice(-40), future: [] }
            : state.history,
        })),
      addShape: (shape) => {
        const state = get();
        state.applyDoc({ ...state.studioDoc, shapes: [...state.studioDoc.shapes, shape] });
        set({ selectedShapeIds: [shape.id] });
      },
      updateShape: (id, patch, recordHistory = true) => {
        const state = get();
        state.applyDoc(
          {
            ...state.studioDoc,
            shapes: state.studioDoc.shapes.map((shape) => (shape.id === id ? { ...shape, ...patch } : shape)),
          },
          recordHistory,
        );
      },
      deleteSelected: () => {
        const state = get();
        if (!state.selectedShapeIds.length) return;
        state.applyDoc({
          ...state.studioDoc,
          shapes: state.studioDoc.shapes.filter((shape) => !state.selectedShapeIds.includes(shape.id)),
        });
        set({ selectedShapeIds: [] });
      },
      undo: () => {
        const state = get();
        const previous = state.history.past[state.history.past.length - 1];
        if (!previous) return;
        set({
          studioDoc: previous,
          history: {
            past: state.history.past.slice(0, -1),
            future: [state.studioDoc, ...state.history.future].slice(0, 40),
          },
        });
      },
      redo: () => {
        const state = get();
        const next = state.history.future[0];
        if (!next) return;
        set({
          studioDoc: next,
          history: {
            past: [...state.history.past, state.studioDoc].slice(-40),
            future: state.history.future.slice(1),
          },
        });
      },
      addLayer: () => {
        const state = get();
        const index = state.studioDoc.layers.length + 1;
        const id = uid('layer');
        state.applyDoc({
          ...state.studioDoc,
          layers: [
            ...state.studioDoc.layers,
            { id, name: `CAMADA ${String(index).padStart(2, '0')}`, color: '#A9A8AC', visible: true, locked: false },
          ],
        });
        set({ activeLayerId: id });
      },
      updateLayer: (id, patch) => {
        const state = get();
        state.applyDoc({
          ...state.studioDoc,
          layers: state.studioDoc.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
        });
      },
      removeLayer: (id) => {
        const state = get();
        if (state.studioDoc.layers.length <= 1) return;
        const layers = state.studioDoc.layers.filter((layer) => layer.id !== id);
        state.applyDoc({
          ...state.studioDoc,
          layers,
          shapes: state.studioDoc.shapes.filter((shape) => shape.layerId !== id),
        });
        if (state.activeLayerId === id) set({ activeLayerId: layers[0].id });
      },

      setStudioViewMode: (studioViewMode) => set({ studioViewMode }),
      setStudioMaximized: (studioMaximized) => set({ studioMaximized }),
      setStudioSplit: (studioSplit) => set({ studioSplit: clamp(studioSplit, 25, 75) }),
      startSimulation: () => {
        const stats = documentStats(get().studioDoc);
        set({
          simulation: {
            ...emptySimulation(),
            running: true,
            durationMs: Math.max(1000, stats.estimatedSeconds * 1000),
            totalSegments: stats.segments,
          },
        });
        get().pushEvent({
          severity: 'INFO',
          code: 'SIM_START',
          module: 'STUDIO',
          message: 'Simulação virtual iniciada.',
          details: 'Trajetória simulada em software. Nenhum movimento físico foi enviado.',
        });
      },
      pauseSimulation: () => set((state) => ({ simulation: { ...state.simulation, running: false } })),
      resetSimulation: () => set({ simulation: { ...get().simulation, ...emptySimulation(), speed: get().simulation.speed } }),
      advanceSimulation: (deltaMs) => {
        const state = get();
        const sim = state.simulation;
        if (!sim.running || sim.durationMs <= 0) return;
        const elapsed = Math.min(sim.durationMs, sim.elapsedMs + deltaMs * sim.speed);
        const progress = (elapsed / sim.durationMs) * 100;
        const segments = buildSegments(state.studioDoc);
        let travelled = (elapsed / sim.durationMs) * segments.reduce((sum, s) => sum + segmentLength(s), 0);
        let index = 0;
        let playhead: Point2 | null = null;
        for (let i = 0; i < segments.length; i += 1) {
          const length = segmentLength(segments[i]);
          if (travelled <= length || i === segments.length - 1) {
            index = i;
            playhead = pointOnSegment(segments[i], length > 0 ? clamp(travelled / length, 0, 1) : 1);
            break;
          }
          travelled -= length;
        }
        set({
          simulation: {
            ...sim,
            elapsedMs: elapsed,
            progress,
            segmentIndex: index,
            playhead,
            running: elapsed < sim.durationMs,
          },
        });
      },
      setSimulationSpeed: (speed) => set((state) => ({ simulation: { ...state.simulation, speed: clamp(speed, 0.25, 4) } })),

      createProject: (name, doc) => {
        const now = Date.now();
        const project: Project = {
          id: uid('project'),
          name: name.trim() || 'SEM TÍTULO',
          folder: 'GERAL',
          createdAt: now,
          updatedAt: now,
          status: 'draft',
          doc: doc ?? createEmptyDoc(),
        };
        set((state) => ({ projects: [...state.projects, project] }));
        get().pushEvent({
          severity: 'INFO',
          code: 'PROJECT_CREATED',
          module: 'PROJECTS',
          message: `Projeto ${project.name} criado.`,
        });
        return project.id;
      },
      saveActiveProject: () => {
        const state = get();
        const id = state.activeProjectId;
        if (!id) {
          const newId = get().createProject('NOVO PROJETO', state.studioDoc);
          set({ activeProjectId: newId });
          return;
        }
        set((current) => ({
          projects: current.projects.map((project) =>
            project.id === id ? { ...project, doc: state.studioDoc, updatedAt: Date.now() } : project,
          ),
        }));
        get().pushEvent({
          severity: 'INFO',
          code: 'PROJECT_SAVED',
          module: 'STUDIO',
          message: 'Desenho salvo no projeto ativo.',
        });
      },
      setActiveProject: (id) => {
        const project = get().projects.find((item) => item.id === id);
        if (!project) return;
        set({
          activeProjectId: id,
          studioDoc: project.doc,
          selectedShapeIds: [],
          history: { past: [], future: [] },
          simulation: emptySimulation(),
        });
      },
      deleteProject: (id) => {
        const state = get();
        state.requestConfirmation({
          title: 'Excluir projeto',
          description: 'O projeto e seu desenho serão removidos da biblioteca local.',
          confirmLabel: 'Excluir',
          tone: 'danger',
          detail: state.projects.find((p) => p.id === id)?.name,
          onConfirm: () => {
            const remaining = get().projects.filter((project) => project.id !== id);
            set((current) => ({
              projects: remaining,
              activeProjectId: current.activeProjectId === id ? remaining[0]?.id ?? null : current.activeProjectId,
              studioDoc:
                current.activeProjectId === id ? remaining[0]?.doc ?? createEmptyDoc() : current.studioDoc,
            }));
            get().pushEvent({
              severity: 'WARNING',
              code: 'PROJECT_DELETED',
              module: 'PROJECTS',
              message: 'Projeto removido da biblioteca.',
            });
          },
        });
      },
      duplicateProject: (id) => {
        const project = get().projects.find((item) => item.id === id);
        if (!project) return;
        const copy: Project = {
          ...project,
          id: uid('project'),
          name: `${project.name} · CÓPIA`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'draft',
          doc: JSON.parse(JSON.stringify(project.doc)) as DrawingDoc,
        };
        set((state) => ({ projects: [...state.projects, copy] }));
      },
      setProjectStatus: (id, status) => {
        const state = get();
        if (status === 'completed_real' && state.connection.state !== 'connected') {
          get().pushEvent({
            severity: 'ERROR',
            code: 'COMPLETE_WITHOUT_CONNECTION',
            module: 'PROJECTS',
            message: 'Não é possível confirmar conclusão real sem conexão ativa.',
          });
          return false;
        }
        set((current) => ({
          projects: current.projects.map((project) =>
            project.id === id ? { ...project, status, updatedAt: Date.now() } : project,
          ),
        }));
        return true;
      },
      enqueueProject: (id) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id ? { ...project, status: 'queued', updatedAt: Date.now() } : project,
          ),
        }));
        get().pushEvent({
          severity: 'INFO',
          code: 'QUEUE_ADDED',
          module: 'QUEUE',
          message: 'Projeto adicionado à fila de execução.',
        });
      },
      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id ? { ...project, name: name.trim() || project.name, updatedAt: Date.now() } : project,
          ),
        })),

      startExecution: (projectId, mode) => {
        const state = get();
        const project = state.projects.find((item) => item.id === projectId);
        if (!project) return false;
        if (mode === 'hardware' && state.connection.state !== 'connected') {
          get().pushEvent({
            severity: 'ERROR',
            code: 'EXEC_NO_CONNECTION',
            module: 'EXECUTION',
            message: 'Execução real exige conexão confirmada com a máquina.',
          });
          return false;
        }
        if (state.rig.mode === 'printer3d' && !state.rig.acknowledged.thermalRunaway) {
          get().pushEvent({
            severity: 'ERROR',
            code: 'EXEC_THERMAL_UNACK',
            module: 'EXECUTION',
            message: 'Confirme a proteção thermal runaway na rig antes de iniciar uma execução.',
          });
          return false;
        }
        if (state.rig.mode === 'cnc' && (!state.rig.acknowledged.spindleFirmware || !state.rig.acknowledged.enclosure || !state.rig.acknowledged.workholding)) {
          get().pushEvent({
            severity: 'ERROR',
            code: 'EXEC_CNC_UNACK',
            module: 'EXECUTION',
            message: 'Confirme firmware, envelope e fixação da peça antes de iniciar uma execução em CNC.',
          });
          return false;
        }
        if (state.rig.mode !== 'plotter') {
          get().pushEvent({
            severity: 'WARNING',
            code: 'EXEC_VECTOR_ONLY',
            module: 'EXECUTION',
            message: 'Esta execução usa apenas o traço vetorial; não gera extrusão nem aciona o fuso.',
            details: 'Use MACHINE CONTROL para comandos térmicos ou de fuso.',
          });
        }
        const stats = documentStats(project.doc);
        set({
          execution: {
            projectId,
            phase: 'running',
            mode,
            elapsedMs: 0,
            progressEstimated: 0,
            progressConfirmed: null,
            startedAt: Date.now(),
            currentSegment: 0,
            totalSegments: stats.segments,
          },
          activeProjectId: projectId,
          studioDoc: project.doc,
          operatingState: mode === 'hardware' ? 'plotting' : 'unknown',
        });
        get().setProjectStatus(projectId, 'running');
        get().pushEvent({
          severity: mode === 'demo' ? 'WARNING' : 'INFO',
          code: mode === 'demo' ? 'EXEC_DEMO_START' : 'EXEC_START',
          module: 'EXECUTION',
          message: mode === 'demo' ? 'Execução virtual iniciada.' : 'Execução real iniciada.',
          details: project.name,
        });
        return true;
      },
      advanceExecution: (deltaMs) => {
        const state = get();
        const exec = state.execution;
        if (exec.phase !== 'running' || !exec.projectId) return;
        const project = state.projects.find((item) => item.id === exec.projectId);
        if (!project) return;
        const stats = documentStats(project.doc);
        const duration = Math.max(1000, stats.estimatedSeconds * 1000);
        const elapsed = Math.min(duration, exec.elapsedMs + deltaMs);
        const progress = (elapsed / duration) * 100;
        set({
          execution: {
            ...exec,
            elapsedMs: elapsed,
            progressEstimated: progress,
            currentSegment: Math.min(exec.totalSegments, Math.ceil((progress / 100) * exec.totalSegments)),
          },
        });
        if (elapsed >= duration && exec.mode === 'demo') get().completeExecution('virtual');
      },
      pauseExecution: () => {
        set((state) => ({
          execution: state.execution.phase === 'running' ? { ...state.execution, phase: 'paused' } : state.execution,
          operatingState: state.execution.phase === 'running' ? 'paused' : state.operatingState,
        }));
      },
      resumeExecution: () =>
        set((state) => ({
          execution: state.execution.phase === 'paused' ? { ...state.execution, phase: 'running' } : state.execution,
          operatingState: state.operatingState === 'paused' ? 'plotting' : state.operatingState,
        })),
      cancelExecution: () => {
        const state = get();
        if (state.execution.projectId) get().setProjectStatus(state.execution.projectId, 'interrupted');
        set({
          execution: { ...state.execution, phase: 'cancelled', progressEstimated: 0 },
          operatingState: 'stopped',
        });
        get().pushEvent({
          severity: 'WARNING',
          code: 'EXEC_CANCELLED',
          module: 'EXECUTION',
          message: 'Execução interrompida.',
        });
      },
      completeExecution: (kind) => {
        const state = get();
        if (!state.execution.projectId) return;
        if (kind === 'real' && (state.connection.state !== 'connected' || state.execution.mode !== 'hardware')) {
          get().pushEvent({
            severity: 'ERROR',
            code: 'COMPLETE_INVALID',
            module: 'EXECUTION',
            message: 'Conclusão real exige execução conectada e confirmação da máquina.',
          });
          return;
        }
        const status: ProjectStatus = kind === 'real' ? 'completed_real' : 'completed_virtual';
        get().setProjectStatus(state.execution.projectId, status);
        set({
          execution: {
            ...state.execution,
            phase: kind === 'real' ? 'completed_real' : 'completed_virtual',
            progressEstimated: 100,
            progressConfirmed: kind === 'real' ? 100 : null,
          },
          operatingState: 'idle',
        });
        get().pushEvent({
          severity: kind === 'virtual' ? 'WARNING' : 'INFO',
          code: kind === 'virtual' ? 'EXEC_VIRTUAL_DONE' : 'EXEC_DONE',
          module: 'EXECUTION',
          message: kind === 'virtual' ? 'Simulação virtual concluída.' : 'Trabalho concluído e confirmado.',
          notify: true,
        });
      },
    }),
    {
      name: 'toki-os-state',
      version: 1,
      partialize: (state) => ({
        prefs: state.prefs,
        activeModule: state.activeModule,
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        studioDoc: state.studioDoc,
        activeLayerId: state.activeLayerId,
        rig: state.rig,
        events: state.events,
        consoleFilter: state.consoleFilter,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.activeModule && state.prefs.startupModule !== state.activeModule) {
          state.setActiveModule(state.prefs.startupModule);
        }
      },
    },
  ),
);

let hardwareWired = false;

export const wireHardware = (): void => {
  if (hardwareWired) return;
  hardwareWired = true;
  connectionManager.onState((snapshot) => useTokiStore.getState().applyConnectionSnapshot(snapshot));
  connectionManager.onEvent((event) => useTokiStore.getState().applyHardwareEvent(event));
  const prefs = useTokiStore.getState().prefs;
  connectionManager.setPolicy({
    autoReconnect: prefs.connection.autoReconnect,
    delayMs: prefs.connection.reconnectDelayMs,
    timeoutMs: prefs.connection.commandTimeoutMs,
  });
};

export const dataOriginLabel = (origin: DataOrigin): string =>
  origin === 'hardware' ? 'HARDWARE' : origin === 'demo' ? 'DEMO' : 'INDISPONÍVEL';
