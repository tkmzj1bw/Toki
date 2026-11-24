import type { ConnectionState, PortInfo, Telemetry } from '@/types';
import { DemoAdapter } from './DemoAdapter';
import { MarlinAdapter } from './MarlinAdapter';
import type { ConnectOptions, HardwareEvent, MachineAdapter } from './types';

export type ConnectionMode = 'demo' | 'hardware';

export interface ConnectionSnapshot {
  state: ConnectionState;
  mode: ConnectionMode;
  telemetry: Telemetry;
  error: string | null;
}

export interface ReconnectPolicy {
  autoReconnect: boolean;
  delayMs: number;
  timeoutMs: number;
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

class ConnectionManager {
  private adapter: MachineAdapter | null = null;
  private mode: ConnectionMode = 'demo';
  private state: ConnectionState = 'disconnected';
  private error: string | null = null;
  private telemetry: Telemetry = emptyTelemetry();
  private wanted = false;
  private lastOptions: ConnectOptions | null = null;
  private policy: ReconnectPolicy = { autoReconnect: false, delayMs: 2000, timeoutMs: 6000 };
  private reconnectTimer: number | null = null;
  private unsubscribers: Array<() => void> = [];
  private stateListeners = new Set<(snapshot: ConnectionSnapshot) => void>();
  private eventListeners = new Set<(event: HardwareEvent) => void>();

  snapshot(): ConnectionSnapshot {
    return { state: this.state, mode: this.mode, telemetry: { ...this.telemetry }, error: this.error };
  }

  onState(listener: (snapshot: ConnectionSnapshot) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.snapshot());
    return () => this.stateListeners.delete(listener);
  }

  onEvent(listener: (event: HardwareEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  setPolicy(policy: ReconnectPolicy): void {
    this.policy = policy;
  }

  async listPorts(mode: ConnectionMode): Promise<PortInfo[]> {
    const adapter = mode === 'demo' ? new DemoAdapter() : new MarlinAdapter();
    return adapter.listPorts();
  }

  async connect(mode: ConnectionMode, options: ConnectOptions): Promise<boolean> {
    this.clearReconnect();
    this.wanted = true;
    this.mode = mode;
    this.lastOptions = options;
    this.setState('connecting');

    try {
      const adapter = mode === 'demo' ? new DemoAdapter() : new MarlinAdapter();
      await adapter.connect(options);
      this.adapter = adapter;
      this.bind(adapter);
      this.telemetry = adapter.getTelemetry();
      this.error = null;
      this.setState('connected');
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.setState('error');
      this.emit({
        severity: 'ERROR',
        code: mode === 'hardware' ? 'HW_CONNECT_FAILED' : 'DEMO_CONNECT_FAILED',
        message: 'Falha ao estabelecer comunicação.',
        details: this.error,
      });
      this.scheduleReconnect();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.wanted = false;
    this.clearReconnect();
    const adapter = this.adapter;
    this.adapter = null;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    if (adapter) await adapter.disconnect();
    this.telemetry = emptyTelemetry();
    this.error = null;
    this.setState('disconnected');
  }

  async send(command: string): Promise<{ ok: boolean; response: string; ts: number }> {
    if (!this.adapter) {
      return { ok: false, response: 'Nenhuma conexão ativa', ts: Date.now() };
    }
    return this.adapter.send(command, this.policy.timeoutMs);
  }

  private bind(adapter: MachineAdapter): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [
      adapter.onTelemetry((telemetry) => {
        this.telemetry = telemetry;
        this.emitState();
      }),
      adapter.onEvent((event) => this.emit(event)),
      adapter.onClose(() => {
        if (!this.wanted) return;
        this.setState('disconnected');
        this.scheduleReconnect();
      }),
    ];
  }

  private scheduleReconnect(): void {
    if (!this.wanted || !this.policy.autoReconnect || this.reconnectTimer !== null || !this.lastOptions) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.wanted) return;
      this.emit({
        severity: 'WARNING',
        code: 'HW_RECONNECT',
        message: `Tentativa de reconexão em ${Math.round(this.policy.delayMs / 1000)}s.`,
      });
      void this.connect(this.mode, this.lastOptions!);
    }, this.policy.delayMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emitState();
  }

  private emitState(): void {
    const snapshot = this.snapshot();
    this.stateListeners.forEach((listener) => listener(snapshot));
  }

  private emit(event: HardwareEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }
}

export const connectionManager = new ConnectionManager();
