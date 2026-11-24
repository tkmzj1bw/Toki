import { useState } from 'react';
import { dataOriginLabel, useTokiStore } from '@/store/useTokiStore';
import { RigModeSelector } from './RigModeSelector';
import { Icon } from '@/components/ui/Icon';
import { clamp, round } from '@/lib/utils';
import { rigModeLabel } from '@/types';
import type { RigMode, SafetyAckKey } from '@/types';

interface AckDefinition {
  key: SafetyAckKey;
  label: string;
  description: string;
  modes: RigMode[];
}

const ackDefinitions: AckDefinition[] = [
  {
    key: 'thermalRunaway',
    label: 'PROTEÇÃO THERMAL RUNAWAY',
    description: 'Firmware configurado e sensor presente. Sem isso, aquecimentos acima de 60 °C são bloqueados.',
    modes: ['printer3d'],
  },
  {
    key: 'spindleFirmware',
    label: 'SUPORTE M3/M4/M5 NO FIRMWARE',
    description: 'Marlin comum não aciona fuso. Confirme que a controladora foi compilada com spindle control.',
    modes: ['cnc'],
  },
  {
    key: 'enclosure',
    label: 'ENVELOPE FECHADO',
    description: 'Confirme proteção física contra respingos e peças projetadas antes de girar a ferramenta.',
    modes: ['cnc'],
  },
  {
    key: 'workholding',
    label: 'PEÇA FIXADA',
    description: 'Confirme fixação mecânica da peça. Nunca segure a peça com as mãos durante o corte.',
    modes: ['cnc'],
  },
];

const profileModes: RigMode[] = ['plotter', 'printer3d', 'cnc'];

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

const NumberField = ({ label, value, min, max, step = 1, unit, onChange }: NumberFieldProps): JSX.Element => (
  <label className="label">
    {label}
    <span className="rig-number-field">
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
      {unit && <span className="tech-code">{unit}</span>}
    </span>
  </label>
);

interface RigPanelProps {
  full?: boolean;
}

