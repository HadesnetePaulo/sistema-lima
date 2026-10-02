import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  ShieldCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  ExternalLink,
  Cloud,
  FileJson,
  AlertTriangle,
  HardDrive,
  Package,
  ReceiptText,
  Wallet,
  Users,
  Trash2
} from 'lucide-react';
import { storage } from '../lib/storage';
import { testFirestoreConnection, saveStateToFirestore } from '../lib/firebase';
import { 
  getStoredSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection,
  pushProdutosToSupabase,
  SupabaseStatus
} from '../lib/supabase';

const SCHEMA_V2_SQL = `-- ============================================================================
-- LIMA SEMIJOIAS - MIGRATION V2 (Executar no SQL Editor do Supabase se desejar)
-- ============================================================================

-- 1. ADICIONA PREÇO DE CUSTO EM PRODUTOS
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2) DEFAULT 0 CHECK (preco_custo >= 0);

-- 2. ADICIONA PREÇO DE CUSTO CONGELADO EM ITENS_VENDA
ALTER TABLE public.itens_venda 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2) DEFAULT 0 CHECK (preco_custo >= 0);

-- 3. ADICIONA DADOS DO CLIENTE EM VENDAS
ALTER TABLE public.vendas 
ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT;

-- 4. TABELA DE MOVIMENTAÇÕES DE CAIXA
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_data ON public.movimentacoes_caixa(created_at DESC);

-- 5. TABELA DE CONTROLE DE FIADO
CREATE TABLE IF NOT EXISTS public.fiados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_whatsapp TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('debito', 'pagamento')),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT,
  venda_id TEXT REFERENCES public.vendas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiados_cliente ON public.fiados(cliente_nome);
CREATE INDEX IF NOT EXISTS idx_fiados_created_at ON public.fiados(created_at DESC);
`;

interface ConfiguracoesSupabaseProps {
  onRefreshAll: () => void;
  supabaseConnected: boolean;
  setSupabaseConnected: (connected: boolean) => void;
}

interface BackupPreviewState {
  fileName: string;
  fileSize: string;
  rawContent: string;
  exportadoEm: string;
  contagens: {
    produtos: number;
    vendas: number;
    caixa: number;
    fiados: number;
  };
}

