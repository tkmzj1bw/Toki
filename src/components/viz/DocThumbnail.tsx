import type { DrawingDoc } from '@/types';
import { shapeToPoints } from '@/lib/geometry';

interface DocThumbnailProps {
  doc: DrawingDoc;
  accent?: string;
}

export function DocThumbnail({ doc, accent }: DocThumbnailProps): JSX.Element {
  const w = doc.bed.width || 300;
  const h = doc.bed.height || 300;
  const pad = 8;
  const scale = Math.min((100 - pad * 2) / w, (100 - pad * 2) / h);
  const tx = (x: number): number => pad + x * scale + ((100 - w * scale) / 2);
  const ty = (y: number): number => pad + y * scale + ((100 - h * scale) / 2);
  const shapes = doc.shapes.filter((shape) => doc.layers.find((l) => l.id === shape.layerId)?.visible !== false);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Miniatura do desenho">
      <rect x="1" y="1" width="98" height="98" fill="none" stroke="var(--line)" />
      {shapes.map((shape) => {
        const points = shapeToPoints(shape, doc);
        if (points.length < 2) return null;
        return (
          <polyline
            key={shape.id}
            points={points.map((p) => `${tx(p.x).toFixed(2)},${ty(p.y).toFixed(2)}`).join(' ')}
            fill="none"
            stroke={accent ?? shape.stroke}
            strokeWidth="0.9"
          />
        );
      })}
      {shapes.length === 0 && <text x="50" y="53" textAnchor="middle" className="label">SEM TRAÇOS</text>}
    </svg>
  );
}
