import React, { useState, useMemo } from 'react';
import { Venda } from '../types';
import { storage } from '../lib/storage';
import { 
  ReceiptText, 
  Search, 
  Eye, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  ShoppingBag, 
  CreditCard,
  Ban,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Package,
  ArrowRight
} from 'lucide-react';

interface HistoricoVendasProps {
  vendas: Venda[];
  onVerRecibo: (venda: Venda) => void;
  onRefresh?: () => void;
}

export const HistoricoVendas: React.FC<HistoricoVendasProps> = ({ 
  vendas, 
  onVerRecibo, 
  onRefresh 
}) => {
  const [busca, setBusca] = useState('');
  const [vendaParaCancelar, setVendaParaCancelar] = useState<Venda | null>(null);
  const [reporEstoqueCheck, setReporEstoqueCheck] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

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
      const matchCliente = (v.cliente_nome || '').toLowerCase().includes(termo);
      const matchItem = v.itens.some(i => i.nome_produto.toLowerCase().includes(termo));
      return matchId || matchForma || matchCliente || matchItem;
    });
  }, [vendas, busca]);

  // Execute sale cancellation
  const handleConfirmarCancelamento = async () => {
    if (!vendaParaCancelar) return;
    setCancelando(true);
    try {
      const ok = await storage.cancelarVenda(vendaParaCancelar.id, reporEstoqueCheck);
      if (ok) {
        setVendaParaCancelar(null);
        onRefresh?.();
        showToast(`Venda #${vendaParaCancelar.id} cancelada com sucesso! Peças devolvidas ao estoque.`);
      } else {
        alert('Não foi possível cancelar esta venda.');
      }
    } catch (err: any) {
      alert(`Erro ao cancelar venda: ${err?.message || 'Falha inesperada'}`);
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-stone-900 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
              Histórico Completo de Vendas & Recibos
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Consulte todas as vendas finalizadas, emita comprovantes de entrega no WhatsApp ou cancele/estorne vendas com reposição automática de estoque.
          </p>
        </div>
      </div>

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
            <p className="text-[11px] text-stone-400 mt-0.5">Semijoias faturadas</p>
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
            <p className="text-[11px] text-stone-400 mt-0.5">Média por venda</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por ID da venda, produto, cliente ou forma de pagamento..."
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white"
          />
        </div>
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="text-xs text-stone-500 hover:text-stone-800 bg-stone-100 px-3 py-2 rounded-xl cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Sales List Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Identificador</th>
                <th className="py-3 px-4">Data & Hora</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Itens Vendidos</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <ReceiptText className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    <p className="text-xs font-semibold text-stone-600">Nenhuma venda encontrada</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {busca ? 'Tente buscar com outros termos.' : 'Registre novas vendas na aba Nova Venda (PDV).'}
                    </p>
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map(venda => {
                  const qtdTotalItens = venda.itens.reduce((acc, i) => acc + i.quantidade, 0);

                  return (
                    <tr key={venda.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* ID */}
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 text-xs">
                        {venda.id}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-stone-500 whitespace-nowrap text-xs">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span>{formatDate(venda.created_at)}</span>
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        {venda.cliente_nome ? (
                          <div className="font-semibold text-stone-900 text-xs">
                            {venda.cliente_nome}
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400 italic">Balcão</span>
                        )}
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

                      {/* Actions: Comprovante + Cancelar Venda */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onVerRecibo(venda)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                            title="Mandar comprovante no WhatsApp"
                          >
                            <ReceiptText className="w-3.5 h-3.5" />
                            <span>Comprovante</span>
                          </button>

                          <button
                            onClick={() => {
                              setVendaParaCancelar(venda);
                              setReporEstoqueCheck(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
                            title="Cancelar esta venda e devolver peças ao estoque"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                            <span>Cancelar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Confirmar Cancelamento da Venda */}
      {vendaParaCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="font-serif text-lg font-bold text-amber-200">
                  Cancelar Venda #{vendaParaCancelar.id}
                </h3>
              </div>
              <button
                onClick={() => setVendaParaCancelar(null)}
                className="text-stone-400 hover:text-stone-100 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Sale Info Summary */}
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Data da Venda:</span>
                  <span className="font-semibold text-stone-800">{formatDate(vendaParaCancelar.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cliente:</span>
                  <span className="font-semibold text-stone-900">{vendaParaCancelar.cliente_nome || 'Balcão'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Forma de Pagamento:</span>
                  <span className="font-semibold text-stone-800">{vendaParaCancelar.forma_pagamento}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-stone-200">
                  <span className="font-bold text-stone-700">Valor Total:</span>
                  <span className="font-bold font-serif text-rose-700 text-sm">
                    {formatCurrency(vendaParaCancelar.total)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <span className="font-bold text-stone-700 block">Itens da Venda:</span>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-stone-200 rounded-xl p-2 bg-stone-50/50">
                  {vendaParaCancelar.itens.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-stone-100 last:border-0">
                      <span className="font-medium text-stone-800 truncate mr-2">
                        {it.quantidade}x {it.nome_produto}
                      </span>
                      <span className="font-mono text-stone-600 shrink-0">
                        {formatCurrency(it.quantidade * it.preco_unitario)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checkbox Devolver Peças ao Estoque */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="repor-estoque-venda"
                  checked={reporEstoqueCheck}
                  onChange={e => setReporEstoqueCheck(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                />
                <label htmlFor="repor-estoque-venda" className="text-xs text-emerald-950 font-medium cursor-pointer">
                  <span className="font-bold">Devolver todas as peças ao estoque da loja</span>
                  <p className="text-[11px] text-emerald-800">
                    O estoque do catálogo será reposto automaticamente com as quantidades vendidas.
                  </p>
                </label>
              </div>

              {/* Notice */}
              <p className="text-[11px] text-stone-500 leading-tight">
                * Caso a venda tenha sido feita em <strong>Conta Corrente</strong>, o débito correspondente será cancelado automaticamente da conta da cliente.
              </p>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={cancelando}
                  onClick={() => setVendaParaCancelar(null)}
                  className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Voltar / Não Cancelar
                </button>
                <button
                  type="button"
                  disabled={cancelando}
                  onClick={handleConfirmarCancelamento}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {cancelando ? (
                    <span>Cancelando...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirmar Cancelamento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
