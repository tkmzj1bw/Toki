import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawingDoc, Point2, ShapeType, VectorShape } from '@/types';
import { useTokiStore } from '@/store/useTokiStore';
import { buildSegments, shapeToPoints } from '@/lib/geometry';
import { clamp, uid } from '@/lib/utils';

interface PlotCanvasProps {
  height?: string;
}

interface DraftState {
  type: ShapeType;
  start: Point2;
  current: Point2;
}

interface DragState {
  id: string;
  start: Point2;
  originalPoints: Point2[];
  doc: DrawingDoc;
  points: Point2[];
}

const asPath = (points: Point2[]): string => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

export function PlotCanvas({ height = '100%' }: PlotCanvasProps): JSX.Element {
  const doc = useTokiStore((s) => s.studioDoc);
  const tool = useTokiStore((s) => s.activeTool);
  const selected = useTokiStore((s) => s.selectedShapeIds);
  const activeLayerId = useTokiStore((s) => s.activeLayerId);
  const simulation = useTokiStore((s) => s.simulation);
  const addShape = useTokiStore((s) => s.addShape);
  const selectShapes = useTokiStore((s) => s.selectShapes);
  const applyDoc = useTokiStore((s) => s.applyDoc);
  const deleteSelected = useTokiStore((s) => s.deleteSelected);
  const undo = useTokiStore((s) => s.undo);
  const redo = useTokiStore((s) => s.redo);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point2[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<Point2>({ x: 0, y: 0 });

  const toPoint = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>): Point2 => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const pad = 10;
    const w = doc.bed.width + pad * 2;
    const h = doc.bed.height + pad * 2;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * w - pad, 0, doc.bed.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * h - pad, 0, doc.bed.height),
    };
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.key === 'Escape') {
        setDraft(null);
        setDraftPoints([]);
      }
      if (event.key === 'Enter' && draftPoints.length >= 2) commitPolyline(draftPoints);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteSelected, undo, redo, draftPoints]);

  const commitPolyline = (points: Point2[]): void => {
    const layer = doc.layers.find((l) => l.id === activeLayerId);
    if (!layer || layer.locked) return;
    addShape({
      id: uid('shape'),
      type: 'polyline',
      layerId: activeLayerId,
      points,
      stroke: layer.color,
      width: 0.5,
    });
    setDraftPoints([]);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    const point = toPoint(event);
    setCursor(point);

    if (tool === 'pan') return;
    if (tool === 'select') {
      selectShapes([]);
      return;
    }
    if (tool === 'polyline') {
      setDraftPoints((current) => [...current, point]);
      return;
    }
    setDraft({ type: tool as ShapeType, start: point, current: point });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const point = toPoint(event);
    setCursor(point);
    if (draft) setDraft({ ...draft, current: point });

    if (drag) {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      setDrag({
        ...drag,
        points: drag.originalPoints.map((p) => ({
          x: clamp(p.x + dx, 0, doc.bed.width),
          y: clamp(p.y + dy, 0, doc.bed.height),
        })),
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    if (draft) {
      const layer = doc.layers.find((l) => l.id === activeLayerId);
      if (layer && !layer.locked) {
        const distance = Math.hypot(draft.current.x - draft.start.x, draft.current.y - draft.start.y);
        if (distance > 1) {
          addShape({
            id: uid('shape'),
            type: draft.type,
            layerId: activeLayerId,
            points: [draft.start, draft.current],
            stroke: layer.color,
            width: 0.5,
          });
        }
      }
      setDraft(null);
    }
    if (drag) {
      applyDoc({
        ...drag.doc,
        shapes: drag.doc.shapes.map((shape) => (shape.id === drag.id ? { ...shape, points: drag.points } : shape)),
      });
      setDrag(null);
    }
  };

  const handleShapeDown = (event: React.PointerEvent<SVGElement>, shape: VectorShape): void => {
    if (tool !== 'select') return;
    event.stopPropagation();
    const layer = doc.layers.find((l) => l.id === shape.layerId);
    if (layer?.locked || shape.locked) return;
    selectShapes([shape.id]);
    setDrag({
      id: shape.id,
      start: toPoint(event as React.PointerEvent<SVGSVGElement>),
      originalPoints: shape.points,
      points: shape.points,
      doc,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const draftPointsForPreview = useMemo(() => {
    if (!draft) return [];
    const base: Point2[] = [draft.start, draft.current];
    if (draft.type === 'rect') {
      return [
        { x: draft.start.x, y: draft.start.y },
        { x: draft.current.x, y: draft.start.y },
        { x: draft.current.x, y: draft.current.y },
        { x: draft.start.x, y: draft.current.y },
        { x: draft.start.x, y: draft.start.y },
      ];
    }
    return base;
  }, [draft]);

  const segments = useMemo(() => buildSegments(doc), [doc]);
  const simLines = useMemo(() => {
    if (!simulation.playhead || simulation.segmentIndex < 0) return [];
    return segments.slice(0, simulation.segmentIndex);
  }, [segments, simulation.playhead, simulation.segmentIndex]);

  const rulerX = Array.from({ length: Math.floor(doc.bed.width / 50) + 1 }, (_, i) => i * 50);
  const rulerY = Array.from({ length: Math.floor(doc.bed.height / 50) + 1 }, (_, i) => i * 50);

  return (
    <div className="col" style={{ height, gap: 0, minHeight: 0 }}>
      <div className="ruler-x"><div className="ruler-ticks">{rulerX.map((value) => <span key={value}>{value}</span>)}</div></div>
      <div className="row" style={{ flex: 1, gap: 0, minHeight: 0 }}>
        <div className="ruler-y"><div className="ruler-ticks" style={{ flexDirection: 'column' }}>{rulerY.map((value) => <span key={value}>{value}</span>)}</div></div>
        <div className={`canvas-wrap tool-${tool}`} style={{ flex: 1 }}>
          <svg
            ref={svgRef}
            className="canvas-svg"
            viewBox={`-10 -10 ${doc.bed.width + 20} ${doc.bed.height + 20}`}
            preserveAspectRatio="none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={() => draftPoints.length >= 2 && commitPolyline(draftPoints)}
          >
            <rect x="0" y="0" width={doc.bed.width} height={doc.bed.height} fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="0.6" />
            {Array.from({ length: Math.floor(doc.bed.width / 10) }, (_, i) => (
              <line key={`vx-${i}`} x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2={doc.bed.height} stroke="var(--line)" strokeWidth="0.3" />
            ))}
            {Array.from({ length: Math.floor(doc.bed.height / 10) }, (_, i) => (
              <line key={`hy-${i}`} x1="0" y1={(i + 1) * 10} x2={doc.bed.width} y2={(i + 1) * 10} stroke="var(--line)" strokeWidth="0.3" />
            ))}

            {doc.shapes.map((shape) => {
              const points = drag?.id === shape.id ? drag.points : shapeToPoints(shape, doc);
              const layer = doc.layers.find((l) => l.id === shape.layerId);
              if (!layer?.visible || points.length < 2) return null;
              return (
                <polyline
                  key={shape.id}
                  points={asPath(points)}
                  fill="none"
                  stroke={selected.includes(shape.id) ? 'var(--accent)' : shape.stroke}
                  strokeWidth={selected.includes(shape.id) ? shape.width * 2 + 0.8 : shape.width * 2}
                  strokeDasharray={layer.locked ? '3 2' : undefined}
                  opacity={layer.locked ? 0.55 : 1}
                  onPointerDown={(event) => handleShapeDown(event, shape)}
                  style={{ cursor: tool === 'select' ? 'move' : 'crosshair' }}
                />
              );
            })}

            {draftPointsForPreview.length >= 2 && (
              <polyline points={asPath(draftPointsForPreview)} fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="3 2" />
            )}
            {draftPoints.length > 0 && (
              <>
                <polyline points={asPath(draftPoints)} fill="none" stroke="var(--accent)" strokeWidth="0.8" />
                {draftPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="var(--accent)" />)}
              </>
            )}

            {simLines.map((segment, index) => (
              <line
                key={`sim-${index}`}
                x1={segment.from.x}
                y1={segment.from.y}
                x2={segment.to.x}
                y2={segment.to.y}
                stroke={segment.pen === 'up' ? 'var(--muted)' : 'var(--accent)'}
                strokeWidth={segment.pen === 'up' ? 0.5 : 1}
                strokeDasharray={segment.pen === 'up' ? '2 2' : undefined}
                opacity={0.9}
              />
            ))}
            {simulation.playhead && (
              <circle cx={simulation.playhead.x} cy={simulation.playhead.y} r="2.2" fill="var(--accent)" />
            )}
          </svg>
          <div className="canvas-overlay">
            <span>X {cursor.x.toFixed(1)} / Y {cursor.y.toFixed(1)} MM</span>
            <span>{tool.toUpperCase()}</span>
            {simulation.progress > 0 && <span className="accent">SIM {simulation.progress.toFixed(0)}%</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
