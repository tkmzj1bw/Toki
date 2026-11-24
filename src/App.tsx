import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { EventConsole } from '@/components/layout/EventConsole';
import { Notifications } from '@/components/layout/Notifications';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { ConnectionDrawer } from '@/components/layout/ConnectionDrawer';
import { BootScreen } from '@/components/layout/BootScreen';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Overview } from '@/modules/Overview';
import { PlotStudio } from '@/modules/PlotStudio';
import { MachineControl } from '@/modules/MachineControl';
import { Monitoring } from '@/modules/Monitoring';
import { ProjectManager } from '@/modules/ProjectManager';
import { SystemCenter } from '@/modules/SystemCenter';
import { connectionManager } from '@/hardware/ConnectionManager';
import { useTokiStore, wireHardware } from '@/store/useTokiStore';

export default function App(): JSX.Element {
  const booted = useTokiStore((s) => s.booted);
  const setBooted = useTokiStore((s) => s.setBooted);
  const activeModule = useTokiStore((s) => s.activeModule);
  const prefs = useTokiStore((s) => s.prefs);
  const rigMode = useTokiStore((s) => s.rig.mode);
  const connectionState = useTokiStore((s) => s.connection.state);
  const queryTemperatures = useTokiStore((s) => s.queryTemperatures);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    wireHardware();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.density = prefs.density;
    root.style.setProperty('--accent', prefs.accent);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotion = (): void => {
      root.style.setProperty('--motion', query.matches ? '0' : String(prefs.animationIntensity));
    };
    applyMotion();
    query.addEventListener('change', applyMotion);
    return () => query.removeEventListener('change', applyMotion);
  }, [prefs.theme, prefs.density, prefs.accent, prefs.animationIntensity]);

  useEffect(() => {
    connectionManager.setPolicy({
      autoReconnect: prefs.connection.autoReconnect,
      delayMs: prefs.connection.reconnectDelayMs,
      timeoutMs: prefs.connection.commandTimeoutMs,
    });
  }, [prefs.connection]);

  useEffect(() => {
    if (connectionState !== 'connected' || rigMode !== 'printer3d') return;
    void queryTemperatures();
    const timer = window.setInterval(() => void queryTemperatures(), 5000);
    return () => window.clearInterval(timer);
  }, [connectionState, rigMode, queryTemperatures]);

  const renderModule = (): JSX.Element => {
    switch (activeModule) {
      case 'studio':
        return <PlotStudio />;
      case 'machine':
        return <MachineControl />;
      case 'monitoring':
        return <Monitoring />;
      case 'projects':
        return <ProjectManager />;
      case 'system':
        return <SystemCenter />;
      default:
        return <Overview />;
    }
  };

  if (!booted) {
    return (
      <BootScreen
        onDone={() => {
          setBooted(true);
          if (prefs.showWelcome) setWelcome(true);
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className={`app-shell${prefs.sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <Sidebar />
        <Header />
        <main className="workspace">{renderModule()}</main>
        <div className="console-host"><EventConsole /></div>
      </div>
      <Notifications />
      <ConfirmDialog />
      <ConnectionDrawer />
      {welcome && (
        <WelcomeScreen
          onEnter={() => {
            setWelcome(false);
            setBooted(true);
          }}
        />
      )}
    </ErrorBoundary>
  );
}
