import { useEffect, useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { RigModeSelector } from '@/components/rig/RigModeSelector';
import { Icon } from '@/components/ui/Icon';
import { formatClock, formatDateTime } from '@/lib/utils';
import { rigModeLabel } from '@/types';
import type { OperatingState } from '@/types';

const moduleMeta: Record<string, { label: string; path: string }> = {
  overview: { label: 'OVERVIEW', path: 'SYS / 01 / CENTRAL DE OPERAÇÕES' },
  studio: { label: 'PLOT STUDIO', path: 'SYS / 02 / PREPARAÇÃO VETORIAL' },
  machine: { label: 'MACHINE CONTROL', path: 'SYS / 03 / CONTROLE DA MÁQUINA' },
  monitoring: { label: 'MONITORING', path: 'SYS / 04 / TELEMETRIA' },
  projects: { label: 'PROJECT MANAGER', path: 'SYS / 05 / BIBLIOTECA E FILA' },
  system: { label: 'SYSTEM CENTER', path: 'SYS / 06 / CONFIGURAÇÕES' },
};

const stateLabel: Record<OperatingState | ConnectionStateLike, string> = {
  unknown: 'INDETERMINADO',
  idle: 'PRONTO',
  homing: 'REFERENCIANDO',
  jogging: 'MOVIMENTO',
  plotting: 'EXECUTANDO',
  paused: 'PAUSADO',
  stopped: 'PARADO',
  error: 'FALHA',
  disconnected: 'DESCONECTADO',
  connecting: 'CONECTANDO',
  connected: 'CONECTADO',
};

type ConnectionStateLike = 'disconnected' | 'connecting' | 'connected' | 'error';

type PopoverId = 'rig' | 'connection' | 'position' | 'firmware' | 'events' | 'notifications' | null;

export function Header(): JSX.Element {
  const activeModule = useTokiStore((s) => s.activeModule);
  const connection = useTokiStore((s) => s.connection);
  const telemetry = useTokiStore((s) => s.telemetry);
  const operating = useTokiStore((s) => s.operatingState);
  const rig = useTokiStore((s) => s.rig);
  const notifications = useTokiStore((s) => s.notifications);
  const events = useTokiStore((s) => s.events);
  const setConnectionDrawerOpen = useTokiStore((s) => s.setConnectionDrawerOpen);
  const dismissNotification = useTokiStore((s) => s.dismissNotification);
  const markAllRead = useTokiStore((s) => s.markAllNotificationsRead);
  const setActiveModule = useTokiStore((s) => s.setActiveModule);
  const [now, setNow] = useState(Date.now());
  const [popover, setPopover] = useState<PopoverId>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;
  const meta = moduleMeta[activeModule] ?? moduleMeta.overview;
  const position = telemetry.position
    ? `${telemetry.position.x.toFixed(1)} ${telemetry.position.y.toFixed(1)} ${telemetry.position.z.toFixed(1)}`
    : '—';
  const origin = telemetry.origin === 'hardware' ? 'HW' : telemetry.origin === 'demo' ? 'DEMO' : '—';
  const safetyMissing = rig.mode === 'cnc'
    ? (['spindleFirmware', 'enclosure', 'workholding'] as const).filter((key) => !rig.acknowledged[key]).length
    : rig.mode === 'printer3d' && !rig.acknowledged.thermalRunaway ? 1 : 0;

  const toggle = (id: Exclude<PopoverId, null>) => setPopover((current) => (current === id ? null : id));

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-module">
          <span className="topbar-module-name">{meta.label}</span>
          <span className="topbar-module-path">{meta.path}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="popover-anchor rig-anchor">
          <button type="button" className="rig-pill" onClick={() => toggle('rig')} aria-label="Configuração da rig" title={rigModeLabel[rig.mode]}>
            <span className="rig-dot" />
            <span className="rig-pill-label">{rigModeLabel[rig.mode]}</span>
            {safetyMissing > 0 && <span className="rig-missing">{safetyMissing}</span>}
          </button>
          {popover === 'rig' && (
            <div className="popover rig-popover">
              <div className="popover-title">CONFIGURAÇÃO DA RIG</div>
              <RigModeSelector compact />
              <div className="col" style={{ gap: 8, marginTop: 12 }}>
                <div className="row-between"><span className="muted">Ferramenta</span><strong className="mono">{rig.profiles[rig.mode].tool.label}</strong></div>
                <div className="row-between"><span className="muted">Segurança</span><strong className={safetyMissing ? 'accent mono' : 'mono'}>{safetyMissing ? `${safetyMissing} PENDENTE(S)` : 'OK'}</strong></div>
                <div className="tech-code">TROCA EXIGE CONFIRMAÇÃO EXPLÍCITA</div>
                <button type="button" className="btn btn-block" onClick={() => { setActiveModule('system'); setPopover(null); }}>
                  ABRIR SYSTEM CENTER
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="popover-anchor">
          <button
            type="button"
            className={`connection-pill ${connection.state === 'error' ? 'error' : ''}`}
            onClick={() => toggle('connection')}
            aria-label="Detalhes da conexão"
          >
            <span className={`dot ${connection.state}`} />
            {stateLabel[connection.state]}
            {connection.mode === 'demo' && <span className="muted">/ DEMO</span>}
          </button>
          {popover === 'connection' && (
            <div className="popover">
              <div className="popover-title">COMUNICAÇÃO</div>
              <div className="col" style={{ gap: 8 }}>
                <div className="row-between">
                  <span className="muted">Estado</span>
                  <strong className="mono">{stateLabel[connection.state]}</strong>
                </div>
                <div className="row-between">
                  <span className="muted">Modo</span>
                  <strong className="mono">{connection.mode.toUpperCase()}</strong>
                </div>
                <div className="row-between">
                  <span className="muted">Porta</span>
                  <strong className="mono">{telemetry.port ?? 'NÃO CONECTADO'}</strong>
                </div>
                <div className="row-between">
                  <span className="muted">Baud</span>
                  <strong className="mono">{telemetry.baud ?? '—'}</strong>
                </div>
                {connection.error && <div className="accent mono" style={{ fontSize: 10 }}>{connection.error}</div>}
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setConnectionDrawerOpen(true);
                    setPopover(null);
                  }}
                >
                  ABRIR PAINEL
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="popover-anchor">
          <button type="button" className="header-metric" onClick={() => toggle('position')} aria-label="Detalhes da posição">
            <span className="header-metric-label">POS X/Y/Z</span>
            <span className="header-metric-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{position}</span>
          </button>
          {popover === 'position' && (
            <div className="popover">
              <div className="popover-title">POSIÇÃO CONFIRMADA</div>
              {telemetry.position ? (
                <div className="col" style={{ gap: 6 }}>
                  <div className="row-between"><span className="muted">X</span><span className="mono">{telemetry.position.x.toFixed(3)} mm</span></div>
                  <div className="row-between"><span className="muted">Y</span><span className="mono">{telemetry.position.y.toFixed(3)} mm</span></div>
                  <div className="row-between"><span className="muted">Z</span><span className="mono">{telemetry.position.z.toFixed(3)} mm</span></div>
                  <div className="row-between"><span className="muted">Origem</span><span className="mono">{origin}</span></div>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 11 }}>Nenhuma posição confirmada. Consulte M114 com a máquina conectada.</div>
              )}
            </div>
          )}
        </div>

        <div className="popover-anchor">
          <button type="button" className="header-metric" onClick={() => toggle('firmware')} aria-label="Detalhes do firmware">
            <span className="header-metric-label">ORIGEM</span>
            <span className="header-metric-value">{origin}</span>
          </button>
          {popover === 'firmware' && (
            <div className="popover">
              <div className="popover-title">CONTROLADORA</div>
              <div className="col" style={{ gap: 6 }}>
                <div className="row-between"><span className="muted">Firmware</span><span className="mono">{telemetry.firmware ?? '—'}</span></div>
                <div className="row-between"><span className="muted">Motores</span><span className="mono">{telemetry.motorsEnabled === null ? '—' : telemetry.motorsEnabled ? 'ON' : 'OFF'}</span></div>
                <div className="row-between"><span className="muted">Último contato</span><span className="mono">{telemetry.lastContactAt ? formatClock(telemetry.lastContactAt) : '—'}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="popover-anchor">
          <button type="button" className="header-metric" onClick={() => toggle('events')} aria-label="Detalhes dos eventos">
            <span className="header-metric-label">EVENTOS</span>
            <span className="header-metric-value">{String(events.length).padStart(3, '0')}</span>
          </button>
          {popover === 'events' && (
            <div className="popover">
              <div className="popover-title">CONSOLE</div>
              <div className="muted" style={{ fontSize: 11 }}>{events.length} eventos registrados nesta sessão.</div>
              <button type="button" className="btn btn-block" style={{ marginTop: 10 }} onClick={() => setActiveModule('monitoring')}>
                VER MONITORAMENTO
              </button>
            </div>
          )}
        </div>

        <div className="v-divider" />

        <div className="popover-anchor">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => toggle('notifications')} aria-label="Notificações">
            <Icon name="bell" size={18} />
            {unread > 0 && <span className="nav-badge" style={{ position: 'absolute', top: 0, right: 0 }}>{unread}</span>}
          </button>
          {popover === 'notifications' && (
            <div className="popover" style={{ width: 340 }}>
              <div className="row-between">
                <div className="popover-title" style={{ margin: 0 }}>NOTIFICAÇÕES</div>
                <button type="button" className="btn btn-sm btn-ghost" onClick={markAllRead}>MARCAR LIDAS</button>
              </div>
              <div className="col" style={{ gap: 8, marginTop: 12, maxHeight: 280, overflow: 'auto' }}>
                {notifications.length === 0 && <span className="muted" style={{ fontSize: 11 }}>Nenhuma notificação.</span>}
                {notifications.slice().reverse().map((item) => (
                  <div key={item.id} className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono accent" style={{ fontSize: 9 }}>{item.code} · {item.severity}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>{item.title}</div>
                      <div className="muted" style={{ fontSize: 10 }}>{formatDateTime(item.ts)}</div>
                    </div>
                    <button type="button" className="mini-icon-btn" onClick={() => dismissNotification(item.id)} aria-label="Dispensar">
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className="header-clock">{formatClock(now)}</span>
          <span className="tech-code">{stateLabel[operating]}</span>
        </div>
      </div>
    </header>
  );
}
