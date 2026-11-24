import { useTokiStore } from '@/store/useTokiStore';
import { rigModeLabel } from '@/types';
import type { RigMode } from '@/types';

const modes: Array<{ id: RigMode; short: string; hint: string }> = [
  { id: 'plotter', short: 'PLOTTER', hint: 'Caneta · traço vetorial' },
  { id: 'printer3d', short: '3D', hint: 'Hotend · temperatura e extrusão' },
  { id: 'cnc', short: 'CNC', hint: 'Fuso M3/M4/M5' },
];

interface RigModeSelectorProps {
  compact?: boolean;
  className?: string;
}

export function RigModeSelector({ compact = false, className = '' }: RigModeSelectorProps): JSX.Element {
  const rig = useTokiStore((s) => s.rig);
  const requestRigMode = useTokiStore((s) => s.requestRigMode);
  const phase = useTokiStore((s) => s.execution.phase);
  const busy = phase === 'running' || phase === 'paused';

  return (
    <div
      className={`rig-selector${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Selecionar configuração da máquina"
    >
      {modes.map((item) => (
        <button
          key={item.id}
          type="button"
          className={rig.mode === item.id ? 'active' : ''}
          disabled={busy || rig.mode === item.id}
          title={busy ? 'Interrompa a execução para trocar de modo' : `${rigModeLabel[item.id]} · ${item.hint}`}
          aria-pressed={rig.mode === item.id}
          onClick={() => requestRigMode(item.id)}
        >
          {compact ? item.short : rigModeLabel[item.id]}
        </button>
      ))}
    </div>
  );
}