export function RigPanel({ full = false }: RigPanelProps): JSX.Element {
  const rig = useTokiStore((s) => s.rig);
  const telemetry = useTokiStore((s) => s.telemetry);
  const spindleCommand = useTokiStore((s) => s.spindleCommand);
  const thermalTarget = useTokiStore((s) => s.thermalTarget);
  const updateRigProfile = useTokiStore((s) => s.updateRigProfile);
  const updateRigTool = useTokiStore((s) => s.updateRigTool);
  const setSafetyAck = useTokiStore((s) => s.setSafetyAck);
  const resetRig = useTokiStore((s) => s.resetRig);
  const requestConfirmation = useTokiStore((s) => s.requestConfirmation);

  const [editMode, setEditMode] = useState<RigMode>(rig.mode);
  const activeProfile = rig.profiles[editMode];
  const currentProfile = rig.profiles[rig.mode];
  const relevantAcks = ackDefinitions.filter((ack) => ack.modes.includes(rig.mode));
  const tempOrigin = dataOriginLabel(telemetry.origin);
  const hotend = telemetry.temperatures?.hotend ?? null;
  const bed = telemetry.temperatures?.bed ?? null;

  const restore = (): void => {
    requestConfirmation({
      title: 'Restaurar perfis da rig',
      description: 'Todos os perfis e confirmações de segurança voltam aos valores de fábrica. A ferramenta ativa não será alterada fisicamente.',
      confirmLabel: 'RESTAURAR',
      tone: 'danger',
      onConfirm: () => {
        resetRig();
        setEditMode(rig.mode);
      },
    });
  };

  return (
    <div className="rig-panel">
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">CONFIGURAÇÃO ATIVA</span>
          <span className={`badge ${rig.mode === 'cnc' ? 'demo' : rig.mode === 'printer3d' ? 'real' : ''}`}>
            {rigModeLabel[rig.mode]}
          </span>
        </div>
        <div className="panel-body tight col" style={{ gap: 10 }}>
          <RigModeSelector />
          <div className="row-between"><span className="muted">Ferramenta</span><strong className="mono">{currentProfile.tool.label}</strong></div>
          <div className="row-between"><span className="muted">Envelope</span><span className="mono">{currentProfile.bed.width} × {currentProfile.bed.height} × {currentProfile.bed.maxZ} mm</span></div>
          <div className="row-between"><span className="muted">Z seguro / trabalho</span><span className="mono">{currentProfile.tool.safeZ} / {currentProfile.tool.workZ} mm</span></div>
          <div className="row-between">
            <span className="muted">Velocidades máx.</span>
            <span className="mono">{currentProfile.travelRateMax} / {currentProfile.feedRateMax} mm/min</span>
          </div>
          {rig.lastModeSwitchAt && (
            <div className="tech-code">ÚLTIMA TROCA · {new Date(rig.lastModeSwitchAt).toLocaleTimeString('pt-BR')}</div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">CHECKLIST DE SEGURANÇA</span>
          <span className="tech-code">CONFIRMAÇÃO OPERADOR</span>
        </div>
        <div className="panel-body tight">
          {relevantAcks.map((ack) => (
            <label key={ack.key} className="rig-ack-row">
              <span className="rig-ack-copy">
                <strong>{ack.label}</strong>
                <span className="muted">{ack.description}</span>
              </span>
              <button
                type="button"
                className={`toggle${rig.acknowledged[ack.key] ? ' on' : ''}`}
                onClick={() => setSafetyAck(ack.key, !rig.acknowledged[ack.key])}
                aria-pressed={rig.acknowledged[ack.key]}
                aria-label={ack.label}
              />
            </label>
          ))}
          {!relevantAcks.length && (
            <div className="muted" style={{ fontSize: 11 }}>
              O modo plotter não exige confirmações adicionais. Nenhum comando térmico ou de fuso é permitido.
            </div>
          )}
          <div className="tech-code" style={{ marginTop: 10 }}>
            AS CONFIRMAÇÕES SÃO LOCAIS E NÃO SUBSTITUEM PROTEÇÃO FÍSICA.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">ESTADO PRESENTE</span>
          <span className="tech-code">{tempOrigin}</span>
        </div>
        <div className="panel-body tight">
          <div className="row-between"><span className="muted">Bico · M105</span><span className="mono">{hotend === null ? '—' : `${round(hotend, 1)} °C · ${tempOrigin}`}</span></div>
          <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Mesa · M105</span><span className="mono">{bed === null ? '—' : `${round(bed, 1)} °C · ${tempOrigin}`}</span></div>
          <div className="row-between" style={{ marginTop: 8 }}><span className="muted">Alvo bico / mesa</span><span className="mono">{thermalTarget.nozzle ?? '—'} / {thermalTarget.bed ?? '—'} °C</span></div>
          <div className="row-between" style={{ marginTop: 8 }}>
            <span className="muted">Fuso · estado comandado</span>
            <span className="mono">
              {spindleCommand.active
                ? `${spindleCommand.direction} ${spindleCommand.rpm} RPM · ${dataOriginLabel(spindleCommand.origin)}`
                : `PARADO · ${dataOriginLabel(spindleCommand.origin)}`}
            </span>
          </div>
          {telemetry.spindle && (
            <div className="tech-code" style={{ marginTop: 8 }}>
              ECO DO ADAPTER: {dataOriginLabel(telemetry.origin)} · {telemetry.spindle.active ? 'ATIVO' : 'PARADO'}
            </div>
          )}
        </div>
      </div>

      {full && (
        <>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">PERFIS DA RIG</span>
              <span className="tech-code">Edição local</span>
            </div>
            <div className="panel-body tight col" style={{ gap: 12 }}>
              <div className="row-between">
                <span className="muted">Editando perfil</span>
                <div className="segmented">
                  {profileModes.map((mode) => (
                    <button key={mode} type="button" className={editMode === mode ? 'active' : ''} onClick={() => setEditMode(mode)}>
                      {rigModeLabel[mode]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rig-field-grid">
                <NumberField
                  label="LEITO X"
                  value={activeProfile.bed.width}
                  min={50}
                  max={600}
                  unit="mm"
                  onChange={(width) => updateRigProfile(editMode, { bed: { ...activeProfile.bed, width } })}
                />
                <NumberField
                  label="LEITO Y"
                  value={activeProfile.bed.height}
                  min={50}
                  max={600}
                  unit="mm"
                  onChange={(height) => updateRigProfile(editMode, { bed: { ...activeProfile.bed, height } })}
                />
                <NumberField
                  label="ALTURA MÁX. Z"
                  value={activeProfile.bed.maxZ}
                  min={5}
                  max={500}
                  unit="mm"
                  onChange={(maxZ) => updateRigProfile(editMode, { bed: { ...activeProfile.bed, maxZ } })}
                />
                <NumberField
                  label="TRAVEL MÁX."
                  value={activeProfile.travelRateMax}
                  min={100}
                  max={30000}
                  step={100}
                  unit="mm/min"
                  onChange={(travelRateMax) => updateRigProfile(editMode, { travelRateMax })}
                />
                <NumberField
                  label="WORK MÁX."
                  value={activeProfile.feedRateMax}
                  min={60}
                  max={30000}
                  step={60}
                  unit="mm/min"
                  onChange={(feedRateMax) => updateRigProfile(editMode, { feedRateMax })}
                />
                <NumberField
                  label="Z SEGURO"
                  value={activeProfile.tool.safeZ}
                  min={0}
                  max={activeProfile.bed.maxZ}
                  step={0.5}
                  unit="mm"
                  onChange={(safeZ) => updateRigTool(editMode, { safeZ })}
                />
                <NumberField
                  label="Z TRABALHO"
                  value={activeProfile.tool.workZ}
                  min={-5}
                  max={activeProfile.bed.maxZ}
                  step={0.1}
                  unit="mm"
                  onChange={(workZ) => updateRigTool(editMode, { workZ })}
                />
              </div>
              <label className="label">
                IDENTIFICAÇÃO DA FERRAMENTA
                <input
                  className="input"
                  value={activeProfile.tool.label}
                  onChange={(event) => updateRigTool(editMode, { label: event.target.value.slice(0, 48) })}
                />
              </label>
            </div>
          </div>

          {editMode === 'cnc' && (
            <div className="panel panel-accent">
              <div className="panel-head"><span className="panel-title">PARÂMETROS DO FUSO</span><span className="tech-code">M3 / M4 / M5</span></div>
              <div className="panel-body tight col" style={{ gap: 10 }}>
                <div className="rig-field-grid">
                  <NumberField label="RPM MÍN." value={activeProfile.tool.rpmMin} min={0} max={60000} step={100} unit="rpm" onChange={(rpmMin) => updateRigTool('cnc', { rpmMin })} />
                  <NumberField label="RPM MÁX." value={activeProfile.tool.rpmMax} min={100} max={60000} step={100} unit="rpm" onChange={(rpmMax) => updateRigTool('cnc', { rpmMax })} />
                  <NumberField label="RPM PADRÃO" value={activeProfile.tool.rpmDefault} min={0} max={60000} step={100} unit="rpm" onChange={(rpmDefault) => updateRigTool('cnc', { rpmDefault })} />
                </div>
                <label className="rig-ack-row">
                  <span className="rig-ack-copy">
                    <strong>HABILITAR COMANDOS DE FUSO</strong>
                    <span className="muted">Libera M3/M4 no perfil CNC. Ainda exige as três confirmações físicas acima.</span>
                  </span>
                  <button
                    type="button"
                    className={`toggle${activeProfile.tool.spindleEnabled ? ' on' : ''}`}
                    onClick={() => updateRigTool('cnc', { spindleEnabled: !activeProfile.tool.spindleEnabled })}
                    aria-pressed={activeProfile.tool.spindleEnabled}
                    aria-label="Habilitar comandos de fuso"
                  />
                </label>
              </div>
            </div>
          )}

          {editMode === 'printer3d' && (
            <div className="panel panel-accent">
              <div className="panel-head"><span className="panel-title">LIMITES TÉRMICOS</span><span className="tech-code">M104 / M140</span></div>
              <div className="panel-body tight rig-field-grid">
                <NumberField label="BICO MÁX." value={activeProfile.tool.nozzleTempMax} min={0} max={400} unit="°C" onChange={(nozzleTempMax) => updateRigTool('printer3d', { nozzleTempMax })} />
                <NumberField label="MESA MÁX." value={activeProfile.tool.bedTempMax} min={0} max={200} unit="°C" onChange={(bedTempMax) => updateRigTool('printer3d', { bedTempMax })} />
                <NumberField label="ALVO BICO" value={activeProfile.tool.nozzleTarget} min={0} max={activeProfile.tool.nozzleTempMax} unit="°C" onChange={(nozzleTarget) => updateRigTool('printer3d', { nozzleTarget })} />
                <NumberField label="ALVO MESA" value={activeProfile.tool.bedTarget} min={0} max={activeProfile.tool.bedTempMax} unit="°C" onChange={(bedTarget) => updateRigTool('printer3d', { bedTarget })} />
              </div>
            </div>
          )}

          <div className="row">
            <button type="button" className="btn btn-danger" onClick={restore}>
              <Icon name="refresh" size={14} /> RESTAURAR PERFIS
            </button>
          </div>
        </>
      )}
    </div>
  );
}
