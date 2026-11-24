import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

interface State {
  error: Error | null;
  detailsOpen: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, detailsOpen: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, detailsOpen: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('TOKI runtime error', error, info);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const error = this.state.error;
    return (
      <div className="boot-screen">
        <div className="panel" style={{ width: 'min(520px, calc(100vw - 40px))', padding: 28 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="operating-icon" style={{ color: 'var(--accent)' }}><Icon name="alert" size={22} /></div>
            <div>
              <div className="eyebrow accent">FALHA DE INTERFACE · TOKI_SYS_ERR</div>
              <div className="modal-title">O módulo não pôde ser exibido</div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 18 }}>
            A operação foi interrompida para proteger o estado do sistema. Nenhum comando foi enviado à máquina por esta tela.
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.7 }}>{error.message || 'Erro não identificado.'}</p>
          <button type="button" className="btn btn-ghost" onClick={() => this.setState({ detailsOpen: !this.state.detailsOpen })}>
            DETALHES TÉCNICOS
          </button>
          {this.state.detailsOpen && (
            <pre className="mono" style={{ fontSize: 10, whiteSpace: 'pre-wrap', background: 'var(--panel-2)', padding: 12, marginTop: 10 }}>
              {error.stack ?? String(error)}
            </pre>
          )}
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={() => this.setState({ error: null })}>
            TENTAR NOVAMENTE
          </button>
        </div>
      </div>
    );
  }
}
