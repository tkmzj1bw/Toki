import type { ConnectOptions, SerialTransport } from './types';

export class WebSerialTransport implements SerialTransport {
  readonly transportId = 'webserial';
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private dataListeners = new Set<(line: string) => void>();
  private closeListeners = new Set<() => void>();
  private buffer = '';
  private reading = false;
  private description = 'WebSerial';

  isConnected(): boolean {
    return Boolean(this.port && this.writer);
  }

  async connect(options: ConnectOptions): Promise<void> {
    if (!('serial' in navigator) || !navigator.serial) {
      throw new Error('WebSerial não disponível neste navegador. Use Chrome ou Edge em HTTPS/localhost.');
    }

    const ports = options.portId ? await navigator.serial.getPorts() : [];
    const port = options.portId ? ports.find((_, index) => `${index}` === options.portId) : await navigator.serial.requestPort();
    if (!port) throw new Error('Porta selecionada não encontrada. Selecione novamente.');

    this.port = port;
    await port.open({ baudRate: options.baudRate });
    this.writer = port.writable?.getWriter() ?? null;
    if (!this.writer) throw new Error('A porta serial não permite escrita.');
    const info = port.getInfo();
    const vid = info.usbVendorId?.toString(16).padStart(4, '0').toUpperCase();
    const pid = info.usbProductId?.toString(16).padStart(4, '0').toUpperCase();
    this.description = vid && pid ? `USB ${vid}:${pid} · ${options.baudRate} baud` : `WebSerial · ${options.baudRate} baud`;
    void this.readLoop();
  }

  async disconnect(): Promise<void> {
    this.reading = false;
    this.writer?.releaseLock();
    this.writer = null;
    const port = this.port;
    this.port = null;
    if (port?.readable?.locked === false && port.writable?.locked === false) {
      await port.close();
    }
    this.closeListeners.forEach((listener) => listener());
  }

  async write(data: string): Promise<void> {
    if (!this.writer) throw new Error('Porta serial não conectada.');
    await this.writer.write(new TextEncoder().encode(data));
  }

  onData(listener: (line: string) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  describe(): string {
    return this.description;
  }

  private async readLoop(): Promise<void> {
    const port = this.port;
    if (!port?.readable) return;
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    this.reading = true;

    try {
      while (this.reading) {
        const { value, done } = await reader.read();
        if (done) break;
        this.buffer += decoder.decode(value, { stream: true });
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? '';
        lines.forEach((line) => {
          if (line.trim()) this.dataListeners.forEach((listener) => listener(line.trim()));
        });
      }
    } catch (error) {
      this.dataListeners.forEach((listener) => listener(`__ERROR__:${String(error)}`));
    } finally {
      reader.releaseLock();
      if (this.reading) {
        this.reading = false;
        this.closeListeners.forEach((listener) => listener());
      }
    }
  }
}
