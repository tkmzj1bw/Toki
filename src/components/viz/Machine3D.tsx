import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { shapeToPoints } from '@/lib/geometry';
import { rigModeLabel } from '@/types';
import type { DrawingDoc, RigMode, RigTool, Vec3 } from '@/types';
import { getMachinePart, PART_GROUP_LABEL } from './machineParts';

export type MachineProjection = 'normal' | 'orbit';

export interface MachineView {
  /** Azimute da câmera em graus. 45° reproduz a vista isométrica. */
  yaw: number;
  /** Inclinação da câmera em graus. */
  tilt: number;
}

export interface Machine3DProps {
  position: Vec3 | null;
  doc?: DrawingDoc;
  bed?: { width: number; height: number };
  mode?: RigMode;
  tool?: RigTool;
  toolActive?: boolean;
  traceProgress?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  className?: string;
  /** Peça realçada pelo inspetor. */
  selectedPart?: string | null;
  /** Chamado quando uma peça é selecionada; `null` limpa a seleção. */
  onSelectPart?: (id: string | null) => void;
  /** 0 = montado, 1 = vista explodida por subsistemas. */
  explode?: number;
  /** Fator de zoom aplicado em torno do centro do desenho. */
  zoom?: number;
  /** Habilita foco, clique por teclado e destaque de peça. */
  interactive?: boolean;
  /** `normal` = planta ortográfica com cabeçote 3D; `orbit` = câmera isométrica girável. */
  projection?: MachineProjection;
  /** Azimute controlado em graus. */
  yaw?: number;
  /** Inclinação controlada em graus. */
  tilt?: number;
  /** Recebe mudanças de órbita quando o usuário arrasta o modelo. */
  onViewChange?: (view: MachineView) => void;
  /** Permite arrastar para girar e inclinar a câmera. */
  orbit?: boolean;
}

interface Point2 {
  x: number;
  y: number;
}

type Point3 = Vec3;
type Projector = (x: number, y: number, z: number) => Point2;

interface View extends MachineView {
  theta: number;
  factor: number;
  /** Projeção dos componentes planares (base, leito, trilhos). */
  project: Projector;
  /** Projeção do cabeçote, com profundidade visível na vista normal. */
  headProject: Projector;
  flat: boolean;
}

const W = 800;
const H = 460;
const SCALE = 0.88;
const CX = 400;
const CY = 138;
const DEG = Math.PI / 180;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const normalizeYaw = (value: number): number => ((value % 360) + 360) % 360;

const makeView = (
  yaw: number,
  tilt: number,
  width: number,
  height: number,
  projection: MachineProjection,
): View => {
  if (projection === 'normal') {
    const scale = Math.min((W - 160) / width, (H - 120) / height, 1.35);
    const cx = width / 2;
    const cy = height / 2;
    const originY = CY + 80;
    const project: Projector = (x, y) => ({
      x: CX + (x - cx) * scale,
      y: originY + (y - cy) * scale,
    });
    return {
      yaw: 0,
      tilt: 90,
      theta: 0,
      factor: 0,
      flat: true,
      project,
      headProject: (x, y, z) => ({
        x: CX + (x - cx) * scale - z * 0.45,
        y: originY + (y - cy) * scale - z * 0.75,
      }),
    };
  }

  const safeTilt = clamp(tilt, 12, 60);
  const theta = normalizeYaw(yaw) * DEG;
  const rawFactor = Math.tan(safeTilt * DEG) * 0.8660254;
  // Comprime o achatamento vertical para que vistas de topo e de perfil caibam no mesmo enquadramento.
  const factor = 0.5 * Math.pow(Math.max(0.05, rawFactor / 0.5), 0.32);
  const sx = SCALE * Math.SQRT2;
  const sz = SCALE * 0.75;
  const cx = width / 2;
  const cy = height / 2;
  const centerY = (cx + cy) * SCALE * 0.5;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const project: Projector = (x, y, z) => ({
    x: CX + ((x - cx) * cos - (y - cy) * sin) * sx,
    y: CY + centerY + ((x - cx) * sin + (y - cy) * cos) * sx * factor - z * sz,
  });
  return {
    yaw: normalizeYaw(yaw),
    tilt: safeTilt,
    theta,
    factor,
    flat: false,
    project,
    headProject: project,
  };
};

const poly = (points: Point2[]): string =>
  points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

