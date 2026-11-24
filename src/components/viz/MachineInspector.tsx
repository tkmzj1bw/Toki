import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { rigModeLabel } from '@/types';
import { Machine3D, type Machine3DProps, type MachineProjection, type MachineView } from './Machine3D';
import {
  getMachinePart,
  getPartSpec,
  PART_GROUP_LABEL,
  partsForMode,
  type PartContext,
  type PartGroup,
} from './machineParts';

export type MachineInspectorProps = Machine3DProps;

type GroupFilter = PartGroup | 'all';

const GROUP_FILTERS: Array<{ id: GroupFilter; label: string }> = [
  { id: 'all', label: 'TODAS' },
  { id: 'estrutura', label: PART_GROUP_LABEL.estrutura },
  { id: 'movimento', label: PART_GROUP_LABEL.movimento },
  { id: 'ferramenta', label: PART_GROUP_LABEL.ferramenta },
];

const DEFAULT_VIEW: MachineView = { yaw: 45, tilt: 30 };

const VIEW_PRESETS: Array<{ label: string; view: MachineView }> = [
  { label: 'ISO', view: DEFAULT_VIEW },
  { label: 'FRENTE', view: { yaw: 0, tilt: 30 } },
  { label: 'LATERAL', view: { yaw: 90, tilt: 30 } },
  { label: 'TOPO', view: { yaw: 45, tilt: 60 } },
];

