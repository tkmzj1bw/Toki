import type { HardwareCommandResult, PortInfo, Severity, Telemetry } from '@/types';

export interface ConnectOptions {
  baudRate: number;
  portId?: string;
}

export interface HardwareEvent {
  severity: Severity;
  code: string;
  message: string;
  details?: string;
}

export interface SerialTransport {
  readonly transportId: string;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  write(data: string): Promise<void>;
  onData(listener: (line: string) => void): () => void;
  onClose(listener: () => void): () => void;
  isConnected(): boolean;
  describe(): string;
}

export interface MachineAdapter {
  readonly mode: 'hardware' | 'demo';
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  send(command: string, timeoutMs?: number): Promise<HardwareCommandResult>;
  onTelemetry(listener: (telemetry: Telemetry) => void): () => void;
  onEvent(listener: (event: HardwareEvent) => void): () => void;
  onClose(listener: () => void): () => void;
  getTelemetry(): Telemetry;
  listPorts(): Promise<PortInfo[]>;
}
