import type { HardwareCommandResult, Telemetry, Vec3 } from '@/types';
import type { ConnectOptions, HardwareEvent, MachineAdapter } from './types';

const initialPosition: Vec3 = { x: 0, y: 0, z: 5 };

export class DemoAdapter implements MachineAdapter {
  readonly mode = 'demo' as const;
  private telemetry: Telemetry = this.empty();
  private telemetryListeners = new Set<(telemetry: Telemetry) => void>();
  private eventListeners = new Set<(event: HardwareEvent) => void>();
  private closeListeners = new Set<() => void>();
  private connected = false;

  private empty(): Telemetry {
    return {
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
    };
  }

  async connect(options: ConnectOptions): Promise<void> {
    this.connected = true;
    this.telemetry = {
      position: { ...initialPosition },
      target: { ...initialPosition },
      origin: 'demo',
      firmware: 'TOKI DEMO · núcleo virtual',
      port: 'SIMULAÇÃO INTERNA',
      baud: options.baudRate,
      motorsEnabled: false,
      lastContactAt: Date.now(),
      temperatures: { hotend: 23, bed: 24 },
      spindle: { active: false, rpm: 0, direction: null },
    };
    this.emit({
      severity: 'WARNING',
      code: 'DEMO_ACTIVE',
      message: 'Modo demo ativo. Nenhum comando será enviado a hardware.',
    });
    this.emitTelemetry();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.telemetry = this.empty();
    this.emitTelemetry();
    this.closeListeners.forEach((listener) => listener());
  }

  async send(command: string): Promise<HardwareCommandResult> {
    if (!this.connected) {
      return { ok: false, response: 'Demo desconectado', ts: Date.now() };
    }
    await new Promise((resolve) => window.setTimeout(resolve, 110));
    const normalized = command.trim().toUpperCase();
    let response = `echo: ${command}`;

    if (/^G28\b/.test(normalized)) {
      this.telemetry.position = { ...initialPosition };
      this.telemetry.target = { ...initialPosition };
      response = 'echo: homing virtual concluído';
    } else if (/^G0\b|^G1\b/.test(normalized)) {
      const next = { ...(this.telemetry.target ?? initialPosition) };
      const x = normalized.match(/\bX(-?\d+(?:\.\d+)?)/);
      const y = normalized.match(/\bY(-?\d+(?:\.\d+)?)/);
      const z = normalized.match(/\bZ(-?\d+(?:\.\d+)?)/);
      if (x) next.x = Number(x[1]);
      if (y) next.y = Number(y[1]);
      if (z) next.z = Number(z[1]);
      this.telemetry.target = next;
      this.telemetry.position = { ...next };
    } else if (/^M17\b/.test(normalized)) {
      this.telemetry.motorsEnabled = true;
      response = 'echo: motores virtuais habilitados';
    } else if (/^M18\b/.test(normalized)) {
      this.telemetry.motorsEnabled = false;
      response = 'echo: motores virtuais desabilitados';
    } else if (/^M114\b/.test(normalized)) {
      const p = this.telemetry.position ?? initialPosition;
      response = `X:${p.x.toFixed(2)} Y:${p.y.toFixed(2)} Z:${p.z.toFixed(2)} Count X:0 Y:0 Z:0`;
    } else if (/^M105\b/.test(normalized)) {
      const t = {
        hotend: this.telemetry.temperatures?.hotend ?? 23,
        bed: this.telemetry.temperatures?.bed ?? 24,
      };
      response = `T:${t.hotend.toFixed(1)} /0.0 B:${t.bed.toFixed(1)} /0.0`;
    } else if (/^M3\b|^M4\b/.test(normalized)) {
      const rpm = Number(normalized.match(/\bS(\d+)/)?.[1] ?? 0);
      this.telemetry.spindle = { active: true, rpm, direction: normalized.startsWith('M3') ? 'CW' : 'CCW' };
      response = `echo: fuso virtual ${this.telemetry.spindle.direction} ${rpm} RPM`;
    } else if (/^M5\b/.test(normalized)) {
      this.telemetry.spindle = { active: false, rpm: 0, direction: null };
      response = 'echo: fuso virtual parado';
    } else if (/^M410\b|^M112\b/.test(normalized)) {
      if (/^M112\b/.test(normalized)) this.telemetry.spindle = { active: false, rpm: 0, direction: null };
      response = 'echo: parada virtual';
    } else if (/^M115\b/.test(normalized)) {
      response = 'FIRMWARE_NAME:TOKI_DEMO SOURCE_CODE_URL:virtual PROTOCOL_VERSION:1.0';
    }

    this.telemetry.lastContactAt = Date.now();
    this.emitTelemetry();
    return { ok: true, response: `${response}\nok`, ts: Date.now() };
  }

  onTelemetry(listener: (telemetry: Telemetry) => void): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  onEvent(listener: (event: HardwareEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  getTelemetry(): Telemetry {
    return { ...this.telemetry };
  }

  async listPorts(): Promise<import('@/types').PortInfo[]> {
    return [{ id: 'demo', label: 'Simulação interna · TOKI DEMO', available: true }];
  }

  private emitTelemetry(): void {
    const snapshot = { ...this.telemetry };
    this.telemetryListeners.forEach((listener) => listener(snapshot));
  }

  private emit(event: HardwareEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }
}