export function MachineInspector(props: MachineInspectorProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [explode, setExplode] = useState(0);
  const [view, setView] = useState<MachineView>(DEFAULT_VIEW);
  const [projection, setProjection] = useState<MachineProjection>('normal');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [query, setQuery] = useState('');

  const mode = props.mode ?? 'plotter';
  const bed = props.bed ?? props.doc?.bed ?? { width: 300, height: 300 };
  const context: PartContext = useMemo(
    () => ({ mode, tool: props.tool, bed }),
    [mode, props.tool, bed.width, bed.height],
  );

  const availableParts = useMemo(() => partsForMode(mode), [mode]);
  const filteredParts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return availableParts.filter((part) => {
      if (group !== 'all' && part.group !== group) return false;
      if (!term) return true;
      return [part.name, part.code, part.description, ...(part.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [availableParts, group, query]);
  const selectedPart = getMachinePart(selected);

  useEffect(() => {
    setSelected(null);
    setZoom(1);
    setExplode(0);
    setView(DEFAULT_VIEW);
    setProjection('normal');
  }, [mode]);

  useEffect(() => {
    if (open) {
      setGroup('all');
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const resetView = (): void => {
    setZoom(1);
    setExplode(0);
    setView(DEFAULT_VIEW);
    setProjection('normal');
  };

  const changeZoom = (delta: number): void => {
    setZoom((current) => Math.max(0.6, Math.min(2.2, Number((current + delta).toFixed(2)))));
  };

  const rotate = (deltaYaw: number): void => {
    setView((current) => ({ ...current, yaw: current.yaw + deltaYaw }));
  };

  const tilt = (delta: number): void => {
    setView((current) => ({ ...current, tilt: current.tilt + delta }));
  };

  const orbitProps: Pick<Machine3DProps, 'projection' | 'yaw' | 'tilt' | 'onViewChange' | 'orbit'> = {
    projection,
    yaw: view.yaw,
    tilt: view.tilt,
    onViewChange: setView,
    orbit: projection === 'orbit',
  };

  const inspectorProps: Machine3DProps = {
    ...props,
    ...orbitProps,
    selectedPart: selected,
    onSelectPart: setSelected,
    zoom,
    explode,
    interactive: true,
  };

  return (
    <div className="machine-inspector">
      <Machine3D
        {...props}
        {...orbitProps}
        selectedPart={selected}
        onSelectPart={(id) => {
          setSelected(id);
          if (id && id !== selected) setOpen(true);
        }}
        zoom={zoom}
        explode={explode}
        interactive
      />

      <div className="inspector-inline-bar">
        <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
          <Icon name="maximize" size={13} /> INSPECIONAR PEÇAS
        </button>
        {selectedPart && (
          <button type="button" className="inspector-chip" onClick={() => setOpen(true)}>
            {selectedPart.code} · {selectedPart.name}
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            className="inspector-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Inspetor de máquina"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div className="inspector-modal">
              <div className="inspector-header">
                <div>
                  <div className="eyebrow">INSPEÇÃO TÉCNICA INTERATIVA</div>
                  <h2>MÁQUINA 3D · PEÇA POR PEÇA</h2>
                  <div className="tech-code">
                    {rigModeLabel[mode]} · {bed.width} × {bed.height} MM · {availableParts.length} PEÇAS CATALOGADAS
                  </div>
                </div>
                <button type="button" className="btn btn-icon" aria-label="Fechar inspetor" onClick={() => setOpen(false)}>
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div className="inspector-body">
                <aside className="inspector-side inspector-parts-panel">
                  <div className="inspector-side-title">COMPONENTES</div>
                  <input
                    className="input inspector-search"
                    type="search"
                    placeholder="Buscar peça, código ou tag"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Buscar peça"
                  />
                  <div className="inspector-filters" role="group" aria-label="Filtrar por sistema">
                    {GROUP_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        className={`btn btn-sm${group === filter.id ? ' active' : ''}`}
                        aria-pressed={group === filter.id}
                        onClick={() => setGroup(filter.id)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <div className="inspector-part-list">
                    {filteredParts.length === 0 && <div className="inspector-empty">Nenhuma peça corresponde ao filtro.</div>}
                    {filteredParts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        className={`inspector-part-item${selected === part.id ? ' selected' : ''}`}
                        aria-pressed={selected === part.id}
                        onClick={() => setSelected(part.id)}
                      >
                        <span className="part-code">{part.code}</span>
                        <span className="part-name">{part.name}</span>
                        <span className="part-group">{PART_GROUP_LABEL[part.group]}</span>
                      </button>
                    ))}
                  </div>
                </aside>

                <section className="inspector-stage">
                  <div className="inspector-stage-head">
                    <span className="panel-title">
                      {projection === 'normal' ? 'VISTA NORMAL · PLANA · PEÇA SELECIONADA' : 'MODELO EM ÓRBITA · PEÇA SELECIONADA'}
                    </span>
                    <span className="tech-code">
                      {projection === 'normal' ? 'EIXOS XYZ · CABEÇOTE EM 3D' : 'ARRASTE PARA GIRAR · CLIQUE EM UMA PEÇA'}
                    </span>
                  </div>
                  <div className="inspector-canvas">
                    <Machine3D {...inspectorProps} className="machine-svg inspector-svg" />
                  </div>
                  <div className="inspector-controls" role="group" aria-label="Controles da visualização">
                    <div className="inspector-control-group" role="group" aria-label="Projeção">
                      <button
                        type="button"
                        className={`btn btn-sm${projection === 'normal' ? ' active' : ''}`}
                        aria-pressed={projection === 'normal'}
                        onClick={() => setProjection('normal')}
                      >
                        NORMAL
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm${projection === 'orbit' ? ' active' : ''}`}
                        aria-pressed={projection === 'orbit'}
                        onClick={() => setProjection('orbit')}
                      >
                        ÓRBITA 3D
                      </button>
                    </div>
                    {projection === 'orbit' && (
                      <>
                        <div className="inspector-control-group" role="group" aria-label="Rotação da câmera">
                          <button type="button" className="btn btn-sm" aria-label="Girar para a esquerda" title="Girar para a esquerda" onClick={() => rotate(-30)}>↶</button>
                          <span className="inspector-view mono">{Math.round(((view.yaw % 360) + 360) % 360)}° / {Math.round(view.tilt)}°</span>
                          <button type="button" className="btn btn-sm" aria-label="Girar para a direita" title="Girar para a direita" onClick={() => rotate(30)}>↷</button>
                        </div>
                        <div className="inspector-control-group" role="group" aria-label="Inclinação da câmera">
                          <button type="button" className="btn btn-sm" aria-label="Inclinar para cima" title="Mais vista de topo" onClick={() => tilt(6)}>↑ TOPO</button>
                          <button type="button" className="btn btn-sm" aria-label="Inclinar para baixo" title="Mais vista lateral" onClick={() => tilt(-6)}>↓ LATERAL</button>
                        </div>
                        <div className="inspector-control-group" role="group" aria-label="Vistas predefinidas">
                          {VIEW_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              className={`btn btn-sm${Math.abs(view.yaw - preset.view.yaw) < 1 && Math.abs(view.tilt - preset.view.tilt) < 1 ? ' active' : ''}`}
                              aria-pressed={Math.abs(view.yaw - preset.view.yaw) < 1 && Math.abs(view.tilt - preset.view.tilt) < 1}
                              onClick={() => setView(preset.view)}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="inspector-control-group" role="group" aria-label="Zoom">
                      <button type="button" className="btn btn-sm" aria-label="Reduzir zoom" onClick={() => changeZoom(-0.2)}>
                        <Icon name="minimize" size={13} /> −
                      </button>
                      <span className="inspector-zoom mono">{Math.round(zoom * 100)}%</span>
                      <button type="button" className="btn btn-sm" aria-label="Aumentar zoom" onClick={() => changeZoom(0.2)}>
                        <Icon name="plus" size={13} /> +
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm${explode > 0 ? ' active' : ''}`}
                      aria-pressed={explode > 0}
                      onClick={() => setExplode((current) => (current > 0 ? 0 : 1))}
                    >
                      VISTA EXPLODIDA
                    </button>
                    <button type="button" className="btn btn-sm" onClick={resetView}>RESETAR</button>
                  </div>
                </section>

                <aside className="inspector-side inspector-detail-panel">
                  <div className="inspector-side-title">FICHA DA PEÇA</div>
                  {selectedPart ? (
                    <>
                      <div className="inspector-detail-code">{selectedPart.code}</div>
                      <h3>{selectedPart.name}</h3>
                      <div className="tech-code">{PART_GROUP_LABEL[selectedPart.group]}</div>
                      <p className="inspector-detail-copy">{selectedPart.description}</p>
                      <div className="inspector-spec">
                        <div className="stat-label">ESPECIFICAÇÃO / CONTEXTO</div>
                        <div className="mono">{getPartSpec(selectedPart, context)}</div>
                      </div>
                      <div className="inspector-tags">
                        {(selectedPart.tags ?? []).map((tag) => (
                          <span key={tag} className="tech-code">{tag}</span>
                        ))}
                      </div>
                      <div className="inspector-note">
                        Representação esquemática para análise de arquitetura. Não substitui manual, desenho técnico nem procedimento de segurança.
                      </div>
                    </>
                  ) : (
                    <div className="inspector-placeholder">
                      <Icon name="cursor" size={22} />
                      <strong>SELECIONE UMA PEÇA</strong>
                      <span>
                        {projection === 'normal'
                          ? 'Vista normal com eixos XYZ e cabeçote em 3D. Clique em uma peça no modelo ou escolha um componente na lista.'
                          : 'Arraste para girar a máquina. Clique em uma peça no modelo ou escolha um componente na lista.'}
                      </span>
                    </div>
                  )}

                  <div className="inspector-context">
                    <div className="stat-label">CONFIGURAÇÃO ATIVA</div>
                    <div className="row-between"><span>Rig</span><strong className="mono">{rigModeLabel[mode]}</strong></div>
                    <div className="row-between"><span>Leito</span><strong className="mono">{bed.width} × {bed.height} mm</strong></div>
                    <div className="row-between"><span>Ferramenta</span><strong className="mono">{props.tool?.label ?? '—'}</strong></div>
                    <div className="row-between"><span>Z seguro</span><strong className="mono">{props.tool ? `${props.tool.safeZ} mm` : '—'}</strong></div>
                    <div className="row-between"><span>Z trabalho</span><strong className="mono">{props.tool ? `${props.tool.workZ} mm` : '—'}</strong></div>
                  </div>
                </aside>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
