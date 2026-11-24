import { useEffect, useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { RigModeSelector } from '@/components/rig/RigModeSelector';
import type { ConnectionMode } from '@/hardware/ConnectionManager';
import { Icon } from '@/components/ui/Icon';
import { formatClock } from '@/lib/utils';

const baudRates = [9600, 19200, 38400, 57600, 115200, 250000];

export function ConnectionDrawer(): JSX.Element | null {
  const open = useTokiStore((s) => s.connectionDrawerOpen);
  const setOpen = useTokiStore((s) => s.setConnectionDrawerOpen);
  const connection = useTokiStore((s) => s.connection);
  const telemetry = useTokiStore((s) => s.telemetry);
  const rig = useTokiStore((s) => s.rig);
  const ports = useTokiStore((s) => s.ports);
  const prefs = useTokiStore((s) => s.prefs.connection);
  const refreshPorts = useTokiStore((s) => s.refreshPorts);
  const connect = useTokiStore((s) => s.connect);
  const disconnect = useTokiStore((s) => s.disconnect);
  const requestConfirmation = useTokiStore((s) => s.requestConfirmation);
  const updateConnectionPreferences = useTokiStore((s) => s.updateConnectionPreferences);
  const [mode, setMode] = useState<ConnectionMode>(connection.mode);
  const [portId, setPortId] = useState('');
  const [baudRate, setBaudRate] = useState(prefs.baudRate);
  const [busy, setBusy] = useState(false);
  const isConnected = connection.state === 'connected';
  const webSerialAvailable = typeof navigator !== 'undefined' && Boolean(navigator.serial);

  useEffect(() => {
    if (!open) return;
    void refreshPorts(mode);
  }, [open, mode, refreshPorts]);

  useEffect(() => {
    if (open && !isConnected) setMode(connection.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connection.mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const handleConnect = async (): Promise<void> => {
    setBusy(true);
    await connect(mode, baudRate, portId || undefined);
    updateConnectionPreferences({ baudRate });
    setBusy(false);
  };

  const handleDisconnect = (): void => {
    requestConfirmation({
      title: 'Desconectar da máquina',
      description: 'Comandos em andamento perderão a comunicação. A execução será interrompida se estiver ativa.',
      confirmLabel: 'DESCONECTAR',
      tone: 'danger',
      onConfirm: async () => disconnect(),
    });
  };

  return (
    <div className="overlay drawer-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Painel de conexão">
        <div className="modal-head row-between">
          <div>
            <div className="eyebrow">SISTEMA / COMUNICAÇÃO</div>
            <div className="modal-title">CONEXÃO DA MÁQUINA</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>ESTADO ATUAL</div>
            <div className="panel" style={{ padding: 14 }}>
              <div className="row-between"><span className="muted">Estado</span><strong className="mono">{connection.state.toUpperCase()}</strong></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Modo</span><strong className="mono">{connection.mode.toUpperCase()}</strong></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Porta</span><strong className="mono">{telemetry.port ?? '—'}</strong></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Firmware</span><strong className="mono">{telemetry.firmware ?? '—'}</strong></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Último contato</span><strong className="mono">{telemetry.lastContactAt ? formatClock(telemetry.lastContactAt) : '—'}</strong></div>
              {connection.error && <div className="accent mono" style={{ fontSize: 10, marginTop: 10 }}>{connection.error}</div>}
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>CONFIGURAÇÃO DA RIG</div>
            <div className="panel" style={{ padding: 14 }}>
              <RigModeSelector compact />
              <div className="row-between" style={{ marginTop: 12 }}><span className="muted">Ferramenta</span><strong className="mono">{rig.profiles[rig.mode].tool.label}</strong></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Envelope</span><span className="mono">{rig.profiles[rig.mode].bed.width} × {rig.profiles[rig.mode].bed.height} mm</span></div>
              <div className="tech-code" style={{ marginTop: 10 }}>A TROCA DE PERFIL É PROTEGIDA POR CONFIRMAÇÃO</div>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>MODO DE OPERAÇÃO</div>
            <div className="segmented" style={{ width: '100%' }}>
              <button type="button" className={mode === 'demo' ? 'active' : ''} onClick={() => !isConnected && setMode('demo')} disabled={isConnected}>DEMO</button>
              <button type="button" className={mode === 'hardware' ? 'active' : ''} onClick={() => !isConnected && setMode('hardware')} disabled={isConnected}>MARLIN / SERIAL</button>
            </div>
            {mode === 'demo' && (
              <div className="badge demo" style={{ marginTop: 10 }}>NENHUM HARDWARE É ACIONADO</div>
            )}
            {mode === 'hardware' && !webSerialAvailable && (
              <div className="accent" style={{ fontSize: 11, marginTop: 10 }}>
                WebSerial indisponível neste navegador. Use Chrome ou Edge em HTTPS/localhost.
              </div>
            )}
          </div>

          {mode === 'hardware' && (
            <div className="field-row">
              <label className="label">
                PORTA
                <select className="select" value={portId} onChange={(event) => setPortId(event.target.value)}>
                  <option value="">SOLICITAR PORTA…</option>
                  {ports.map((port) => (
                    <option key={port.id} value={port.id}>{port.label}</option>
                  ))}
                </select>
              </label>
              <label className="label">
                BAUD RATE
                <select className="select" value={baudRate} onChange={(event) => setBaudRate(Number(event.target.value))}>
                  {baudRates.map((rate) => (
                    <option key={rate} value={rate}>{rate}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="field-row">
            <label className="label">
              RECONEXÃO AUTOMÁTICA
              <button
                type="button"
                className={`toggle${prefs.autoReconnect ? ' on' : ''}`}
                onClick={() => updateConnectionPreferences({ autoReconnect: !prefs.autoReconnect })}
                aria-pressed={prefs.autoReconnect}
                aria-label="Reconexão automática"
              />
            </label>
            <label className="label">
              TIMEOUT (MS)
              <input
                className="input"
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={prefs.commandTimeoutMs}
                onChange={(event) => updateConnectionPreferences({ commandTimeoutMs: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="row">
            {!isConnected ? (
              <button type="button" className="btn btn-primary" onClick={() => void handleConnect()} disabled={busy || connection.state === 'connecting'}>
                {busy ? 'CONECTANDO…' : mode === 'demo' ? 'ATIVAR DEMO' : 'CONECTAR'}
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={handleDisconnect}>DESCONECTAR</button>
            )}
            <button type="button" className="btn" onClick={() => void refreshPorts(mode)}>
              <Icon name="refresh" size={14} /> ATUALIZAR PORTAS
            </button>
          </div>

          <div className="muted" style={{ fontSize: 10, lineHeight: 1.6 }}>
            A conexão só é declarada ativa após resposta positiva do comando M115. Posições são exibidas apenas quando confirmadas pela controladora.
          </div>
        </div>
      </aside>
    </div>
  );
}
