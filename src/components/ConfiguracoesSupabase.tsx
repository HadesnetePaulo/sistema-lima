import React, { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { storage } from '../lib/storage';
import { 
  getStoredSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection,
  pushProdutosToSupabase,
  SupabaseStatus
} from '../lib/supabase';

const SCHEMA_V2_SQL = `-- ============================================================================
-- LIMA SEMIJOIAS - MIGRATION V2 (Executar no SQL Editor do Supabase)
-- Adiciona preco_custo, modulo de caixa e controle de fiado sem quebrar dados existentes
-- ============================================================================

-- 1. ADICIONA PREÇO DE CUSTO EM PRODUTOS (pode ser 0/nulo nos existentes)
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2) DEFAULT 0 CHECK (preco_custo >= 0);

-- 2. ADICIONA PREÇO DE CUSTO CONGELADO EM ITENS_VENDA (para cálculo de lucro real)
ALTER TABLE public.itens_venda 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2) DEFAULT 0 CHECK (preco_custo >= 0);

-- 3. ADICIONA DADOS DO CLIENTE EM VENDAS (opcional para fiado/identificação)
ALTER TABLE public.vendas 
ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT;

-- 4. TABELA DE MOVIMENTAÇÕES DE CAIXA (Entradas manuais e Saídas/Retiradas/Despesas)
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_data ON public.movimentacoes_caixa(created_at DESC);

-- 5. TABELA DE CONTROLE DE FIADO (Lançamentos de compras a prazo e pagamentos)
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

-- 6. ATUALIZAÇÃO DA FUNÇÃO ATÔMICA: registrar_venda (V2)
-- Grava preco_custo nos itens vendidos e, se a forma for 'Fiado', cria lançamento automático
CREATE OR REPLACE FUNCTION public.registrar_venda(
  itens JSONB,
  forma_pagamento TEXT,
  p_cliente_nome TEXT DEFAULT NULL,
  p_cliente_whatsapp TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id TEXT;
  v_item RECORD;
  v_produto RECORD;
  v_total NUMERIC(10, 2) := 0;
  v_item_subtotal NUMERIC(10, 2);
  v_custo_unitario NUMERIC(10, 2);
  v_retorno JSONB;
BEGIN
  v_venda_id := 'VND-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');

  IF jsonb_array_length(itens) = 0 THEN
    RAISE EXCEPTION 'A lista de itens da venda não pode estar vazia.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(itens) AS x(produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = v_item.produto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    IF v_produto.quantidade_estoque < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%". Disponível: %, Solicitado: %.',
        v_produto.nome, v_produto.quantidade_estoque, v_item.quantidade;
    END IF;

    v_item_subtotal := v_produto.preco * v_item.quantidade;
    v_total := v_total + v_item_subtotal;
  END LOOP;

  INSERT INTO public.vendas (id, forma_pagamento, total, cliente_nome, cliente_whatsapp, created_at)
  VALUES (v_venda_id, forma_pagamento, v_total, p_cliente_nome, p_cliente_whatsapp, NOW());

  FOR v_item IN SELECT * FROM jsonb_to_recordset(itens) AS x(produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = v_item.produto_id;

    v_custo_unitario := COALESCE(v_produto.preco_custo, 0);

    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario, preco_custo)
    VALUES (v_venda_id, v_produto.id, v_produto.nome, v_item.quantidade, v_produto.preco, v_custo_unitario);

    UPDATE public.produtos
    SET quantidade_estoque = quantidade_estoque - v_item.quantidade
    WHERE id = v_produto.id;
  END LOOP;

  IF forma_pagamento ILIKE '%fiado%' AND p_cliente_nome IS NOT NULL AND trim(p_cliente_nome) <> '' THEN
    INSERT INTO public.fiados (cliente_nome, cliente_whatsapp, tipo, valor, descricao, venda_id, created_at)
    VALUES (
      trim(p_cliente_nome),
      trim(p_cliente_whatsapp),
      'debito',
      v_total,
      'Compra a prazo #' || v_venda_id,
      v_venda_id,
      NOW()
    );
  END IF;

  v_retorno := jsonb_build_object(
    'sucesso', true,
    'venda_id', v_venda_id,
    'total', v_total,
    'forma_pagamento', forma_pagamento,
    'cliente_nome', p_cliente_nome,
    'created_at', NOW()
  );

  RETURN v_retorno;
END;
$$;

-- Permissões
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;`;

interface ConfiguracoesSupabaseProps {
  onRefreshAll: () => void;
  supabaseConnected: boolean;
  setSupabaseConnected: (connected: boolean) => void;
}

export const ConfiguracoesSupabase: React.FC<ConfiguracoesSupabaseProps> = ({
  onRefreshAll,
  supabaseConnected,
  setSupabaseConnected
}) => {
  const [copiadoSql, setCopiadoSql] = useState(false);

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

  // Initial check on load
  useEffect(() => {
    if (supabaseUrl && supabaseKey) {
      testSupabaseConnection().then(res => {
        setStatusDetalhado(res);
        setSupabaseConnected(res.connected);
      });
    }
  }, []);

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

  // Export JSON Backup
  const handleExportarBackup = () => {
    const jsonStr = storage.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_lima_semijoias_v2_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON Backup
  const handleImportarBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const ok = storage.importBackup(content);
      if (ok) {
        alert('Backup importado com sucesso!');
        onRefreshAll();
      } else {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  };

  // Reset to default
  const handleRestaurarPadrao = () => {
    if (confirm('Deseja restaurar os produtos padrão do catálogo da Lima Semijoias?')) {
      storage.resetCatalogToDefault();
      onRefreshAll();
      alert('Catálogo padrão restaurado com sucesso!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Status */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
              Configurações, Backup & Supabase
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Gerenciamento de banco de dados na nuvem da Lima Semijoias, senha de acesso do balcão, cópia de segurança e migrações.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${
            supabaseConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${supabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{supabaseConnected ? 'Conectado ao Supabase' : 'Operando em Modo Local'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: SQL Script for Supabase (Col 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-stone-700" />
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  Script de Migration V2 (migration_v2.sql)
                </h2>
                <p className="text-[11px] text-stone-400">
                  Adiciona <code className="font-mono text-amber-800">preco_custo</code>, tabelas de Caixa e Fiado sem quebrar dados existentes
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
                  <span>Copiar SQL V2</span>
                </>
              )}
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-stone-950 text-stone-300 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-stone-800">
              {SCHEMA_V2_SQL}
            </pre>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-stone-700 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-amber-900">Como aplicar a Migration V2 no Supabase:</p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-800 hover:text-amber-950 font-medium inline-flex items-center gap-1"
              >
                <span>Abrir Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-stone-600 text-[11px]">
              <li>Acesse seu projeto no painel da Supabase.</li>
              <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong> &gt; <strong>New query</strong>.</li>
              <li>Cole o código SQL V2 copiado acima e clique em <strong>Run</strong>.</li>
              <li>Ele adicionará a coluna <code className="font-mono text-stone-800">preco_custo</code> em produtos, criará as tabelas <code className="font-mono text-stone-800">movimentacoes_caixa</code> e <code className="font-mono text-stone-800">fiados</code> sem apagar nada do que você já cadastrou na V1!</li>
            </ol>
          </div>
        </div>

        {/* Right Side: Credentials & Security (Col 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Supabase Connection Form */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-stone-900">
                  Configurar Credenciais
                </h2>
              </div>
              <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
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
                  API Key (publishable anon ou secret key)
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
                  Sincronização Nuvem:
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
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition cursor-pointer shadow-xs"
              >
                Alterar Senha do Sistema
              </button>
            </form>
          </div>

          {/* Backup & Restore */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
              <Download className="w-4 h-4 text-stone-700" />
              <h2 className="text-sm font-semibold text-stone-900">
                Backup dos Dados (JSON)
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportarBackup}
                className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar JSON</span>
              </button>

              <label className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Importar JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportarBackup}
                  className="hidden"
                />
              </label>
            </div>

            <button
              onClick={handleRestaurarPadrao}
              className="w-full py-2 text-[11px] text-stone-400 hover:text-rose-600 flex items-center justify-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restaurar catálogo inicial Lima Semijoias</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
