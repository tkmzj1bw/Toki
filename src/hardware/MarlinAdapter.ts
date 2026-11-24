import type { HardwareCommandResult, Telemetry } from '@/types';
import type { ConnectOptions, HardwareEvent, MachineAdapter } from './types';
import { WebSerialTransport } from './WebSerialTransport';

interface PendingCommand {
  command: string;
  resolve: (result: HardwareCommandResult) => void;
  timer: number;
  responses: string[];
}

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

export class MarlinAdapter implements MachineAdapter {
  readonly mode = 'hardware' as const;
  private transport = new WebSerialTransport();
  private telemetry: Telemetry = emptyTelemetry();
  private telemetryListeners = new Set<(telemetry: Telemetry) => void>();
  private eventListeners = new Set<(event: HardwareEvent) => void>();
  private closeListeners = new Set<() => void>();
  private queue: PendingCommand[] = [];
  private active: PendingCommand | null = null;
  private unsubscribers: Array<() => void> = [];
  private closing = false;

  async connect(options: ConnectOptions): Promise<void> {
    this.closing = false;
    await this.transport.connect(options);
    this.telemetry = {
      ...emptyTelemetry(),
      origin: 'hardware',
      port: this.transport.describe(),
      baud: options.baudRate,
    };
    this.unsubscribers.push(
      this.transport.onData((line) => this.handleLine(line)),
      this.transport.onClose(() => this.handleClose()),
    );

    const handshake = await this.send('M115');
    if (!handshake.ok) {
      await this.disconnect();
      throw new Error(`Handshake M115 falhou: ${handshake.response}`);
    }
    if (this.telemetry.firmware === null) {
      this.emit({
        severity: 'WARNING',
        code: 'HW_FIRMWARE_UNKNOWN',
        message: 'Firmware não identificado pelo comando M115.',
        details: 'Comunicação estabelecida, mas o nome/versão não foi informado pela controladora.',
      });
    }
    await this.send('M114');
    this.emitTelemetry();
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    if (this.active) {
      window.clearTimeout(this.active.timer);
      this.active.resolve({ ok: false, response: 'Conexão encerrada', ts: Date.now() });
      this.active = null;
    }
    this.queue.forEach((pending) => {
      window.clearTimeout(pending.timer);
      pending.resolve({ ok: false, response: 'Conexão encerrada', ts: Date.now() });
    });
    this.queue = [];
    await this.transport.disconnect();
    this.telemetry = { ...emptyTelemetry(), port: this.telemetry.port, baud: this.telemetry.baud };
    this.emitTelemetry();
  }

  send(command: string, timeoutMs = 6000): Promise<HardwareCommandResult> {
    if (!this.transport.isConnected()) {
      return Promise.resolve({ ok: false, response: 'Serial desconectada', ts: Date.now() });
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        if (this.active?.command === command) this.active = null;
        this.emit({
          severity: 'ERROR',
          code: 'HW_TIMEOUT',
          message: `Timeout ao aguardar resposta de ${command}.`,
        });
        resolve({ ok: false, response: 'TIMEOUT', ts: Date.now() });
        this.pump();
      }, timeoutMs);
      this.queue.push({ command, resolve, timer, responses: [] });
      this.pump();
    });
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
    if (!navigator.serial) return [];
    const ports = await navigator.serial.getPorts();
    return ports.map((port, index) => {
      const info = port.getInfo();
      const vid = info.usbVendorId?.toString(16).toUpperCase() ?? '----';
      const pid = info.usbProductId?.toString(16).toUpperCase() ?? '----';
      return { id: `${index}`, label: `Porta ${index + 1} · USB ${vid}:${pid}`, available: true };
    });
  }

  private pump(): void {
    if (this.active || this.queue.length === 0 || !this.transport.isConnected()) return;
    this.active = this.queue.shift() ?? null;
    if (!this.active) return;
    void this.transport.write(`${this.active.command}\n`).catch((error: unknown) => {
      this.emit({
        severity: 'ERROR',
        code: 'HW_WRITE_FAILED',
        message: 'Falha ao enviar comando à controladora.',
        details: String(error),
      });
    });
  }

  private handleLine(line: string): void {
    if (line.startsWith('__ERROR__')) {
      this.emit({
        severity: 'CRITICAL',
        code: 'HW_READ_FAILED',
        message: 'Falha de leitura na porta serial.',
        details: line.slice(9),
      });
      this.handleClose();
      return;
    }

    this.telemetry.lastContactAt = Date.now();
    if (this.active) this.active.responses.push(line);

    const firmwareMatch = line.match(/FIRMWARE_NAME:([^\s]+)/i);
    if (firmwareMatch) this.telemetry.firmware = firmwareMatch[1];

    const positionMatch = line.match(/X:\s*(-?\d+(?:\.\d+)?)\s*Y:\s*(-?\d+(?:\.\d+)?)\s*Z:\s*(-?\d+(?:\.\d+)?)/i);
    if (positionMatch) {
      this.telemetry.position = {
        x: Number(positionMatch[1]),
        y: Number(positionMatch[2]),
        z: Number(positionMatch[3]),
      };
      this.telemetry.target = { ...this.telemetry.position };
      this.emitTelemetry();
    }

    const hotendMatch = line.match(/\bT\d*:\s*(-?\d+(?:\.\d+)?)/i);
    const bedMatch = line.match(/\bB\d*:\s*(-?\d+(?:\.\d+)?)/i);
    if (hotendMatch || bedMatch) {
      this.telemetry.temperatures = {
        hotend: hotendMatch ? Number(hotendMatch[1]) : (this.telemetry.temperatures?.hotend ?? null),
        bed: bedMatch ? Number(bedMatch[1]) : (this.telemetry.temperatures?.bed ?? null),
      };
      this.emitTelemetry();
    }

    if (/^ok\b/i.test(line)) {
      this.finishActive(true, line);
      return;
    }
    if (/^error\b/i.test(line)) {
      this.emit({
        severity: 'ERROR',
        code: 'HW_COMMAND_REJECTED',
        message: 'A controladora rejeitou um comando.',
        details: line,
      });
      this.finishActive(false, line);
      return;
    }
    if (/^echo:busy/i.test(line)) {
      this.emit({
        severity: 'INFO',
        code: 'HW_BUSY',
        message: 'Controladora ocupada processando comandos.',
      });
    }
  }

  private finishActive(ok: boolean, response: string): void {
    const pending = this.active;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    this.active = null;
    pending.resolve({
      ok,
      response: pending.responses.join(' | ') || response,
      ts: Date.now(),
    });
    this.pump();
  }

  private handleClose(): void {
    if (this.closing) return;
    this.emit({
      severity: 'ERROR',
      code: 'HW_DISCONNECTED',
      message: 'Conexão serial perdida.',
    });
    this.closeListeners.forEach((listener) => listener());
    this.emitTelemetry();
  }

  private emitTelemetry(): void {
    const snapshot = { ...this.telemetry };
    this.telemetryListeners.forEach((listener) => listener(snapshot));
  }

  private emit(event: HardwareEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }
}
