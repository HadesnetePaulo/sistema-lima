import React, { useState, useMemo } from 'react';
import { LancamentoFiado, ResumoClienteFiado } from '../types';
import { storage } from '../lib/storage';
import { 
  Users, 
  Search, 
  Plus, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  MessageCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trash2, 
  X, 
  AlertCircle,
  FileText,
  BadgeDollarSign
} from 'lucide-react';

interface ControleFiadoProps {
  onRefresh: () => void;
}

export const ControleFiado: React.FC<ControleFiadoProps> = ({ onRefresh }) => {
  const [busca, setBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ResumoClienteFiado | null>(null);

  // Modal: Registrar Pagamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [pagamentoClienteNome, setPagamentoClienteNome] = useState('');
  const [pagamentoValor, setPagamentoValor] = useState('');
  const [pagamentoDescricao, setPagamentoDescricao] = useState('');
  const [pagamentoErro, setPagamentoErro] = useState<string | null>(null);

  // Modal: Novo Débito Manual
  const [modalNovoDebitoAberto, setModalNovoDebitoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoWhatsapp, setNovoWhatsapp] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novoDescricao, setNovoDescricao] = useState('');
  const [novoErro, setNovoErro] = useState<string | null>(null);

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

  // Get calculated summaries from storage
  const resumos = useMemo(() => {
    return storage.getResumoFiados();
  }, [storage.getFiados()]);

  // Overall metrics
  const totalPendente = useMemo(() => {
    return resumos
      .filter(r => r.saldo_devedor > 0)
      .reduce((sum, r) => sum + r.saldo_devedor, 0);
  }, [resumos]);

  const totalClientesPendentes = useMemo(() => {
    return resumos.filter(r => r.saldo_devedor > 0).length;
  }, [resumos]);

  const totalQuitado = useMemo(() => {
    return resumos.reduce((sum, r) => sum + r.total_pago, 0);
  }, [resumos]);

  // Filtered client list
  const resumosFiltrados = useMemo(() => {
    return resumos.filter(r => {
      const termo = busca.toLowerCase();
      const matchNome = r.cliente_nome.toLowerCase().includes(termo);
      const matchWhats = (r.cliente_whatsapp || '').includes(termo);
      return matchNome || matchWhats;
    });
  }, [resumos, busca]);

  // Open payment modal for a specific client
  const handleAbrirPagamento = (cliente: ResumoClienteFiado) => {
    setPagamentoClienteNome(cliente.cliente_nome);
    setPagamentoValor(cliente.saldo_devedor > 0 ? cliente.saldo_devedor.toString() : '');
    setPagamentoDescricao('Pagamento parcial/total de semijoias');
    setPagamentoErro(null);
    setModalPagamentoAberto(true);
  };

  // Save payment
  const handleSalvarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(pagamentoValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      setPagamentoErro('Digite um valor de pagamento válido.');
      return;
    }

    try {
      const cliente = resumos.find(r => r.cliente_nome.toUpperCase() === pagamentoClienteNome.toUpperCase());

      await storage.addLancamentoFiado({
        cliente_nome: pagamentoClienteNome.trim(),
        cliente_whatsapp: cliente?.cliente_whatsapp,
        tipo: 'pagamento',
        valor: valorNum,
        descricao: pagamentoDescricao.trim() || 'Pagamento recebido'
      });

      // Também registra automaticamente como entrada no caixa da loja
      await storage.addMovimentacaoCaixa({
        tipo: 'entrada',
        valor: valorNum,
        descricao: `Recebimento de fiado - ${pagamentoClienteNome.trim()}`
      });

      setModalPagamentoAberto(false);
      onRefresh();
    } catch (err: any) {
      setPagamentoErro(err?.message || 'Erro ao salvar pagamento.');
    }
  };

  // Save manual debit
  const handleSalvarNovoDebito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setNovoErro('Digite o nome da cliente.');
      return;
    }

    const valorNum = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      setNovoErro('Digite um valor válido.');
      return;
    }

    try {
      await storage.addLancamentoFiado({
        cliente_nome: novoNome.trim(),
        cliente_whatsapp: novoWhatsapp.trim() || undefined,
        tipo: 'debito',
        valor: valorNum,
        descricao: novoDescricao.trim() || 'Compra a prazo'
      });

      setModalNovoDebitoAberto(false);
      setNovoNome('');
      setNovoWhatsapp('');
      setNovoValor('');
      setNovoDescricao('');
      setNovoErro(null);
      onRefresh();
    } catch (err: any) {
      setNovoErro(err?.message || 'Erro ao registrar fiado.');
    }
  };

  // WhatsApp reminder message
  const handleCobrarWhatsApp = (cliente: ResumoClienteFiado) => {
    const rawNumber = (cliente.cliente_whatsapp || '').replace(/\D/g, '');
    const cleanNumber = rawNumber.length >= 10 && !rawNumber.startsWith('55') ? `55${rawNumber}` : rawNumber;

    const msg = `Olá, ${cliente.cliente_nome}! Tudo bem? ✨\n\n` +
      `Passando para te enviar o extrato das suas comprinhas na *Lima Semijoias*.\n` +
      `O seu saldo pendente atual é de *${formatCurrency(cliente.saldo_devedor)}*.\n\n` +
      `Caso queira acertar por Pix, é só me avisar que te envio a chave, tá bom? Muito obrigada pelo carinho e preferência! 💛`;

    const encodedMsg = encodeURIComponent(msg);
    const link = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    window.open(link, '_blank');
  };

  const handleExcluirLancamento = async (id: string) => {
    if (confirm('Deseja excluir este lançamento do histórico?')) {
      await storage.deleteLancamentoFiado(id);
      onRefresh();
      // Update selected client
      if (clienteSelecionado) {
        const atualizados = storage.getResumoFiados();
        const atual = atualizados.find(r => r.cliente_nome === clienteSelecionado.cliente_nome);
        setClienteSelecionado(atual || null);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Controle de Fiados & Crediário de Clientes
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Gestão de vendas a prazo e quitações da Lima Semijoias. Saldo devedor apurado <strong>automaticamente</strong>.
          </p>
        </div>

        <button
          onClick={() => {
            setNovoNome('');
            setNovoWhatsapp('');
            setNovoValor('');
            setNovoDescricao('');
            setNovoErro(null);
            setModalNovoDebitoAberto(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap min-h-[44px]"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Novo Débito Manual</span>
        </button>
      </div>

      {/* KPI Cards: Clean 3-grid on tablet/desktop, compact mobile friendly summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Total Pendente */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-xs bg-gradient-to-br from-white to-rose-50/30">
          <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
            Total a Receber (Em Aberto)
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-rose-700 mt-1 tabular-nums">
            {formatCurrency(totalPendente)}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {totalClientesPendentes} {totalClientesPendentes === 1 ? 'cliente com saldo pendente' : 'clientes com saldo pendente'}
          </p>
        </div>

        {/* Clientes com débito */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
          <div>
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Clientes com Débito
            </p>
            <p className="text-xl sm:text-2xl font-bold font-serif text-stone-900 mt-0.5 sm:mt-1 tabular-nums">
              {totalClientesPendentes} <span className="text-xs font-sans text-stone-500 font-normal">de {resumos.length} clientes</span>
            </p>
          </div>
          <p className="text-[11px] text-stone-400 hidden sm:block mt-0.5">
            Cadastradas no sistema
          </p>
        </div>

        {/* Total Quitado */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Total Já Recebido
            </p>
            <p className="text-xl sm:text-2xl font-bold font-serif text-emerald-800 mt-0.5 sm:mt-1 tabular-nums">
              {formatCurrency(totalQuitado)}
            </p>
          </div>
          <p className="text-[11px] text-stone-400 hidden sm:block mt-0.5">
            Baixas efetuadas
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou WhatsApp..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white transition min-h-[44px]"
          />
        </div>
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="text-xs text-stone-500 hover:text-stone-800 bg-stone-100 px-3.5 py-2.5 rounded-xl font-medium min-h-[44px]"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Clients Cards Grid: Generous padding, large touch targets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {resumosFiltrados.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-10 sm:p-12 text-center border border-dashed border-stone-300">
            <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">Nenhum cliente no controle de fiado</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Ao registrar uma venda escolhendo a forma <strong>"Fiado / A Prazo"</strong>, ela será lançada automaticamente aqui.
            </p>
          </div>
        ) : (
          resumosFiltrados.map(cliente => {
            const devedor = cliente.saldo_devedor > 0;

            return (
              <div
                key={cliente.cliente_nome}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between shadow-xs ${
                  devedor ? 'border-amber-300/90 shadow-sm' : 'border-stone-200 opacity-85'
                }`}
              >
                <div className="space-y-3">
                  {/* Top: Name, WhatsApp & Status */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-stone-100">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-stone-900 text-base leading-tight truncate">
                        {cliente.cliente_nome}
                      </h3>
                      {cliente.cliente_whatsapp ? (
                        <p className="text-xs text-stone-500 flex items-center gap-1 mt-1 font-mono">
                          <span>{cliente.cliente_whatsapp}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-400 italic mt-0.5">Sem WhatsApp cadastrado</p>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                      devedor ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {devedor ? 'Pendente' : 'Quitado'}
                    </span>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-stone-50 p-3 rounded-xl space-y-1.5 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Total Comprado:</span>
                      <span className="font-semibold text-stone-800 tabular-nums">
                        {formatCurrency(cliente.total_compras)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Total Já Pago:</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        {formatCurrency(cliente.total_pago)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
                      <span className="font-bold text-stone-800">Saldo Devedor:</span>
                      <span className={`text-lg font-bold font-serif tabular-nums ${
                        devedor ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {formatCurrency(cliente.saldo_devedor)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions: Generous touch buttons */}
                <div className="pt-3.5 mt-3 border-t border-stone-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAbrirPagamento(cliente)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <BadgeDollarSign className="w-4 h-4 text-amber-400" />
                      <span>Dar Baixa / Receber</span>
                    </button>

                    <button
                      onClick={() => setClienteSelecionado(cliente)}
                      className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
                      title="Ver extrato completo"
                    >
                      <FileText className="w-4 h-4 text-stone-500" />
                      <span>Extrato</span>
                    </button>
                  </div>

                  {devedor && (
                    <button
                      onClick={() => handleCobrarWhatsApp(cliente)}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[44px] active:scale-98"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Cobrar no WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Client Statement (Extrato de Lançamentos) */}
      {clienteSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-amber-200">
                  Extrato: {clienteSelecionado.cliente_nome}
                </h2>
                <p className="text-xs text-stone-400">
                  Saldo devedor atual:{' '}
                  <strong className="text-amber-300 font-mono">
                    {formatCurrency(clienteSelecionado.saldo_devedor)}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setClienteSelecionado(null)}
                className="text-stone-400 hover:text-stone-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-stone-100">
              {clienteSelecionado.historico.map(item => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      item.tipo === 'debito' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.tipo === 'debito' ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-stone-800">
                        {item.tipo === 'debito' ? 'Compra Fiada' : 'Pagamento Recebido'}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {formatDate(item.created_at)} {item.descricao && `· ${item.descricao}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`font-bold tabular-nums ${
                      item.tipo === 'debito' ? 'text-amber-900' : 'text-emerald-700'
                    }`}>
                      {item.tipo === 'debito' ? '+' : '-'} {formatCurrency(item.valor)}
                    </span>
                    <button
                      onClick={() => handleExcluirLancamento(item.id)}
                      className="p-1 text-stone-300 hover:text-rose-600 transition"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setClienteSelecionado(null);
                  handleAbrirPagamento(clienteSelecionado);
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition"
              >
                Dar Baixa de Pagamento
              </button>
              <button
                onClick={() => setClienteSelecionado(null)}
                className="px-4 py-2 text-stone-600 text-xs font-medium hover:bg-stone-200/60 rounded-xl transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Pagamento */}
      {modalPagamentoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-stone-100">
              <h2 className="font-serif text-lg font-bold text-amber-200">
                Registrar Pagamento de Fiado
              </h2>
              <button
                onClick={() => setModalPagamentoAberto(false)}
                className="text-stone-400 hover:text-stone-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarPagamento} className="p-6 space-y-4">
              {pagamentoErro && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pagamentoErro}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={pagamentoClienteNome}
                  onChange={e => setPagamentoClienteNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Valor Pago (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={pagamentoValor}
                  onChange={e => setPagamentoValor(e.target.value)}
                  placeholder="Ex: 100,00"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Pode ser o valor total da dívida ou um pagamento parcial.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Observação / Forma de Recebimento
                </label>
                <input
                  type="text"
                  value={pagamentoDescricao}
                  onChange={e => setPagamentoDescricao(e.target.value)}
                  placeholder="Ex: Pago via Pix, dinheiro, etc."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalPagamentoAberto(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Débito Manual */}
      {modalNovoDebitoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-stone-100">
              <h2 className="font-serif text-lg font-bold text-amber-200">
                Novo Lançamento de Fiado Manual
              </h2>
              <button
                onClick={() => setModalNovoDebitoAberto(false)}
                className="text-stone-400 hover:text-stone-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoDebito} className="p-6 space-y-4">
              {novoErro && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{novoErro}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome da Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Ex: Maria Eduarda"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  WhatsApp (DDD + Número)
                </label>
                <input
                  type="text"
                  value={novoWhatsapp}
                  onChange={e => setNovoWhatsapp(e.target.value)}
                  placeholder="Ex: 11987654321"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Valor da Compra Fiada (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={novoValor}
                  onChange={e => setNovoValor(e.target.value)}
                  placeholder="Ex: 150,00"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Descrição dos Itens / Motivo
                </label>
                <input
                  type="text"
                  value={novoDescricao}
                  onChange={e => setNovoDescricao(e.target.value)}
                  placeholder="Ex: 1x Colar Pérola + 1x Brinco Solitário"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoDebitoAberto(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Gravar Fiado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
