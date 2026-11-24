import { useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { BrandMark } from '@/components/ui/BrandMark';
import { Icon } from '@/components/ui/Icon';

interface WelcomeScreenProps {
  onEnter: () => void;
}

export function WelcomeScreen({ onEnter }: WelcomeScreenProps): JSX.Element {
  const updatePreferences = useTokiStore((s) => s.updatePreferences);
  const [leaving, setLeaving] = useState(false);

  const enter = (): void => {
    updatePreferences({ showWelcome: false });
    setLeaving(true);
    window.setTimeout(onEnter, 400);
  };

  return (
    <div className={`welcome-screen${leaving ? ' leaving' : ''}`}>
      <div className="welcome-card">
        <BrandMark className="boot-logo" style={{ width: 64, height: 64 }} />
        <div className="eyebrow">PRIMEIRO ACESSO · SISTEMA LOCAL</div>
        <h1 className="welcome-title">TOKI</h1>
        <p className="welcome-text">
          Sistema operacional industrial para controle, monitoramento e organização de um pen plotter.
          A interface foi projetada para operação precisa, com dados claros e limites operacionais explícitos.
        </p>
        <div className="welcome-grid">
          <div className="welcome-feature">
            <strong>DEMO EXPLÍCITO</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              O sistema inicia sem máquina conectada. Nenhuma telemetria é inventada.
            </div>
          </div>
          <div className="welcome-feature">
            <strong>MARLIN / WEBSERIAL</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Camada de comunicação isolada e pronta para firmware compatível.
            </div>
          </div>
          <div className="welcome-feature">
            <strong>OPERAÇÃO SEGURA</strong>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Comandos validados, limites físicos e confirmações para ações críticas.
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={enter}>
          ENTRAR NO SISTEMA <Icon name="chevron" size={14} />
        </button>
      </div>
    </div>
  );
}
