import { useTokiStore } from '@/store/useTokiStore';
import { Icon } from '@/components/ui/Icon';
import { formatClock } from '@/lib/utils';

export function Notifications(): JSX.Element {
  const notifications = useTokiStore((s) => s.notifications);
  const dismiss = useTokiStore((s) => s.dismissNotification);
  const enabled = useTokiStore((s) => s.prefs.notificationsEnabled);
  const visible = enabled ? notifications.slice(-3).reverse() : [];

  return (
    <div className="notification-stack" aria-live="polite" aria-label="Notificações">
      {visible.map((item) => (
        <div key={item.id} className={`notification sev-${item.severity}`} role="status">
          <div className="notification-top">
            <span className="tech-code accent">{item.code}</span>
            <button type="button" className="mini-icon-btn" onClick={() => dismiss(item.id)} aria-label="Dispensar notificação">
              <Icon name="x" size={13} />
            </button>
          </div>
          <div className="notification-title" style={{ marginTop: 6 }}>{item.title}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{item.description}</div>
          <div className="row-between" style={{ marginTop: 10 }}>
            <span className="badge">{item.severity}</span>
            <span className="tech-code">{formatClock(item.ts)} · {item.module}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
