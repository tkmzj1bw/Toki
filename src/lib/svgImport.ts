import type { DrawingDoc, Point2, VectorShape } from '@/types';
import { uid } from './utils';

const n = (value: string | null, fallback = 0): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePath = (d: string): Point2[][] => {
  const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const subpaths: Point2[][] = [];
  let current: Point2[] = [];
  let cursor: Point2 = { x: 0, y: 0 };
  let start: Point2 = { x: 0, y: 0 };
  let i = 0;
  const num = () => Number.parseFloat(tokens[i++] ?? '0');

  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (!cmd) break;
    const upper = cmd.toUpperCase();
    const relative = cmd !== upper;

    if (upper === 'M') {
      if (current.length > 1) subpaths.push(current);
      const x = num();
      const y = num();
      cursor = relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
      start = cursor;
      current = [cursor];
    } else if (upper === 'L') {
      const x = num();
      const y = num();
      cursor = relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
      current.push(cursor);
    } else if (upper === 'H') {
      const x = num();
      cursor = { x: relative ? cursor.x + x : x, y: cursor.y };
      current.push(cursor);
    } else if (upper === 'V') {
      const y = num();
      cursor = { x: cursor.x, y: relative ? cursor.y + y : y };
      current.push(cursor);
    } else if (upper === 'Z') {
      if (current.length > 1) current.push(start);
      cursor = start;
    } else {
      // Comandos de curva não são convertidos; ignorar tokens restantes deste par.
      i += 1;
    }
  }
  if (current.length > 1) subpaths.push(current);
  return subpaths;
};

export interface ImportResult {
  doc: DrawingDoc;
  warnings: string[];
}

export const importSvg = (svgText: string, base: DrawingDoc): ImportResult => {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const error = parsed.querySelector('parsererror');
  if (error) throw new Error('SVG inválido');

  const svg = parsed.documentElement;
  const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  const vb = viewBox?.length === 4 && viewBox.every(Number.isFinite) ? viewBox : null;
  const sourceW = vb ? vb[2] : n(svg.getAttribute('width'), base.bed.width);
  const sourceH = vb ? vb[3] : n(svg.getAttribute('height'), base.bed.height);
  const ox = vb ? vb[0] : 0;
  const oy = vb ? vb[1] : 0;
  const project = (p: Point2): Point2 => ({
    x: Math.min(base.bed.width, Math.max(0, ((p.x - ox) / Math.max(1, sourceW)) * base.bed.width)),
    y: Math.min(base.bed.height, Math.max(0, ((p.y - oy) / Math.max(1, sourceH)) * base.bed.height)),
  });

  const shapes: VectorShape[] = [];
  const warnings: string[] = [];
  const layerId = base.layers[0]?.id ?? 'layer_default';

  svg.querySelectorAll('line, polyline, polygon, rect, circle, ellipse, path').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const stroke = el.getAttribute('stroke') ?? base.layers[0]?.color ?? '#171719';
    let points: Point2[] = [];
    let type: VectorShape['type'] = 'polyline';

    if (tag === 'line') {
      type = 'line';
      points = [
        { x: n(el.getAttribute('x1')), y: n(el.getAttribute('y1')) },
        { x: n(el.getAttribute('x2')), y: n(el.getAttribute('y2')) },
      ];
    } else if (tag === 'polyline' || tag === 'polygon') {
      points = (el.getAttribute('points') ?? '')
        .trim()
        .split(/[\s,]+/)
        .reduce<Point2[]>((acc, value, idx, arr) => {
          if (idx % 2 === 0) acc.push({ x: Number.parseFloat(value), y: Number.parseFloat(arr[idx + 1]) });
          return acc;
        }, []);
      if (tag === 'polygon' && points.length) points.push(points[0]);
    } else if (tag === 'rect') {
      type = 'rect';
      const x = n(el.getAttribute('x'));
      const y = n(el.getAttribute('y'));
      points = [
        { x, y },
        { x: x + n(el.getAttribute('width')), y: y + n(el.getAttribute('height')) },
      ];
    } else if (tag === 'circle') {
      type = 'ellipse';
      const cx = n(el.getAttribute('cx'));
      const cy = n(el.getAttribute('cy'));
      const r = n(el.getAttribute('r'));
      points = [
        { x: cx - r, y: cy - r },
        { x: cx + r, y: cy + r },
      ];
    } else if (tag === 'ellipse') {
      type = 'ellipse';
      const cx = n(el.getAttribute('cx'));
      const cy = n(el.getAttribute('cy'));
      points = [
        { x: cx - n(el.getAttribute('rx')), y: cy - n(el.getAttribute('ry')) },
        { x: cx + n(el.getAttribute('rx')), y: cy + n(el.getAttribute('ry')) },
      ];
    } else if (tag === 'path') {
      const subpaths = parsePath(el.getAttribute('d') ?? '');
      subpaths.forEach((subpath) => {
        shapes.push({
          id: uid('shape'),
          type: 'polyline',
          layerId,
          points: subpath.map(project),
          stroke,
          width: n(el.getAttribute('stroke-width'), base.settings.feedRate > 0 ? 0.4 : 0.4),
        });
      });
      return;
    }

    if (points.length >= 2) {
      shapes.push({
        id: uid('shape'),
        type,
        layerId,
        points: points.map(project),
        stroke,
        width: 0.4,
      });
    }
  });

  if (!shapes.length) warnings.push('Nenhum elemento vetorial compatível foi encontrado no SVG.');
  return { doc: { ...base, shapes }, warnings };
};