/** Caixa alinhada aos eixos. Na vista normal mostra apenas a face superior. */
const cuboid = (
  view: View,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  className = '',
): JSX.Element => {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  const c = Math.min(y0, y1);
  const d = Math.max(y0, y1);
  const e = Math.min(z0, z1);
  const f = Math.max(z0, z1);
  const p = view.project;
  if (view.flat) {
    return (
      <g className={`cuboid ${className}`}>
        <polygon className="face-top" points={poly([p(a, c, f), p(b, c, f), p(b, d, f), p(a, d, f)])} />
      </g>
    );
  }
  const xFace = Math.sin(view.theta) >= 0 ? b : a;
  const yFace = Math.cos(view.theta) >= 0 ? d : c;
  return (
    <g className={`cuboid ${className}`}>
      <polygon className="face-x" points={poly([p(xFace, c, e), p(xFace, d, e), p(xFace, d, f), p(xFace, c, f)])} />
      <polygon className="face-y" points={poly([p(a, yFace, e), p(b, yFace, e), p(b, yFace, f), p(a, yFace, f)])} />
      <polygon className="face-top" points={poly([p(a, c, f), p(b, c, f), p(b, d, f), p(a, d, f)])} />
    </g>
  );
};

/** Viga reta entre dois pontos, com seção quadrada. */
const beam = (
  view: View,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  z0: number,
  z1: number,
  width: number,
  className = '',
): JSX.Element =>
  cuboid(
    view,
    Math.min(x1, x2) - width / 2,
    Math.min(y1, y2) - width / 2,
    z0,
    Math.max(x1, x2) + width / 2,
    Math.max(y1, y2) + width / 2,
    z1,
    className,
  );

const bolt = (view: View, x: number, y: number, z: number, radius = 2.4): JSX.Element => {
  const center = view.project(x, y, z);
  return (
    <g className="bolt-group">
      <circle cx={center.x} cy={center.y} r={radius} className="bolt" />
      <path d={`M${(center.x - radius * 0.6).toFixed(1)} ${center.y.toFixed(1)} h${(radius * 1.2).toFixed(1)}`} className="bolt-slot" />
    </g>
  );
};

const motor = (view: View, x: number, y: number, z: number): JSX.Element => {
  const center = view.project(x, y, z);
  return (
    <g className="motor" transform={`translate(${center.x.toFixed(1)} ${center.y.toFixed(1)})`}>
      <rect x="-9" y="-9" width="18" height="18" rx="2" className="motor-body" />
      <circle r="3.4" className="motor-shaft" />
      <path d="M-5 -5 L5 5 M5 -5 L-5 5" className="motor-cross" />
    </g>
  );
};

const arrow = (view: View, from: Point3, to: Point3, className: string): JSX.Element =>
  arrow2(view.project(from.x, from.y, from.z), view.project(to.x, to.y, to.z), className);

const arrow2 = (a: Point2, b: Point2, className: string): JSX.Element => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const size = 6;
  const tip = `M${b.x.toFixed(1)} ${b.y.toFixed(1)} L${(b.x - ux * size + px * size * 0.5).toFixed(1)} ${(b.y - uy * size + py * size * 0.5).toFixed(1)} L${(b.x - ux * size - px * size * 0.5).toFixed(1)} ${(b.y - uy * size - py * size * 0.5).toFixed(1)} Z`;
  return (
    <g className={className}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <path d={tip} />
    </g>
  );
};

/** Caixa local do cabeçote: mantém volume mesmo na vista normal. */
const headBox = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  className = '',
): JSX.Element => {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  const c = Math.min(y0, y1);
  const d = Math.max(y0, y1);
  const e = Math.min(z0, z1);
  const f = Math.max(z0, z1);
  const q = (x: number, y: number, z: number): Point2 => ({ x: x + z * 0.5, y: y - z * 0.8 });
  return (
    <g className={`cuboid ${className}`}>
      <polygon className="face-x" points={poly([q(b, c, e), q(b, d, e), q(b, d, f), q(b, c, f)])} />
      <polygon className="face-y" points={poly([q(a, d, e), q(b, d, e), q(b, d, f), q(a, d, f)])} />
      <polygon className="face-top" points={poly([q(a, c, f), q(b, c, f), q(b, d, f), q(a, d, f)])} />
    </g>
  );
};

