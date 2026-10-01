import React, { useState, useMemo } from 'react';
import { Venda, MovimentacaoCaixa } from '../types';
import { storage } from '../lib/storage';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Code2,
  Copy,
  Check
} from 'lucide-react';

interface ModuloCaixaProps {
  vendas: Venda[];
  movimentacoes: MovimentacaoCaixa[];
  onRefresh: () => void;
}

type PeriodoFiltro = 'hoje' | '7dias' | 'mes' | 'personalizado' | 'todos';

export const ModuloCaixa: React.FC<ModuloCaixaProps> = ({
  vendas,
  movimentacoes,
  onRefresh
}) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalCodigoActionAberto, setModalCodigoActionAberto] = useState(false);
  const [abaMobileLista, setAbaMobileLista] = useState<'movimentacoes' | 'vendas'>('movimentacoes');

  // Form states
  const [formTipo, setFormTipo] = useState<'entrada' | 'saida'>('saida');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formErro, setFormErro] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper date filtering
  const isInPeriod = (dateString: string) => {
    if (periodo === 'todos') return true;
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (periodo === 'hoje') {
      return date >= today;
    }

    if (periodo === '7dias') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      return date >= sevenDaysAgo;
    }

    if (periodo === 'mes') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= firstDayOfMonth;
    }

    if (periodo === 'personalizado') {
      if (dataInicioPersonalizada) {
        const dIni = new Date(dataInicioPersonalizada);
        dIni.setHours(0, 0, 0, 0);
        if (date < dIni) return false;
      }
      if (dataFimPersonalizada) {
        const dFim = new Date(dataFimPersonalizada);
        dFim.setHours(23, 59, 59, 999);
        if (date > dFim) return false;
      }
      return true;
    }

    return true;
  };

  // Filtered sales and manual movements
  const vendasFiltradas = useMemo(() => {
    return vendas.filter(v => isInPeriod(v.created_at));
  }, [vendas, periodo]);

  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(m => isInPeriod(m.created_at));
  }, [movimentacoes, periodo]);

  // 1. Receita total das vendas
  const receitaVendas = useMemo(() => {
    return vendasFiltradas.reduce((sum, v) => sum + v.total, 0);
  }, [vendasFiltradas]);

  // 2. Entradas manuais (ex: aporte, suprimento de troco)
  const entradasManuais = useMemo(() => {
    return movimentacoesFiltradas
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.valor, 0);
  }, [movimentacoesFiltradas]);

  // Total entradas
  const totalEntradas = receitaVendas + entradasManuais;

  // 3. Saídas manuais (despesas, retiradas, sangrias, contas da loja)
  const totalSaidas = useMemo(() => {
    return movimentacoesFiltradas
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + m.valor, 0);
  }, [movimentacoesFiltradas]);

  // 4. Custo total dos produtos vendidos (preco_custo * quantidade)
  const custoProdutosVendidos = useMemo(() => {
    let custoTotal = 0;
    for (const v of vendasFiltradas) {
      for (const item of v.itens) {
        const custoUnit = item.preco_custo || 0;
        custoTotal += custoUnit * item.quantidade;
      }
    }
    return custoTotal;
  }, [vendasFiltradas]);

  // 5. Lucro Bruto e Ajustado por movimentações de caixa:
  // Lucro Bruto = Receita das vendas - Custo dos produtos vendidos (CMV)
  const lucroBruto = receitaVendas - custoProdutosVendidos;

  // Saldo das movimentações manuais de caixa (entradas - saídas)
  const saldoMovimentacoes = entradasManuais - totalSaidas;

  // Lucro Líquido Ajustado = Lucro Bruto + Saldo das Movimentações de Caixa
  const lucroLiquidoAjustado = lucroBruto + saldoMovimentacoes;

  // Saldo total bruto acumulado no caixa
  const saldoCaixa = totalEntradas - totalSaidas;

  // Save manual movement
  const handleSalvarMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescricao.trim()) {
      setFormErro('Digite uma descrição para o lançamento.');
      return;
    }

    const valorNum = parseFloat(formValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      setFormErro('Digite um valor válido maior que zero.');
      return;
    }

    try {
      await storage.addMovimentacaoCaixa({
        tipo: formTipo,
        valor: valorNum,
        descricao: formDescricao.trim()
      });

      setFormDescricao('');
      setFormValor('');
      setModalNovoAberto(false);
      setFormErro(null);
      onRefresh();
    } catch (err: any) {
      setFormErro(err?.message || 'Erro ao salvar movimentação.');
    }
  };

  const handleExcluirMovimentacao = async (id: string) => {
    if (confirm('Deseja excluir este lançamento de caixa?')) {
      await storage.deleteMovimentacaoCaixa(id);
      onRefresh();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Top Banner & Filter Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                Módulo de Caixa & Lucro (V2)
              </h1>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Entradas de vendas, saídas manuais e cálculo do lucro real.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalCodigoActionAberto(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs min-h-[42px]"
              title="Visualizar a Server Action Next.js 14 que realiza este cálculo"
            >
              <Code2 className="w-4 h-4 text-amber-700" />
              <span className="hidden sm:inline">Server Action</span>
            </button>

            <button
              onClick={() => {
                setFormTipo('saida');
                setFormValor('');
                setFormDescricao('');
                setFormErro(null);
                setModalNovoAberto(true);
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap min-h-[42px]"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Lançar Entrada / Saída</span>
            </button>
          </div>
        </div>

        {/* Period Selector: Smooth horizontal scrolling with thumb-friendly hit targets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar bg-stone-100 p-1.5 rounded-xl">
          <button
            onClick={() => setPeriodo('hoje')}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 min-h-[36px] flex items-center ${
              periodo === 'hoje' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriodo('7dias')}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 min-h-[36px] flex items-center ${
              periodo === '7dias' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            7 Dias
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 min-h-[36px] flex items-center ${
              periodo === 'mes' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Este Mês
          </button>
          <button
            onClick={() => setPeriodo('personalizado')}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 min-h-[36px] flex items-center ${
              periodo === 'personalizado' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Personalizado
          </button>
          <button
            onClick={() => setPeriodo('todos')}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 min-h-[36px] flex items-center ${
              periodo === 'todos' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Custom Date Filters when 'personalizado' is active */}
      {periodo === 'personalizado' && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-700" />
            <span className="font-semibold text-amber-950">Filtrar Intervalo Personalizado:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-stone-600">De:</label>
            <input
              type="date"
              value={dataInicioPersonalizada}
              onChange={e => setDataInicioPersonalizada(e.target.value)}
              className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-stone-600">Até:</label>
            <input
              type="date"
              value={dataFimPersonalizada}
              onChange={e => setDataFimPersonalizada(e.target.value)}
              className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-800"
            />
          </div>
          {(dataInicioPersonalizada || dataFimPersonalizada) && (
            <button
              onClick={() => {
                setDataInicioPersonalizada('');
                setDataFimPersonalizada('');
              }}
              className="px-2.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 underline font-medium"
            >
              Limpar datas
            </button>
          )}
        </div>
      )}

      {/* Executive Financial Overview: Hero Net Profit Card First */}
      <div className="space-y-3 sm:space-y-4">
        {/* HERO CARD: Lucro Líquido Real Ajustado */}
        <div className={`p-5 sm:p-6 rounded-3xl border shadow-lg transition-all ${
          lucroLiquidoAjustado >= 0 ? 'bg-gradient-to-br from-emerald-950 via-stone-900 to-stone-950 text-stone-100 border-emerald-800/80' : 'bg-gradient-to-br from-rose-950 via-stone-900 to-stone-950 text-stone-100 border-rose-800/80'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Lucro Líquido Real (V2)
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                lucroLiquidoAjustado >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {lucroLiquidoAjustado >= 0 ? 'Positivo' : 'Negativo'}
              </span>
            </div>

            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              lucroLiquidoAjustado >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {lucroLiquidoAjustado >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <p className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums tracking-tight">
              {formatCurrency(lucroLiquidoAjustado)}
            </p>
            <div className="text-xs text-stone-300 space-x-2">
              <span>Lucro Bruto: <strong className="text-white">{formatCurrency(lucroBruto)}</strong></span>
              <span>·</span>
              <span>Saldo Caixa: <strong className="text-white">{saldoMovimentacoes >= 0 ? '+' : ''}{formatCurrency(saldoMovimentacoes)}</strong></span>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 mt-2">
            Fórmula: Receita de Vendas ({formatCurrency(receitaVendas)}) - Custo das Peças ({formatCurrency(custoProdutosVendidos)}) - Saídas do Caixa ({formatCurrency(totalSaidas)}) + Entradas Manuais ({formatCurrency(entradasManuais)})
          </p>
        </div>

        {/* 3 Pillars: Entradas, Saídas, Custos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Entradas */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
            <div>
              <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold uppercase tracking-wider mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                <span>Total Entradas</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-serif text-stone-900 tabular-nums">
                {formatCurrency(totalEntradas)}
              </p>
            </div>
            <p className="text-[11px] text-stone-500 sm:mt-2 text-right sm:text-left">
              {vendasFiltradas.length} vendas {entradasManuais > 0 ? `+ ${formatCurrency(entradasManuais)} aportes` : ''}
            </p>
          </div>

          {/* Saídas e Despesas */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
            <div>
              <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold uppercase tracking-wider mb-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                <span>Saídas / Despesas</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-serif text-rose-700 tabular-nums">
                {formatCurrency(totalSaidas)}
              </p>
            </div>
            <p className="text-[11px] text-stone-500 sm:mt-2 text-right sm:text-left">
              {movimentacoesFiltradas.filter(m => m.tipo === 'saida').length} retiradas manuais
            </p>
          </div>

          {/* Custo dos Produtos */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
            <div>
              <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold uppercase tracking-wider mb-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                <span>Custo das Peças</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-serif text-stone-900 tabular-nums">
                {formatCurrency(custoProdutosVendidos)}
              </p>
            </div>
            <p className="text-[11px] text-stone-500 sm:mt-2 text-right sm:text-left">
              Soma de custo das peças vendidas
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Tab Toggle for Detailed Lists (Solves Mobile Clutter) */}
      <div className="lg:hidden flex bg-stone-200/90 p-1.5 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setAbaMobileLista('movimentacoes')}
          className={`flex-1 py-2.5 rounded-xl transition text-center min-h-[42px] ${
            abaMobileLista === 'movimentacoes'
              ? 'bg-white text-stone-950 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Lançamentos Caixa ({movimentacoesFiltradas.length})
        </button>
        <button
          onClick={() => setAbaMobileLista('vendas')}
          className={`flex-1 py-2.5 rounded-xl transition text-center min-h-[42px] ${
            abaMobileLista === 'vendas'
              ? 'bg-white text-stone-950 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Vendas com Lucro ({vendasFiltradas.length})
        </button>
      </div>

      {/* Detailed Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left: Manual Movements List (Col 7 on Desktop, conditional on Mobile) */}
        <div className={`lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-3.5 ${
          abaMobileLista !== 'movimentacoes' ? 'hidden lg:block' : ''
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Lançamentos do Caixa
              </h2>
              <p className="text-[11px] text-stone-400">Despesas, retiradas e suprimentos manuais</p>
            </div>
            <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
              {movimentacoesFiltradas.length} {movimentacoesFiltradas.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          <div className="divide-y divide-stone-100 max-h-[28rem] overflow-y-auto pr-1">
            {movimentacoesFiltradas.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                Nenhum lançamento manual de despesa ou suprimento neste período.
              </div>
            ) : (
              movimentacoesFiltradas.map(mov => (
                <div key={mov.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      mov.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {mov.tipo === 'entrada' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-stone-900 truncate">
                        {mov.descricao}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {formatDate(mov.created_at)} · {mov.tipo === 'entrada' ? 'Entrada / Aporte' : 'Saída / Despesa'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs sm:text-sm font-bold tabular-nums ${
                      mov.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {mov.tipo === 'entrada' ? '+' : '-'} {formatCurrency(mov.valor)}
                    </span>
                    <button
                      onClick={() => handleExcluirMovimentacao(mov.id)}
                      className="w-8 h-8 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition active:scale-95"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Sales Revenue in Period (Col 5 on Desktop, conditional on Mobile) */}
        <div className={`lg:col-span-5 bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-3.5 ${
          abaMobileLista !== 'vendas' ? 'hidden lg:block' : ''
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Vendas no Período
              </h2>
              <p className="text-[11px] text-stone-400">Receita e margem bruta por venda</p>
            </div>
            <span className="text-xs font-bold text-stone-800 bg-stone-100 px-2.5 py-1 rounded-lg tabular-nums">
              {formatCurrency(receitaVendas)}
            </span>
          </div>

          <div className="divide-y divide-stone-100 max-h-[28rem] overflow-y-auto pr-1">
            {vendasFiltradas.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                Nenhuma venda registrada no período selecionado.
              </div>
            ) : (
              vendasFiltradas.slice(0, 20).map(v => {
                const custoVenda = v.itens.reduce((sum, i) => sum + (i.preco_custo || 0) * i.quantidade, 0);
                const lucroVenda = v.total - custoVenda;

                return (
                  <div key={v.id} className="py-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-stone-800">{v.id}</span>
                        <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                          {v.forma_pagamento}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1">
                        {v.itens.length} {v.itens.length === 1 ? 'item' : 'itens'} · Custo:{' '}
                        <span className="text-stone-700 font-semibold">{formatCurrency(custoVenda)}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-stone-900 text-xs sm:text-sm tabular-nums">
                        {formatCurrency(v.total)}
                      </p>
                      <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${lucroVenda >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        Lucro: {formatCurrency(lucroVenda)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: View Next.js 14 Server Action Code */}
      {modalCodigoActionAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-stone-900 rounded-2xl shadow-2xl border border-stone-800 text-stone-100 flex flex-col max-h-[88vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-amber-100">
                    Server Action: calcularLucroPeriodo
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Next.js 14 (App Router) + Supabase (service_role no servidor)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`'use server';

import { createClient } from '@supabase/supabase-js';

export interface FiltroPeriodoLucro {
  dataInicio?: string | Date;
  dataFim?: string | Date;
}

export async function calcularLucroPeriodo(filtro?: FiltroPeriodoLucro) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const agora = new Date();
  const dInicio = filtro?.dataInicio ? new Date(filtro.dataInicio) : new Date(agora.getFullYear(), agora.getMonth(), 1);
  dInicio.setHours(0, 0, 0, 0);

  const dFim = filtro?.dataFim ? new Date(filtro.dataFim) : new Date();
  dFim.setHours(23, 59, 59, 999);

  // 1. Vendas com itens e preco_custo
  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select(\`
      id, total, created_at,
      itens_venda (
        quantidade, preco_unitario, preco_custo,
        produtos ( preco_custo )
      )
    \`)
    .gte('created_at', dInicio.toISOString())
    .lte('created_at', dFim.toISOString());

  if (errVendas) throw errVendas;

  // 2. Movimentações de caixa (entradas e saídas manuais)
  const { data: caixa, error: errCaixa } = await supabase
    .from('movimentacoes_caixa')
    .select('tipo, valor, created_at')
    .gte('created_at', dInicio.toISOString())
    .lte('created_at', dFim.toISOString());

  if (errCaixa) throw errCaixa;

  // 3. Cálculos
  let totalReceita = 0;
  let custoTotalItens = 0;

  for (const v of vendas || []) {
    totalReceita += Number(v.total || 0);
    for (const item of (v as any).itens_venda || []) {
      const qtd = Number(item.quantidade || 0);
      const custoUnit = Number(item.preco_custo || item.produtos?.preco_custo || 0);
      custoTotalItens += custoUnit * qtd;
    }
  }

  // 4. Saídas e Entradas de caixa
  let totalSaidas = 0;
  let totalEntradas = 0;
  for (const m of caixa || []) {
    const val = Number(m.valor || 0);
    if (m.tipo === 'saida') totalSaidas += val;
    else if (m.tipo === 'entrada') totalEntradas += val;
  }

  // 5. Lucro = Receita Total - Custo dos Itens Vendidos - Saídas do Caixa
  const lucroBruto = totalReceita - custoTotalItens;
  const lucroFinal = lucroBruto - totalSaidas;
  const saldoFinalAjustado = lucroFinal + totalEntradas;

  return {
    sucesso: true,
    periodo: { inicio: dInicio.toISOString(), fim: dFim.toISOString() },
    receitaTotalVendas: totalReceita,
    custoTotalItensVendidos: custoTotalItens,
    totalSaidasCaixa: totalSaidas,
    lucroFinal,
    saldoFinalAjustado
  };
}`);
                    alert('Código copiado para a área de transferência!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar TypeScript</span>
                </button>

                <button
                  onClick={() => setModalCodigoActionAberto(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-stone-950 font-mono text-xs text-stone-300 leading-relaxed">
              <pre className="overflow-x-auto">
{`'use server';

import { createClient } from '@supabase/supabase-js';

export interface FiltroPeriodoLucro {
  dataInicio?: string | Date;
  dataFim?: string | Date;
}

export async function calcularLucroPeriodo(filtro?: FiltroPeriodoLucro) {
  // Inicialização segura no servidor (Secret Key)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const agora = new Date();
  const dInicio = filtro?.dataInicio ? new Date(filtro.dataInicio) : new Date(agora.getFullYear(), agora.getMonth(), 1);
  dInicio.setHours(0, 0, 0, 0);

  const dFim = filtro?.dataFim ? new Date(filtro.dataFim) : new Date();
  dFim.setHours(23, 59, 59, 999);

  // 1. Busca vendas e itens no período filtrável
  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select(\`
      id, total, created_at,
      itens_venda (
        quantidade, preco_unitario, preco_custo,
        produtos ( preco_custo )
      )
    \`)
    .gte('created_at', dInicio.toISOString())
    .lte('created_at', dFim.toISOString());

  if (errVendas) throw errVendas;

  // 2. Busca movimentações manuais de caixa (entradas e saídas)
  const { data: caixa, error: errCaixa } = await supabase
    .from('movimentacoes_caixa')
    .select('tipo, valor, created_at')
    .gte('created_at', dInicio.toISOString())
    .lte('created_at', dFim.toISOString());

  if (errCaixa) throw errCaixa;

  // 3. Soma da receita e do custo (preco_custo * quantidade)
  let totalReceita = 0;
  let custoTotalItens = 0;

  for (const v of vendas || []) {
    totalReceita += Number(v.total || 0);
    for (const item of (v as any).itens_venda || []) {
      const qtd = Number(item.quantidade || 0);
      const custoUnit = Number(item.preco_custo || item.produtos?.preco_custo || 0);
      custoTotalItens += custoUnit * qtd;
    }
  }

  // 4. Saldo das movimentações de caixa
  let entradasManuais = 0;
  let saidasManuais = 0;
  for (const m of caixa || []) {
    const val = Number(m.valor || 0);
    if (m.tipo === 'entrada') entradasManuais += val;
    else if (m.tipo === 'saida') saidasManuais += val;
  }

  const saldoMovimentacoes = entradasManuais - saidasManuais;

  // 5. Lucro Bruto e Lucro Líquido Ajustado
  const lucroBruto = totalReceita - custoTotalItens;
  const lucroLiquidoAjustado = lucroBruto + saldoMovimentacoes;

  return {
    sucesso: true,
    periodo: { inicio: dInicio.toISOString(), fim: dFim.toISOString() },
    totalReceita,
    custoTotalItens,
    lucroBruto,
    saldoMovimentacoes,
    lucroLiquidoAjustado
  };
}`}
              </pre>
            </div>

            <div className="p-4 bg-stone-900 border-t border-stone-800 text-xs text-stone-400 flex items-center justify-between">
              <span>Arquivo criado em: <code className="text-amber-300 font-mono">src/actions/calcularLucro.ts</code></span>
              <button
                onClick={() => setModalCodigoActionAberto(false)}
                className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Movement */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-stone-100">
              <h2 className="font-serif text-lg font-bold text-amber-200">
                Lançar Movimentação de Caixa
              </h2>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-stone-400 hover:text-stone-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarMovimentacao} className="p-6 space-y-4">
              {formErro && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formErro}</span>
                </div>
              )}

              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Tipo de Lançamento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTipo('saida')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      formTipo === 'saida'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>Saída / Despesa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipo('entrada')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      formTipo === 'entrada'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>Entrada / Aporte</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Descrição *
                </label>
                <input
                  type="text"
                  required
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  placeholder="Ex: Embalagens, Frete, Retirada pessoal, Luz..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Valor (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={formValor}
                  onChange={e => setFormValor(e.target.value)}
                  placeholder="Ex: 85,00"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-mono"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
