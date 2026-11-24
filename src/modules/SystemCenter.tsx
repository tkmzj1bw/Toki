import { useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { RigPanel } from '@/components/rig/RigPanel';
import { Icon } from '@/components/ui/Icon';
import { formatClock, formatDateTime } from '@/lib/utils';
import { rigModeLabel } from '@/types';
import type { ModuleId } from '@/types';

type Section = 'general' | 'appearance' | 'animations' | 'notifications' | 'rig' | 'connection' | 'startup' | 'diagnostics' | 'logs';

const sections: Array<{ id: Section; label: string }> = [
  { id: 'general', label: 'GERAL' },
  { id: 'appearance', label: 'APARÊNCIA' },
  { id: 'animations', label: 'ANIMAÇÕES' },
  { id: 'notifications', label: 'NOTIFICAÇÕES' },
  { id: 'rig', label: 'RIG / MÁQUINA' },
  { id: 'connection', label: 'CONEXÃO' },
  { id: 'startup', label: 'INICIALIZAÇÃO' },
  { id: 'diagnostics', label: 'DIAGNÓSTICOS' },
  { id: 'logs', label: 'LOGS' },
];

const accents = ['#E33B40', '#38A878', '#171719', '#A9A8AC'];

const startupModules: Array<{ id: ModuleId; label: string }> = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'studio', label: 'PLOT STUDIO' },
  { id: 'machine', label: 'MACHINE CONTROL' },
  { id: 'monitoring', label: 'MONITORING' },
  { id: 'projects', label: 'PROJECT MANAGER' },
  { id: 'system', label: 'SYSTEM CENTER' },
];

interface RowProps {
  name: string;
  description: string;
  children: React.ReactNode;
}

const Row = ({ name, description, children }: RowProps): JSX.Element => (
  <div className="setting-row">
    <div className="setting-info">
      <div className="setting-name">{name}</div>
      <div className="setting-desc">{description}</div>
    </div>
    <div className="setting-control">{children}</div>
  </div>
);

