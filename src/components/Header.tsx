import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Package, 
  ReceiptText, 
  Wallet, 
  BarChart3, 
  Users, 
  Database, 
  LogOut,
  MoreHorizontal,
  X,
  Truck
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type TabType = 'pdv' | 'produtos' | 'fornecedores' | 'vendas' | 'caixa' | 'relatorios' | 'fiado' | 'config';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  cartCount: number;
  onLogout: () => void;
  supabaseConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  onLogout,
  supabaseConnected
}) => {
  const [mobileMenuAberto, setMobileMenuAberto] = useState(false);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setMobileMenuAberto(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-stone-900 border-b border-stone-800 text-stone-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark with Official Logo */}
        <button
          onClick={() => setActiveTab('pdv')}
          className="text-left group cursor-pointer focus:outline-none flex items-center gap-2.5 sm:gap-3"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-white border border-amber-400/40 p-1 shadow-sm group-hover:border-amber-300 transition shrink-0 flex items-center justify-center">
            <img
              src="/logo-lima.jpg"
              alt="Logo Lima Semijoias"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg sm:text-xl font-bold tracking-wider text-amber-200 group-hover:text-amber-100 transition leading-tight">
              LIMA SEMIJOIAS
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-400/80 font-medium hidden sm:block">
              Semijoias Finas & Acessórios
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links (Desktop from lg breakpoint up) */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => setActiveTab('pdv')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pdv'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Nova Venda</span>
            {cartCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-stone-950 font-black rounded-full text-[11px]">
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('produtos')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'produtos'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <Package className="w-4 h-4 text-amber-400" />
            <span>Estoque</span>
          </button>

          <button
            onClick={() => setActiveTab('fornecedores')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fornecedores'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Fornecedores</span>
          </button>

          <button
            onClick={() => setActiveTab('caixa')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'caixa'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Caixa & Lucro</span>
          </button>

          <button
            onClick={() => setActiveTab('fiado')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fiado'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Conta Corrente</span>
          </button>

          <button
            onClick={() => setActiveTab('relatorios')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'relatorios'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <span>Relatórios</span>
          </button>

          <button
            onClick={() => setActiveTab('vendas')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'vendas'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <ReceiptText className="w-4 h-4 text-amber-400" />
            <span>Histórico</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Config & Backup</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions (Cloud status pill + PWA Install + Logout/Lock) */}
        <div className="flex items-center gap-2">
          {/* Cloud Firebase Indicator */}
          <button
            onClick={() => setActiveTab('config')}
            title="Dados protegidos e sincronizados na nuvem Firebase"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 font-medium hover:bg-emerald-900/60 transition cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Nuvem Firebase Ativa</span>
          </button>

          {/* Supabase optional indicator */}
          {supabaseConnected && (
            <button
              onClick={() => setActiveTab('config')}
              title="Conectado ao Supabase (Online)"
              className="hidden md:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-stone-700 bg-stone-800 text-stone-300 hover:text-stone-100"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Supabase</span>
            </button>
          )}

          <PWAInstallButton />

          <button
            onClick={onLogout}
            title="Bloquear sistema / Trocar de operador"
            className="p-2 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Anchor - Spacious, touch-friendly, safe-area aware */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-lg border-t border-stone-800/90 h-16 pb-safe flex items-center justify-around px-2 shadow-2xl">
        <button
          onClick={() => handleSelectTab('pdv')}
          className={`flex-1 h-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
            activeTab === 'pdv' ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          <div className="relative">
            <ShoppingBag className={`w-5 h-5 transition-transform ${activeTab === 'pdv' ? 'scale-110 text-amber-400' : ''}`} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-amber-500 text-stone-950 font-black rounded-full text-[9px] shadow-xs">
                {cartCount}
              </span>
            )}
          </div>
          <span className="mt-1 text-[11px] tracking-tight">Vender</span>
          {activeTab === 'pdv' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
          )}
        </button>

        <button
          onClick={() => handleSelectTab('produtos')}
          className={`flex-1 h-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
            activeTab === 'produtos' ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          <Package className={`w-5 h-5 transition-transform ${activeTab === 'produtos' ? 'scale-110 text-amber-400' : ''}`} />
          <span className="mt-1 text-[11px] tracking-tight">Estoque</span>
          {activeTab === 'produtos' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
          )}
        </button>

        <button
          onClick={() => handleSelectTab('caixa')}
          className={`flex-1 h-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
            activeTab === 'caixa' ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          <Wallet className={`w-5 h-5 transition-transform ${activeTab === 'caixa' ? 'scale-110 text-amber-400' : ''}`} />
          <span className="mt-1 text-[11px] tracking-tight">Caixa</span>
          {activeTab === 'caixa' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
          )}
        </button>

        <button
          onClick={() => handleSelectTab('fiado')}
          className={`flex-1 h-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
            activeTab === 'fiado' ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          <Users className={`w-5 h-5 transition-transform ${activeTab === 'fiado' ? 'scale-110 text-amber-400' : ''}`} />
          <span className="mt-1 text-[11px] tracking-tight">C. Corrente</span>
          {activeTab === 'fiado' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
          )}
        </button>

        <button
          onClick={() => setMobileMenuAberto(true)}
          className={`flex-1 h-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
            ['vendas', 'relatorios', 'config', 'fornecedores'].includes(activeTab) ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-300'
          }`}
        >
          <MoreHorizontal className={`w-5 h-5 transition-transform ${['vendas', 'relatorios', 'config', 'fornecedores'].includes(activeTab) ? 'scale-110 text-amber-400' : ''}`} />
          <span className="mt-1 text-[11px] tracking-tight">Mais</span>
          {['vendas', 'relatorios', 'config', 'fornecedores'].includes(activeTab) && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
          )}
        </button>
      </div>

      {/* Mobile "Mais" Bottom Sheet Drawer */}
      {mobileMenuAberto && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full bg-stone-900 rounded-t-3xl border-t border-stone-800 p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-stone-400">
                Menu Adicional
              </span>
              <button
                onClick={() => setMobileMenuAberto(false)}
                className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleSelectTab('fornecedores')}
                className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold border transition ${
                  activeTab === 'fornecedores'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-stone-800/80 text-stone-200 border-stone-700'
                }`}
              >
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Fornecedores</span>
              </button>

              <button
                onClick={() => handleSelectTab('relatorios')}
                className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold border transition ${
                  activeTab === 'relatorios'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-stone-800/80 text-stone-200 border-stone-700'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <span>Relatórios</span>
              </button>

              <button
                onClick={() => handleSelectTab('vendas')}
                className={`col-span-2 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold border transition ${
                  activeTab === 'vendas'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-stone-800/80 text-stone-200 border-stone-700'
                }`}
              >
                <ReceiptText className="w-4 h-4 text-amber-400" />
                <span>Histórico Vendas</span>
              </button>

              <button
                onClick={() => handleSelectTab('config')}
                className={`col-span-2 p-3 rounded-xl flex items-center justify-between text-xs font-semibold border transition ${
                  activeTab === 'config'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-stone-800/80 text-stone-200 border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Configurações & Backup (JSON / Nuvem)</span>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Nuvem Ativa</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
