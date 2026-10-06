import React, { useState, useMemo } from 'react';
import { LancamentoFiado, ResumoClienteFiado, Venda, Produto } from '../types';
import { storage } from '../lib/storage';
import { 
  Users, 
  Search, 
  Plus, 
  Minus,
  CheckCircle2, 
  MessageCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trash2, 
  X, 
  AlertCircle,
  FileText,
  BadgeDollarSign,
  Package,
  Sparkles,
  Phone,
  Check,
  Calendar,
  RotateCcw,
  History,
  Layers
} from 'lucide-react';

interface ControleFiadoProps {
  fiados?: LancamentoFiado[];
  vendas?: Venda[];
  produtos?: Produto[];
  onRefresh: () => void;
}

export const ControleFiado: React.FC<ControleFiadoProps> = ({ 
  fiados, 
  vendas, 
  produtos: produtosProp, 
  onRefresh 
}) => {
  const [busca, setBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ResumoClienteFiado | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal: Registrar Pagamento / Baixa
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [pagamentoClienteNome, setPagamentoClienteNome] = useState('');
  const [pagamentoValor, setPagamentoValor] = useState('');
  const [pagamentoDescricao, setPagamentoDescricao] = useState('');
  const [pagamentoErro, setPagamentoErro] = useState<string | null>(null);
  const [pagamentoSalvando, setPagamentoSalvando] = useState(false);

  // Modal: Movimentar Conta Corrente (Acrescentar ou Remover Itens)
  const [modalMovimentoAberto, setModalMovimentoAberto] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState<'acrescentar' | 'remover'>('acrescentar');
  const [clienteNomeInput, setClienteNomeInput] = useState('');
  const [clienteWhatsappInput, setClienteWhatsappInput] = useState('');
  
  // Modos de seleção: 'historico' (itens já comprados pela cliente), 'catalogo', 'avulso'
  const [modoSelecao, setModoSelecao] = useState<'historico' | 'catalogo' | 'avulso'>('catalogo');
  
  // Catálogo
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [quantidadeItem, setQuantidadeItem] = useState(1);
  const [precoCustomizado, setPrecoCustomizado] = useState('');
  
  // Avulso
  const [descricaoAvulsa, setDescricaoAvulsa] = useState('');
  const [valorAvulso, setValorAvulso] = useState('');
  
  // Opção de devolver ao estoque na remoção
  const [devolverAoEstoque, setDevolverAoEstoque] = useState(true);

  // Item selecionado do histórico para remoção
  const [itemHistoricoSelecionado, setItemHistoricoSelecionado] = useState<LancamentoFiado | null>(null);

  const [movimentoErro, setMovimentoErro] = useState<string | null>(null);
  const [movimentoSalvando, setMovimentoSalvando] = useState(false);

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

  // Products from prop or storage
  const produtosLista = useMemo(() => {
    return produtosProp && produtosProp.length > 0 ? produtosProp : storage.getProdutos();
  }, [produtosProp]);

  // Filtered products for Catalog selection inside modal
  const produtosFiltradosModal = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase();
    if (!termo) return produtosLista.slice(0, 15);
    return produtosLista.filter(p => 
      p.nome.toLowerCase().includes(termo) ||
      p.codigo_barras.toLowerCase().includes(termo) ||
      p.categoria.toLowerCase().includes(termo)
    ).slice(0, 20);
  }, [produtosLista, buscaProduto]);

  // Summaries per client (Conta Corrente)
  const resumos = useMemo(() => {
    return storage.getResumoFiados();
  }, [fiados, vendas]);

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

  // Filtered client list for main search
  const resumosFiltrados = useMemo(() => {
    return resumos.filter(r => {
      const termo = busca.toLowerCase();
      const matchNome = r.cliente_nome.toLowerCase().includes(termo);
      const matchWhats = (r.cliente_whatsapp || '').includes(termo);
      return matchNome || matchWhats;
    });
  }, [resumos, busca]);

  // Target client summary for balance preview & previous items
  const clienteAlvoResumo = useMemo(() => {
    if (!clienteNomeInput.trim()) return null;
    return resumos.find(r => r.cliente_nome.trim().toUpperCase() === clienteNomeInput.trim().toUpperCase());
  }, [resumos, clienteNomeInput]);

  // Debits of target client (purchases available for removal)
  const itensCompradosCliente = useMemo(() => {
    if (!clienteAlvoResumo) return [];
    return clienteAlvoResumo.historico.filter(h => h.tipo === 'debito');
  }, [clienteAlvoResumo]);

  // Open modal: Acrescentar ou Remover
  const handleAbrirMovimento = (cliente?: ResumoClienteFiado, operacao: 'acrescentar' | 'remover' = 'acrescentar') => {
    setTipoOperacao(operacao);
    if (cliente) {
      setClienteNomeInput(cliente.cliente_nome);
      setClienteWhatsappInput(cliente.cliente_whatsapp || '');
      // If removing and client has previous debits, suggest the history view
      if (operacao === 'remover' && cliente.historico.some(h => h.tipo === 'debito')) {
        setModoSelecao('historico');
      } else {
        setModoSelecao('catalogo');
      }
    } else {
      setClienteNomeInput('');
      setClienteWhatsappInput('');
      setModoSelecao('catalogo');
    }

    setBuscaProduto('');
    setProdutoSelecionado(null);
    setQuantidadeItem(1);
    setPrecoCustomizado('');
    setDescricaoAvulsa('');
    setValorAvulso('');
    setDevolverAoEstoque(true);
    setItemHistoricoSelecionado(null);
    setMovimentoErro(null);
    setModalMovimentoAberto(true);
  };

  // Open payment modal
  const handleAbrirPagamento = (cliente: ResumoClienteFiado) => {
    setPagamentoClienteNome(cliente.cliente_nome);
    setPagamentoValor(cliente.saldo_devedor > 0 ? cliente.saldo_devedor.toString() : '');
    setPagamentoDescricao('Pagamento de conta corrente');
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

    setPagamentoSalvando(true);
    setPagamentoErro(null);

    try {
      const cliente = resumos.find(r => r.cliente_nome.toUpperCase() === pagamentoClienteNome.toUpperCase());

      await storage.addLancamentoFiado({
        cliente_nome: pagamentoClienteNome.trim(),
        cliente_whatsapp: cliente?.cliente_whatsapp,
        tipo: 'pagamento',
        valor: valorNum,
        descricao: pagamentoDescricao.trim() || 'Pagamento recebido na conta corrente'
      });

      // Automatically registers entry into store cash register
      await storage.addMovimentacaoCaixa({
        tipo: 'entrada',
        valor: valorNum,
        descricao: `Recebimento de conta corrente - ${pagamentoClienteNome.trim()}`
      });

      setModalPagamentoAberto(false);
      onRefresh();
      showToast(`Pagamento de ${formatCurrency(valorNum)} recebido com sucesso!`);

      // Update statement view if open
      if (clienteSelecionado) {
        const atualizados = storage.getResumoFiados();
        const atual = atualizados.find(r => r.cliente_nome.toUpperCase() === pagamentoClienteNome.trim().toUpperCase());
        setClienteSelecionado(atual || null);
      }
    } catch (err: any) {
      setPagamentoErro(err?.message || 'Erro ao salvar pagamento.');
    } finally {
      setPagamentoSalvando(false);
    }
  };

  // Select a product from catalog
  const handleSelecionarProdutoCatalogo = (p: Produto) => {
    setProdutoSelecionado(p);
    setQuantidadeItem(1);
    setPrecoCustomizado(p.preco.toFixed(2).replace('.', ','));
  };

  // Select an item from customer's previous debits for removal
  const handleSelecionarItemHistorico = (item: LancamentoFiado) => {
    setItemHistoricoSelecionado(item);
    setDescricaoAvulsa(item.descricao || 'Item da conta');
    setValorAvulso(item.valor.toFixed(2).replace('.', ','));
    if (item.produto_id) {
      const p = produtosLista.find(prod => prod.id === item.produto_id);
      if (p) {
        setProdutoSelecionado(p);
        setQuantidadeItem(item.quantidade || 1);
        setPrecoCustomizado((item.valor / (item.quantidade || 1)).toFixed(2).replace('.', ','));
      }
    }
  };

  // Calculated subtotal for the item being added or removed
  const valorTotalOperacao = useMemo(() => {
    if (modoSelecao === 'catalogo') {
      if (!produtoSelecionado) return 0;
      const precoNum = parseFloat(precoCustomizado.replace(',', '.')) || produtoSelecionado.preco;
      return Number((quantidadeItem * precoNum).toFixed(2));
    } else if (modoSelecao === 'historico') {
      if (itemHistoricoSelecionado) return itemHistoricoSelecionado.valor;
      const valNum = parseFloat(valorAvulso.replace(',', '.'));
      return isNaN(valNum) ? 0 : valNum;
    } else {
      const valNum = parseFloat(valorAvulso.replace(',', '.'));
      return isNaN(valNum) ? 0 : valNum;
    }
  }, [modoSelecao, produtoSelecionado, quantidadeItem, precoCustomizado, valorAvulso, itemHistoricoSelecionado]);

  // Projected new balance
  const novoSaldoProjetado = useMemo(() => {
    const saldoAtual = clienteAlvoResumo ? clienteAlvoResumo.saldo_devedor : 0;
    if (tipoOperacao === 'acrescentar') {
      return Number((saldoAtual + valorTotalOperacao).toFixed(2));
    } else {
      return Number(Math.max(0, saldoAtual - valorTotalOperacao).toFixed(2));
    }
  }, [clienteAlvoResumo, tipoOperacao, valorTotalOperacao]);

  // Save addition OR removal
  const handleSalvarMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNomeInput.trim()) {
      setMovimentoErro('Informe ou selecione o nome da cliente.');
      return;
    }

    if (modoSelecao === 'catalogo') {
      if (!produtoSelecionado) {
        setMovimentoErro('Selecione uma peça do catálogo.');
        return;
      }
      if (quantidadeItem <= 0) {
        setMovimentoErro('A quantidade deve ser de no mínimo 1 unidade.');
        return;
      }
      if (valorTotalOperacao <= 0) {
        setMovimentoErro('O valor da peça deve ser maior que zero.');
        return;
      }
    } else if (modoSelecao === 'historico') {
      if (!itemHistoricoSelecionado && valorTotalOperacao <= 0) {
        setMovimentoErro('Selecione uma peça comprada pela cliente ou informe o valor.');
        return;
      }
    } else {
      if (!descricaoAvulsa.trim()) {
        setMovimentoErro('Digite a descrição da peça.');
        return;
      }
      if (valorTotalOperacao <= 0) {
        setMovimentoErro('Digite um valor válido para o lançamento.');
        return;
      }
    }

    setMovimentoSalvando(true);
    setMovimentoErro(null);

    try {
      let descricaoFinal = '';
      let prodId: string | undefined = undefined;
      let qtd: number | undefined = undefined;

      if (modoSelecao === 'catalogo' && produtoSelecionado) {
        prodId = produtoSelecionado.id;
        qtd = quantidadeItem;
        descricaoFinal = `${quantidadeItem}x ${produtoSelecionado.nome}`;
      } else if (modoSelecao === 'historico' && itemHistoricoSelecionado) {
        prodId = itemHistoricoSelecionado.produto_id;
        qtd = itemHistoricoSelecionado.quantidade || 1;
        descricaoFinal = itemHistoricoSelecionado.descricao || 'Devolução de peça comprada';
      } else {
        descricaoFinal = descricaoAvulsa.trim();
      }

      if (tipoOperacao === 'acrescentar') {
        // ACRESCENTAR: Débito na conta + baixa no estoque
        await storage.acrescentarContaCorrente({
          cliente_nome: clienteNomeInput.trim(),
          cliente_whatsapp: clienteWhatsappInput.trim() || undefined,
          descricao: descricaoFinal,
          valor: valorTotalOperacao,
          produto_id: prodId,
          quantidade: qtd
        });

        showToast(`Item de ${formatCurrency(valorTotalOperacao)} acrescentado à conta de ${clienteNomeInput.trim()}!`);
      } else {
        // REMOVER: Abatimento/estorno da conta + devolução ao estoque se marcado
        await storage.removerItemContaCorrente({
          cliente_nome: clienteNomeInput.trim(),
          cliente_whatsapp: clienteWhatsappInput.trim() || undefined,
          descricao: descricaoFinal,
          valor: valorTotalOperacao,
          produto_id: prodId,
          quantidade: qtd,
          devolverAoEstoque: devolverAoEstoque
        });

        showToast(`Item de ${formatCurrency(valorTotalOperacao)} removido da conta com sucesso!`);
      }

      setModalMovimentoAberto(false);
      onRefresh();

      // Update statement view if open for this client
      if (clienteSelecionado && clienteSelecionado.cliente_nome.trim().toUpperCase() === clienteNomeInput.trim().toUpperCase()) {
        const atualizados = storage.getResumoFiados();
        const atual = atualizados.find(r => r.cliente_nome.toUpperCase() === clienteNomeInput.trim().toUpperCase());
        setClienteSelecionado(atual || null);
      }
    } catch (err: any) {
      setMovimentoErro(err?.message || `Erro ao ${tipoOperacao === 'acrescentar' ? 'acrescentar' : 'remover'} item da conta.`);
    } finally {
      setMovimentoSalvando(false);
    }
  };

  // WhatsApp statement message
  const handleCobrarWhatsApp = (cliente: ResumoClienteFiado) => {
    const rawNumber = (cliente.cliente_whatsapp || '').replace(/\D/g, '');
    const cleanNumber = rawNumber.length >= 10 && !rawNumber.startsWith('55') ? `55${rawNumber}` : rawNumber;

    const msg = `Olá, ${cliente.cliente_nome}! Tudo bem? ✨\n\n` +
      `Passando para te enviar o extrato da sua *Conta Corrente* na *Lima Semijoias*.\n` +
      `O seu saldo em aberto atual é de *${formatCurrency(cliente.saldo_devedor)}*.\n\n` +
      `Caso queira acertar por Pix, é só me avisar que te envio a chave, tá bom? Muito obrigada pelo carinho e preferência! 💛`;

    const encodedMsg = encodeURIComponent(msg);
    const link = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    window.open(link, '_blank');
  };

  // Direct remove/delete of a transaction in Statement or Modal
  const handleExcluirLancamento = async (id: string, descricao?: string) => {
    await storage.deleteLancamentoFiado(id, true);
    onRefresh();
    if (clienteSelecionado) {
      const atualizados = storage.getResumoFiados();
      const atual = atualizados.find(r => r.cliente_nome === clienteSelecionado.cliente_nome);
      setClienteSelecionado(atual || null);
    }
    showToast(`Peça "${descricao || 'Item'}" removida da conta com sucesso e estoque reposto.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-stone-900 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner & Primary Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Conta Corrente de Clientes
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Controle comercial de compras a prazo e acertos. Acrescente ou remova peças da conta a qualquer momento com ajuste automático de estoque e sincronização em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Botão Acrescentar */}
          <button
            onClick={() => handleAbrirMovimento(undefined, 'acrescentar')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-stone-950 font-bold" />
            <span>+ Acrescentar Peça</span>
          </button>

          {/* Botão Remover / Devolver */}
          <button
            onClick={() => handleAbrirMovimento(undefined, 'remover')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-700 border border-stone-200 text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap min-h-[44px]"
          >
            <Minus className="w-4 h-4 text-rose-600 font-bold" />
            <span>− Remover Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Clean 3-grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Total em Aberto */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-xs bg-gradient-to-br from-white to-rose-50/30">
          <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
            Total em Aberto (A Receber)
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-rose-700 mt-1 tabular-nums">
            {formatCurrency(totalPendente)}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {totalClientesPendentes} {totalClientesPendentes === 1 ? 'cliente com saldo pendente' : 'clientes com saldo pendente'}
          </p>
        </div>

        {/* Clientes com Conta Aberta */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex sm:flex-col justify-between items-center sm:items-start">
          <div>
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Clientes com Conta Aberta
            </p>
            <p className="text-xl sm:text-2xl font-bold font-serif text-stone-900 mt-0.5 sm:mt-1 tabular-nums">
              {totalClientesPendentes} <span className="text-xs font-sans text-stone-500 font-normal">de {resumos.length} cadastradas</span>
            </p>
          </div>
          <p className="text-[11px] text-stone-400 hidden sm:block mt-0.5">
            Contas correntes ativas
          </p>
        </div>

        {/* Total Já Recebido */}
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
            Baixas e pagamentos efetuados
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
            placeholder="Buscar conta corrente por nome de cliente ou WhatsApp..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white transition min-h-[44px]"
          />
        </div>
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="text-xs text-stone-500 hover:text-stone-800 bg-stone-100 px-3.5 py-2.5 rounded-xl font-medium min-h-[44px] cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {resumosFiltrados.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-10 sm:p-12 text-center border border-dashed border-stone-300">
            <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">Nenhuma conta corrente de cliente encontrada</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Ao registrar uma venda escolhendo <strong>"Conta Corrente"</strong> no PDV ou clicando no botão <strong>"Acrescentar Peça"</strong>, a cliente aparecerá aqui.
            </p>
            <button
              onClick={() => handleAbrirMovimento(undefined, 'acrescentar')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Abrir Nova Conta Corrente</span>
            </button>
          </div>
        ) : (
          resumosFiltrados.map(cliente => {
            const devedor = cliente.saldo_devedor > 0;

            return (
              <div
                key={cliente.cliente_nome}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between shadow-xs ${
                  devedor ? 'border-amber-300/90 shadow-sm' : 'border-stone-200 opacity-90'
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
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{cliente.cliente_whatsapp}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-400 italic mt-0.5">Sem WhatsApp cadastrado</p>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                      devedor ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {devedor ? 'Saldo em Aberto' : 'Conta Zerada'}
                    </span>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-stone-50 p-3 rounded-xl space-y-1.5 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Total Comprado na Conta:</span>
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
                      <span className="font-bold text-stone-800">Saldo Atual da Conta:</span>
                      <span className={`text-lg font-bold font-serif tabular-nums ${
                        devedor ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {formatCurrency(cliente.saldo_devedor)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions: Acrescentar + Remover + Receber + Extrato */}
                <div className="pt-3.5 mt-3 border-t border-stone-100 space-y-2">
                  {/* Two Buttons: + Acrescentar Peça & − Remover Peça */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAbrirMovimento(cliente, 'acrescentar')}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5 min-h-[42px]"
                      title="Adicionar mais uma peça comprada na conta desta cliente"
                    >
                      <Plus className="w-3.5 h-3.5 font-bold" />
                      <span>+ Acrescentar</span>
                    </button>

                    <button
                      onClick={() => handleAbrirMovimento(cliente, 'remover')}
                      className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5 min-h-[42px]"
                      title="Remover ou devolver uma peça da conta desta cliente"
                    >
                      <Minus className="w-3.5 h-3.5 text-rose-600 font-bold" />
                      <span>− Remover</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAbrirPagamento(cliente)}
                      className="flex-1 py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5 min-h-[40px]"
                    >
                      <BadgeDollarSign className="w-4 h-4 text-emerald-400" />
                      <span>Dar Baixa / Receber</span>
                    </button>

                    <button
                      onClick={() => setClienteSelecionado(cliente)}
                      className="py-2 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1 min-h-[40px]"
                      title="Ver extrato completo da conta corrente"
                    >
                      <FileText className="w-4 h-4 text-stone-500" />
                      <span>Extrato</span>
                    </button>
                  </div>

                  {devedor && (
                    <button
                      onClick={() => handleCobrarWhatsApp(cliente)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[38px] active:scale-98"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Enviar Extrato no WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Client Statement (Extrato da Conta Corrente) */}
      {clienteSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-amber-200">
                  Extrato de Conta Corrente
                </h2>
                <p className="text-xs text-stone-300">
                  Cliente: <strong className="text-white">{clienteSelecionado.cliente_nome}</strong>
                </p>
              </div>
              <button
                onClick={() => setClienteSelecionado(null)}
                className="text-stone-400 hover:text-stone-100 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Summary Banner */}
            <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-900 font-semibold block">
                  Saldo em Aberto Atual
                </span>
                <span className={`text-xl font-bold font-serif tabular-nums ${
                  clienteSelecionado.saldo_devedor > 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}>
                  {formatCurrency(clienteSelecionado.saldo_devedor)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    handleAbrirMovimento(clienteSelecionado, 'acrescentar');
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Acrescentar</span>
                </button>

                <button
                  onClick={() => {
                    handleAbrirMovimento(clienteSelecionado, 'remover');
                  }}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl border border-rose-300 shadow-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Remover Item</span>
                </button>
              </div>
            </div>

            {/* Transactions Ledger */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-stone-100">
              {clienteSelecionado.historico.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">Nenhum lançamento registrado nesta conta.</p>
              ) : (
                clienteSelecionado.historico.map(item => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.tipo === 'debito' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.tipo === 'debito' ? (
                          <ArrowUpRight className="w-4 h-4 text-amber-700" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 truncate">
                          {item.tipo === 'debito' ? 'Peça / Compra na Conta' : (item.descricao?.includes('Devolução') ? 'Devolução / Estorno' : 'Pagamento / Baixa')}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {item.descricao || (item.tipo === 'debito' ? 'Lançamento a prazo' : 'Pagamento')}
                        </p>
                        <p className="text-[10px] text-stone-400 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{formatDate(item.created_at)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-bold tabular-nums text-xs sm:text-sm ${
                        item.tipo === 'debito' ? 'text-amber-950' : 'text-emerald-700'
                      }`}>
                        {item.tipo === 'debito' ? '+' : '-'} {formatCurrency(item.valor)}
                      </span>
                      <button
                        onClick={() => handleExcluirLancamento(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Remover/cancelar este item da conta e repor estoque"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  handleAbrirPagamento(clienteSelecionado);
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <BadgeDollarSign className="w-4 h-4 text-emerald-400" />
                <span>Receber Pagamento</span>
              </button>
              <button
                onClick={() => setClienteSelecionado(null)}
                className="px-4 py-2 text-stone-600 text-xs font-medium hover:bg-stone-200/60 rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Movimentar Conta Corrente (Acrescentar OU Remover Itens) */}
      {modalMovimentoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-stone-100">
              <div className="flex items-center gap-2">
                {tipoOperacao === 'acrescentar' ? (
                  <Plus className="w-5 h-5 text-amber-400" />
                ) : (
                  <Minus className="w-5 h-5 text-rose-400" />
                )}
                <div>
                  <h2 className="font-serif text-lg font-bold text-amber-200 leading-tight">
                    {tipoOperacao === 'acrescentar' 
                      ? 'Acrescentar à Conta Corrente' 
                      : 'Remover / Devolver Item da Conta'}
                  </h2>
                  <p className="text-xs text-stone-400">
                    {tipoOperacao === 'acrescentar'
                      ? 'Lançar nova compra e dar baixa no estoque'
                      : 'Abater valor da conta e devolver ao estoque'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalMovimentoAberto(false)}
                className="text-stone-400 hover:text-stone-100 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Operação Segmented Control: [ + Acrescentar ] vs [ − Remover ] */}
            <div className="p-3 bg-stone-100 border-b border-stone-200">
              <div className="grid grid-cols-2 gap-2 bg-stone-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setTipoOperacao('acrescentar');
                    if (modoSelecao === 'historico') setModoSelecao('catalogo');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipoOperacao === 'acrescentar'
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Plus className="w-4 h-4 font-bold" />
                  <span>Acrescentar Peça (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoOperacao('remover')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipoOperacao === 'remover'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Minus className="w-4 h-4 font-bold" />
                  <span>Remover / Devolver (−)</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSalvarMovimento} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {movimentoErro && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{movimentoErro}</span>
                </div>
              )}

              {/* Cliente Identification */}
              <div className="space-y-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nome da Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={clienteNomeInput}
                    onChange={e => setClienteNomeInput(e.target.value)}
                    placeholder="Digite ou selecione a cliente..."
                    list="clientes-sugestoes"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="clientes-sugestoes">
                    {resumos.map(r => (
                      <option key={r.cliente_nome} value={r.cliente_nome}>
                        {r.cliente_nome} (Saldo atual: {formatCurrency(r.saldo_devedor)})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    WhatsApp da Cliente (opcional)
                  </label>
                  <input
                    type="text"
                    value={clienteWhatsappInput}
                    onChange={e => setClienteWhatsappInput(e.target.value)}
                    placeholder="Ex: 11987654321"
                    className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {clienteAlvoResumo && (
                  <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Saldo Atual em Aberto:</span>
                    <span className="font-bold font-serif text-rose-700">
                      {formatCurrency(clienteAlvoResumo.saldo_devedor)}
                    </span>
                  </div>
                )}
              </div>

              {/* Peças Atualmente Compradas nesta Conta - Permite remoção direta com 1 clique */}
              {clienteAlvoResumo && itensCompradosCliente.length > 0 && (
                <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-700" />
                      <span>Peças Atuais na Conta ({itensCompradosCliente.length})</span>
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Clique em Remover para estornar
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5 divide-y divide-amber-100">
                    {itensCompradosCliente.map(item => (
                      <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-stone-900 truncate">
                            {item.descricao || 'Item da conta'}
                          </p>
                          <p className="text-[10px] text-stone-500">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-stone-900 tabular-nums">
                            {formatCurrency(item.valor)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleExcluirLancamento(item.id, item.descricao)}
                            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs"
                            title="Remover esta peça da conta e repor no estoque da loja"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modo de Seleção: 'historico' (se for remover), 'catalogo', 'avulso' */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  {tipoOperacao === 'acrescentar' ? 'O que a cliente pegou?' : 'Qual item deseja remover/devolver?'}
                </label>
                <div className={`grid gap-1.5 bg-stone-100 p-1 rounded-xl ${
                  tipoOperacao === 'remover' && itensCompradosCliente.length > 0 ? 'grid-cols-3' : 'grid-cols-2'
                }`}>
                  {tipoOperacao === 'remover' && itensCompradosCliente.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModoSelecao('historico')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        modoSelecao === 'historico'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <History className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Peças Compradas ({itensCompradosCliente.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setModoSelecao('catalogo')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                      modoSelecao === 'catalogo'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Peça do Catálogo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoSelecao('avulso')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                      modoSelecao === 'avulso'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Item Avulso / Valor</span>
                  </button>
                </div>
              </div>

              {/* Opção 1: Peças Compradas Anteriormente pela Cliente (Para Remoção Rápida) */}
              {tipoOperacao === 'remover' && modoSelecao === 'historico' && (
                <div className="space-y-2">
                  <p className="text-xs text-stone-500">
                    Selecione qual peça comprada a cliente está devolvendo ou deseja remover:
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-stone-200 rounded-xl p-2 bg-stone-50/50">
                    {itensCompradosCliente.map(item => {
                      const isSelected = itemHistoricoSelecionado?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelecionarItemHistorico(item)}
                          className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between gap-2.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-rose-100/90 border-rose-400 shadow-2xs'
                              : 'bg-white hover:bg-stone-100 border-stone-200/80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-stone-900 truncate">
                              {item.descricao || 'Item comprado'}
                            </p>
                            <p className="text-[10px] text-stone-500 flex items-center gap-1">
                              <span>{formatDate(item.created_at)}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-xs text-stone-900 tabular-nums block">
                              {formatCurrency(item.valor)}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-800 font-bold">
                                <Check className="w-3 h-3" /> Selecionado
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opção 2: Catálogo de Peças */}
              {modoSelecao === 'catalogo' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={buscaProduto}
                      onChange={e => setBuscaProduto(e.target.value)}
                      placeholder="Buscar por nome, código de barras ou categoria..."
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 focus:bg-white"
                    />
                  </div>

                  {/* Products Grid / Picker */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-stone-200 rounded-xl p-2 bg-stone-50/50">
                    {produtosFiltradosModal.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-4">Nenhuma peça encontrada.</p>
                    ) : (
                      produtosFiltradosModal.map(p => {
                        const isSelected = produtoSelecionado?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelecionarProdutoCatalogo(p)}
                            className={`w-full p-2 rounded-xl text-left transition flex items-center justify-between gap-2.5 cursor-pointer border ${
                              isSelected
                                ? (tipoOperacao === 'acrescentar' ? 'bg-amber-100/90 border-amber-400 shadow-2xs' : 'bg-rose-100/90 border-rose-400 shadow-2xs')
                                : 'bg-white hover:bg-stone-100 border-stone-200/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0 flex items-center justify-center">
                                <img
                                  src={p.imagem_url || '/logo-lima.jpg'}
                                  alt={p.nome}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/logo-lima.jpg';
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-stone-900 truncate">
                                  {p.nome}
                                </p>
                                <p className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                                  <span>{p.codigo_barras}</span>
                                  <span>·</span>
                                  <span className={p.quantidade_estoque <= 0 ? 'text-rose-600 font-bold' : 'text-stone-500'}>
                                    Estoque: {p.quantidade_estoque} un
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-xs text-stone-900 tabular-nums block">
                                {formatCurrency(p.preco)}
                              </span>
                              {isSelected && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-800 font-bold">
                                  <Check className="w-3 h-3" /> Selecionado
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Quantity and Price adjustment for selected product */}
                  {produtoSelecionado && (
                    <div className={`p-3 rounded-xl space-y-2.5 border ${
                      tipoOperacao === 'acrescentar' ? 'bg-amber-50/70 border-amber-300' : 'bg-rose-50/70 border-rose-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900">
                          {produtoSelecionado.nome}
                        </span>
                        <span className="text-xs font-mono text-stone-500">
                          Estoque atual: {produtoSelecionado.quantidade_estoque} un
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Quantidade:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQuantidadeItem(Math.max(1, quantidadeItem - 1))}
                              className="w-8 h-8 rounded-lg bg-white border border-stone-300 font-bold text-stone-700 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={quantidadeItem}
                              onChange={e => setQuantidadeItem(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-14 text-center py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setQuantidadeItem(quantidadeItem + 1)}
                              className="w-8 h-8 rounded-lg bg-white border border-stone-300 font-bold text-stone-700 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Preço Unitário (R$):
                          </label>
                          <input
                            type="text"
                            value={precoCustomizado}
                            onChange={e => setPrecoCustomizado(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Opção 3: Lançamento Avulso */}
              {modoSelecao === 'avulso' && (
                <div className="space-y-3 p-3 bg-stone-50 border border-stone-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      {tipoOperacao === 'acrescentar' ? 'Descrição da Peça / Motivo *' : 'Descrição do Item a Remover / Devolver *'}
                    </label>
                    <input
                      type="text"
                      required={modoSelecao === 'avulso'}
                      value={descricaoAvulsa}
                      onChange={e => setDescricaoAvulsa(e.target.value)}
                      placeholder={tipoOperacao === 'acrescentar' ? 'Ex: 1x Colar Gravatinha Banhado' : 'Ex: Devolução de 1x Colar Gravatinha'}
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Valor (R$) *
                    </label>
                    <input
                      type="text"
                      required={modoSelecao === 'avulso'}
                      value={valorAvulso}
                      onChange={e => setValorAvulso(e.target.value)}
                      placeholder="Ex: 89,90"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-mono text-stone-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Checkbox Devolver ao Estoque na Remoção */}
              {tipoOperacao === 'remover' && (produtoSelecionado || (itemHistoricoSelecionado && itemHistoricoSelecionado.produto_id)) && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="devolver-estoque-check"
                    checked={devolverAoEstoque}
                    onChange={e => setDevolverAoEstoque(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="devolver-estoque-check" className="text-xs text-emerald-950 font-medium cursor-pointer">
                    <span className="font-bold">Devolver peça ao estoque da loja</span>
                    <p className="text-[11px] text-emerald-800">
                      Irá acrescentar novamente {quantidadeItem} unidade(s) ao estoque desta semijoia no catálogo.
                    </p>
                  </label>
                </div>
              )}

              {/* Total & Projected Balance Card */}
              <div className="p-3.5 bg-stone-900 text-stone-100 rounded-xl space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-stone-400">
                    {tipoOperacao === 'acrescentar' ? 'Valor a Acrescentar:' : 'Valor a Abater / Remover:'}
                  </span>
                  <span className={`text-lg font-bold font-serif tabular-nums ${
                    tipoOperacao === 'acrescentar' ? 'text-amber-300' : 'text-rose-400'
                  }`}>
                    {tipoOperacao === 'acrescentar' ? '+' : '-'} {formatCurrency(valorTotalOperacao)}
                  </span>
                </div>

                {clienteAlvoResumo && (
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-stone-800 text-xs">
                    <span className="text-stone-400">Novo Saldo Devedor Previsto:</span>
                    <span className={`font-bold tabular-nums font-mono ${
                      novoSaldoProjetado > 0 ? 'text-amber-300' : 'text-emerald-400'
                    }`}>
                      {formatCurrency(novoSaldoProjetado)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMovimentoAberto(false)}
                  className="px-4 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={movimentoSalvando}
                  className={`px-5 py-2.5 disabled:opacity-50 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                    tipoOperacao === 'acrescentar'
                      ? 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {movimentoSalvando ? (
                    <span>Salvando...</span>
                  ) : tipoOperacao === 'acrescentar' ? (
                    <>
                      <Plus className="w-4 h-4 font-bold" />
                      <span>Confirmar e Acrescentar à Conta</span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-4 h-4 font-bold" />
                      <span>Confirmar e Remover da Conta</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Pagamento / Baixa */}
      {modalPagamentoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-stone-100">
              <h2 className="font-serif text-lg font-bold text-amber-200">
                Registrar Pagamento de Conta Corrente
              </h2>
              <button
                onClick={() => setModalPagamentoAberto(false)}
                className="text-stone-400 hover:text-stone-100 p-1 cursor-pointer"
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
                  Pode ser o valor total da dívida ou um pagamento parcial. Será registrado automaticamente no caixa da loja.
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
                  disabled={pagamentoSalvando}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  {pagamentoSalvando ? 'Gravando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
