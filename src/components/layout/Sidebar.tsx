import type { ModuleId } from '@/types';
import { useTokiStore } from '@/store/useTokiStore';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';

interface NavItem {
  id: ModuleId;
  label: string;
  code: string;
  icon: IconName;
}

const items: NavItem[] = [
  { id: 'overview', label: 'OVERVIEW', code: '01', icon: 'overview' },
  { id: 'studio', label: 'PLOT STUDIO', code: '02', icon: 'studio' },
  { id: 'machine', label: 'MACHINE CTRL', code: '03', icon: 'machine' },
  { id: 'monitoring', label: 'MONITORING', code: '04', icon: 'monitor' },
  { id: 'projects', label: 'PROJECTS', code: '05', icon: 'projects' },
  { id: 'system', label: 'SYSTEM CENTER', code: '06', icon: 'system' },
];

export function Sidebar(): JSX.Element {
  const activeModule = useTokiStore((s) => s.activeModule);
  const collapsed = useTokiStore((s) => s.prefs.sidebarCollapsed);
  const toggleSidebar = useTokiStore((s) => s.toggleSidebar);
  const setActiveModule = useTokiStore((s) => s.setActiveModule);
  const setConnectionDrawerOpen = useTokiStore((s) => s.setConnectionDrawerOpen);
  const queued = useTokiStore((s) => s.projects.filter((p) => p.status === 'queued').length);
  const unread = useTokiStore((s) => s.notifications.filter((n) => !n.read).length);
  const connection = useTokiStore((s) => s.connection);

  const badgeFor = (id: ModuleId): number | null => {
    if (id === 'projects' && queued > 0) return queued;
    if (id === 'monitoring' && unread > 0) return unread;
    return null;
  };

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Navegação principal">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <BrandMark />
        </div>
        <div>
          <div className="brand-name">TOKI</div>
          <div className="brand-sub">INDUSTRIAL OS · v0.1</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Módulos">
        <div className="nav-group-label">SISTEMA / MÓDULOS</div>
        {items.map((item) => {
          const badge = badgeFor(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item${activeModule === item.id ? ' active' : ''}`}
              onClick={() => setActiveModule(item.id)}
              aria-current={activeModule === item.id ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon name={item.icon} size={19} />
              <span className="nav-label">{item.label}</span>
              {badge !== null ? <span className="nav-badge">{badge}</span> : <span className="nav-code">{item.code}</span>}
              {collapsed && <span className="tooltip">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-item"
          onClick={() => setConnectionDrawerOpen(true)}
          aria-label="Abrir painel de conexão"
        >
          <Icon name="plug" size={18} />
          <span className="nav-label sidebar-footer-text">CONEXÃO</span>
          <span className={`dot ${connection.state}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="nav-item"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          <Icon name="chevron" size={18} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }} />
          <span className="nav-label sidebar-footer-text">RECOLHER</span>
        </button>
        <div className="sidebar-system-line">
          <span className={`dot ${connection.state}`} />
          <span className="sidebar-footer-text">TOKI // SYS ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
