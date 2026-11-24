import type { Severity } from '@/types';
import { useTokiStore } from '@/store/useTokiStore';
import { Icon } from '@/components/ui/Icon';
import { formatClock } from '@/lib/utils';

const filters: Array<Severity | 'ALL'> = ['ALL', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

export function EventConsole(): JSX.Element {
  const events = useTokiStore((s) => s.events);
  const filter = useTokiStore((s) => s.consoleFilter);
  const setFilter = useTokiStore((s) => s.setConsoleFilter);
  const open = useTokiStore((s) => s.prefs.consoleOpen);
  const setOpen = useTokiStore((s) => s.setConsoleOpen);

  const visible = events.filter((event) => filter === 'ALL' || event.severity === filter).slice().reverse();

  return (
    <div className={`event-console${open ? ' open' : ''}`} aria-label="Console de eventos">
      <div className="console-toolbar">
        <Icon name="command" size={14} />
        <span className="console-title">CONSOLE DE EVENTOS</span>
        <span className="badge">{events.length}</span>
        <div className="spacer" />
        {open && (
          <div className="segmented" role="group" aria-label="Filtro de severidade">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? 'RECOLHER' : 'EXPANDIR'}
          <Icon name="chevron" size={12} style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
        </button>
      </div>
      {open && (
        <div className="console-rows" role="log" aria-live="polite">
          {visible.length === 0 && (
            <div className="empty-state" style={{ minHeight: 80 }}>Nenhum evento nesta categoria.</div>
          )}
          {visible.map((event) => (
            <div key={event.id} className={`console-row sev-${event.severity}`}>
              <span className="muted">{formatClock(event.ts)}</span>
              <span className="console-sev">{event.severity}</span>
              <span className="console-code">{event.code}</span>
              <span>{event.message}{event.details ? ` · ${event.details}` : ''}</span>
              <span className="console-module muted">{event.module}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
