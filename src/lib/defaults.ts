import type { DrawingDoc, Preferences, Project, RigProfile, RigState } from '@/types';
import { uid } from './utils';

export const defaultPreferences: Preferences = {
  theme: 'light',
  accent: '#E33B40',
  density: 'comfortable',
  animationIntensity: 1,
  notificationsEnabled: true,
  startupModule: 'overview',
  showWelcome: true,
  consoleOpen: false,
  sidebarCollapsed: false,
  connection: {
    baudRate: 115200,
    autoReconnect: true,
    reconnectDelayMs: 2500,
    commandTimeoutMs: 6000,
  },
};

const plotterProfile: RigProfile = {
  label: 'PEN PLOTTER',
  bed: { width: 300, height: 300, maxZ: 40 },
  feedRateMax: 6000,
  travelRateMax: 9000,
  tool: {
    kind: 'pen',
    label: 'Caneta técnica 0,5 mm',
    safeZ: 5,
    workZ: 0,
    rpmMin: 0,
    rpmMax: 0,
    rpmDefault: 0,
    nozzleTempMax: 0,
    bedTempMax: 0,
    nozzleTarget: 0,
    bedTarget: 0,
    spindleEnabled: false,
  },
};

const printerProfile: RigProfile = {
  label: 'IMPRESSORA 3D',
  bed: { width: 300, height: 300, maxZ: 300 },
  feedRateMax: 12000,
  travelRateMax: 18000,
  tool: {
    kind: 'hotend',
    label: 'Hotend direta · bico 0,4 mm',
    safeZ: 10,
    workZ: 0.2,
    rpmMin: 0,
    rpmMax: 0,
    rpmDefault: 0,
    nozzleTempMax: 260,
    bedTempMax: 110,
    nozzleTarget: 200,
    bedTarget: 60,
    spindleEnabled: false,
  },
};

const cncProfile: RigProfile = {
  label: 'CNC / FUSO',
  bed: { width: 300, height: 300, maxZ: 120 },
  feedRateMax: 3000,
  travelRateMax: 6000,
  tool: {
    kind: 'spindle',
    label: 'Fuso 300 W · collet 3,175 mm',
    safeZ: 15,
    workZ: 0,
    rpmMin: 3000,
    rpmMax: 12000,
    rpmDefault: 8000,
    nozzleTempMax: 0,
    bedTempMax: 0,
    nozzleTarget: 0,
    bedTarget: 0,
    spindleEnabled: false,
  },
};

export const defaultRigState: RigState = {
  mode: 'plotter',
  profiles: {
    plotter: plotterProfile,
    printer3d: printerProfile,
    cnc: cncProfile,
  },
  acknowledged: {
    spindleFirmware: false,
    enclosure: false,
    workholding: false,
    thermalRunaway: false,
  },
  lastModeSwitchAt: null,
};

export const createEmptyDoc = (): DrawingDoc => ({
  shapes: [],
  layers: [{ id: 'layer_01', name: 'CAMADA 01', color: '#171719', visible: true, locked: false }],
  bed: { width: 300, height: 300 },
  settings: {
    feedRate: 1800,
    travelRate: 3000,
    penUp: 5,
    penDown: 0,
    passes: 1,
  },
});

export const createDemoDoc = (): DrawingDoc => ({
  ...createEmptyDoc(),
  layers: [
    { id: 'layer_01', name: 'CONTORNO', color: '#171719', visible: true, locked: false },
    { id: 'layer_02', name: 'DETALHE', color: '#E33B40', visible: true, locked: false },
  ],
  shapes: [
    {
      id: uid('shape'),
      type: 'rect',
      layerId: 'layer_01',
      points: [
        { x: 70, y: 70 },
        { x: 230, y: 230 },
      ],
      stroke: '#171719',
      width: 0.5,
    },
    {
      id: uid('shape'),
      type: 'ellipse',
      layerId: 'layer_01',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
      stroke: '#171719',
      width: 0.5,
    },
    {
      id: uid('shape'),
      type: 'polyline',
      layerId: 'layer_02',
      points: [
        { x: 70, y: 150 },
        { x: 150, y: 70 },
        { x: 230, y: 150 },
        { x: 150, y: 230 },
        { x: 70, y: 150 },
      ],
      stroke: '#E33B40',
      width: 0.5,
    },
  ],
});

export const createDemoProject = (): Project => {
  const now = Date.now();
  return {
    id: 'project_demo_001',
    name: 'AMOSTRA · Geometria TOKI',
    folder: 'DEMO',
    createdAt: now - 1000 * 60 * 60 * 26,
    updatedAt: now - 1000 * 60 * 42,
    status: 'draft',
    doc: createDemoDoc(),
    notes: 'Projeto de demonstração incluído para explorar o editor. Não representa execução real.',
  };
};
