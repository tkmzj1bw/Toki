import type { DrawingDoc, RigState } from '@/types';

export interface CommandContext {
  doc: DrawingDoc;
  connected: boolean;
  mode: 'demo' | 'hardware' | 'none';
  rig: RigState;
  nozzleTemp?: number | null;
}

export interface ValidationResult {
  ok: boolean;
  command: string;
  reason?: string;
}

/** Comandos comuns a todas as configurações da rig. */
const COMMON = new Set(['G0', 'G1', 'G4', 'G21', 'G28', 'G90', 'M17', 'M18', 'M105', 'M114', 'M115', 'M400', 'M410', 'M112']);
const THERMAL = new Set(['M104', 'M109', 'M140', 'M190', 'M106', 'M107']);
const SPINDLE = new Set(['M3', 'M4', 'M5']);

const TOKEN = /^[GM]\d+(?:\s+[XYZEFS]\s*-?\d+(?:\.\d+)?)*$/i;

export const allowedCommandsFor = (rig: RigState): string[] => {
  const base = [...COMMON];
  if (rig.mode === 'printer3d') base.push(...THERMAL);
  if (rig.mode === 'cnc') base.push(...SPINDLE);
  return base.sort();
};

export const validateCommand = (raw: string, context: CommandContext): ValidationResult => {
  const command = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!command) return { ok: false, command, reason: 'Comando vazio.' };
  if (!context.connected) {
    return { ok: false, command, reason: 'Sem conexão ativa com a máquina.' };
  }
  if (command.includes('\n') || command.includes(';')) {
    return { ok: false, command, reason: 'Use apenas um comando por linha.' };
  }
  if (!TOKEN.test(command)) {
    return { ok: false, command, reason: 'Comando fora da lista segura de operação.' };
  }

  const code = command.match(/^[GM]\d+/)?.[0].toUpperCase() ?? '';
  const allowed = new Set(allowedCommandsFor(context.rig));
  if (!allowed.has(code)) {
    return { ok: false, command, reason: `Comando ${code} não permitido no modo ${context.rig.mode.toUpperCase()}.` };
  }

  const params: Record<string, number> = {};
  const matcher = /\b([XYZEFS])\s*(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(command))) params[match[1]] = Number(match[2]);

  const isMotion = code === 'G0' || code === 'G1';
  const usesS = code === 'M104' || code === 'M109' || code === 'M140' || code === 'M190' || code === 'M106' || code === 'M3' || code === 'M4';
  if (params.S !== undefined && !usesS) {
    return { ok: false, command, reason: `Parâmetro S não é aceito por ${code}.` };
  }
  if (params.F !== undefined && !isMotion) {
    return { ok: false, command, reason: `Parâmetro F só é aceito em movimentos G0/G1.` };
  }
  if (params.E !== undefined && !isMotion) {
    return { ok: false, command, reason: `Parâmetro E só é aceito em movimentos G0/G1.` };
  }

  const profile = context.rig.profiles[context.rig.mode];
  const { width, height, maxZ } = profile.bed;
  const tool = profile.tool;

  const zMin = context.rig.mode === 'plotter'
    ? Math.min(tool.safeZ, tool.workZ) - 2
    : context.rig.mode === 'cnc'
      ? Math.min(tool.safeZ, tool.workZ) - 2
      : 0;
  const zMax = context.rig.mode === 'plotter'
    ? Math.max(tool.safeZ, tool.workZ) + 5
    : context.rig.mode === 'cnc'
      ? Math.max(tool.safeZ, tool.workZ) + 5
      : maxZ;

  if (params.X !== undefined && (params.X < 0 || params.X > width)) {
    return { ok: false, command, reason: `X fora do leito da rig (0–${width} mm).` };
  }
  if (params.Y !== undefined && (params.Y < 0 || params.Y > height)) {
    return { ok: false, command, reason: `Y fora do leito da rig (0–${height} mm).` };
  }
  if (params.Z !== undefined && (params.Z < zMin || params.Z > zMax)) {
    return { ok: false, command, reason: `Z fora da faixa segura da rig (${zMin}–${zMax} mm).` };
  }
  if (params.E !== undefined) {
    if (context.rig.mode !== 'printer3d') {
      return { ok: false, command, reason: 'Extrusão (E) disponível apenas na impressora 3D.' };
    }
    if (!context.rig.acknowledged.thermalRunaway) {
      return { ok: false, command, reason: 'Extrusão bloqueada: confirme a proteção thermal runaway em RIG / MÁQUINA.' };
    }
    if (context.mode === 'hardware' && (context.nozzleTemp === null || context.nozzleTemp === undefined || context.nozzleTemp < 180)) {
      return { ok: false, command, reason: 'Extrusão bloqueada: bico abaixo de 180 °C ou leitura M105 indisponível.' };
    }
    if (params.E < 0 || params.E > 10000) {
      return { ok: false, command, reason: 'Valor de extrusão fora da faixa (0–10000 mm).' };
    }
  }
  if (params.F !== undefined) {
    const feedLimit = code === 'G1' ? profile.feedRateMax : profile.travelRateMax;
    if (params.F <= 0 || params.F > feedLimit) {
      return { ok: false, command, reason: `Feed rate fora do limite da rig (1–${feedLimit} mm/min).` };
    }
  }

  if (code === 'M104' || code === 'M109') {
    if (params.S === undefined || params.S < 0 || params.S > tool.nozzleTempMax) {
      return { ok: false, command, reason: `Temperatura do bico fora da faixa (0–${tool.nozzleTempMax} °C).` };
    }
    if ((code === 'M109' || params.S > 60) && !context.rig.acknowledged.thermalRunaway) {
      return { ok: false, command, reason: 'Proteção thermal runaway não confirmada em RIG / MÁQUINA.' };
    }
  }
  if (code === 'M140' || code === 'M190') {
    if (params.S === undefined || params.S < 0 || params.S > tool.bedTempMax) {
      return { ok: false, command, reason: `Temperatura da mesa fora da faixa (0–${tool.bedTempMax} °C).` };
    }
    if ((code === 'M190' || params.S > 60) && !context.rig.acknowledged.thermalRunaway) {
      return { ok: false, command, reason: 'Proteção thermal runaway não confirmada em RIG / MÁQUINA.' };
    }
  }
  if (code === 'M106' && (params.S === undefined || params.S < 0 || params.S > 255)) {
    return { ok: false, command, reason: 'Ventoinha fora da faixa (0–255).' };
  }

  if (code === 'M3' || code === 'M4') {
    if (!tool.spindleEnabled || !context.rig.acknowledged.spindleFirmware) {
      return { ok: false, command, reason: 'Fuso não habilitado. Confirme o suporte M3/M4/M5 no firmware em RIG / MÁQUINA.' };
    }
    if (!context.rig.acknowledged.enclosure || !context.rig.acknowledged.workholding) {
      return { ok: false, command, reason: 'Confirme envelope fechado e fixação da peça antes de acionar o fuso.' };
    }
    if (params.S === undefined || params.S < tool.rpmMin || params.S > tool.rpmMax) {
      return { ok: false, command, reason: `Rotação fora da faixa do fuso (${tool.rpmMin}–${tool.rpmMax} RPM).` };
    }
  }

  return { ok: true, command };
};

export const commandDescriptions: Record<string, string> = {
  G28: 'Home de referência',
  G0: 'Movimento de deslocamento',
  G1: 'Movimento de trabalho',
  G4: 'Pausa programada',
  G21: 'Unidades em milímetros',
  G90: 'Coordenadas absolutas',
  M3: 'Fuso horário (CW)',
  M4: 'Fuso anti-horário (CCW)',
  M5: 'Parar fuso',
  M17: 'Habilitar motores',
  M18: 'Desabilitar motores',
  M104: 'Definir temperatura do bico',
  M105: 'Consultar temperaturas',
  M106: 'Ventoinha',
  M107: 'Desligar ventoinha',
  M109: 'Aquecer bico e aguardar',
  M114: 'Consultar posição',
  M115: 'Consultar firmware',
  M140: 'Definir temperatura da mesa',
  M190: 'Aquecer mesa e aguardar',
  M400: 'Aguardar movimentos',
  M410: 'Parada rápida',
  M112: 'Parada de emergência',
};