export function Machine3D({
  position,
  doc,
  bed: bedOverride,
  mode = 'plotter',
  tool,
  toolActive = false,
  traceProgress = 0,
  showGrid = true,
  showLabels = true,
  className = 'machine-svg',
  selectedPart = null,
  onSelectPart,
  explode = 0,
  zoom = 1,
  interactive = false,
  projection = 'normal',
  yaw,
  tilt,
  onViewChange,
  orbit = false,
}: Machine3DProps): JSX.Element {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const [internalView, setInternalView] = useState<MachineView>({ yaw: 45, tilt: 30 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; yaw: number; tilt: number } | null>(null);
  const suppressClickRef = useRef(false);

  const bed = bedOverride ?? doc?.bed ?? { width: 300, height: 300 };
  const width = bed.width;
  const height = bed.height;
  const currentYaw = yaw ?? internalView.yaw;
  const currentTilt = tilt ?? internalView.tilt;
  const view = makeView(currentYaw, currentTilt, width, height, projection);
  const p = view.project;

  const unconfirmed = !position;
  const pos = position ?? { x: 0, y: 0, z: tool?.safeZ ?? doc?.settings.penUp ?? 5 };
  const head = view.headProject(pos.x, pos.y, pos.z);
  const gantryZ = Math.max(pos.z + 18, (tool?.safeZ ?? 5) + 16, 24);
  const gantryTop = gantryZ + 9;
  const margin = 12;
  const beamWidth = 10;
  const frameBottom = -14;
  const frameTop = -4;
  const ex = Math.max(0, Math.min(1, explode));
  const zoomLevel = Math.max(0.6, Math.min(2.2, zoom));
  const activePartId = hoveredPart ?? selectedPart;
  const activePart = getMachinePart(activePartId);
  const layerOffset = (value: number): string => `translate(0 ${(ex * value).toFixed(1)})`;
  const zoomTransform = `translate(${CX} ${CY}) scale(${zoomLevel.toFixed(3)}) translate(${-CX} ${-CY})`;

  const updateView = (next: MachineView): void => {
    const normalized: MachineView = {
      yaw: normalizeYaw(next.yaw),
      tilt: clamp(next.tilt, 12, 60),
    };
    if (onViewChange) onViewChange(normalized);
    else setInternalView(normalized);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    suppressClickRef.current = false;
    if (!orbit || projection !== 'orbit') return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      yaw: currentYaw,
      tilt: currentTilt,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) suppressClickRef.current = true;
    updateView({ yaw: drag.yaw + dx * 0.35, tilt: drag.tilt - dy * 0.18 });
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>): void => {
    if (!dragRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const select = (id: string): void => {
    if (suppressClickRef.current) return;
    onSelectPart?.(selectedPart === id ? null : id);
  };

  const partNode = (
    id: string,
    children: ReactNode,
    partClassName = '',
    options: { transform?: string; key?: string } = {},
  ): JSX.Element => {
    const part = getMachinePart(id);
    const selected = activePartId === id;
    const dimmed = !!activePartId && !selected;
    const handlers = interactive
      ? {
          role: 'button' as const,
          tabIndex: 0,
          'aria-label': `Inspecionar peça: ${part?.name ?? id}`,
          onMouseEnter: () => setHoveredPart(id),
          onMouseLeave: () => setHoveredPart(null),
          onFocus: () => setHoveredPart(id),
          onBlur: () => setHoveredPart(null),
          onClick: (event: MouseEvent<SVGGElement>) => {
            event.stopPropagation();
            select(id);
          },
          onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              select(id);
            }
          },
        }
      : {};
    return (
      <g
        key={options.key}
        className={`part ${partClassName}${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
        data-part-id={id}
        transform={options.transform}
        {...handlers}
      >
        {children}
      </g>
    );
  };

  const bedCorners = [p(0, 0, 0), p(width, 0, 0), p(width, height, 0), p(0, height, 0)];
  const bedInset = [p(6, 6, 0.2), p(width - 6, 6, 0.2), p(width - 6, height - 6, 0.2), p(6, height - 6, 0.2)];
  const shadowCorners = [
    p(-margin - 6, -margin - 6, -23),
    p(width + margin + 6, -margin - 6, -23),
    p(width + margin + 6, height + margin + 6, -23),
    p(-margin - 6, height + margin + 6, -23),
  ];

  const gridLines: JSX.Element[] = [];
  if (showGrid) {
    const step = 30;
    for (let x = step; x < width; x += step) {
      const a = p(x, 0, 0.25);
      const b = p(x, height, 0.25);
      gridLines.push(<line key={`gx-${x}`} className="bed-grid" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
    for (let y = step; y < height; y += step) {
      const a = p(0, y, 0.25);
      const b = p(width, y, 0.25);
      gridLines.push(<line key={`gy-${y}`} className="bed-grid" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
  }

  const traces = doc
    ? doc.shapes.flatMap((shape) => {
        const layer = doc.layers.find((item) => item.id === shape.layerId);
        if (layer && !layer.visible) return [];
        const points = shapeToPoints(shape, doc);
        if (points.length < 2) return [];
        return [
          <polyline
            key={shape.id}
            className="trace"
            points={poly(points.map((point) => p(point.x, point.y, 0.45)))}
            stroke={shape.stroke}
          />,
        ];
      })
    : [];
  const traceCount = traces.length;
  const visibleTraces = traceProgress > 0 ? traces.slice(0, Math.max(1, Math.ceil(traceCount * traceProgress))) : traces;

  const frameCorners: Array<[number, number]> = [
    [-margin, -margin],
    [width + margin, -margin],
    [width + margin, height + margin],
    [-margin, height + margin],
  ];

  const slotZ = frameTop + 0.3;
  const frameSlots = [
    <line key="slot-f1" className="frame-slot" x1={view.project(-margin, -margin - 2.5, slotZ).x} y1={view.project(-margin, -margin - 2.5, slotZ).y} x2={view.project(width + margin, -margin - 2.5, slotZ).x} y2={view.project(width + margin, -margin - 2.5, slotZ).y} />,
    <line key="slot-f2" className="frame-slot" x1={view.project(-margin, -margin + 2.5, slotZ).x} y1={view.project(-margin, -margin + 2.5, slotZ).y} x2={view.project(width + margin, -margin + 2.5, slotZ).x} y2={view.project(width + margin, -margin + 2.5, slotZ).y} />,
    <line key="slot-b1" className="frame-slot" x1={view.project(-margin, height + margin - 2.5, slotZ).x} y1={view.project(-margin, height + margin - 2.5, slotZ).y} x2={view.project(width + margin, height + margin - 2.5, slotZ).x} y2={view.project(width + margin, height + margin - 2.5, slotZ).y} />,
    <line key="slot-b2" className="frame-slot" x1={view.project(-margin, height + margin + 2.5, slotZ).x} y1={view.project(-margin, height + margin + 2.5, slotZ).y} x2={view.project(width + margin, height + margin + 2.5, slotZ).x} y2={view.project(width + margin, height + margin + 2.5, slotZ).y} />,
    <line key="slot-l1" className="frame-slot" x1={view.project(-margin - 2.5, -margin, slotZ).x} y1={view.project(-margin - 2.5, -margin, slotZ).y} x2={view.project(-margin - 2.5, height + margin, slotZ).x} y2={view.project(-margin - 2.5, height + margin, slotZ).y} />,
    <line key="slot-l2" className="frame-slot" x1={view.project(-margin + 2.5, -margin, slotZ).x} y1={view.project(-margin + 2.5, -margin, slotZ).y} x2={view.project(-margin + 2.5, height + margin, slotZ).x} y2={view.project(-margin + 2.5, height + margin, slotZ).y} />,
    <line key="slot-r1" className="frame-slot" x1={view.project(width + margin - 2.5, -margin, slotZ).x} y1={view.project(width + margin - 2.5, -margin, slotZ).y} x2={view.project(width + margin - 2.5, height + margin, slotZ).x} y2={view.project(width + margin - 2.5, height + margin, slotZ).y} />,
    <line key="slot-r2" className="frame-slot" x1={view.project(width + margin + 2.5, -margin, slotZ).x} y1={view.project(width + margin + 2.5, -margin, slotZ).y} x2={view.project(width + margin + 2.5, height + margin, slotZ).x} y2={view.project(width + margin + 2.5, height + margin, slotZ).y} />,
  ];

  const screwX = width + margin + 9;
  const screwTicks: JSX.Element[] = [];
  for (let y = 12; y < height; y += 26) {
    const a = p(screwX - 2.5, y - 2, -2);
    const b = p(screwX + 2.5, y + 2, -2);
    screwTicks.push(<line key={`screw-${y}`} className="screw-tick" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
  }

  const headShape = (): JSX.Element => {
    if (mode === 'printer3d') {
      return (
        <g className={`rig-head hotend${toolActive ? ' active' : ''}`}>
          {partNode('hotend-carriage', <rect x="-11" y="-22" width="22" height="9" rx="2" className="hotend-carriage" />, '', { transform: `translate(0 ${(-ex * 3).toFixed(1)})` })}
          {partNode('filament-tube', <path d="M0 -22 L0 -34" className="filament-tube" />, '', { transform: `translate(0 ${(-ex * 10).toFixed(1)})` })}
          {partNode('heatsink', <g className="heatsink">{[-18, -14, -10, -6, -2].map((y) => <rect key={`fin-${y}`} x="-8" y={y} width="16" height="2.6" rx="0.6" className="hotend-fin" />)}</g>, '', { transform: `translate(0 ${(-ex * 6).toFixed(1)})` })}
          {partNode('heat-block', <g className="heat-block-group"><rect x="-7" y="1" width="14" height="10" rx="1" className="heat-block" /><circle cx="-10" cy="6" r="2" className="heater-wire" /></g>, '', { transform: `translate(0 ${(-ex * 2).toFixed(1)})` })}
          {partNode('nozzle', <path d="M-4 11 L4 11 L0 20 Z" className="head-nozzle" />, '', { transform: `translate(0 ${(ex * 2).toFixed(1)})` })}
          {partNode('part-fan', <g className="fan-shroud"><rect x="8" y="-3" width="13" height="15" rx="2" className="fan-frame" /><circle cx="14.5" cy="4.5" r="4" className="fan-hub" /><path d="M14.5 4.5 L18.5 0.5 M14.5 4.5 L18.5 8.5 M14.5 4.5 L10.5 8.5 M14.5 4.5 L10.5 0.5" className="fan-blade" /></g>, '', { transform: `translate(${(ex * 10).toFixed(1)} ${(-ex * 4).toFixed(1)})` })}
        </g>
      );
    }

    if (mode === 'cnc') {
      return (
        <g className={`rig-head spindle${toolActive ? ' active' : ''}`}>
          {partNode('hotend-carriage', <rect x="-16" y="-26" width="32" height="10" rx="2" className="hotend-carriage" />, '', { transform: `translate(0 ${(-ex * 3).toFixed(1)})` })}
          {partNode('spindle-body', <g className="spindle-body-group"><rect x="-14" y="-16" width="28" height="28" rx="3" className="spindle-body" />{[-11, -5, 1, 7].map((y) => <line key={`slot-${y}`} x1="-13" y1={y} x2="13" y2={y} className="spindle-slot" />)}</g>, '', { transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
          {partNode('collet', <path d="M-9 12 L9 12 L6 19 L-6 19 Z" className="collet" />, '', { transform: `translate(0 ${(ex * 2).toFixed(1)})` })}
          {partNode('bit', <g className="bit-group"><path d="M-3 19 L3 19 L1.6 29 L-1.6 29 Z" className="spindle-bit" /><path d="M-2.4 21 L-0.8 28 M2.4 21 L0.8 28" className="bit-flute" /></g>, '', { transform: `translate(0 ${(ex * 7).toFixed(1)})` })}
          {partNode('spindle-cable', <path d="M14 -8 Q25 -6 23 7" className="spindle-cable" />, '', { transform: `translate(${(ex * 10).toFixed(1)} ${(-ex * 3).toFixed(1)})` })}
          {partNode('dust-shoe', <rect x="-19" y="21" width="38" height="6" rx="2" className="dust-shoe" />, '', { transform: `translate(0 ${(ex * 12).toFixed(1)})` })}
        </g>
      );
    }

    return (
      <g className={`rig-head pen${toolActive ? ' active' : ''}`}>
        {partNode('hotend-carriage', <rect x="-14" y="-15" width="28" height="19" rx="2" className="hotend-carriage" />, '', { transform: `translate(0 ${(-ex * 3).toFixed(1)})` })}
        {partNode('pen-clamp', <rect x="-9" y="-11" width="18" height="11" rx="1" className="pen-clamp" />, '', { transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
        {partNode('fastener', <g className="pen-fasteners"><circle cx="-6" cy="-5.5" r="1.6" className="bolt" /><circle cx="6" cy="-5.5" r="1.6" className="bolt" /></g>, '', { transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
        {partNode('pen-barrel', <rect x="-2.6" y="-2" width="5.2" height="17" rx="1" className="pen-barrel" />, '', { transform: `translate(0 ${(ex * 3).toFixed(1)})` })}
        {partNode('pen-tip', <path d="M-2.6 15 L2.6 15 L0 23 Z" className="pen-tip" />, '', { transform: `translate(0 ${(ex * 7).toFixed(1)})` })}
        {partNode('fastener', <path d="M-14 4 L-9 4 M9 4 L14 4" className="motor-cross" />, '', { key: 'pen-clamp-cross', transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
      </g>
    );
  };

  /** Cabeçote volumétrico usado na vista normal (planta). */
  const headShape3D = (): JSX.Element => {
    if (mode === 'printer3d') {
      return (
        <g className={`rig-head hotend head-3d${toolActive ? ' active' : ''}`}>
          {partNode('hotend-carriage', headBox(-12, -22, 4, 12, -12, 10, 'hotend-carriage'), '', { transform: `translate(0 ${(-ex * 3).toFixed(1)})` })}
          {partNode('filament-tube', <path d="M0 -22 L0 -40" className="filament-tube" />, '', { transform: `translate(0 ${(-ex * 10).toFixed(1)})` })}
          {partNode('heatsink', <g className="heatsink">{[-17, -13, -9, -5, -1].map((y) => <rect key={`fin3d-${y}`} x={-8 + 0.5 * 9} y={y - 0.8 * 9} width="16" height="2.6" rx="0.6" className="hotend-fin" />)}</g>, '', { transform: `translate(0 ${(-ex * 6).toFixed(1)})` })}
          {partNode('heat-block', headBox(-7, 2, 3, 7, 12, 9, 'heat-block'), '', { transform: `translate(0 ${(-ex * 2).toFixed(1)})` })}
          {partNode('nozzle', headBox(-4, 12, 2, 4, 20, 4, 'head-nozzle'), '', { transform: `translate(0 ${(ex * 2).toFixed(1)})` })}
          {partNode('part-fan', <g className="fan-shroud"><rect x={8 + 0.5 * 9} y={-4 - 0.8 * 9} width="13" height="15" rx="2" className="fan-frame" /><circle cx={14.5 + 0.5 * 9} cy={4.5 - 0.8 * 9} r="4" className="fan-hub" /><path d={`M${14.5 + 4.5} ${4.5 - 7.2} l4 -4 M${14.5 + 4.5} ${4.5 - 7.2} l4 4 M${14.5 + 4.5} ${4.5 - 7.2} l-4 4 M${14.5 + 4.5} ${4.5 - 7.2} l-4 -4`} className="fan-blade" /></g>, '', { transform: `translate(${(ex * 10).toFixed(1)} ${(-ex * 4).toFixed(1)})` })}
        </g>
      );
    }

    if (mode === 'cnc') {
      return (
        <g className={`rig-head spindle head-3d${toolActive ? ' active' : ''}`}>
          {partNode('hotend-carriage', headBox(-16, -26, 4, 16, -16, 10, 'hotend-carriage'), '', { transform: `translate(0 ${(-ex * 3).toFixed(1)})` })}
          {partNode('spindle-body', headBox(-14, -16, 2, 14, 12, 13, 'spindle-body'), '', { transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
          {partNode('collet', headBox(-9, 12, 2, 9, 19, 5, 'collet'), '', { transform: `translate(0 ${(ex * 2).toFixed(1)})` })}
          {partNode('bit', headBox(-3, 19, 1, 3, 29, 3, 'spindle-bit'), '', { transform: `translate(0 ${(ex * 7).toFixed(1)})` })}
          {partNode('spindle-cable', <path d="M14 -8 Q25 -6 23 7" className="spindle-cable" />, '', { transform: `translate(${(ex * 10).toFixed(1)} ${(-ex * 3).toFixed(1)})` })}
          {partNode('dust-shoe', headBox(-19, 21, 1, 19, 27, 4, 'dust-shoe'), '', { transform: `translate(0 ${(ex * 12).toFixed(1)})` })}
        </g>
      );
    }

    return (
      <g className={`rig-head pen head-3d${toolActive ? ' active' : ''}`}>
        {partNode('hotend-carriage', headBox(-14, -15, 4, 14, 4, 9, 'hotend-carriage'), '', { transform: `translate(0 ${(-ex * 3).toFixed(1)})` })}
        {partNode('pen-clamp', headBox(-9, -11, 4, 9, 0, 8, 'pen-clamp'), '', { transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
        {partNode('fastener', <g className="pen-fasteners"><circle cx={-6 + 0.5 * 8} cy={-5.5 - 0.8 * 8} r="1.6" className="bolt" /><circle cx={6 + 0.5 * 8} cy={-5.5 - 0.8 * 8} r="1.6" className="bolt" /></g>, '', { transform: `translate(0 ${(-ex * 5).toFixed(1)})` })}
        {partNode('pen-barrel', headBox(-3, 0, 2, 3, 17, 5, 'pen-barrel'), '', { transform: `translate(0 ${(ex * 3).toFixed(1)})` })}
        {partNode('pen-tip', headBox(-2.6, 15, 1, 2.6, 23, 3, 'pen-tip'), '', { transform: `translate(0 ${(ex * 7).toFixed(1)})` })}
      </g>
    );
  };

  const origin = p(0, 0, 0);
  const normalAxes = (
    <g className="axis-system normal-axes">
      {arrow2(origin, { x: origin.x + 58, y: origin.y }, 'axis-red')}
      {arrow2(origin, { x: origin.x, y: origin.y + 58 }, 'axis-green')}
      {arrow2(origin, { x: origin.x - 26, y: origin.y - 34 }, 'axis-blue')}
    </g>
  );

  return (
    <svg
      className={`${className}${dragging ? ' dragging' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role={interactive ? 'group' : 'img'}
      aria-label={interactive
        ? `Modelo 3D interativo da máquina em modo ${rigModeLabel[mode]}`
        : `Representação ${projection === 'normal' ? 'ortográfica' : 'isométrica'} da máquina em modo ${rigModeLabel[mode]}`}
      data-inspectable={interactive ? 'true' : 'false'}
      data-projection={projection}
      data-orbit={orbit && projection === 'orbit' ? 'true' : 'false'}
      data-selected-part={activePartId ?? ''}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <g className="machine-root" transform={zoomTransform}>
        {projection === 'normal' ? null : <polygon className="machine-shadow" points={poly(shadowCorners)} />}

        <g className="base-frame" transform={layerOffset(projection === 'normal' ? 0 : 16)}>
          {partNode('frame', beam(view, -margin, -margin, width + margin, -margin, frameBottom, frameTop, beamWidth), '', { key: 'frame-front' })}
          {partNode('frame', beam(view, -margin, height + margin, width + margin, height + margin, frameBottom, frameTop, beamWidth), '', { key: 'frame-back' })}
          {partNode('frame', beam(view, -margin, -margin, -margin, height + margin, frameBottom, frameTop, beamWidth), '', { key: 'frame-left' })}
          {partNode('frame', beam(view, width + margin, -margin, width + margin, height + margin, frameBottom, frameTop, beamWidth), '', { key: 'frame-right' })}
          {partNode('frame-slot', <g className="frame-slots">{frameSlots}</g>)}
          {frameCorners.map(([x, y], index) => (
            <g key={`corner-${index}`} className="corner-bracket">
              {partNode('frame', cuboid(view, x - 6, y - 6, frameTop, x + 6, y + 6, frameTop + 3, 'corner'))}
              {partNode('fastener', bolt(view, x, y, frameTop + 3.4), '', { key: `corner-bolt-${index}` })}
              {projection === 'normal' ? null : partNode('foot', cuboid(view, x - 7, y - 7, -22, x + 7, y + 7, frameBottom, 'foot'), '', { key: `corner-foot-${index}` })}
            </g>
          ))}
        </g>

        <g className="bed-group" transform={layerOffset(projection === 'normal' ? 0 : 8)}>
          {partNode('bed', <polygon className="bed-surface" points={poly(bedCorners)} />)}
          {partNode('bed-inset', <polygon className="bed-inset" points={poly(bedInset)} />)}
          {partNode('bed-grid', <g className="bed-grid-group">{gridLines}</g>)}
          <polygon className="frame-line" points={poly(bedCorners)} />
        </g>

        <g className="motion-system" transform={layerOffset(projection === 'normal' ? 0 : 2)}>
          {partNode('y-rail', beam(view, 0, 0, 0, height, -3.5, -0.5, 6, 'linear-rail'), '', { key: 'rail-left' })}
          {partNode('y-rail', beam(view, width, 0, width, height, -3.5, -0.5, 6, 'linear-rail'), '', { key: 'rail-right' })}
          {partNode('y-carriage', cuboid(view, -7, pos.y - 9, -1, 7, pos.y + 9, 5, 'carriage'), '', { key: 'carriage-left' })}
          {partNode('y-carriage', cuboid(view, width - 7, pos.y - 9, -1, width + 7, pos.y + 9, 5, 'carriage'), '', { key: 'carriage-right' })}
          {partNode('lead-screw', <g className="lead-screw"><line x1={p(screwX, 0, -2).x} y1={p(screwX, 0, -2).y} x2={p(screwX, height, -2).x} y2={p(screwX, height, -2).y} />{screwTicks}</g>)}
          {partNode('y-motor', motor(view, screwX, height + 16, -2))}
        </g>

        {visibleTraces}

        <g className="gantry-system" transform={layerOffset(projection === 'normal' ? 0 : -10)}>
          {partNode('gantry', beam(view, -margin, pos.y, width + margin, pos.y, gantryZ, gantryTop, beamWidth, 'gantry-beam'))}
          {partNode('fastener', bolt(view, -margin + 7, pos.y, gantryTop + 0.4), '', { key: 'gantry-bolt-left' })}
          {partNode('fastener', bolt(view, width + margin - 7, pos.y, gantryTop + 0.4), '', { key: 'gantry-bolt-right' })}
          {partNode('belt', <g className="belt"><line x1={p(-margin + 10, pos.y - 2.5, gantryTop + 0.6).x} y1={p(-margin + 10, pos.y - 2.5, gantryTop + 0.6).y} x2={p(width + margin - 10, pos.y - 2.5, gantryTop + 0.6).x} y2={p(width + margin - 10, pos.y - 2.5, gantryTop + 0.6).y} /><line x1={p(-margin + 10, pos.y + 2.5, gantryTop + 0.6).x} y1={p(-margin + 10, pos.y + 2.5, gantryTop + 0.6).y} x2={p(width + margin - 10, pos.y + 2.5, gantryTop + 0.6).x} y2={p(width + margin - 10, pos.y + 2.5, gantryTop + 0.6).y} /></g>)}
          {partNode('pulley', <g className="pulley-group"><circle cx={p(-margin + 8, pos.y, gantryTop + 0.6).x} cy={p(-margin + 8, pos.y, gantryTop + 0.6).y} r="3.6" className="pulley" /><circle cx={p(width + margin - 8, pos.y, gantryTop + 0.6).x} cy={p(width + margin - 8, pos.y, gantryTop + 0.6).y} r="3.6" className="pulley" /></g>)}
          {partNode('z-rail', <g className="z-rail-group">{beam(view, pos.x - 18, pos.y, pos.x - 18, pos.y, -1, gantryTop, 4, 'z-rail')}{beam(view, pos.x + 18, pos.y, pos.x + 18, pos.y, -1, gantryTop, 4, 'z-rail')}</g>)}
          {partNode('z-carriage', beam(view, pos.x - 22, pos.y, pos.x + 22, pos.y, pos.z - 4, pos.z + 9, 14, 'z-carriage'))}
        </g>

        <g
          className={`machine-head${unconfirmed ? ' unconfirmed' : ''}`}
          transform={`translate(${head.x.toFixed(1)} ${(head.y - ex * (projection === 'normal' ? 14 : 26)).toFixed(1)})`}
        >
          {projection === 'normal' ? headShape3D() : headShape()}
        </g>

        {projection === 'normal' ? normalAxes : (
          <g className="axis-system">
            {arrow(view, { x: 0, y: 0, z: 0 }, { x: 58, y: 0, z: 0 }, 'axis-red')}
            {arrow(view, { x: 0, y: 0, z: 0 }, { x: 0, y: 58, z: 0 }, 'axis-green')}
            {arrow(view, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 48 }, 'axis-blue')}
          </g>
        )}

        {showLabels && (
          <g className="label">
            {projection === 'normal' ? (
              <>
                <text x={origin.x + 62} y={origin.y + 4}>X</text>
                <text x={origin.x - 4} y={origin.y + 68}>Y</text>
                <text x={origin.x - 32} y={origin.y - 40}>Z</text>
                <text x={CX - 34} y={H - 26}>VISTA NORMAL · PLANA</text>
              </>
            ) : (
              <>
                <text x={p(64, 0, 0).x} y={p(64, 0, 0).y}>X</text>
                <text x={p(0, 64, 0).x} y={p(0, 64, 0).y + 4}>Y</text>
                <text x={p(0, 0, 54).x + 5} y={p(0, 0, 54).y}>Z</text>
                <text x={CX - 34} y={CY + height * SCALE * 0.5 + 26}>BED {width}×{height}</text>
              </>
            )}
            <text x={projection === 'normal' ? head.x + 22 : p(width + margin, pos.y, gantryTop).x + 10} y={projection === 'normal' ? head.y - 40 : p(width + margin, pos.y, gantryTop).y - 8}>Z{pos.z.toFixed(1)}</text>
            <text x={CX - 48} y={H - 10}>{rigModeLabel[mode]} · {tool?.label ?? 'FERRAMENTA PADRÃO'}</text>
            {unconfirmed && <text x={CX - 64} y={H - 42} className="warning-label">POSIÇÃO NÃO CONFIRMADA</text>}
          </g>
        )}

        {interactive && activePart && (
          <g className="part-callout" transform="translate(18 18)">
            <rect x="0" y="0" width="214" height="38" rx="2" />
            <text x="8" y="15">{activePart.code} · {activePart.name}</text>
            <text x="8" y="29" className="callout-meta">{PART_GROUP_LABEL[activePart.group]} · SELECIONE PARA DETALHES</text>
          </g>
        )}
      </g>
    </svg>
  );
}
