import React, { useState } from 'react';
import { Download, Smartphone, Check, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed as PWA or in standalone mode
  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
        <Check className="w-3.5 h-3.5 text-emerald-600" />
        <span className="hidden sm:inline">Modo Aplicativo Ativo</span>
      </span>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95"
        title="Instalar sistema na tela inicial do celular ou computador"
      >
        <Download className="w-3.5 h-3.5 text-amber-700" />
        <span>Instalar Atalho (PWA)</span>
      </button>

      {/* Manual Installation Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-semibold text-stone-900">
                  Instalar como Aplicativo
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-sm text-stone-600 space-y-3">
              <p>
                Este sistema pode funcionar direto no seu celular ou computador sem precisar baixar da loja de apps:
              </p>

              {isIOS ? (
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 text-stone-800">
                  <p className="font-semibold text-amber-900 mb-1">No iPhone / iPad (Safari):</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Toque no botão de <strong>Compartilhar</strong> (ícone de quadrado com seta para cima).</li>
                    <li>Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</li>
                    <li>Toque em <strong>Adicionar</strong> no topo direito. Pronto!</li>
                  </ol>
                </div>
              ) : (
                <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 text-stone-800">
                  <p className="font-semibold text-stone-900 mb-1">No Android / Chrome / Edge:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Toque nos <strong>três pontinhos</strong> (menu) no topo direito do navegador.</li>
                    <li>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
                    <li>O ícone dourado do sistema aparecerá na sua tela junto aos seus outros aplicativos!</li>
                  </ol>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
