import { rigModeLabel } from '@/types';
import type { DrawingDoc, Point2, RigState, VectorShape } from '@/types';
import { round } from './utils';

export interface PathSegment {
  from: Point2;
  to: Point2;
  pen: 'up' | 'down';
  shapeId: string;
}

const ellipsePoints = (cx: number, cy: number, rx: number, ry: number, steps = 48): Point2[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });

export const shapeToPoints = (shape: VectorShape, _doc: DrawingDoc): Point2[] => {
  const [a, b] = shape.points;
  switch (shape.type) {
    case 'line':
      return a && b ? [a, b] : [];
    case 'rect': {
      if (!a || !b) return [];
      const x1 = Math.min(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const x2 = Math.max(a.x, b.x);
      const y2 = Math.max(a.y, b.y);
      return [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
        { x: x1, y: y1 },
      ];
    }
    case 'ellipse': {
      if (!a || !b) return [];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      return ellipsePoints(cx, cy, Math.abs(a.x - b.x) / 2, Math.abs(a.y - b.y) / 2);
    }
    case 'polyline':
      return shape.points;
    default:
      return [];
  }
};

export const buildSegments = (doc: DrawingDoc): PathSegment[] => {
  const visible = new Set(doc.layers.filter((l) => l.visible).map((l) => l.id));
  const segments: PathSegment[] = [];
  let penPosition: Point2 = { x: 0, y: 0 };

  doc.shapes.forEach((shape) => {
    if (!visible.has(shape.layerId)) return;
    const points = shapeToPoints(shape, doc);
    if (points.length < 2) return;

    const first = points[0];
    if (Math.hypot(first.x - penPosition.x, first.y - penPosition.y) > 0.01) {
      segments.push({ from: penPosition, to: first, pen: 'up', shapeId: shape.id });
    }
    for (let i = 1; i < points.length; i += 1) {
      segments.push({ from: points[i - 1], to: points[i], pen: 'down', shapeId: shape.id });
    }
    penPosition = points[points.length - 1];
  });

  return segments;
};

export const segmentLength = (segment: PathSegment): number =>
  Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);

export const totalDistance = (segments: PathSegment[]): number =>
  segments.reduce((sum, segment) => sum + segmentLength(segment), 0);

export const documentStats = (doc: DrawingDoc) => {
  const segments = buildSegments(doc);
  const drawDistance = segments
    .filter((s) => s.pen === 'down')
    .reduce((sum, s) => sum + segmentLength(s), 0);
  const travelDistance = segments
    .filter((s) => s.pen === 'up')
    .reduce((sum, s) => sum + segmentLength(s), 0);
  return {
    shapes: doc.shapes.length,
    visibleShapes: doc.shapes.filter((s) => doc.layers.find((l) => l.id === s.layerId)?.visible).length,
    layers: doc.layers.length,
    segments: segments.length,
    drawDistance: round(drawDistance, 1),
    travelDistance: round(travelDistance, 1),
    estimatedSeconds: round(
      (drawDistance / Math.max(1, doc.settings.feedRate)) * 60 +
        (travelDistance / Math.max(1, doc.settings.travelRate)) * 60,
      1,
    ),
  };
};

export const pointOnSegment = (segment: PathSegment, t: number): Point2 => ({
  x: segment.from.x + (segment.to.x - segment.from.x) * t,
  y: segment.from.y + (segment.to.y - segment.from.y) * t,
});

export const clampToBed = (point: Point2, doc: DrawingDoc): Point2 => ({
  x: Math.min(doc.bed.width, Math.max(0, point.x)),
  y: Math.min(doc.bed.height, Math.max(0, point.y)),
});

export const toGcode = (doc: DrawingDoc, rig?: RigState): string => {
  const segments = buildSegments(doc);
  const mode = rig?.mode ?? 'plotter';
  const profile = rig?.profiles[mode];
  const tool = profile?.tool;
  const bed = profile?.bed ?? doc.bed;
  const safeZ = tool?.safeZ ?? doc.settings.penUp;
  const workZ = tool?.workZ ?? doc.settings.penDown;
  const travelRate = Math.min(doc.settings.travelRate, profile?.travelRateMax ?? doc.settings.travelRate);
  const feedRate = Math.min(doc.settings.feedRate, profile?.feedRateMax ?? doc.settings.feedRate);

  const lines: string[] = [
    `; TOKI — ${rigModeLabel[mode]} · traço vetorial`,
    `; Bed ${bed.width}x${bed.height} mm · Z seguro ${safeZ} / trabalho ${workZ}`,
    'G21',
    'G90',
    `G0 Z${safeZ} F${travelRate}`,
  ];

  if (mode === 'printer3d' && tool) {
    const canHeat = rig?.acknowledged.thermalRunaway ?? false;
    lines.push(
      canHeat
        ? `M104 S${tool.nozzleTarget}`
        : '; M104 BLOQUEADO: confirme thermal runaway na rig',
      canHeat
        ? `M140 S${tool.bedTarget}`
        : '; M140 BLOQUEADO: confirme thermal runaway na rig',
      '; Sem comandos E: extrusão manual em MACHINE CONTROL',
    );
  }

  if (mode === 'cnc' && tool) {
    const cncReady = tool.spindleEnabled
      && (rig?.acknowledged.spindleFirmware ?? false)
      && (rig?.acknowledged.enclosure ?? false)
      && (rig?.acknowledged.workholding ?? false);
    lines.push(
      cncReady
        ? `M3 S${tool.rpmDefault}`
        : '; M3/M4 BLOQUEADO: confirme firmware, envelope e fixação na rig',
    );
  }

  segments.forEach((segment) => {
    const to = clampToBed(segment.to, { ...doc, bed });
    lines.push(`G0 X${round(to.x, 3)} Y${round(to.y, 3)} Z${safeZ} F${travelRate}`);
    if (segment.pen === 'down') {
      lines.push(`G1 Z${workZ} F${Math.max(60, Math.round(travelRate / 2))}`);
      lines.push(`G1 X${round(to.x, 3)} Y${round(to.y, 3)} F${feedRate}`);
      lines.push(`G0 Z${safeZ} F${travelRate}`);
    }
  });

  if (mode === 'printer3d') lines.push('M104 S0', 'M140 S0');
  if (mode === 'cnc') lines.push('M5');
  lines.push('M114', '; END');
  return lines.join('\n');
};
