import { useEffect, useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { RigModeSelector } from '@/components/rig/RigModeSelector';
import { RigPanel } from '@/components/rig/RigPanel';
import { MachineInspector } from '@/components/viz/MachineInspector';
import { Icon } from '@/components/ui/Icon';
import { allowedCommandsFor, commandDescriptions, validateCommand } from '@/hardware/commands';
import { round } from '@/lib/utils';
import { dataOriginLabel } from '@/store/useTokiStore';
import { rigModeLabel } from '@/types';

const steps = [0.1, 1, 5, 10, 25, 50];

export function MachineControl(): JSX.Element {
  const telemetry = useTokiStore((s) => s.telemetry);
  const connection = useTokiStore((s) => s.connection);
  const operating = useTokiStore((s) => s.operatingState);
  const doc = useTokiStore((s) => s.studioDoc);
  const rig = useTokiStore((s) => s.rig);
  const spindleCommand = useTokiStore((s) => s.spindleCommand);
  const thermalTarget = useTokiStore((s) => s.thermalTarget);
  const extruderE = useTokiStore((s) => s.extruderE);
  const jog = useTokiStore((s) => s.jog);
  const moveTool = useTokiStore((s) => s.moveTool);
  const setPen = useTokiStore((s) => s.setPen);
  const home = useTokiStore((s) => s.home);
  const toggleMotors = useTokiStore((s) => s.toggleMotors);
  const queryPosition = useTokiStore((s) => s.queryPosition);
  const queryFirmware = useTokiStore((s) => s.queryFirmware);
  const queryTemperatures = useTokiStore((s) => s.queryTemperatures);
  const setThermalTarget = useTokiStore((s) => s.setThermalTarget);
  const cooldown = useTokiStore((s) => s.cooldown);
  const extrude = useTokiStore((s) => s.extrude);
  const setSpindle = useTokiStore((s) => s.setSpindle);
  const stopSpindle = useTokiStore((s) => s.stopSpindle);
  const quickStop = useTokiStore((s) => s.quickStop);
  const emergencyStop = useTokiStore((s) => s.emergencyStop);
  const sendCommand = useTokiStore((s) => s.sendCommand);
  const requestConfirmation = useTokiStore((s) => s.requestConfirmation);
  const setConnectionDrawerOpen = useTokiStore((s) => s.setConnectionDrawerOpen);
  const setActiveModule = useTokiStore((s) => s.setActiveModule);

  const [step, setStep] = useState(5);
  const [command, setCommand] = useState('');
  const [nozzleTarget, setNozzleTarget] = useState(rig.profiles.printer3d.tool.nozzleTarget);
  const [bedTarget, setBedTarget] = useState(rig.profiles.printer3d.tool.bedTarget);
  const [extrudeMm, setExtrudeMm] = useState(10);
  const [rpm, setRpm] = useState(rig.profiles.cnc.tool.rpmDefault);
  const [direction, setDirection] = useState<'CW' | 'CCW'>('CW');

  useEffect(() => {
    setNozzleTarget(rig.profiles.printer3d.tool.nozzleTarget);
    setBedTarget(rig.profiles.printer3d.tool.bedTarget);
    setRpm(rig.profiles.cnc.tool.rpmDefault);
  }, [rig.profiles.printer3d.tool.nozzleTarget, rig.profiles.printer3d.tool.bedTarget, rig.profiles.cnc.tool.rpmDefault]);

  const enabled = connection.state === 'connected';
  const demo = connection.mode === 'demo';
  const profile = rig.profiles[rig.mode];
  const tool = profile.tool;
  const ack = rig.acknowledged;
  const position = telemetry.position;
  const temps = telemetry.temperatures;
  const validation = validateCommand(command || 'G28', {
    doc,
    connected: enabled,
    mode: connection.mode,
    rig,
    nozzleTemp: temps?.hotend ?? null,
  });
  const origin = dataOriginLabel(telemetry.origin);
  const zMin = rig.mode === 'printer3d' ? 0 : round(Math.min(tool.safeZ, tool.workZ) - 2, 1);
  const zMax = rig.mode === 'printer3d' ? profile.bed.maxZ : round(Math.max(tool.safeZ, tool.workZ) + 5, 1);

  const confirmAction = (
    title: string,
    description: string,
    label: string,
    action: () => void | Promise<void>,
    tone: 'default' | 'danger' = 'danger',
  ): void => {
    requestConfirmation({ title, description, confirmLabel: label, tone, onConfirm: action });
  };

  const renderToolPanel = (): JSX.Element => {
    if (rig.mode === 'printer3d') {
      return (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">HOTEND / MESA</span><span className="tech-code">M104 / M140</span></div>
          <div className="panel-body col" style={{ gap: 10 }}>
            <div className="rig-readout-grid">
              <div><div className="stat-label">BICO · M105</div><div className="stat-value small">{temps?.hotend === null || temps?.hotend === undefined ? '—' : `${round(temps.hotend, 1)} °C`}</div></div>
              <div><div className="stat-label">MESA · M105</div><div className="stat-value small">{temps?.bed === null || temps?.bed === undefined ? '—' : `${round(temps.bed, 1)} °C`}</div></div>
            </div>
            <div className="tech-code">ORIGEM: {origin} · {demo ? 'LEITURA VIRTUAL' : temps ? 'LEITURA M105' : 'SEM LEITURA'}</div>
            <div className="field-row">
              <label className="label">
                ALVO BICO
                <input className="input" type="number" min={0} max={tool.nozzleTempMax} value={nozzleTarget} onChange={(event) => setNozzleTarget(Number(event.target.value))} />
              </label>
              <label className="label">
                ALVO MESA
                <input className="input" type="number" min={0} max={tool.bedTempMax} value={bedTarget} onChange={(event) => setBedTarget(Number(event.target.value))} />
              </label>
            </div>
            <div className="field-row">
              <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => void setThermalTarget('nozzle', nozzleTarget)}>
                BICO {nozzleTarget} °C
              </button>
              <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => void setThermalTarget('bed', bedTarget)}>
                MESA {bedTarget} °C
              </button>
            </div>
            <div className="field-row">
              <button type="button" className="btn btn-sm" disabled={!enabled} onClick={() => void queryTemperatures()}>
                <Icon name="thermal" size={13} /> CONSULTAR M105
              </button>
              <button type="button" className="btn btn-sm" disabled={!enabled} onClick={() => void cooldown()}>RESFRIAR</button>
            </div>
            <div className="divider" />
            <div className="row-between"><span className="muted">Alvo ativo</span><span className="mono">{thermalTarget.nozzle ?? '—'} / {thermalTarget.bed ?? '—'} °C</span></div>
            <div className="field-row">
              <label className="label">
                EXTRUSÃO (MM)
                <input className="input" type="number" min={0.1} max={100} step={0.1} value={extrudeMm} onChange={(event) => setExtrudeMm(Number(event.target.value))} />
              </label>
              <button
                type="button"
                className="btn btn-block"
                disabled={!enabled}
                onClick={() => confirmAction(
                  'Extrudar material',
                  'O bico precisa estar quente e o sensor confirme a leitura. A extrusão é enviada como movimento E absoluto; retire a peça antes de continuar.',
                  'EXTRUDAR',
                  () => extrude(extrudeMm),
                )}
              >
                EXTRUDAR · E{extruderE.toFixed(1)}
              </button>
            </div>
            {!ack.thermalRunaway && (
              <div className="accent" style={{ fontSize: 10, lineHeight: 1.5 }}>
                Thermal runaway não confirmado. Aquecimentos acima de 60 °C e extrusão real estão bloqueados.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (rig.mode === 'cnc') {
      const ready = tool.spindleEnabled && ack.spindleFirmware && ack.enclosure && ack.workholding;
      return (
        <div className="panel panel-accent">
          <div className="panel-head"><span className="panel-title">FUSO / SPINDLE</span><span className="tech-code">M3 / M4 / M5</span></div>
          <div className="panel-body col" style={{ gap: 10 }}>
            <div className="rig-readout-grid">
              <div><div className="stat-label">ESTADO COMANDADO</div><div className="stat-value small">{spindleCommand.active ? 'ATIVO' : 'PARADO'}</div></div>
              <div><div className="stat-label">ROTAÇÃO COMANDADA</div><div className="stat-value small">{spindleCommand.active ? `${spindleCommand.direction} ${spindleCommand.rpm}` : '—'}</div></div>
            </div>
            <div className="tech-code">ORIGEM DO COMANDO: {dataOriginLabel(spindleCommand.origin)} · SEM MEDIÇÃO DE RPM</div>
            <label className="label">
              ROTAÇÃO (RPM)
              <input className="input" type="number" min={tool.rpmMin} max={tool.rpmMax} step={100} value={rpm} onChange={(event) => setRpm(Number(event.target.value))} />
            </label>
            <div className="segmented" role="group" aria-label="Sentido de rotação">
              <button type="button" className={direction === 'CW' ? 'active' : ''} onClick={() => setDirection('CW')}>M3 · CW</button>
              <button type="button" className={direction === 'CCW' ? 'active' : ''} onClick={() => setDirection('CCW')}>M4 · CCW</button>
            </div>
            <div className="field-row">
              <button
                type="button"
                className="btn btn-danger btn-block"
                disabled={!enabled || !ready}
                onClick={() => confirmAction(
                  'Acionar fuso',
                  `O comando ${direction === 'CW' ? 'M3' : 'M4'} S${rpm} girará a ferramenta. Confirme envelope fechado, peça fixada e firmware com suporte a spindle. O TOKI não mede rotação real.`,
                  'ACIONAR',
                  () => setSpindle(rpm, direction),
                )}
              >
                <Icon name="power" size={13} /> ACIONAR
              </button>
              <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => void stopSpindle()}>M5 · PARAR</button>
            </div>
            {!ready && (
              <div className="accent" style={{ fontSize: 10, lineHeight: 1.5 }}>
                {!tool.spindleEnabled && 'Fuso desabilitado no perfil. '}
                {!ack.spindleFirmware && 'Firmware não confirmado. '}
                {!ack.enclosure && 'Envelope não confirmado. '}
                {!ack.workholding && 'Fixação não confirmada.'}
              </div>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setActiveModule('system')}>
              ABRIR CHECKLIST COMPLETO
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="panel">
        <div className="panel-head"><span className="panel-title">CANETA E MOTORES</span><span className="tech-code">PEN / STEP</span></div>
        <div className="panel-body col" style={{ gap: 8 }}>
          <div className="field-row">
            <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => void setPen(false)}>PEN UP · Z{tool.safeZ}</button>
            <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => void setPen(true)}>PEN DOWN · Z{tool.workZ}</button>
          </div>
          <div className="field-row">
            <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => void toggleMotors(true)}>M17 · MOTORES ON</button>
            <button type="button" className="btn btn-block" disabled={!enabled} onClick={() => confirmAction('Desabilitar motores', 'O comando M18 libera os eixos. A máquina pode ser movida manualmente.', 'DESABILITAR', () => toggleMotors(false))}>M18 · OFF</button>
          </div>
          <div className="row-between">
            <span className="muted">Estado dos motores</span>
            <span className="mono">{telemetry.motorsEnabled === null ? '—' : telemetry.motorsEnabled ? 'HABILITADOS' : 'DESABILITADOS'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="module-shell">
      <div className="module-header">
        <div>
          <div className="eyebrow">MÓDULO 03 · CONTROLE DA MÁQUINA</div>
          <h1 className="module-title">MACHINE CONTROL</h1>
          <div className="module-subtitle">CONFIGURAÇÃO DA RIG / MOVIMENTAÇÃO / FERRAMENTA / COMANDOS MARLIN</div>
        </div>
        <div className="row">
          <span className={`badge ${demo ? 'demo' : 'real'}`}>{demo ? 'DEMO · SEM HARDWARE' : 'MARLIN / SERIAL'}</span>
          <button type="button" className="btn" onClick={() => setConnectionDrawerOpen(true)}>
            <Icon name="plug" size={14} /> {enabled ? 'CONECTADO' : 'CONECTAR'}
          </button>
        </div>
      </div>

      <div className="panel rig-strip" style={{ marginBottom: 'var(--gap)' }}>
        <div className="panel-body tight rig-strip-body">
          <div>
            <div className="eyebrow">CONFIGURAÇÃO ATIVA</div>
            <strong className="rig-strip-title">{rigModeLabel[rig.mode]}</strong>
            <div className="tech-code">{tool.label}</div>
          </div>
          <RigModeSelector compact />
          <div className="rig-strip-meta">
            <span>LEITO {profile.bed.width} × {profile.bed.height} × {profile.bed.maxZ} MM</span>
            <span>Z SEGURO {tool.safeZ} MM · Z TRABALHO {tool.workZ} MM</span>
          </div>
        </div>
      </div>

      {!enabled && (
        <div className="panel panel-accent" style={{ marginBottom: 'var(--gap)' }}>
          <div className="panel-body tight">
            <strong>Controle indisponível.</strong> É necessária uma conexão ativa para enviar comandos. O modo demo pode ser ativado no painel de conexão para explorar a interface sem acionar hardware.
          </div>
        </div>
      )}

      <div className="control-grid">
        <div className="panel control-stage">
          <div className="panel-head">
            <span className="panel-title">VISUALIZAÇÃO 3D · POSIÇÃO CONFIRMADA</span>
            <span className="tech-code">{operating.toUpperCase()}</span>
          </div>
          <div className="stage-frame">
            <span className="stage-corner tl" /><span className="stage-corner tr" />
            <span className="stage-corner bl" /><span className="stage-corner br" />
            <MachineInspector
              position={position}
              doc={doc}
              bed={profile.bed}
              mode={rig.mode}
              tool={tool}
              toolActive={rig.mode === 'cnc' ? spindleCommand.active : rig.mode === 'printer3d' ? (thermalTarget.nozzle ?? 0) > 0 : false}
              showLabels
            />
            <div className="stage-badge">{rigModeLabel[rig.mode]} · {origin}</div>
            <div className="stage-meta">
              <span>X {position ? position.x.toFixed(2) : '—'} MM</span>
              <span>Y {position ? position.y.toFixed(2) : '—'} MM</span>
              <span>Z {position ? position.z.toFixed(2) : '—'} MM</span>
            </div>
          </div>
        </div>

        <div className="control-side">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">MOVIMENTAÇÃO MANUAL</span><span className="tech-code">X / Y / Z</span></div>
            <div className="panel-body col" style={{ alignItems: 'center' }}>
              <div className="segmented" role="group" aria-label="Passo de movimento">
                {steps.map((value) => (
                  <button key={value} type="button" className={step === value ? 'active' : ''} onClick={() => setStep(value)}>{value}</button>
                ))}
              </div>
              <div className="jog-pad" style={{ marginTop: 14 }}>
                <span />
                <button type="button" className="btn" disabled={!enabled} onClick={() => void jog('Y', step)}>Y+</button>
                <span />
                <button type="button" className="btn" disabled={!enabled} onClick={() => void jog('X', -step)}>X−</button>
                <button type="button" className="btn btn-primary" disabled={!enabled} onClick={() => confirmAction('Referenciar máquina', 'O comando G28 move os eixos até os fins de curso. Certifique-se de que a área está livre.', 'HOME', () => home())}>HOME</button>
                <button type="button" className="btn" disabled={!enabled} onClick={() => void jog('X', step)}>X+</button>
                <span />
                <button type="button" className="btn" disabled={!enabled} onClick={() => void jog('Y', -step)}>Y−</button>
                <span />
              </div>
              <div className="divider" />
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn" disabled={!enabled} onClick={() => void jog('Z', -1)}>Z− 1MM</button>
                <button type="button" className="btn" disabled={!enabled} onClick={() => void jog('Z', 1)}>Z+ 1MM</button>
              </div>
              <div className="field-row" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-sm btn-block" disabled={!enabled} onClick={() => void moveTool('safe')}>ESTACIONAR · Z{tool.safeZ}</button>
                <button type="button" className="btn btn-sm btn-block" disabled={!enabled} onClick={() => void moveTool('work')}>POSIÇÃO TRABALHO · Z{tool.workZ}</button>
              </div>
            </div>
          </div>

          {renderToolPanel()}

          <RigPanel />

          <div className="panel panel-accent">
            <div className="panel-head"><span className="panel-title">INTERRUPÇÃO</span><span className="tech-code">SAFETY</span></div>
            <div className="panel-body col" style={{ gap: 8 }}>
              <button type="button" className="btn btn-danger btn-block" disabled={!enabled} onClick={() => void quickStop()}>
                <Icon name="stop" size={14} /> PARADA RÁPIDA · M410
              </button>
              <button
                type="button"
                className="btn btn-danger btn-block"
                disabled={!enabled}
                onClick={() => confirmAction(
                  'Parada de emergência',
                  'M112 reinicia a controladora e interrompe qualquer execução. Esta interface não substitui o circuito físico de emergência.',
                  'EMERGÊNCIA',
                  () => emergencyStop(),
                )}
              >
                <Icon name="alert" size={14} /> EMERGÊNCIA · M112
              </button>
            </div>
          </div>
        </div>

        <div className="control-bottom">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">POSIÇÃO E CONSULTAS</span><span className="tech-code">M114 / M115</span></div>
            <div className="panel-body tight">
              <div className="axis-readout">
                <div><div className="stat-label">X</div><div className="stat-value small">{position ? position.x.toFixed(2) : '—'}</div></div>
                <div><div className="stat-label">Y</div><div className="stat-value small">{position ? position.y.toFixed(2) : '—'}</div></div>
                <div><div className="stat-label">Z</div><div className="stat-value small">{position ? position.z.toFixed(2) : '—'}</div></div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-sm" disabled={!enabled} onClick={() => void queryPosition()}>CONSULTAR POSIÇÃO</button>
                <button type="button" className="btn btn-sm" disabled={!enabled} onClick={() => void queryFirmware()}>FIRMWARE</button>
              </div>
              <div className="tech-code" style={{ marginTop: 10 }}>{telemetry.firmware ?? 'FIRMWARE NÃO IDENTIFICADO'}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title">LIMITES FÍSICOS</span><span className="tech-code">{rigModeLabel[rig.mode]}</span></div>
            <div className="panel-body tight">
              <div className="row-between"><span className="muted">Leito X</span><span className="mono">0 – {profile.bed.width} mm</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Leito Y</span><span className="mono">0 – {profile.bed.height} mm</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Faixa Z segura</span><span className="mono">{zMin} – {zMax} mm</span></div>
              <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Feed / travel</span><span className="mono">{profile.feedRateMax} / {profile.travelRateMax}</span></div>
              <div className="tech-code" style={{ marginTop: 10 }}>COMANDOS SÃO VALIDADOS ANTES DO ENVIO</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title">COMANDO DIRETO</span><span className="tech-code">ALLOWLIST</span></div>
            <div className="panel-body tight col" style={{ gap: 8 }}>
              <div className="command-line">
                <input
                  className="input"
                  value={command}
                  onChange={(event) => setCommand(event.target.value.toUpperCase())}
                  placeholder="EX: G0 X100 Y100"
                  aria-label="Comando Marlin"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!command.trim()}
                  onClick={async () => {
                    const result = await sendCommand(command);
                    if (result.ok) setCommand('');
                  }}
                >
                  ENVIAR
                </button>
              </div>
              <div className={validation.ok ? 'muted' : 'accent'} style={{ fontSize: 10 }}>
                {validation.ok ? `VÁLIDO · ${commandDescriptions[validation.command.split(' ')[0]] ?? 'COMANDO SEGURO'}` : validation.reason}
              </div>
              <div className="tech-code">PERMITIDOS: {allowedCommandsFor(rig).join(' · ')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
