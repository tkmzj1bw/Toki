import { useEffect, useState } from 'react';
import { useTokiStore } from '@/store/useTokiStore';
import { Icon } from '@/components/ui/Icon';

export function ConfirmDialog(): JSX.Element | null {
  const confirmation = useTokiStore((s) => s.confirmation);
  const close = useTokiStore((s) => s.closeConfirmation);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirmation) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmation, close]);

  if (!confirmation) return null;

  const confirm = async (): Promise<void> => {
    setBusy(true);
    try {
      await confirmation.onConfirm();
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="modal-head row" style={{ alignItems: 'flex-start' }}>
          <div className="operating-icon" style={{ color: confirmation.tone === 'danger' ? 'var(--accent)' : 'var(--ink)' }}>
            <Icon name={confirmation.tone === 'danger' ? 'alert' : 'check'} size={20} />
          </div>
          <div>
            <div className="eyebrow">CONFIRMAÇÃO OPERACIONAL</div>
            <div className="modal-title" id="confirm-title">{confirmation.title}</div>
          </div>
        </div>
        <div className="modal-body">
          {confirmation.description}
          {confirmation.detail && (
            <div className="tech" style={{ marginTop: 12, padding: 10, border: '1px solid var(--line)' }}>
              {confirmation.detail}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={close} disabled={busy}>
            {confirmation.cancelLabel ?? 'CANCELAR'}
          </button>
          <button
            type="button"
            className={`btn ${confirmation.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? 'PROCESSANDO…' : confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
