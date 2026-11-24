import { useEffect, useMemo, useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { DocThumbnail } from '@/components/viz/DocThumbnail';
import { PlotCanvas } from '@/components/viz/PlotCanvas';
import { MachineInspector } from '@/components/viz/MachineInspector';
import { Icon } from '@/components/ui/Icon';
import { documentStats } from '@/lib/geometry';
import { formatBytes, formatDateTime, formatDuration } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types';

type Tab = 'library' | 'files' | 'history' | 'queue' | 'execution';

const statusLabel: Record<ProjectStatus, string> = {
  draft: 'RASCUNHO',
  queued: 'AGUARDANDO',
  running: 'EM EXECUÇÃO',
  interrupted: 'INTERROMPIDO',
  completed_real: 'CONCLUÍDO · REAL',
  completed_virtual: 'CONCLUÍDO · VIRTUAL',
};

const statusClass = (status: ProjectStatus): string =>
  status === 'completed_real' ? 'real' : status === 'completed_virtual' ? 'virtual' : '';

export function ProjectManager(): JSX.Element {
  const projects = useTokiStore((s) => s.projects);
  const activeProjectId = useTokiStore((s) => s.activeProjectId);
  const setActiveProject = useTokiStore((s) => s.setActiveProject);
  const createProject = useTokiStore((s) => s.createProject);
  const deleteProject = useTokiStore((s) => s.deleteProject);
  const duplicateProject = useTokiStore((s) => s.duplicateProject);
  const renameProject = useTokiStore((s) => s.renameProject);
  const enqueueProject = useTokiStore((s) => s.enqueueProject);
  const setActiveModule = useTokiStore((s) => s.setActiveModule);
  const execution = useTokiStore((s) => s.execution);
  const startExecution = useTokiStore((s) => s.startExecution);
  const advanceExecution = useTokiStore((s) => s.advanceExecution);
  const pauseExecution = useTokiStore((s) => s.pauseExecution);
  const resumeExecution = useTokiStore((s) => s.resumeExecution);
  const cancelExecution = useTokiStore((s) => s.cancelExecution);
  const completeExecution = useTokiStore((s) => s.completeExecution);
  const requestConfirmation = useTokiStore((s) => s.requestConfirmation);
  const connection = useTokiStore((s) => s.connection);
  const telemetry = useTokiStore((s) => s.telemetry);

  const [tab, setTab] = useState<Tab>('library');
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('TODAS');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [executionMode, setExecutionMode] = useState<'demo' | 'hardware'>('demo');

  useEffect(() => {
    if (execution.phase !== 'running') return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      advanceExecution(now - last);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [execution.phase, advanceExecution]);

  const folders = useMemo(() => ['TODAS', ...Array.from(new Set(projects.map((p) => p.folder)))], [projects]);
  const filtered = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = folder === 'TODAS' || project.folder === folder;
    return matchesSearch && matchesFolder;
  });
  const executionProject = projects.find((p) => p.id === execution.projectId);
  const executionStats = executionProject ? documentStats(executionProject.doc) : null;
  const remainingMs = executionStats ? Math.max(0, executionStats.estimatedSeconds * 1000 - execution.elapsedMs) : 0;

  const filteredByStatus = (statuses: ProjectStatus[]): Project[] =>
    projects.filter((project) => statuses.includes(project.status));

  const create = (): void => {
    if (!newName.trim()) return;
    const id = createProject(newName);
    setActiveProject(id);
    setNewName('');
    setCreating(false);
  };

  const openInStudio = (project: Project): void => {
    setActiveProject(project.id);
    setActiveModule('studio');
  };

  const start = (projectId: string, mode: 'demo' | 'hardware'): void => {
    if (mode === 'hardware' && connection.state !== 'connected') return;
    requestConfirmation({
      title: mode === 'hardware' ? 'Iniciar execução real' : 'Iniciar simulação virtual',
      description:
        mode === 'hardware'
          ? 'O G-code será enviado à controladora conectada. Confirme que a área de trabalho está livre.'
          : 'A execução será apenas uma simulação por software. Nenhum comando será enviado à máquina.',
      confirmLabel: mode === 'hardware' ? 'INICIAR MÁQUINA' : 'INICIAR SIMULAÇÃO',
      tone: mode === 'hardware' ? 'danger' : 'default',
      detail: projects.find((p) => p.id === projectId)?.name,
      onConfirm: () => {
        startExecution(projectId, mode);
        setTab('execution');
      },
    });
  };

  const conclude = (kind: 'real' | 'virtual'): void => {
    requestConfirmation({
      title: kind === 'real' ? 'Confirmar conclusão real' : 'Registrar conclusão virtual',
      description:
        kind === 'real'
          ? 'Confirme que a máquina finalizou o trabalho e que o resultado foi verificado fisicamente.'
          : 'O trabalho será marcado como concluído apenas na simulação, sem afirmar execução física.',
      confirmLabel: kind === 'real' ? 'CONFIRMAR REAL' : 'REGISTRAR VIRTUAL',
      tone: kind === 'real' ? 'default' : 'danger',
      onConfirm: () => completeExecution(kind),
    });
  };

  const cancel = (): void => {
    requestConfirmation({
      title: 'Cancelar execução',
      description: 'A execução será interrompida e o projeto marcado como interrompido.',
      confirmLabel: 'CANCELAR EXECUÇÃO',
      tone: 'danger',
      onConfirm: () => cancelExecution(),
    });
  };

  return (
    <section className="module-shell">
      <div className="module-header">
        <div>
          <div className="eyebrow">MÓDULO 05 · BIBLIOTECA E FILA DE TRABALHOS</div>
          <h1 className="module-title">PROJECT MANAGER</h1>
          <div className="module-subtitle">{projects.length} PROJETOS · {filteredByStatus(['queued']).length} AGUARDANDO · {filteredByStatus(['completed_real', 'completed_virtual']).length} CONCLUÍDOS</div>
        </div>
        <div className="row">
          <input className="input" style={{ width: 180 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="BUSCAR PROJETO" aria-label="Buscar projeto" />
          <button type="button" className="btn btn-primary" onClick={() => setCreating(!creating)}><Icon name="plus" size={14} /> NOVO</button>
        </div>
      </div>

      {creating && (
        <div className="panel" style={{ marginBottom: 'var(--gap)' }}>
          <div className="panel-body tight row">
            <input className="input" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="NOME DO PROJETO" aria-label="Nome do novo projeto" onKeyDown={(event) => event.key === 'Enter' && create()} />
            <button type="button" className="btn btn-primary" onClick={create}>CRIAR</button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>CANCELAR</button>
          </div>
        </div>
      )}

      <div className="project-tabs" role="tablist">
        {([
          ['library', 'BIBLIOTECA'],
          ['files', 'ARQUIVOS'],
          ['history', 'HISTÓRICO'],
          ['queue', 'FILA DE EXECUÇÃO'],
          ['execution', 'EXECUÇÃO'],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`project-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'library' && (
        <>
          <div className="row" style={{ marginBottom: 'var(--gap)' }}>
            <span className="eyebrow">PASTA</span>
            <select className="select" style={{ width: 180 }} value={folder} onChange={(event) => setFolder(event.target.value)} aria-label="Filtrar por pasta">
              {folders.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <span className="tech-code">{filtered.length} ITENS</span>
          </div>
          <div className="project-card-grid">
            {filtered.map((project) => {
              const stats = documentStats(project.doc);
              return (
                <div key={project.id} className={`project-card${activeProjectId === project.id ? ' selected' : ''}`}>
                  <div className="project-card-thumb"><DocThumbnail doc={project.doc} /></div>
                  <div className="project-card-body">
                    {editingId === project.id ? (
                      <div className="row" style={{ gap: 4 }}>
                        <input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Renomear projeto" />
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => { renameProject(project.id, editName); setEditingId(null); }}>OK</button>
                      </div>
                    ) : (
                      <div className="project-name" title={project.name}>{project.name}</div>
                    )}
                    <div className="row-between">
                      <span className={`status-tag ${statusClass(project.status)}`}>{statusLabel[project.status]}</span>
                      <span className="tech-code">{project.folder}</span>
                    </div>
                    <div className="tech-code" style={{ marginTop: 10 }}>{formatDateTime(project.updatedAt)}</div>
                    <div className="tech-code">{stats.shapes} traços · {stats.estimatedSeconds}s estimados</div>
                    <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => openInStudio(project)}>ABRIR</button>
                      <button type="button" className="btn btn-sm" onClick={() => enqueueProject(project.id)} disabled={project.status === 'queued'}>FILA</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => { duplicateProject(project.id); }} title="Duplicar"><Icon name="layers" size={12} /></button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditingId(project.id); setEditName(project.name); }} title="Renomear">REN</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => deleteProject(project.id)} title="Excluir"><Icon name="trash" size={12} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!filtered.length && <div className="empty-state">Nenhum projeto encontrado.</div>}
          </div>
        </>
      )}

      {tab === 'files' && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">ARQUIVOS DA BIBLIOTECA</span><span className="tech-code">ARMAZENAMENTO LOCAL</span></div>
          <div className="panel-body flush">
            <table className="file-table">
              <thead><tr><th>NOME</th><th>FORMATO</th><th>TAMANHO</th><th>MODIFICADO</th><th>PASTA</th><th>STATUS</th></tr></thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}.json</td>
                    <td className="mono">TKI / JSON</td>
                    <td className="mono">{formatBytes(new Blob([JSON.stringify(project.doc)]).size)}</td>
                    <td className="mono">{formatDateTime(project.updatedAt)}</td>
                    <td className="mono">{project.folder}</td>
                    <td><span className={`status-tag ${statusClass(project.status)}`}>{statusLabel[project.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="empty-state" style={{ minHeight: 100 }}>Nenhum arquivo.</div>}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">HISTÓRICO DE TRABALHOS</span><span className="tech-code">REGISTROS LOCAIS</span></div>
          <div className="panel-body tight">
            {projects.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((project) => (
              <div className="activity-item" key={project.id}>
                <span className="mono muted">{formatDateTime(project.updatedAt)}</span>
                <span>{project.name}</span>
                <span className={`status-tag ${statusClass(project.status)}`}>{statusLabel[project.status]}</span>
              </div>
            ))}
            {!projects.length && <div className="empty-state" style={{ minHeight: 100 }}>Nenhum registro.</div>}
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="kanban">
          {([
            { title: 'AGUARDANDO', statuses: ['draft', 'queued'] as ProjectStatus[] },
            { title: 'EM EXECUÇÃO', statuses: ['running'] as ProjectStatus[] },
            { title: 'CONCLUÍDOS', statuses: ['completed_real', 'completed_virtual'] as ProjectStatus[] },
          ]).map((column) => (
            <div className="kanban-col" key={column.title}>
              <div className="kanban-head">
                <span>{column.title}</span>
                <span className="badge">{filteredByStatus(column.statuses).length}</span>
              </div>
              <div className="kanban-body">
                {filteredByStatus(column.statuses).map((project) => (
                  <div className="queue-card" key={project.id}>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="thumb" style={{ width: 38, height: 38 }}><DocThumbnail doc={project.doc} /></div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="truncate" style={{ fontSize: 11, fontWeight: 600 }}>{project.name}</div>
                        <div className="tech-code">{project.folder} · {documentStats(project.doc).shapes} traços</div>
                      </div>
                    </div>
                    <div className="row-between">
                      <span className={`status-tag ${statusClass(project.status)}`}>{statusLabel[project.status]}</span>
                      <div className="row" style={{ gap: 4 }}>
                        {column.title === 'AGUARDANDO' && (
                          <>
                            <button type="button" className="btn btn-sm" onClick={() => enqueueProject(project.id)} disabled={project.status === 'queued'}>FILA</button>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => start(project.id, executionMode)} disabled={executionMode === 'hardware' && connection.state !== 'connected'}>INICIAR</button>
                          </>
                        )}
                        {column.title === 'EM EXECUÇÃO' && (
                          <button type="button" className="btn btn-sm" onClick={() => setTab('execution')}>ACOMPANHAR</button>
                        )}
                        {column.title === 'CONCLUÍDOS' && (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => openInStudio(project)}>ABRIR</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!filteredByStatus(column.statuses).length && <div className="empty-state" style={{ minHeight: 80 }}>Nenhum trabalho.</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'execution' && (
        <div className="execution-layout">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">ACOMPANHAMENTO DE EXECUÇÃO</span>
              <span className={`badge ${execution.mode === 'demo' ? 'demo' : execution.mode === 'hardware' ? 'real' : ''}`}>{execution.mode.toUpperCase()}</span>
            </div>
            <div className="panel-body col">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <div className="segmented">
                  <button type="button" className={executionMode === 'demo' ? 'active' : ''} onClick={() => setExecutionMode('demo')}>DEMO</button>
                  <button type="button" className={executionMode === 'hardware' ? 'active' : ''} onClick={() => setExecutionMode('hardware')} disabled={connection.state !== 'connected'}>MÁQUINA</button>
                </div>
                <select className="select" style={{ width: 240 }} value={execution.projectId ?? ''} onChange={(event) => setActiveProject(event.target.value)} aria-label="Projeto da execução">
                  <option value="">SELECIONAR PROJETO…</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                {execution.phase === 'idle' || execution.phase === 'cancelled' || execution.phase.endsWith('_virtual') || execution.phase.endsWith('_real') ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!execution.projectId}
                    onClick={() => execution.projectId && start(execution.projectId, executionMode)}
                  >
                    <Icon name="play" size={14} /> INICIAR
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn" onClick={() => (execution.phase === 'paused' ? resumeExecution() : pauseExecution())}>
                      <Icon name={execution.phase === 'paused' ? 'play' : 'pause'} size={14} />
                      {execution.phase === 'paused' ? 'RETOMAR' : 'PAUSAR'}
                    </button>
                    <button type="button" className="btn btn-danger" onClick={cancel}><Icon name="stop" size={14} /> CANCELAR</button>
                  </>
                )}
              </div>

              <div className="execution-views">
                <div className="panel">
                  <div className="panel-head"><span className="panel-title">PRÉVIA 2D / TRAJETÓRIA</span><span className="tech-code">{executionProject?.name ?? '—'}</span></div>
                  <PlotCanvas height="300px" />
                </div>
                <div className="panel">
                  <div className="panel-head"><span className="panel-title">MÁQUINA 3D</span><span className="tech-code">{telemetry.position ? 'POSIÇÃO CONFIRMADA' : 'SEM TELEMETRIA'}</span></div>
                  <div className="stage-frame" style={{ flex: 1, padding: 8 }}>
                    <MachineInspector position={telemetry.position} doc={executionProject?.doc} showLabels={false} />
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><span className="panel-title">PROGRESSO</span><span className="tech-code">{execution.phase.toUpperCase()}</span></div>
                <div className="panel-body tight">
                  <div className="row-between"><span className="muted">Estimado (software)</span><strong className="mono">{execution.progressEstimated.toFixed(1)}%</strong></div>
                  <div className="progress" style={{ margin: '8px 0 12px' }}><span className="progress-fill" style={{ width: `${execution.progressEstimated}%` }} /></div>
                  <div className="row-between"><span className="muted">Confirmado (máquina)</span><strong className="mono">{execution.progressConfirmed === null ? 'INDISPONÍVEL' : `${execution.progressConfirmed}%`}</strong></div>
                  <div className="tech-code" style={{ marginTop: 8 }}>
                    {execution.mode === 'demo'
                      ? 'SIMULAÇÃO VIRTUAL · NENHUM MOVIMENTO FÍSICO'
                      : 'PROGRESSO CONFIRMADO SOMENTE COM TELEMETRIA / VERIFICAÇÃO OPERACIONAL'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col" style={{ gap: 'var(--gap)' }}>
            <div className="panel">
              <div className="panel-head"><span className="panel-title">INDICADORES</span><span className="tech-code">LIVE</span></div>
              <div className="panel-body tight">
                <div className="execution-metrics">
                  <div className="stat"><div className="stat-label">DECORRIDO</div><div className="stat-value small">{formatDuration(execution.elapsedMs)}</div></div>
                  <div className="stat"><div className="stat-label">SEGMENTO</div><div className="stat-value small">{execution.currentSegment}/{execution.totalSegments}</div></div>
                  <div className="stat"><div className="stat-label">ETA ESTIMADO</div><div className="stat-value small">{execution.phase === 'running' ? formatDuration(remainingMs) : '—'}</div></div>
                  <div className="stat"><div className="stat-label">TEMPO TOTAL EST.</div><div className="stat-value small">{executionStats ? `${executionStats.estimatedSeconds}s` : '—'}</div></div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><span className="panel-title">CONFIRMAÇÃO</span><span className="tech-code">SEGURANÇA</span></div>
              <div className="panel-body tight col" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-block"
                  disabled={!execution.projectId || execution.phase === 'idle' || execution.mode !== 'hardware' || connection.state !== 'connected'}
                  onClick={() => conclude('real')}
                >
                  CONFIRMAR CONCLUSÃO REAL
                </button>
                <button type="button" className="btn btn-danger btn-block" disabled={!execution.projectId || execution.phase === 'idle'} onClick={() => conclude('virtual')}>
                  REGISTRAR CONCLUSÃO VIRTUAL
                </button>
                <button type="button" className="btn btn-ghost btn-block" disabled={!execution.projectId} onClick={() => openInStudio(executionProject!)}>
                  RETORNAR AO PROJETO
                </button>
                <div className="tech-code">TRABALHOS NÃO SÃO MARCADOS COMO CONCLUÍDOS SEM CONFIRMAÇÃO EXPLÍCITA.</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><span className="panel-title">ESTADO DA MÁQUINA</span><span className="tech-code">{connection.state.toUpperCase()}</span></div>
              <div className="panel-body tight">
                <div className="row-between"><span className="muted">Conexão</span><span className="mono">{connection.state.toUpperCase()}</span></div>
                <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Porta</span><span className="mono">{telemetry.port ?? '—'}</span></div>
                <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Firmware</span><span className="mono" title={telemetry.firmware ?? ''}>{telemetry.firmware ?? '—'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
