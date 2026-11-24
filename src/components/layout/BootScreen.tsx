import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/ui/BrandMark';

const steps = [
  'INICIALIZANDO NÚCLEO TOKI',
  'CARREGANDO DESIGN SYSTEM',
  'VERIFICANDO ESTADO DA MÁQUINA',
  'PREPARANDO MÓDULOS OPERACIONAIS',
  'SISTEMA PRONTO',
];

interface BootScreenProps {
  onDone: () => void;
}

export function BootScreen({ onDone }: BootScreenProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 1700;
    let frame = 0;
    const tick = (now: number): void => {
      const value = Math.min(100, ((now - start) / duration) * 100);
      setProgress(value);
      if (value < 100) {
        frame = requestAnimationFrame(tick);
      } else {
        setLeaving(true);
        window.setTimeout(onDone, 420);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  const stepIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));

  return (
    <div className={`boot-screen${leaving ? ' leaving' : ''}`} role="status" aria-label="Inicializando TOKI">
      <div style={{ textAlign: 'center' }}>
        <BrandMark className="boot-logo" />
        <div className="boot-title">TOKI</div>
        <div className="boot-sub">INDUSTRIAL OPERATING SYSTEM</div>
      </div>
      <div className="col" style={{ alignItems: 'center', gap: 12 }}>
        <div className="boot-bar"><span style={{ width: `${progress}%` }} /></div>
        <div className="boot-message">{steps[stepIndex]} · {Math.round(progress)}%</div>
        <div className="tech-code">NENHUMA COMUNICAÇÃO COM HARDWARE ESTABELECIDA NESTA FASE</div>
      </div>
    </div>
  );
}
