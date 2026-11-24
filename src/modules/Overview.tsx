import { useTokiStore } from '@/store/useTokiStore';
import { MachineInspector } from '@/components/viz/MachineInspector';
import { DocThumbnail } from '@/components/viz/DocThumbnail';
import { Icon } from '@/components/ui/Icon';
import { documentStats } from '@/lib/geometry';
import { formatClock, formatDate } from '@/lib/utils';
import { rigModeLabel } from '@/types';
import type { OperatingState } from '@/types';

const stateLabel: Record<OperatingState, string> = {
  unknown: 'INDETERMINADO',
  idle: 'PRONTO',
  homing: 'REFERENCIANDO',
  jogging: 'EM MOVIMENTO',
  plotting: 'EXECUTANDO',
  paused: 'PAUSADO',
  stopped: 'PARADO',
  error: 'FALHA',
};

export function Overview(): JSX.Element {
  const telemetry = useTokiStore((s) => s.telemetry);
  const connection = useTokiStore((s) => s.connection);
  const operating = useTokiStore((s) => s.operatingState);
  const events = useTokiStore((s) => s.events);
  const projects = useTokiStore((s) => s.projects);
  const studioDoc = useTokiStore((s) => s.studioDoc);
  const rig = useTokiStore((s) => s.rig);
  const spindleCommand = useTokiStore((s) => s.spindleCommand);
  const execution = useTokiStore((s) => s.execution);
  const setActiveModule = useTokiStore((s) => s.setActiveModule);
  const setActiveProject = useTokiStore((s) => s.setActiveProject);

  const stats = documentStats(studioDoc);
  const alerts = events.filter((event) => event.severity !== 'INFO').slice(-3).reverse();
  const recentEvents = events.slice(-4).reverse();
  const recentProjects = projects.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const position = telemetry.position;
  const originLabel = telemetry.origin === 'hardware' ? 'HARDWARE' : telemetry.origin === 'demo' ? 'DEMO' : 'INDISPONÍVEL';

  return (
    <section className="module-shell">
      <div className="module-header">
        <div>
          <div className="eyebrow">MÓDULO 01 · CENTRAL DE OPERAÇÕES</div>
          <h1 className="module-title">OVERVIEW</h1>
          <div className="module-subtitle">ESTADO OPERACIONAL / VISUALIZAÇÃO DA MÁQUINA / RESUMO DO SISTEMA</div>
        </div>
        <button type="button" className="btn" onClick={() => setActiveModule('machine')}>
          <Icon name="machine" size={14} /> CONTROLE DA MÁQUINA
        </button>
      </div>

      <div className="overview-grid">
        <div className="panel machine-stage">
          <div className="panel-head">
            <span className="panel-title">VISUALIZAÇÃO DA MÁQUINA · ISO 3D</span>
            <span className="tech-code">{connection.mode === 'demo' ? 'MODO DEMO' : 'MARLIN / SERIAL'}</span>
          </div>
          <div className="operating-banner">
            <div className="operating-icon">{operating === 'error' ? '!' : '◈'}</div>
            <div>
              <div className="eyebrow">ESTADO OPERACIONAL</div>
              <div className="operating-state">{stateLabel[operating]}</div>
            </div>
            <div className="spacer" />
            <span className={`badge ${telemetry.origin === 'hardware' ? 'real' : telemetry.origin === 'demo' ? 'demo' : ''}`}>
              {originLabel}
            </span>
          </div>
          <div className="stage-frame">
            <span className="stage-corner tl" /><span className="stage-corner tr" />
            <span className="stage-corner bl" /><span className="stage-corner br" />
            <MachineInspector
              position={position}
              doc={studioDoc}
              bed={rig.profiles[rig.mode].bed}
              mode={rig.mode}
              tool={rig.profiles[rig.mode].tool}
              toolActive={rig.mode === 'cnc' ? spindleCommand.active : false}
            />
            <div className="stage-badge">{rigModeLabel[rig.mode]} · {rig.profiles[rig.mode].bed.width}×{rig.profiles[rig.mode].bed.height} MM</div>
            <div className="stage-meta">
              <span>POSIÇÃO {position ? `X${position.x.toFixed(1)} Y${position.y.toFixed(1)} Z${position.z.toFixed(1)}` : 'NÃO CONFIRMADA'}</span>
              <span>TRAÇOS VISÍVEIS {stats.visibleShapes} / {stats.shapes}</span>
              <span>EXECUÇÃO {execution.phase.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="overview-side">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">INDICADORES TÉCNICOS</span><span className="tech-code">01</span></div>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">CONEXÃO</div>
                <div className="stat-value small">{connection.state.toUpperCase()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">ORIGEM DOS DADOS</div>
                <div className="stat-value small">{originLabel}</div>
              </div>
              <div className="stat">
                <div className="stat-label">RIG ATIVA</div>
                <div className="stat-value small" title={rig.profiles[rig.mode].tool.label}>{rigModeLabel[rig.mode]}</div>
              </div>
              <div className="stat">
                <div className="stat-label">TEMPERATURA · M105</div>
                <div className="stat-value small">
                  {telemetry.temperatures
                    ? `${telemetry.temperatures.hotend ?? '—'} / ${telemetry.temperatures.bed ?? '—'} °C`
                    : '—'}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">POSIÇÃO X / Y</div>
                <div className="stat-value small">{position ? `${position.x.toFixed(1)} / ${position.y.toFixed(1)}` : '—'}</div>
              </div>
              <div className="stat">
                <div className="stat-label">POSIÇÃO Z</div>
                <div className="stat-value small">{position ? `${position.z.toFixed(1)} MM` : '—'}</div>
              </div>
              <div className="stat">
                <div className="stat-label">FIRMWARE</div>
                <div className="stat-value small" title={telemetry.firmware ?? ''}>{telemetry.firmware ?? '—'}</div>
              </div>
              <div className="stat">
                <div className="stat-label">EVENTOS</div>
                <div className="stat-value small">{String(events.length).padStart(3, '0')}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title">INFORMAÇÕES OPERACIONAIS</span><span className="tech-code">02</span></div>
            <div className="panel-body tight">
              <div className="row-between"><span className="muted">Porta</span><span className="mono">{telemetry.port ?? '—'}</span></div>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div className="row-between"><span className="muted">Baud rate</span><span className="mono">{telemetry.baud ?? '—'}</span></div>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div className="row-between"><span className="muted">Motores</span><span className="mono">{telemetry.motorsEnabled === null ? '—' : telemetry.motorsEnabled ? 'HABILITADOS' : 'DESABILITADOS'}</span></div>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div className="row-between"><span className="muted">Último contato</span><span className="mono">{telemetry.lastContactAt ? formatClock(telemetry.lastContactAt) : '—'}</span></div>
              {connection.error && <div className="accent mono" style={{ fontSize: 10, marginTop: 12 }}>{connection.error}</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title">TRABALHO ATIVO</span><span className="tech-code">03</span></div>
            <div className="panel-body tight">
              {execution.projectId ? (
                <>
                  <div className="row-between"><span className="muted">Projeto</span><strong className="mono">{projects.find((p) => p.id === execution.projectId)?.name ?? '—'}</strong></div>
                  <div className="row-between" style={{ marginTop: 10 }}><span className="muted">Progresso estimado</span><strong className="mono">{execution.progressEstimated.toFixed(0)}%</strong></div>
                  <div className="progress" style={{ marginTop: 10 }}><span className="progress-fill" style={{ width: `${execution.progressEstimated}%` }} /></div>
                  <div className="tech-code" style={{ marginTop: 8 }}>
                    CONFIRMADO: {execution.progressConfirmed === null ? 'INDISPONÍVEL' : `${execution.progressConfirmed}%`}
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ minHeight: 70 }}>Nenhum trabalho em execução.</div>
              )}
            </div>
          </div>
        </div>

        <div className="panel overview-bottom-item" style={{ gridColumn: 1 }}>
          <div className="panel-head"><span className="panel-title">ATIVIDADE RECENTE</span><span className="tech-code">EVENT FEED</span></div>
          <div className="panel-body tight">
            <div className="activity-list">
              {recentEvents.length === 0 && <div className="empty-state" style={{ minHeight: 80 }}>Nenhum evento registrado.</div>}
              {recentEvents.map((event) => (
                <div className="activity-item" key={event.id}>
                  <span className="mono muted">{formatClock(event.ts)}</span>
                  <span>{event.message}</span>
                  <span className="activity-code">{event.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ gridColumn: 2 }}>
          <div className="panel-head"><span className="panel-title">ALERTAS</span><span className="tech-code">{alerts.length}</span></div>
          <div className="panel-body tight">
            {alerts.length === 0 && <div className="empty-state" style={{ minHeight: 80 }}>Nenhum alerta ativo.</div>}
            {alerts.map((event) => (
              <div key={event.id} className="activity-item" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <div className="mono accent" style={{ fontSize: 9 }}>{event.severity} · {event.code}</div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>{event.message}</div>
                </div>
                <span className="muted" style={{ fontSize: 9 }}>{formatClock(event.ts)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ gridColumn: 3 }}>
          <div className="panel-head"><span className="panel-title">PROJETOS RECENTES</span><button type="button" className="btn btn-sm btn-ghost" onClick={() => setActiveModule('projects')}>VER TODOS</button></div>
          <div className="panel-body tight">
            {recentProjects.length === 0 && <div className="empty-state" style={{ minHeight: 80 }}>Nenhum projeto salvo.</div>}
            {recentProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="project-mini"
                style={{ width: '100%', background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => {
                  setActiveProject(project.id);
                  setActiveModule('studio');
                }}
              >
                <div className="thumb"><DocThumbnail doc={project.doc} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 11, fontWeight: 600 }}>{project.name}</div>
                  <div className="tech-code">{formatDate(project.updatedAt)} · {project.status.toUpperCase()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
