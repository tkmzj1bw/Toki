import type { TokiEvent } from '@/types';

interface EventChartProps {
  events: TokiEvent[];
  minutes?: number;
  label?: string;
}

const W = 600;
const H = 240;
const PAD = 28;

export function EventChart({ events, minutes = 10, label = 'EVENTOS / MIN' }: EventChartProps): JSX.Element {
  const now = Date.now();
  const buckets = Array.from({ length: minutes }, (_, i) => ({
    time: now - (minutes - 1 - i) * 60_000,
    count: 0,
  }));
  events.forEach((event) => {
    const index = buckets.findIndex((bucket) => Math.abs(bucket.time - event.ts) < 30_000);
    if (index >= 0) buckets[index].count += 1;
  });
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const points = buckets.map((bucket, i) => ({
    x: PAD + (i / Math.max(1, minutes - 1)) * (W - PAD * 2),
    y: H - PAD - (bucket.count / max) * (H - PAD * 2),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${points[points.length - 1]?.x ?? PAD},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <line
          key={ratio}
          className="chart-grid-line"
          x1={PAD}
          y1={PAD + ratio * (H - PAD * 2)}
          x2={W - PAD}
          y2={PAD + ratio * (H - PAD * 2)}
        />
      ))}
      <text className="chart-label" x="2" y={PAD + 4}>{max}</text>
      <text className="chart-label" x="2" y={H - PAD + 4}>0</text>
      <path d={area} fill="var(--accent)" opacity="0.08" />
      <path d={path} className="chart-line" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill="var(--accent)" />
      ))}
      <text className="chart-label" x={PAD} y={H - 8}>-{minutes} MIN</text>
      <text className="chart-label" x={W - PAD - 34} y={H - 8}>AGORA</text>
    </svg>
  );
}
