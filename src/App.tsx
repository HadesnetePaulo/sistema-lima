import React, { useState, useEffect, useCallback } from 'react';
import { Produto, Venda, MovimentacaoCaixa, LancamentoFiado, Fornecedor, PedidoCompra } from './types';
import { storage } from './lib/storage';
import { testSupabaseConnection } from './lib/supabase';
import { subscribeToFirestoreState } from './lib/firebase';
import { Header, TabType } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { NovaVenda } from './components/NovaVenda';
import { ProdutosEstoque } from './components/ProdutosEstoque';
import { ModuloFornecedores } from './components/ModuloFornecedores';
import { HistoricoVendas } from './components/HistoricoVendas';
import { ModuloCaixa } from './components/ModuloCaixa';
import { RelatorioProdutos } from './components/RelatorioProdutos';
import { ControleFiado } from './components/ControleFiado';
import { ConfiguracoesSupabase } from './components/ConfiguracoesSupabase';
import { ReciboModal } from './components/ReciboModal';
import { WifiOff, Sparkles } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return storage.isAuthenticated();
  });

  const [activeTab, setActiveTab] = useState<TabType>('pdv');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [movimentacoesCaixa, setMovimentacoesCaixa] = useState<MovimentacaoCaixa[]>([]);
  const [fiados, setFiados] = useState<LancamentoFiado[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [pedidosCompra, setPedidosCompra] = useState<PedidoCompra[]>([]);
  const [reciboAtivo, setReciboAtivo] = useState<Venda | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Synchronize dynamic document.title across all pages with Lima Semijoias branding
  useEffect(() => {
    if (!isAuthenticated) {
      document.title = 'Acesso ao Sistema — Lima Semijoias';
      return;
    }

    const TITULOS_PAGINAS: Record<TabType, string> = {
      pdv: 'Nova Venda (PDV) — Lima Semijoias',
      produtos: 'Catálogo & Estoque — Lima Semijoias',
      fornecedores: 'Fornecedores & Pedidos de Compra — Lima Semijoias',
      caixa: 'Fluxo de Caixa & Lucro — Lima Semijoias',
      fiado: 'Conta Corrente de Clientes — Lima Semijoias',
      relatorios: 'Relatórios de Desempenho — Lima Semijoias',
      vendas: 'Histórico de Vendas — Lima Semijoias',
      config: 'Configurações & Backup — Lima Semijoias',
    };

    document.title = TITULOS_PAGINAS[activeTab] || 'Lima Semijoias — Sistema de Vendas & Estoque';
  }, [activeTab, isAuthenticated]);

  // Load initial data (local first, then async server + Supabase check)
  const carregarDados = useCallback(async () => {
    // 1. Instant local load
    setProdutos(storage.getProdutos());
    setVendas(storage.getVendas());
    setMovimentacoesCaixa(storage.getMovimentacoesCaixa());
    setFiados(storage.getFiados());
    setFornecedores(storage.getFornecedores());
    setPedidosCompra(storage.getPedidosCompra());

    // 2. Multi-device persistent server synchronization
    try {
      const serverData = await storage.sincronizarServidor();
      if (serverData) {
        setProdutos(serverData.produtos);
        setVendas(serverData.vendas);
        setMovimentacoesCaixa(serverData.caixa);
        setFiados(serverData.fiados);
        if (serverData.fornecedores) setFornecedores(serverData.fornecedores);
        if (serverData.pedidosCompra) setPedidosCompra(serverData.pedidosCompra);
      }
    } catch (err) {
      console.warn('Sincronização persistente multi-dispositivo offline:', err);
    }

    // 3. Check Supabase connection and sync if available
    try {
      const conn = await testSupabaseConnection();
      setSupabaseConnected(conn.connected);

      if (conn.connected) {
        const [resProds, resVendas, resCaixa, resFiados] = await Promise.all([
          storage.carregarProdutosAsync(),
          storage.carregarVendasAsync(),
          storage.carregarMovimentacoesCaixaAsync(),
          storage.carregarFiadosAsync(),
        ]);
        if (resProds.fromSupabase) {
          setProdutos(resProds.produtos);
        }
        if (resVendas.fromSupabase) {
          setVendas(resVendas.vendas);
        }
        if (resCaixa.fromSupabase) {
          setMovimentacoesCaixa(resCaixa.movs);
        }
        if (resFiados.fromSupabase) {
          setFiados(resFiados.fiados);
        }
      }
    } catch (err) {
      console.warn('Verificação Supabase offline:', err);
    }
  }, []);

  useEffect(() => {
    carregarDados();

    // Real-time multi-device subscription: when ANY phone or PC saves, updates reflect here immediately!
    const unsubscribeFirestore = subscribeToFirestoreState((cloudState) => {
      // 1. Immediately update localStorage so that storage.getProdutos(), storage.getVendas(), etc., reflect the cloud
      storage.atualizarEstadoLocal(cloudState);
      // 2. Immediately update React state on all connected devices
      if (cloudState.produtos) setProdutos(cloudState.produtos);
      if (cloudState.vendas) setVendas(cloudState.vendas);
      if (cloudState.caixa) setMovimentacoesCaixa(cloudState.caixa);
      if (cloudState.fiados) setFiados(cloudState.fiados);
      if (cloudState.fornecedores) setFornecedores(cloudState.fornecedores);
      if (cloudState.pedidosCompra) setPedidosCompra(cloudState.pedidosCompra);
    });

    // Background polling every 4s for real-time multi-device sync fallback
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        carregarDados();
      }
    }, 4000);

    // Re-sync whenever user focuses the tab/window on their mobile or computer
    const handleFocus = () => {
      carregarDados();
    };

    // Online/Offline detection for PWA
    const handleOnline = () => {
      setIsOnline(true);
      carregarDados();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubscribeFirestore();
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [carregarDados]);

  const handleLogout = () => {
    storage.logout();
    setIsAuthenticated(false);
  };

  const handleVendaConcluida = (novaVenda: Venda) => {
    carregarDados();
    setReciboAtivo(novaVenda);
  };

  // If user is locked out / unauthenticated, render lock screen
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onSuccess={() => {
          setIsAuthenticated(true);
          carregarDados();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-800">
      {/* Offline Status Toast */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 text-center no-print">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Modo Offline ativo · Seus dados e vendas continuam salvos localmente.</span>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={0}
        onLogout={handleLogout}
        supabaseConnected={supabaseConnected}
      />

      {/* Main Content Area - Generous bottom padding so elements never clash with fixed mobile navbar */}
      <main className="flex-1 pb-28 sm:pb-12">
        {activeTab === 'pdv' && (
          <NovaVenda
            produtos={produtos}
            vendas={vendas}
            fiados={fiados}
            onVendaConcluida={handleVendaConcluida}
            onRefreshProdutos={carregarDados}
          />
        )}

        {activeTab === 'produtos' && (
          <ProdutosEstoque
            produtos={produtos}
            onRefresh={carregarDados}
          />
        )}

        {activeTab === 'fornecedores' && (
          <ModuloFornecedores
            produtos={produtos}
            fornecedores={fornecedores}
            pedidosCompra={pedidosCompra}
            onRefresh={carregarDados}
            onNavegarParaEstoque={() => setActiveTab('produtos')}
          />
        )}

        {activeTab === 'caixa' && (
          <ModuloCaixa
            vendas={vendas}
            movimentacoes={movimentacoesCaixa}
            onRefresh={carregarDados}
          />
        )}

        {activeTab === 'fiado' && (
          <ControleFiado
            fiados={fiados}
            vendas={vendas}
            produtos={produtos}
            onRefresh={carregarDados}
          />
        )}

        {activeTab === 'relatorios' && (
          <RelatorioProdutos
            produtos={produtos}
            vendas={vendas}
          />
        )}

        {activeTab === 'vendas' && (
          <HistoricoVendas
            vendas={vendas}
            onVerRecibo={venda => setReciboAtivo(venda)}
            onRefresh={carregarDados}
          />
        )}

        {activeTab === 'config' && (
          <ConfiguracoesSupabase
            onRefreshAll={carregarDados}
            supabaseConnected={supabaseConnected}
            setSupabaseConnected={setSupabaseConnected}
          />
        )}
      </main>

      {/* Receipt Modal */}
      {reciboAtivo && (
        <ReciboModal
          venda={reciboAtivo}
          onClose={() => setReciboAtivo(null)}
          onCancelarVenda={() => carregarDados()}
        />
      )}

      {/* Clean Subtle Footer */}
      <footer className="no-print border-t border-stone-200/80 py-4 text-center text-xs text-stone-500 bg-white/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-stone-700">
            <div className="w-6 h-6 rounded-md overflow-hidden bg-white border border-stone-200 p-0.5 shrink-0 flex items-center justify-center">
              <img src="/logo-lima.jpg" alt="Lima Semijoias" className="w-full h-full object-contain" />
            </div>
            <span className="font-serif font-semibold text-stone-900">Lima Semijoias</span>
            <span>· Sistema de Vendas, Caixa & Conta Corrente (V2)</span>
          </div>
          <p className="text-[11px] text-stone-400">
            Uso interno exclusivo · Sincronizado Multi-Dispositivo · PWA Ativo
          </p>
        </div>
      </footer>
    </div>
  );
}