export const ConfiguracoesSupabase: React.FC<ConfiguracoesSupabaseProps> = ({
  onRefreshAll,
  supabaseConnected,
  setSupabaseConnected
}) => {
  const [copiadoSql, setCopiadoSql] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats for backup display
  const [statsAtuais, setStatsAtuais] = useState(() => storage.exportBackup().stats);

  // Client Delivery Audit & Clean Test Data State
  const [analiseEntrega, setAnaliseEntrega] = useState(() => storage.analisarDadosEntregaCliente());
  const [modalLimpezaAberto, setModalLimpezaAberto] = useState(false);
  const [limpandoTestes, setLimpandoTestes] = useState(false);

  // Cloud Firebase Status
  const [firebaseStatus, setFirebaseStatus] = useState<{
    loading: boolean;
    conectado: boolean;
    mensagem: string;
    ultimaSincronizacao?: string;
  }>({
    loading: false,
    conectado: true,
    mensagem: 'Conectado à nuvem Google Firebase (Firestore ativo)',
    ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  // Backup Import Modal & Feedback
  const [backupPreview, setBackupPreview] = useState<BackupPreviewState | null>(null);
  const [importandoBackup, setImportandoBackup] = useState(false);
  const [alertaBackup, setAlertaBackup] = useState<{
    tipo: 'sucesso' | 'erro' | 'info';
    titulo: string;
    mensagem: string;
  } | null>(null);

  // Supabase Config Form
  const currentConfig = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseKey, setSupabaseKey] = useState(currentConfig.key);
  const [msgConfig, setMsgConfig] = useState<string | null>(null);
  const [testandoConexao, setTestandoConexao] = useState(false);
  const [statusDetalhado, setStatusDetalhado] = useState<SupabaseStatus | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  // Password change
  const [novaSenha, setNovaSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState<string | null>(null);

  // Check Firebase and update stats
  const atualizarStatus = () => {
    const { stats } = storage.exportBackup();
    setStatsAtuais(stats);
    setAnaliseEntrega(storage.analisarDadosEntregaCliente());
  };

  useEffect(() => {
    atualizarStatus();
    // Test Firebase connection on mount
    testFirestoreConnection().then(res => {
      setFirebaseStatus({
        loading: false,
        conectado: res.ok,
        mensagem: res.message,
        ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
    });

    if (supabaseUrl && supabaseKey) {
      testSupabaseConnection().then(res => {
        setStatusDetalhado(res);
        setSupabaseConnected(res.connected);
      });
    }
  }, []);

  // Execute Test Cleaning with Client Data Protection
  const handleExecutarLimpezaTestes = async () => {
    setLimpandoTestes(true);
    try {
      const res = await storage.limparDadosDeTesteEPreservarCliente();
      onRefreshAll();
      atualizarStatus();
      setModalLimpezaAberto(false);
      setAlertaBackup({
        tipo: 'sucesso',
        titulo: 'Sistema Preparado para Entrega!',
        mensagem: `${res.produtosRemovidos} itens de teste foram removidos. Todos os ${res.produtosPreservados} produtos reais e as ${res.vendasPreservadas} vendas realizadas foram preservados e salvos com sucesso na nuvem!`
      });
      setTimeout(() => setAlertaBackup(null), 6500);
    } catch (err: any) {
      setAlertaBackup({
        tipo: 'erro',
        titulo: 'Erro ao Limpar Testes',
        mensagem: err?.message || 'Falha ao processar limpeza.'
      });
    } finally {
      setLimpandoTestes(false);
    }
  };

  // Force Cloud Sync (Firebase + Express)
  const handleForcarSincronizacaoNuvem = async () => {
    setFirebaseStatus(prev => ({ ...prev, loading: true }));
    try {
      await storage.persistirEmTodasNuvens();
      const res = await testFirestoreConnection();
      setFirebaseStatus({
        loading: false,
        conectado: res.ok,
        mensagem: res.ok ? 'Todos os dados foram gravados na nuvem Firebase com sucesso!' : res.message,
        ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      atualizarStatus();
      setAlertaBackup({
        tipo: 'sucesso',
        titulo: 'Sincronização Concluída',
        mensagem: 'Todas as joias, histórico de vendas, fluxo de caixa e fiados estão 100% seguros na nuvem.'
      });
      setTimeout(() => setAlertaBackup(null), 5000);
    } catch (err: any) {
      setFirebaseStatus(prev => ({
        ...prev,
        loading: false,
        mensagem: `Erro ao sincronizar: ${err?.message || 'Falha na rede'}`
      }));
    }
  };

  // Export JSON Backup
  const handleExportarBackup = () => {
    try {
      const { jsonString, filename, stats } = storage.exportBackup();
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setAlertaBackup({
        tipo: 'sucesso',
        titulo: 'Backup Exportado com Sucesso!',
        mensagem: `O arquivo "${filename}" foi baixado no seu dispositivo com ${stats.totalProdutos} produtos, ${stats.totalVendas} vendas, ${stats.totalCaixa} lançamentos no caixa e ${stats.totalFiados} registros de fiados.`
      });
      setTimeout(() => setAlertaBackup(null), 6000);
    } catch (err: any) {
      setAlertaBackup({
        tipo: 'erro',
        titulo: 'Erro ao Exportar Backup',
        mensagem: err?.message || 'Não foi possível gerar o arquivo de backup.'
      });
    }
  };

  // Handle file select for JSON import
  const handleSelecionarArquivoBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const validacao = storage.validarArquivoBackup(content);

      if (!validacao.valido || !validacao.contagens) {
        setAlertaBackup({
          tipo: 'erro',
          titulo: 'Arquivo de Backup Inválido',
          mensagem: validacao.erro || 'O arquivo selecionado não contém um formato de backup válido da Lima Semijoias.'
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setBackupPreview({
        fileName: file.name,
        fileSize: fileSizeStr,
        rawContent: content,
        exportadoEm: validacao.exportadoEm || 'Não especificada',
        contagens: validacao.contagens
      });
    };
    reader.readAsText(file);
  };

  // Confirm import
  const handleConfirmarImportacao = async () => {
    if (!backupPreview) return;
    setImportandoBackup(true);

    try {
      const res = await storage.importBackup(backupPreview.rawContent);
      if (res.sucesso && res.contagens) {
        onRefreshAll();
        atualizarStatus();
        setBackupPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setAlertaBackup({
          tipo: 'sucesso',
          titulo: 'Backup Restaurado com Sucesso!',
          mensagem: `Foram restaurados ${res.contagens.produtos} produtos, ${res.contagens.vendas} vendas, ${res.contagens.caixa} registros de caixa e ${res.contagens.fiados} fiados. Os dados foram salvos e sincronizados com a nuvem Firebase.`
        });
        setTimeout(() => setAlertaBackup(null), 6500);
      } else {
        setAlertaBackup({
          tipo: 'erro',
          titulo: 'Falha na Restauração',
          mensagem: res.erro || 'Ocorreu um erro ao restaurar os dados do arquivo.'
        });
      }
    } catch (err: any) {
      setAlertaBackup({
        tipo: 'erro',
        titulo: 'Erro ao Processar Backup',
        mensagem: err?.message || 'Falha inesperada ao importar o arquivo.'
      });
    } finally {
      setImportandoBackup(false);
    }
  };

  // Copy SQL
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_V2_SQL);
      setCopiadoSql(true);
      setTimeout(() => setCopiadoSql(false), 2500);
    } catch {
      setCopiadoSql(true);
      setTimeout(() => setCopiadoSql(false), 2500);
    }
  };

  // Save Supabase Config
  const handleSalvarSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setMsgConfig('Configurações salvas! Testando conexão com o Supabase...');
    setTestandoConexao(true);

    try {
      const res = await testSupabaseConnection();
      setStatusDetalhado(res);
      setSupabaseConnected(res.connected);
      setMsgConfig(res.message);
      if (res.connected) {
        onRefreshAll();
      }
    } catch (err: any) {
      setMsgConfig(`Erro: ${err?.message || 'Falha ao testar'}`);
    } finally {
      setTestandoConexao(false);
    }
  };

  // Test Supabase Connection
  const handleTestarConexao = async () => {
    setTestandoConexao(true);
    setMsgConfig(null);
    try {
      saveSupabaseConfig(supabaseUrl, supabaseKey);
      const res = await testSupabaseConnection();
      setStatusDetalhado(res);
      setSupabaseConnected(res.connected);
      setMsgConfig(res.message);
      if (res.connected) {
        onRefreshAll();
      }
    } catch (err: any) {
      setMsgConfig(`Erro ao conectar: ${err?.message || 'Verifique sua URL e Chave'}`);
    } finally {
      setTestandoConexao(false);
    }
  };

  // Push local products to Supabase
  const handleSubirProdutosParaSupabase = async () => {
    setSincronizando(true);
    setMsgConfig(null);
    try {
      const prods = storage.getProdutos();
      const res = await pushProdutosToSupabase(prods);
      if (res.error) {
        setMsgConfig(`Aviso: ${res.error}`);
      } else {
        setMsgConfig(`${res.count} produtos sincronizados com sucesso no Supabase!`);
        onRefreshAll();
      }
    } catch (err: any) {
      setMsgConfig(`Erro ao enviar: ${err?.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  // Pull products and sales from Supabase
  const handlePuxarDadosSupabase = async () => {
    setSincronizando(true);
    setMsgConfig(null);
    try {
      const resP = await storage.carregarProdutosAsync();
      const resV = await storage.carregarVendasAsync();
      const resC = await storage.carregarMovimentacoesCaixaAsync();
      const resF = await storage.carregarFiadosAsync();

      setMsgConfig(`Dados sincronizados com o Supabase: ${resP.produtos.length} produtos, ${resV.vendas.length} vendas, ${resC.movs.length} caixa, ${resF.fiados.length} fiados.`);
      onRefreshAll();
      atualizarStatus();
    } catch (err: any) {
      setMsgConfig(`Erro ao carregar dados: ${err?.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  // Change Password
  const handleAlterarSenha = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSenha.trim()) {
      setMsgSenha('Digite a nova senha desejada.');
      return;
    }
    storage.setMasterPassword(novaSenha.trim());
    setNovaSenha('');
    setMsgSenha('Senha de acesso da Lima Semijoias atualizada com sucesso!');
    setTimeout(() => setMsgSenha(null), 3500);
  };

  // Reset to default
  const handleRestaurarPadrao = () => {
    const confirmacao = window.confirm('Deseja realmente restaurar os produtos padrão do catálogo da Lima Semijoias? Isso adicionará as semijoias originais.');
    if (confirmacao) {
      storage.resetCatalogToDefault();
      onRefreshAll();
      atualizarStatus();
      setAlertaBackup({
        tipo: 'info',
        titulo: 'Catálogo Restaurado',
        mensagem: 'Os produtos padrão da boutique foram recarregados com sucesso.'
      });
      setTimeout(() => setAlertaBackup(null), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Alert Banner */}
      {alertaBackup && (
        <div className={`p-4 rounded-2xl border shadow-sm flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-2 ${
          alertaBackup.tipo === 'sucesso'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : alertaBackup.tipo === 'erro'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {alertaBackup.tipo === 'sucesso' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : alertaBackup.tipo === 'erro' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{alertaBackup.titulo}</h4>
            <p className="text-xs opacity-90 mt-0.5">{alertaBackup.mensagem}</p>
          </div>
          <button
            onClick={() => setAlertaBackup(null)}
            className="text-stone-400 hover:text-stone-600 p-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Status */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
              Configurações, Backup & Nuvem
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Cópia de segurança manual em JSON, sincronização contínua na nuvem Firebase, senha do sistema e migrações.
          </p>
        </div>

        {/* Cloud Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Firebase Pill */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${
            firebaseStatus.conectado
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${firebaseStatus.conectado ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <Cloud className="w-3.5 h-3.5" />
            <span>{firebaseStatus.conectado ? 'Nuvem Firebase Conectada' : 'Reconectando à Nuvem...'}</span>
          </div>

          {/* Supabase Pill */}
          {supabaseConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-stone-50 border-stone-200 text-stone-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Supabase Conectado</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: BACKUP MANUAL EM JSON (Destaque Principal) */}
      <div className="bg-gradient-to-br from-amber-500/10 via-white to-stone-50 rounded-2xl border-2 border-amber-300/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center border border-amber-400/40 shadow-xs">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif">
                Central de Backup Manual em JSON (Segurança Extra)
              </h2>
              <p className="text-xs text-stone-600">
                Baixe uma cópia de segurança completa do seu sistema no formato JSON ou restaure seus dados a qualquer momento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-500 bg-white/80 px-3 py-1.5 rounded-xl border border-stone-200">
            <HardDrive className="w-3.5 h-3.5 text-amber-600" />
            <span>Dados atuais: <strong>{statsAtuais.totalProdutos}</strong> joias, <strong>{statsAtuais.totalVendas}</strong> vendas, <strong>{statsAtuais.totalFiados}</strong> fiados</span>
          </div>
        </div>

        {/* Resumo do que está no sistema agora */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold">Joias / Produtos</div>
              <div className="text-sm font-bold text-stone-800">{statsAtuais.totalProdutos} itens</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold">Histórico de Vendas</div>
              <div className="text-sm font-bold text-stone-800">{statsAtuais.totalVendas} vendas</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold">Fluxo de Caixa</div>
              <div className="text-sm font-bold text-stone-800">{statsAtuais.totalCaixa} registros</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold">Contas de Fiados</div>
              <div className="text-sm font-bold text-stone-800">{statsAtuais.totalFiados} lançamentos</div>
            </div>
          </div>
        </div>

        {/* Action Cards: Exportar vs Importar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Exportar */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between space-y-4 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                <Download className="w-4 h-4 text-amber-600" />
                <span>Exportar Cópia de Segurança (.JSON)</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Gera um arquivo padronizado contendo 100% dos dados da sua loja (produtos, estoque, preços de custo, vendas realizadas, caixa e caderninho de fiados). Você pode salvar no seu computador, celular ou pendrive.
              </p>
            </div>

            <button
              onClick={handleExportarBackup}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-semibold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Backup Completo em JSON</span>
            </button>
          </div>

          {/* Card 2: Importar */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between space-y-4 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Importar & Restaurar Backup (.JSON)</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Carregue um arquivo de backup (.json) gerado anteriormente. O sistema analisará o arquivo e mostrará uma prévia dos dados antes de você confirmar a restauração.
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelecionarArquivoBackup}
                className="hidden"
                id="input-backup-json"
              />
              <label
                htmlFor="input-backup-json"
                className="w-full py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-white font-semibold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2 text-center"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Selecionar Arquivo de Backup para Restaurar</span>
              </label>
            </div>
          </div>
        </div>

        {/* Cloud Persistence Guarantee Card */}
        <div className="bg-emerald-950/5 border border-emerald-600/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-950">
                Persistência Automática em Nuvem Firebase Ativada
              </h4>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Cada joia cadastrada, venda efetuada, movimentação de caixa ou pagamento de fiado é gravado automaticamente no Google Firebase Firestore. Os dados não são perdidos com reinicializações ou atualizações do sistema.
              </p>
            </div>
          </div>

          <button
            onClick={handleForcarSincronizacaoNuvem}
            disabled={firebaseStatus.loading}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${firebaseStatus.loading ? 'animate-spin' : ''}`} />
            <span>{firebaseStatus.loading ? 'Sincronizando...' : 'Sincronizar Nuvem Agora'}</span>
          </button>
        </div>
      </div>

      {/* SECTION: AUDITORIA & PREPARAÇÃO PARA ENTREGA AO CLIENTE */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/30 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif">
                Preparação para Entrega ao Cliente
              </h2>
              <p className="text-xs text-stone-600">
                Auditoria de segurança: proteja os dados e vendas que o cliente já fez e remova apenas os itens de teste.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Vendas & Produtos Reais Protegidos</span>
            </span>
          </div>
        </div>

        {/* Status dos dados encontrados */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Card 1: Produtos do Cliente (Reais ou com vendas) */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Produtos Reais do Cliente
              </span>
              <span className="font-mono font-bold text-emerald-900 text-sm">{analiseEntrega.produtosReais.length}</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-tight">
              Peças cadastradas pelo cliente ou que já tiveram vendas registradas. <strong>Não serão alteradas.</strong>
            </p>
          </div>

          {/* Card 2: Histórico de Vendas */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4 text-emerald-600" />
                Vendas Realizadas
              </span>
              <span className="font-mono font-bold text-emerald-900 text-sm">{analiseEntrega.totalVendas}</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-tight">
              Histórico financeiro, itens vendidos, caixa e fiados. <strong>100% preservados e blindados.</strong>
            </p>
          </div>

          {/* Card 3: Itens de Teste / Demonstração */}
          <div className={`p-4 rounded-xl border space-y-1.5 ${
            analiseEntrega.produtosTeste.length > 0
              ? 'bg-amber-50/80 border-amber-300'
              : 'bg-stone-50 border-stone-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-semibold flex items-center gap-1.5 ${
                analiseEntrega.produtosTeste.length > 0 ? 'text-amber-950' : 'text-stone-700'
              }`}>
                <AlertTriangle className={`w-4 h-4 ${analiseEntrega.produtosTeste.length > 0 ? 'text-amber-600' : 'text-stone-400'}`} />
                Itens de Teste / Amostras
              </span>
              <span className="font-mono font-bold text-sm text-stone-800">{analiseEntrega.produtosTeste.length}</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-tight">
              {analiseEntrega.produtosTeste.length > 0
                ? `${analiseEntrega.produtosTeste.length} produtos de demonstração sem nenhuma venda vinculada.`
                : 'Nenhum item de teste pendente. O catálogo está limpo e profissional.'}
            </p>
          </div>
        </div>

        {/* Ação de Limpeza com Segurança Total */}
        {analiseEntrega.produtosTeste.length > 0 ? (
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <span>Limpar {analiseEntrega.produtosTeste.length} itens de teste identificados:</span>
              </h4>
              <p className="text-[11px] text-stone-600">
                {analiseEntrega.produtosTeste.map(p => p.nome).slice(0, 4).join(', ')}
                {analiseEntrega.produtosTeste.length > 4 ? ` e mais ${analiseEntrega.produtosTeste.length - 4}...` : ''}
              </p>
            </div>

            <button
              onClick={() => setModalLimpezaAberto(true)}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-semibold text-xs transition cursor-pointer shadow-sm flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remover Apenas Itens de Teste</span>
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Tudo limpo! O sistema está pronto para entrega, contendo apenas os dados autênticos do cliente.</span>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE LIMPEZA PRÉ-ENTREGA */}
      {modalLimpezaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-stone-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 font-serif">
                  Confirmar Limpeza para Entrega
                </h3>
                <p className="text-xs text-stone-500">
                  Proteção total das vendas e produtos reais do cliente
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
              <p>
                Esta ação vai remover com segurança os <strong>{analiseEntrega.produtosTeste.length} produtos de teste</strong> que nunca tiveram vendas.
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Garantia de Não Alteração:
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  • <strong>{analiseEntrega.produtosReais.length} produtos reais</strong> serão mantidos intactos.<br />
                  • <strong>{analiseEntrega.totalVendas} vendas registradas</strong> serão preservadas no histórico.<br />
                  • O resultado será sincronizado imediatamente no Firebase Firestore.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalLimpezaAberto(false)}
                disabled={limpandoTestes}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 font-semibold text-xs text-stone-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutarLimpezaTestes}
                disabled={limpandoTestes}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {limpandoTestes ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Limpando testes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar e Limpar Testes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO & INSPEÇÃO DE BACKUP */}
      {backupPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-stone-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 font-serif">
                  Confirmar Restauração de Backup
                </h3>
                <p className="text-xs text-stone-500">
                  Verifique os dados contidos no arquivo antes de aplicar a restauração.
                </p>
              </div>
            </div>

            {/* File info */}
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Arquivo:</span>
                <span className="font-mono font-medium text-stone-800">{backupPreview.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Tamanho:</span>
                <span className="font-mono font-medium text-stone-800">{backupPreview.fileSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Data do Backup:</span>
                <span className="font-medium text-stone-800">{backupPreview.exportadoEm}</span>
              </div>
            </div>

            {/* Counts preview */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Conteúdo identificado no arquivo:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
                  <span className="text-stone-600">Produtos / Joias:</span>
                  <span className="font-bold text-amber-900">{backupPreview.contagens.produtos}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 flex items-center justify-between">
                  <span className="text-stone-600">Vendas Registradas:</span>
                  <span className="font-bold text-emerald-900">{backupPreview.contagens.vendas}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/60 flex items-center justify-between">
                  <span className="text-stone-600">Fluxo de Caixa:</span>
                  <span className="font-bold text-blue-900">{backupPreview.contagens.caixa}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200/60 flex items-center justify-between">
                  <span className="text-stone-600">Fiados / Clientes:</span>
                  <span className="font-bold text-purple-900">{backupPreview.contagens.fiados}</span>
                </div>
              </div>
            </div>

            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Ao confirmar, todos os dados atuais do sistema serão substituídos pelos dados deste arquivo e imediatamente sincronizados com a nuvem Firebase.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBackupPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={importandoBackup}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 font-semibold text-xs text-stone-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarImportacao}
                disabled={importandoBackup}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {importandoBackup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar e Restaurar Dados</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SENHA & SUPABASE (Configurações Secundárias) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: SQL Script for Supabase (Col 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-stone-700" />
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  Script de Migration V2 para Supabase (Opcional)
                </h2>
                <p className="text-[11px] text-stone-400">
                  Caso deseje espelhar os dados também em um PostgreSQL próprio no Supabase
                </p>
              </div>
            </div>

            <button
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition active:scale-95 cursor-pointer shadow-xs"
            >
              {copiadoSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar SQL</span>
                </>
              )}
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-stone-950 text-stone-300 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed border border-stone-800">
              {SCHEMA_V2_SQL}
            </pre>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs text-stone-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-stone-900">Nota sobre Banco de Dados:</p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-800 hover:text-amber-950 font-medium inline-flex items-center gap-1"
              >
                <span>Painel Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-stone-600 text-[11px]">
              O sistema já está conectado e persistindo dados em tempo real no <strong>Firebase Firestore</strong>. A integração com o Supabase é opcional para quem deseja manter simultaneamente uma cópia em banco relacional SQL.
            </p>
          </div>
        </div>

        {/* Right Side: Credentials & Password (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Master Password Management */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-stone-900">
                Senha de Acesso (APP_PASSWORD)
              </h2>
            </div>

            <p className="text-xs text-stone-500">
              Senha que a dona da Lima Semijoias usa para desbloquear o sistema (Padrão: <span className="font-mono font-bold text-stone-700">123456</span>).
            </p>

            <form onSubmit={handleAlterarSenha} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Nova senha (ex: 654321)"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {msgSenha && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{msgSenha}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs active:scale-98"
              >
                Alterar Senha do Sistema
              </button>
            </form>
          </div>

          {/* Supabase Connection Form */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-stone-700" />
                <h2 className="text-sm font-semibold text-stone-900">
                  Credenciais Supabase (Opcional)
                </h2>
              </div>
              <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-emerald-500' : 'bg-stone-300'}`} />
            </div>

            <form onSubmit={handleSalvarSupabase} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                  placeholder="sb_publishable_... ou eyJhbGciOi..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {msgConfig && (
                <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  supabaseConnected ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {supabaseConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>{msgConfig}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={testandoConexao}
                  className="flex-1 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition cursor-pointer shadow-xs active:scale-98 disabled:opacity-50"
                >
                  {testandoConexao ? 'Conectando...' : 'Salvar & Conectar'}
                </button>
                <button
                  type="button"
                  onClick={handleTestarConexao}
                  disabled={testandoConexao}
                  className="px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  Testar
                </button>
              </div>
            </form>

            {/* Sync actions when connected */}
            {supabaseConnected && (
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Sincronização Supabase:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSubirProdutosParaSupabase}
                    disabled={sincronizando}
                    className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-medium text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Enviar Produtos</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePuxarDadosSupabase}
                    disabled={sincronizando}
                    className="py-2 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-medium text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5 text-stone-600" />
                    <span>Baixar da Nuvem</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reset catalog option */}
          <div className="text-center pt-2">
            <button
              onClick={handleRestaurarPadrao}
              className="text-[11px] text-stone-400 hover:text-rose-600 inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restaurar catálogo inicial da boutique</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