export function SystemCenter(): JSX.Element {
  const [section, setSection] = useState<Section>('general');
  const prefs = useTokiStore((s) => s.prefs);
  const updatePreferences = useTokiStore((s) => s.updatePreferences);
  const updateConnectionPreferences = useTokiStore((s) => s.updateConnectionPreferences);
  const resetPreferences = useTokiStore((s) => s.resetPreferences);
  const setConsoleOpen = useTokiStore((s) => s.setConsoleOpen);
  const events = useTokiStore((s) => s.events);
  const clearEvents = useTokiStore((s) => s.clearEvents);
  const connection = useTokiStore((s) => s.connection);
  const telemetry = useTokiStore((s) => s.telemetry);
  const rig = useTokiStore((s) => s.rig);
  const projects = useTokiStore((s) => s.projects);
  const setBooted = useTokiStore((s) => s.setBooted);

  const webSerial = typeof navigator !== 'undefined' && Boolean(navigator.serial);
  const storageBytes = typeof localStorage !== 'undefined' ? new Blob([localStorage.getItem('toki-os-state') ?? '']).size : 0;

  return (
    <section className="module-shell">
      <div className="module-header">
        <div>
          <div className="eyebrow">MÓDULO 06 · CONFIGURAÇÕES DO SISTEMA</div>
          <h1 className="module-title">SYSTEM CENTER</h1>
          <div className="module-subtitle">PREFERÊNCIAS / APARÊNCIA / CONEXÃO / DIAGNÓSTICOS</div>
        </div>
        <button type="button" className="btn" onClick={resetPreferences}><Icon name="refresh" size={14} /> RESTAURAR PADRÃO</button>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Categorias de configuração">
          {sections.map((item) => (
            <button key={item.id} type="button" className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-section">
          {section === 'general' && (
            <>
              <Row name="Densidade visual" description="Controla o espaçamento e o tamanho dos painéis.">
                <div className="segmented">
                  <button type="button" className={prefs.density === 'comfortable' ? 'active' : ''} onClick={() => updatePreferences({ density: 'comfortable' })}>NORMAL</button>
                  <button type="button" className={prefs.density === 'compact' ? 'active' : ''} onClick={() => updatePreferences({ density: 'compact' })}>COMPACTA</button>
                </div>
              </Row>
              <Row name="Sidebar recolhida" description="Exibe apenas os ícones dos módulos na navegação.">
                <button type="button" className={`toggle${prefs.sidebarCollapsed ? ' on' : ''}`} onClick={() => updatePreferences({ sidebarCollapsed: !prefs.sidebarCollapsed })} aria-pressed={prefs.sidebarCollapsed} aria-label="Sidebar recolhida" />
              </Row>
              <Row name="Console de eventos" description="Mantém o console expandido ao iniciar o sistema.">
                <button type="button" className={`toggle${prefs.consoleOpen ? ' on' : ''}`} onClick={() => setConsoleOpen(!prefs.consoleOpen)} aria-pressed={prefs.consoleOpen} aria-label="Console expandido" />
              </Row>
              <Row name="Tela de boas-vindas" description="Exibe a introdução no primeiro acesso.">
                <button type="button" className={`toggle${prefs.showWelcome ? ' on' : ''}`} onClick={() => updatePreferences({ showWelcome: !prefs.showWelcome })} aria-pressed={prefs.showWelcome} aria-label="Tela de boas-vindas" />
              </Row>
            </>
          )}

          {section === 'appearance' && (
            <>
              <Row name="Tema" description="Tema claro ou escuro, mantendo a identidade cromática do TOKI.">
                <div className="segmented">
                  <button type="button" className={prefs.theme === 'light' ? 'active' : ''} onClick={() => updatePreferences({ theme: 'light' })}>CLARO</button>
                  <button type="button" className={prefs.theme === 'dark' ? 'active' : ''} onClick={() => updatePreferences({ theme: 'dark' })}>ESCURO</button>
                </div>
              </Row>
              <Row name="Cor de destaque" description="Cor usada em alertas, indicadores e estados ativos.">
                <div className="swatch-row">
                  {accents.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`swatch${prefs.accent === color ? ' active' : ''}`}
                      onClick={() => updatePreferences({ accent: color })}
                      aria-label={`Cor ${color}`}
                    >
                      <span style={{ background: color }} />
                    </button>
                  ))}
                </div>
              </Row>
              <Row name="Restaurar tema" description="Volta ao tema claro, cor vermelha e densidade normal.">
                <button type="button" className="btn" onClick={() => updatePreferences({ theme: 'light', accent: '#E33B40', density: 'comfortable' })}>PADRÃO</button>
              </Row>
            </>
          )}

          {section === 'animations' && (
            <>
              <Row name="Intensidade das animações" description="Multiplica a duração das transições. 0 desativa animações globais.">
                <div className="row">
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={2}
                    step={0.25}
                    value={prefs.animationIntensity}
                    onChange={(event) => updatePreferences({ animationIntensity: Number(event.target.value) })}
                    aria-label="Intensidade das animações"
                  />
                  <span className="mono">{prefs.animationIntensity.toFixed(2)}×</span>
                </div>
              </Row>
              <Row name="Movimento reduzido" description="O sistema respeita a preferência de movimento reduzido do dispositivo.">
                <span className="badge">AUTOMÁTICO</span>
              </Row>
            </>
          )}

          {section === 'notifications' && (
            <>
              <Row name="Notificações imersivas" description="Exibe avisos de WARNING, ERROR e CRITICAL sobre a interface.">
                <button type="button" className={`toggle${prefs.notificationsEnabled ? ' on' : ''}`} onClick={() => updatePreferences({ notificationsEnabled: !prefs.notificationsEnabled })} aria-pressed={prefs.notificationsEnabled} aria-label="Notificações" />
              </Row>
              <Row name="Sem áudio" description="Toda comunicação do TOKI é visual. Nenhum som é reproduzido.">
                <span className="badge">SEM SOM</span>
              </Row>
            </>
          )}

          {section === 'rig' && <RigPanel full />}

          {section === 'connection' && (
            <>
              <Row name="Baud rate padrão" description="Velocidade usada ao abrir a porta serial.">
                <select className="select" style={{ width: 150 }} value={prefs.connection.baudRate} onChange={(event) => updateConnectionPreferences({ baudRate: Number(event.target.value) })}>
                  {[9600, 19200, 38400, 57600, 115200, 250000].map((rate) => <option key={rate} value={rate}>{rate}</option>)}
                </select>
              </Row>
              <Row name="Reconexão automática" description="Tenta restabelecer a comunicação após uma desconexão inesperada.">
                <button type="button" className={`toggle${prefs.connection.autoReconnect ? ' on' : ''}`} onClick={() => updateConnectionPreferences({ autoReconnect: !prefs.connection.autoReconnect })} aria-pressed={prefs.connection.autoReconnect} aria-label="Reconexão automática" />
              </Row>
              <Row name="Intervalo de reconexão" description="Tempo entre tentativas, em milissegundos.">
                <input className="input" style={{ width: 120 }} type="number" min={500} max={30000} step={500} value={prefs.connection.reconnectDelayMs} onChange={(event) => updateConnectionPreferences({ reconnectDelayMs: Number(event.target.value) })} />
              </Row>
              <Row name="Timeout de comando" description="Tempo máximo aguardando a resposta ok da controladora.">
                <input className="input" style={{ width: 120 }} type="number" min={1000} max={30000} step={500} value={prefs.connection.commandTimeoutMs} onChange={(event) => updateConnectionPreferences({ commandTimeoutMs: Number(event.target.value) })} />
              </Row>
              <Row name="Status atual" description="Estado da comunicação nesta sessão.">
                <span className={`badge ${connection.state === 'connected' ? 'real' : connection.state === 'error' ? 'demo' : ''}`}>{connection.state.toUpperCase()}</span>
              </Row>
            </>
          )}

          {section === 'startup' && (
            <>
              <Row name="Módulo inicial" description="Módulo aberto após a inicialização.">
                <select className="select" style={{ width: 200 }} value={prefs.startupModule} onChange={(event) => updatePreferences({ startupModule: event.target.value as ModuleId })}>
                  {startupModules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </Row>
              <Row name="Reexecutar boot" description="Mostra novamente a tela de inicialização minimalista.">
                <button type="button" className="btn" onClick={() => setBooted(false)}>REINICIAR</button>
              </Row>
            </>
          )}

          {section === 'diagnostics' && (
            <>
              <Row name="Versão do sistema" description="Identificador da build local.">
                <span className="mono">TOKI 0.1.0</span>
              </Row>
              <Row name="WebSerial" description="Necessário para conexão com firmware Marlin.">
                <span className={`badge ${webSerial ? 'real' : 'demo'}`}>{webSerial ? 'DISPONÍVEL' : 'INDISPONÍVEL'}</span>
              </Row>
              <Row name="Porta ativa" description="Informação reportada pela camada de comunicação.">
                <span className="mono">{telemetry.port ?? 'NENHUMA'}</span>
              </Row>
              <Row name="Firmware identificado" description="Valor obtido do comando M115.">
                <span className="mono">{telemetry.firmware ?? 'NÃO IDENTIFICADO'}</span>
              </Row>
              <Row name="Configuração da rig" description="Perfil ativo selecionado pelo operador.">
                <span className="mono">{rigModeLabel[rig.mode]}</span>
              </Row>
              <Row name="Temperatura · M105" description="Leitura reportada pela controladora; indisponível quando o sensor não responde.">
                <span className="mono">
                  {telemetry.temperatures
                    ? `${telemetry.temperatures.hotend ?? '—'} / ${telemetry.temperatures.bed ?? '—'} °C`
                    : 'SEM LEITURA'}
                </span>
              </Row>
              <Row name="Projetos locais" description="Registros persistidos neste navegador.">
                <span className="mono">{projects.length}</span>
              </Row>
              <Row name="Eventos em memória" description="Quantidade de registros no console.">
                <span className="mono">{events.length} / 400</span>
              </Row>
              <Row name="Estado persistido" description="Tamanho aproximado das preferências e projetos.">
                <span className="mono">{(storageBytes / 1024).toFixed(1)} KB</span>
              </Row>
            </>
          )}

          {section === 'logs' && (
            <div className="panel-body tight">
              <div className="row-between" style={{ marginBottom: 12 }}>
                <span className="eyebrow">REGISTROS LOCAIS</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={clearEvents} disabled={!events.length}>LIMPAR LOGS</button>
              </div>
              <div className="col" style={{ gap: 0, maxHeight: 420, overflow: 'auto' }}>
                {events.slice().reverse().map((event) => (
                  <div key={event.id} className="console-row" style={{ gridTemplateColumns: '82px 76px 148px minmax(0,1fr) 110px' }}>
                    <span className="muted">{formatDateTime(event.ts)}</span>
                    <span className="console-sev">{event.severity}</span>
                    <span className="console-code">{event.code}</span>
                    <span>{event.message}{event.details ? ` · ${event.details}` : ''}</span>
                    <span className="muted">{event.module}</span>
                  </div>
                ))}
                {!events.length && <div className="empty-state" style={{ minHeight: 120 }}>Nenhum log registrado.</div>}
              </div>
              <div className="tech-code" style={{ marginTop: 12 }}>ÚLTIMO EVENTO: {events.length ? formatClock(events[events.length - 1].ts) : '—'}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
