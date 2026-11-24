import { useMemo } from 'react';
import { dataOriginLabel, useTokiStore } from '@/store/useTokiStore';
import { EventChart } from '@/components/viz/EventChart';
import { MachineInspector } from '@/components/viz/MachineInspector';
import { Icon } from '@/components/ui/Icon';
import { documentStats } from '@/lib/geometry';
import { formatClock, formatDuration, round } from '@/lib/utils';
import { rigModeLabel } from '@/types';

export function Monitoring(): JSX.Element {
  const telemetry = useTokiStore((s) => s.telemetry);
  const connection = useTokiStore((s) => s.connection);
  const operating = useTokiStore((s) => s.operatingState);
  const events = useTokiStore((s) => s.events);
  const doc = useTokiStore((s) => s.studioDoc);
  const rig = useTokiStore((s) => s.rig);
  const spindleCommand = useTokiStore((s) => s.spindleCommand);
  const execution = useTokiStore((s) => s.execution);
  const projects = useTokiStore((s) => s.projects);
  const setConsoleOpen = useTokiStore((s) => s.setConsoleOpen);
  const queryTemperatures = useTokiStore((s) => s.queryTemperatures);

  const stats = useMemo(() => documentStats(doc), [doc]);
  const commandEvents = events.filter((event) => event.code.startsWith('CMD_'));
  const critical = events.filter((event) => event.severity === 'ERROR' || event.severity === 'CRITICAL');
  const originLabel = dataOriginLabel(telemetry.origin);
  const profile = rig.profiles[rig.mode];
  const temps = telemetry.temperatures;
  const hasTemps = Boolean(temps && (temps.hotend !== null || temps.bed !== null));

  const cards = [
    {
      label: 'ESTADO DE COMUNICAÇÃO',
      value: connection.state.toUpperCase(),
      foot: `${connection.mode.toUpperCase()} · ${telemetry.port ?? 'SEM PORTA'}`,
    },
    {
      label: 'POSIÇÃO CONFIRMADA',
      value: telemetry.position ? `${telemetry.position.x.toFixed(1)} / ${telemetry.position.y.toFixed(1)}` : '—',
      foot: telemetry.position ? `Z ${telemetry.position.z.toFixed(1)} MM · ${originLabel}` : 'NENHUM DADO DISPONÍVEL',
    },
    {
      label: 'ESTADO OPERACIONAL',
      value: operating.toUpperCase(),
      foot: execution.phase === 'running' ? `EXECUÇÃO ${execution.mode.toUpperCase()}` : 'SEM EXECUÇÃO ATIVA',
    },
    {
      label: 'CONFIGURAÇÃO DA RIG',
      value: rigModeLabel[rig.mode],
      foot: `FERRAMENTA ${profile.tool.label}`,
    },
    {
      label: 'TEMPERATURA · M105',
      value: hasTemps ? `${temps?.hotend ?? '—'} / ${temps?.bed ?? '—'}` : '—',
      foot: hasTemps ? `BICO / MESA °C · ${originLabel}${telemetry.origin === 'demo' ? ' · VIRTUAL' : ''}` : 'SENSOR INDISPONÍVEL',
    },
    {
      label: 'FUSO · COMANDADO',
      value: spindleCommand.active ? `${spindleCommand.direction} ${spindleCommand.rpm}` : 'PARADO',
      foot: `RPM COMANDADO · ${dataOriginLabel(spindleCommand.origin)} · SEM MEDIÇÃO`,
    },
    {
      label: 'COMANDOS REGISTRADOS',
      value: String(commandEvents.length).padStart(3, '0'),
      foot: `${events.length} EVENTOS NO CONSOLE`,
    },
  ];

  return (
    <section className="module-shell">
      <div className="module-header">
        <div>
          <div className="eyebrow">MÓDULO 04 · TELEMETRIA E DIAGNÓSTICO</div>
          <h1 className="module-title">MONITORING</h1>
          <div className="module-subtitle">INDICADORES REAIS / EVENTOS / VISUALIZAÇÃO DA MÁQUINA</div>
        </div>
        <div className="row">
          {rig.mode === 'printer3d' && (
            <button type="button" className="btn" disabled={connection.state !== 'connected'} onClick={() => void queryTemperatures()}>
              <Icon name="thermal" size={14} /> CONSULTAR M105
            </button>
          )}
          <button type="button" className="btn" onClick={() => setConsoleOpen(true)}>
            <Icon name="command" size={14} /> ABRIR CONSOLE
          </button>
        </div>
      </div>

      <div className="monitor-grid">
        {cards.map((card) => (
          <div key={card.label} className="metric-card">
            <div className="stat-label">{card.label}</div>
            <div className="stat-value small" title={card.value}>{card.value}</div>
            <div className="metric-foot"><span>{card.foot}</span></div>
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">ATIVIDADE DE EVENTOS · 10 MIN</span><span className="tech-code">DADOS REAIS DO CONSOLE</span></div>
          <div className="panel-body"><EventChart events={events} /></div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title">VISUALIZAÇÃO DA MÁQUINA</span><span className="tech-code">{originLabel}</span></div>
          <div className="stage-frame" style={{ flex: 1, padding: 8 }}>
            <MachineInspector
              position={telemetry.position}
              doc={doc}
              bed={profile.bed}
              mode={rig.mode}
              tool={profile.tool}
              toolActive={rig.mode === 'cnc' ? spindleCommand.active : false}
              showLabels={false}
            />
            <div className="stage-badge">{rigModeLabel[rig.mode]} · {telemetry.position ? 'POSIÇÃO CONFIRMADA' : 'SEM TELEMETRIA'}</div>
          </div>
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: 'var(--gap)', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 0.7fr)' }}>
        <div className="panel">
          <div className="panel-head"><span className="panel-title">HISTÓRICO DE ATIVIDADE</span><span className="tech-code">{events.length} REGISTROS</span></div>
          <div className="panel-body tight">
            <div className="activity-list">
              {events.slice(-12).reverse().map((event) => (
                <div className="activity-item" key={event.id}>
                  <span className="mono muted">{formatClock(event.ts)}</span>
                  <span>{event.message}</span>
                  <span className="activity-code">{event.code}</span>
                </div>
              ))}
              {!events.length && <div className="empty-state" style={{ minHeight: 100 }}>Nenhuma atividade registrada.</div>}
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--gap)' }}>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">ALERTAS E FALHAS</span><span className="tech-code">{critical.length}</span></div>
            <div className="panel-body tight">
              {critical.slice(-5).reverse().map((event) => (
                <div key={event.id} className="activity-item" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div className="mono accent" style={{ fontSize: 9 }}>{event.severity} · {event.code}</div>
                    <div style={{ marginTop: 3, fontSize: 11 }}>{event.message}</div>
                  </div>
                  <span className="muted" style={{ fontSize: 9 }}>{formatClock(event.ts)}</span>
                </div>
              ))}
              {!critical.length && <div className="empty-state" style={{ minHeight: 70 }}>Nenhuma falha registrada.</div>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">RESUMO OPERACIONAL</span><span className="tech-code">INFO</span></div>
            <div className="panel-body tight">
              <div className="row-between"><span className="muted">Desenho ativo</span><span className="mono">{stats.shapes} traços</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Tempo estimado</span><span className="mono">{round(stats.estimatedSeconds, 1)}s</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Décorrido (exec.)</span><span className="mono">{formatDuration(execution.elapsedMs)}</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Rig ativa</span><span className="mono">{rigModeLabel[rig.mode]}</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Thermal runaway</span><span className="mono">{rig.acknowledged.thermalRunaway ? 'CONFIRMADO' : 'PENDENTE'}</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Projetos</span><span className="mono">{projects.length}</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Progresso confirmado</span><span className="mono">{execution.progressConfirmed === null ? 'INDISPONÍVEL' : `${execution.progressConfirmed}%`}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
