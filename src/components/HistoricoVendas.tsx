import React, { useState, useMemo } from 'react';
import { Venda } from '../types';
import { ReceiptText, Search, Eye, Calendar, Sparkles, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react';

interface HistoricoVendasProps {
  vendas: Venda[];
  onVerRecibo: (venda: Venda) => void;
}

export const HistoricoVendas: React.FC<HistoricoVendasProps> = ({ vendas, onVerRecibo }) => {
  const [busca, setBusca] = useState('');

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

  // Metrics
  const totalFaturamento = useMemo(() => {
    return vendas.reduce((sum, v) => sum + v.total, 0);
  }, [vendas]);

  const totalPecasVendidas = useMemo(() => {
    return vendas.reduce((sum, v) => {
      const pecasNaVenda = v.itens.reduce((acc, item) => acc + item.quantidade, 0);
      return sum + pecasNaVenda;
    }, 0);
  }, [vendas]);

  const ticketMedio = useMemo(() => {
    return vendas.length > 0 ? totalFaturamento / vendas.length : 0;
  }, [vendas, totalFaturamento]);

  // Filtered sales
  const vendasFiltradas = useMemo(() => {
    return vendas.filter(v => {
      const termo = busca.toLowerCase();
      const matchId = v.id.toLowerCase().includes(termo);
      const matchForma = v.forma_pagamento.toLowerCase().includes(termo);
      const matchItem = v.itens.some(i => i.nome_produto.toLowerCase().includes(termo));
      return matchId || matchForma || matchItem;
    });
  }, [vendas, busca]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Total Faturado
            </p>
            <p className="text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">
              {formatCurrency(totalFaturamento)}
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">Em {vendas.length} vendas registradas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Total Pieces */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Peças Vendidas
            </p>
            <p className="text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">
              {totalPecasVendidas} <span className="text-sm font-sans font-normal text-stone-500">un</span>
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">Baixa automática de estoque</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Average Ticket */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Ticket Médio
            </p>
            <p className="text-2xl font-bold font-serif text-stone-900 mt-1 tabular-nums">
              {formatCurrency(ticketMedio)}
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">Média por venda efetuada</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar venda por código (Ex: VND-), forma de pagamento ou nome de peça..."
            className="w-full pl-10 pr-4 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white"
          />
        </div>
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="text-xs text-stone-500 hover:text-stone-800 bg-stone-100 px-3 py-2 rounded-xl"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Comprovante</th>
                <th className="py-3 px-4">Data e Hora</th>
                <th className="py-3 px-4">Itens Vendidos</th>
                <th className="py-3 px-4">Forma de Pagamento</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4 text-right">Recibo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <ReceiptText className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">Nenhuma venda encontrada</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      As vendas finalizadas na aba "Nova Venda" aparecerão listadas aqui.
                    </p>
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map(venda => {
                  const qtdTotalItens = venda.itens.reduce((acc, i) => acc + i.quantidade, 0);

                  return (
                    <tr key={venda.id} className="hover:bg-stone-50/80 transition-colors">
                      {/* ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-stone-900">
                        {venda.id}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatDate(venda.created_at)}</span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4">
                        <div className="max-w-xs">
                          <p className="font-medium text-stone-800 line-clamp-1">
                            {venda.itens.map(i => `${i.quantidade}x ${i.nome_produto}`).join(', ')}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {qtdTotalItens} {qtdTotalItens === 1 ? 'peça' : 'peças'}
                          </p>
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 bg-stone-100 text-stone-700 rounded-full font-medium text-[11px]">
                          {venda.forma_pagamento}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 font-bold text-stone-900 tabular-nums text-sm">
                        {formatCurrency(venda.total)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onVerRecibo(venda)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Recibo</span>
                        </button>
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
