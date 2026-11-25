// Gera cases.jsonl extras para `record`. Não é código do app.
import { writeFileSync } from 'node:fs';

const tool = (kind, overrides = {}) => ({
  kind,
  label: kind,
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
  ...overrides,
});

const profiles = {
  plotter: {
    label: 'PEN PLOTTER',
    bed: { width: 300, height: 300, maxZ: 40 },
    feedRateMax: 6000,
    travelRateMax: 9000,
    tool: tool('pen', { safeZ: 5, workZ: 0 }),
  },
  printer3d: {
    label: 'IMPRESSORA 3D',
    bed: { width: 300, height: 300, maxZ: 300 },
    feedRateMax: 12000,
    travelRateMax: 18000,
    tool: tool('hotend', {
      safeZ: 10,
      workZ: 0.2,
      nozzleTempMax: 260,
      bedTempMax: 110,
      nozzleTarget: 200,
      bedTarget: 60,
    }),
  },
  cnc: {
    label: 'CNC / FUSO',
    bed: { width: 300, height: 300, maxZ: 120 },
    feedRateMax: 3000,
    travelRateMax: 6000,
    tool: tool('spindle', {
      safeZ: 15,
      workZ: 0,
      rpmMin: 3000,
      rpmMax: 12000,
      rpmDefault: 8000,
      spindleEnabled: true,
    }),
  },
};

const ack = (overrides = {}) => ({
  spindleFirmware: false,
  enclosure: false,
  workholding: false,
  thermalRunaway: false,
  ...overrides,
});

const rig = (mode, overrides = {}) => ({
  mode,
  profiles: structuredClone(profiles),
  acknowledged: ack(overrides.acknowledged),
  lastModeSwitchAt: null,
  ...overrides,
});

const ctx = (mode, overrides = {}) => ({
  doc: {
    shapes: [],
    layers: [],
    bed: { width: 300, height: 300 },
    settings: { feedRate: 1800, travelRate: 3000, penUp: 5, penDown: 0, passes: 1 },
  },
  connected: true,
  mode: 'demo',
  rig: rig(mode, overrides.rig),
  ...overrides,
});

const lines = [];
const push = (fn, args) => lines.push(JSON.stringify({ fn, args }));

for (const mode of ['plotter', 'printer3d', 'cnc', 'unknown']) {
  push('allowedCommandsFor', [rig(mode)]);
}

const v = (raw, mode, overrides) => push('validateCommand', [raw, ctx(mode, overrides)]);

//normalização e portões iniciais
v('', 'plotter');
v('   ', 'plotter');
v('M105', 'plotter', { connected: false });
v('M105\nM105', 'plotter');
v('M105 ; comentário', 'plotter');
v('M105\t;x', 'plotter');
v('G28.1', 'plotter');
v('M999', 'plotter');
v('X10', 'plotter');
v('M104 S200', 'plotter');
v('M3 S8000', 'plotter');
v('g0 x10 y20', 'plotter');
v('  G0   X10   Y20  ', 'plotter');

//allowlist por modo
for (const command of ['G0', 'G1', 'G4', 'G21', 'G28', 'G90', 'M17', 'M18', 'M105', 'M114', 'M115', 'M400', 'M410', 'M112']) {
  v(command, 'plotter');
}
for (const command of ['M104', 'M109', 'M140', 'M190', 'M106', 'M107']) {
  v(command, 'plotter');
  v(command, 'printer3d');
}
for (const command of ['M3', 'M4', 'M5']) {
  v(command, 'plotter');
  v(command, 'cnc', { rig: { acknowledged: ack({ spindleFirmware: true, enclosure: true, workholding: true }) } });
}

//parâmetros e sintaxe
v('G0 X10 Y20 F3000', 'plotter');
v('G1 X10 Y20 F6000', 'plotter');
v('G1 X10 Y20 F6001', 'plotter');
v('G0 X10 Y20 F9000', 'plotter');
v('G0 X10 Y20 F9001', 'plotter');
v('G0 S100', 'plotter');
v('G1 S0', 'plotter');
v('M105 F100', 'plotter');
v('M105 E10', 'plotter');
v('G1 E10', 'plotter');
v('G0 X010', 'plotter');
v('G0 X1.5', 'plotter');
v('G0 X-0', 'plotter');
v('G0 X+1', 'plotter');
v('G0 X1.', 'plotter');
v('G0 X.5', 'plotter');
v('G0 X1Y2', 'plotter');
v('G4 P100', 'plotter');

//limites de leito e Z
v('G0 X-1', 'plotter');
v('G0 X301', 'plotter');
v('G0 Y-1', 'plotter');
v('G0 Y301', 'plotter');
v('G0 X300 Y300', 'plotter');
v('G0 Z-3', 'plotter');
v('G0 Z-3.1', 'plotter');
v('G0 Z10', 'plotter');
v('G0 Z10.1', 'plotter');
v('G1 Z300', 'printer3d');
v('G1 Z300.1', 'printer3d');
v('G1 Z-0.1', 'printer3d');
v('G1 Z-2', 'cnc');
v('G1 Z-2.1', 'cnc');
v('G1 Z20', 'cnc');
v('G1 Z20.1', 'cnc');

//extrusão
v('G1 E10', 'printer3d');
v('G1 E10', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('G1 E10', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) }, mode: 'hardware', nozzleTemp: null });
v('G1 E10', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) }, mode: 'hardware', nozzleTemp: 179 });
v('G1 E10', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) }, mode: 'hardware', nozzleTemp: 180 });
v('G1 E10', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) }, mode: 'hardware', nozzleTemp: 200 });
v('G1 E10000', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('G1 E10001', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('G1 E-1', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });

//térmico
v('M104 S55', 'printer3d');
v('M104 S60', 'printer3d');
v('M104 S60.1', 'printer3d');
v('M104 S200', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M104 S261', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M104', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M109 S200', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M140 S60', 'printer3d');
v('M140 S110', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M140 S111', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M190 S60', 'printer3d', { rig: { acknowledged: ack({ thermalRunaway: true }) } });
v('M106 S0', 'printer3d');
v('M106 S255', 'printer3d');
v('M106 S256', 'printer3d');
v('M106', 'printer3d');
v('M107 S1', 'printer3d');

//fuso
const cncReady = { rig: { acknowledged: ack({ spindleFirmware: true, enclosure: true, workholding: true }) } };
v('M3 S8000', 'cnc');
v('M3 S8000', 'cnc', { rig: { acknowledged: ack({ spindleFirmware: true }) } });
v('M3 S8000', 'cnc', { rig: { acknowledged: ack({ spindleFirmware: true, enclosure: true }) } });
v('M3 S8000', 'cnc', cncReady);
v('M3 S3000', 'cnc', cncReady);
v('M3 S2999', 'cnc', cncReady);
v('M3 S12000', 'cnc', cncReady);
v('M3 S12001', 'cnc', cncReady);
v('M4 S8000', 'cnc', cncReady);
v('M5 S1', 'cnc', cncReady);
v('M3 S8000 F100', 'cnc', cncReady);

writeFileSync(new URL('./extra-inputs.jsonl', import.meta.url), lines.join('\n') + '\n');
console.log(`generated ${lines.length} extra cases`);
