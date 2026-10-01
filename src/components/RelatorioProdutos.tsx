import React, { useState, useMemo } from 'react';
import { Produto, Venda } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Search, 
  Calendar,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

interface RelatorioProdutosProps {
  produtos: Produto[];
  vendas: Venda[];
}

type PeriodoFiltro = 'hoje' | '7dias' | 'mes' | 'todos';

interface ProdutoPerformance {
  produto_id: string;
  nome: string;
  categoria: string;
  codigo_barras: string;
  preco: number;
  preco_custo: number;
  quantidade_estoque: number;
  imagem_url?: string;
  quantidade_vendida: number;
  faturamento: number;
  custo_total: number;
  lucro_bruto: number;
}

export const RelatorioProdutos: React.FC<RelatorioProdutosProps> = ({
  produtos,
  vendas
}) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [abaAtiva, setAbaAtiva] = useState<'mais_vendidos' | 'menos_vendidos'>('mais_vendidos');
  const [busca, setBusca] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
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

    return true;
  };

  // Aggregate sales by product_id
  const performanceProdutos = useMemo(() => {
    // 1. Filter sales by period
    const vendasNoPeriodo = vendas.filter(v => isInPeriod(v.created_at));

    // 2. Map of sales by product ID
    const vendasMap = new Map<string, { quantidade: number; faturamento: number; custo: number }>();

    for (const venda of vendasNoPeriodo) {
      for (const item of venda.itens) {
        const atual = vendasMap.get(item.produto_id) || { quantidade: 0, faturamento: 0, custo: 0 };
        const qtd = item.quantidade;
        const subtotal = item.quantidade * item.preco_unitario;
        const custo = (item.preco_custo || 0) * item.quantidade;

        vendasMap.set(item.produto_id, {
          quantidade: atual.quantidade + qtd,
          faturamento: atual.faturamento + subtotal,
          custo: atual.custo + custo
        });
      }
    }

    // 3. Build array combining all products from catalog
    const lista: ProdutoPerformance[] = produtos.map(prod => {
      const dadosVenda = vendasMap.get(prod.id) || { quantidade: 0, faturamento: 0, custo: 0 };
      const lucro = dadosVenda.faturamento - dadosVenda.custo;

      return {
        produto_id: prod.id,
        nome: prod.nome,
        categoria: prod.categoria,
        codigo_barras: prod.codigo_barras || '',
        preco: prod.preco,
        preco_custo: prod.preco_custo || 0,
        quantidade_estoque: prod.quantidade_estoque,
        imagem_url: prod.imagem_url,
        quantidade_vendida: dadosVenda.quantidade,
        faturamento: dadosVenda.faturamento,
        custo_total: dadosVenda.custo,
        lucro_bruto: lucro
      };
    });

    return lista;
  }, [produtos, vendas, periodo]);

  // Filtered and sorted list based on active tab and search
  const listaOrdenada = useMemo(() => {
    let result = performanceProdutos.filter(item => {
      const termo = busca.toLowerCase();
      return (
        item.nome.toLowerCase().includes(termo) ||
        item.categoria.toLowerCase().includes(termo) ||
        item.codigo_barras.toLowerCase().includes(termo)
      );
    });

    if (abaAtiva === 'mais_vendidos') {
      // Sort by sales descending
      result.sort((a, b) => b.quantidade_vendida - a.quantidade_vendida || b.faturamento - a.faturamento);
    } else {
      // Sort by sales ascending (least sold / unsold first)
      result.sort((a, b) => a.quantidade_vendida - b.quantidade_vendida || a.faturamento - b.faturamento);
    }

    return result;
  }, [performanceProdutos, abaAtiva, busca]);

  // Overall metric totals for period
  const totalPecasPeriodo = useMemo(() => {
    return performanceProdutos.reduce((sum, p) => sum + p.quantidade_vendida, 0);
  }, [performanceProdutos]);

  const faturamentoPeriodo = useMemo(() => {
    return performanceProdutos.reduce((sum, p) => sum + p.faturamento, 0);
  }, [performanceProdutos]);

  const produtosComVenda = useMemo(() => {
    return performanceProdutos.filter(p => p.quantidade_vendida > 0).length;
  }, [performanceProdutos]);

  const produtosSemVenda = useMemo(() => {
    return performanceProdutos.filter(p => p.quantidade_vendida === 0).length;
  }, [performanceProdutos]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header & Period Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              Relatório de Produtos & Vendas (V2)
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Ranking simples de mais e menos vendidos por quantidade total no período.
          </p>
        </div>

        {/* Period Selector: Smooth horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar bg-stone-100 p-1.5 rounded-xl self-start md:self-auto">
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
            onClick={() => setPeriodo('todos')}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 min-h-[36px] flex items-center ${
              periodo === 'todos' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todo o Histórico
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Peças Vendidas
          </p>
          <p className="text-xl sm:text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">
            {totalPecasPeriodo} <span className="text-xs font-sans text-stone-500 font-normal">unidades</span>
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Faturamento
          </p>
          <p className="text-xl sm:text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">
            {formatCurrency(faturamentoPeriodo)}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Com Venda
          </p>
          <p className="text-xl sm:text-2xl font-bold font-serif text-emerald-800 mt-1 tabular-nums">
            {produtosComVenda} <span className="text-xs font-sans text-stone-500 font-normal">modelos</span>
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
            Sem Venda
          </p>
          <p className="text-xl sm:text-2xl font-bold font-serif text-amber-800 mt-1 tabular-nums">
            {produtosSemVenda} <span className="text-xs font-sans text-stone-500 font-normal">encalhados</span>
          </p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
        {/* Tab & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbaAtiva('mais_vendidos')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                abaAtiva === 'mais_vendidos'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Mais Vendidos</span>
            </button>
            <button
              onClick={() => setAbaAtiva('menos_vendidos')}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                abaAtiva === 'menos_vendidos'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              <span>Menos Vendidos</span>
            </button>
          </div>

          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por semijoia ou categoria..."
              className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white min-h-[44px]"
            />
          </div>
        </div>

        {/* Mobile View: Pattern B Touch Cards for Rankings */}
        <div className="md:hidden divide-y divide-stone-100">
          {listaOrdenada.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              Nenhum produto correspondente aos filtros.
            </div>
          ) : (
            listaOrdenada.map((item, idx) => {
              const semVenda = item.quantidade_vendida === 0;

              return (
                <div key={item.produto_id} className="py-3.5 flex items-start gap-3">
                  {/* Position badge */}
                  <div className="shrink-0 pt-0.5">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs shadow-xs ${
                      idx === 0 && abaAtiva === 'mais_vendidos'
                        ? 'bg-amber-400 text-stone-950 font-serif text-sm'
                        : idx === 1 && abaAtiva === 'mais_vendidos'
                        ? 'bg-stone-300 text-stone-900 font-bold'
                        : idx === 2 && abaAtiva === 'mais_vendidos'
                        ? 'bg-amber-200 text-amber-900 font-bold'
                        : 'bg-stone-100 text-stone-600 font-mono text-[11px]'
                    }`}>
                      {idx + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-0.5">
                      <span className="font-semibold text-amber-800 uppercase">{item.categoria}</span>
                      {item.codigo_barras && (
                        <span className="font-mono bg-stone-100 px-1 py-0.2 rounded text-stone-600">
                          #{item.codigo_barras}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-stone-900 text-sm leading-snug">
                      {item.nome}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        semVenda ? 'bg-stone-100 text-stone-500' : 'bg-amber-100 text-amber-950'
                      }`}>
                        {item.quantidade_vendida} un vendidas
                      </span>

                      <span className="font-semibold text-stone-900 tabular-nums">
                        Fat: {formatCurrency(item.faturamento)}
                      </span>

                      {item.lucro_bruto > 0 && (
                        <span className="text-emerald-700 font-bold tabular-nums">
                          Lucro: {formatCurrency(item.lucro_bruto)}
                        </span>
                      )}

                      <span className="text-[11px] text-stone-400">
                        Estoque: {item.quantidade_estoque} un
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Posição</th>
                <th className="py-3 px-4">Semijoia</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-center">Qtd. Vendida</th>
                <th className="py-3 px-4">Faturamento</th>
                <th className="py-3 px-4">Lucro Estimado</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {listaOrdenada.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    Nenhum produto correspondente aos filtros.
                  </td>
                </tr>
              ) : (
                listaOrdenada.map((item, idx) => {
                  const semVenda = item.quantidade_vendida === 0;

                  return (
                    <tr key={item.produto_id} className="hover:bg-stone-50/80 transition-colors">
                      {/* Ranking badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                          idx === 0 && abaAtiva === 'mais_vendidos'
                            ? 'bg-amber-400 text-stone-950 font-serif'
                            : idx === 1 && abaAtiva === 'mais_vendidos'
                            ? 'bg-stone-300 text-stone-900'
                            : idx === 2 && abaAtiva === 'mais_vendidos'
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-stone-100 text-stone-500 font-mono text-[11px]'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center border border-stone-200">
                            {item.imagem_url ? (
                              <img
                                src={item.imagem_url}
                                alt={item.nome}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Sparkles className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-900 text-xs sm:text-sm">
                              {item.nome}
                            </p>
                            <p className="text-[10px] text-stone-400">
                              Venda: {formatCurrency(item.preco)} {item.preco_custo > 0 && `· Custo: ${formatCurrency(item.preco_custo)}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-stone-600 font-medium">
                        {item.categoria}
                      </td>

                      {/* Qtd Sold */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs tabular-nums ${
                          semVenda
                            ? 'bg-stone-100 text-stone-400'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {item.quantidade_vendida} un
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-4 font-bold text-stone-900 tabular-nums">
                        {formatCurrency(item.faturamento)}
                      </td>

                      {/* Profit */}
                      <td className="py-3 px-4 tabular-nums">
                        <span className={`font-semibold ${item.lucro_bruto > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                          {formatCurrency(item.lucro_bruto)}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                          item.quantidade_estoque <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : item.quantidade_estoque <= 3
                            ? 'bg-amber-100 text-amber-800'
                            : 'text-stone-700'
                        }`}>
                          {item.quantidade_estoque} un
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
