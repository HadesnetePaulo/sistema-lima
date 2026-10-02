import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Sparkles, Database } from 'lucide-react';
import { storage } from '../lib/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocal = () => {
    try {
      storage.resetToDefaults();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1C1917] text-stone-100 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-amber-400" />
            </div>

            <div>
              <h1 className="font-serif text-2xl font-bold text-amber-200">
                Lima Semijoias
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Ocorreu uma pequena instabilidade temporária na exibição.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-stone-950/80 p-3 rounded-xl border border-stone-800 text-left text-xs font-mono text-rose-300 max-h-32 overflow-y-auto">
                <p className="font-semibold text-rose-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Detalhes técnicos:
                </p>
                <p className="text-[11px] leading-relaxed break-words">
                  {this.state.error.message || 'Erro desconhecido de renderização'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar Sistema</span>
              </button>

              <button
                onClick={this.handleResetLocal}
                className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Restaura os dados padrão do catálogo de semijoias"
              >
                <Database className="w-4 h-4" />
                <span>Restaurar Catálogo</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
