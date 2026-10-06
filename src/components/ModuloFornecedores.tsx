import React, { useState, useMemo } from 'react';
import { 
  Fornecedor, 
  PedidoCompra, 
  Produto, 
  StatusPedidoCompra, 
  ItemPedidoCompra 
} from '../types';
import { storage } from '../lib/storage';
import { 
  Truck, 
  Plus, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail, 
  MessageSquare, 
  Edit3, 
  Trash2, 
  Package, 
  DollarSign, 
  FileText, 
  Check, 
  X, 
  Filter, 
  BarChart3, 
  Download, 
  Boxes, 
  ExternalLink,
  ChevronDown,
  Building2,
  CalendarDays,
  ShoppingBag
} from 'lucide-react';
import { baixarArquivoCSV } from '../lib/csvExport';

interface ModuloFornecedoresProps {
  produtos: Produto[];
  fornecedores: Fornecedor[];
  pedidosCompra: PedidoCompra[];
  onRefresh: () => void;
  onNavegarParaEstoque?: (produtoId?: string) => void;
}

type SubTab = 'fornecedores' | 'pedidos' | 'relatorios';

const FORMAS_PAGAMENTO_SUGESTOES = [
  'Pix',
  'Boleto Bancário',
  'Cartão de Crédito',
  'Transferência Bancária',
  'À Vista',
  'Faturado 30 dias',
  'Faturado 30/60 dias'
];

export const ModuloFornecedores: React.FC<ModuloFornecedoresProps> = ({
  produtos,
  fornecedores,
  pedidosCompra,
  onRefresh,
  onNavegarParaEstoque
}) => {
  const [subTab, setSubTab] = useState<SubTab>('fornecedores');

  // --- BUSCA E FILTROS ---
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [buscaPedido, setBuscaPedido] = useState('');
  const [filtroStatusPedido, setFiltroStatusPedido] = useState<string>('todos');

  // --- MODAL FORNECEDOR ---
  const [modalFornecedorAberto, setModalFornecedorAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<Fornecedor | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');
  const [formCnpjCpf, setFormCnpjCpf] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPrazoMedio, setFormPrazoMedio] = useState('');
  const [formPedidoMinimo, setFormPedidoMinimo] = useState('');
  const [formFormasPagamento, setFormFormasPagamento] = useState<string[]>([]);
  const [novaFormaPagamento, setNovaFormaPagamento] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formErroFornecedor, setFormErroFornecedor] = useState<string | null>(null);

  // --- MODAL NOVO PEDIDO DE COMPRA ---
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [pedidoFornecedorId, setPedidoFornecedorId] = useState('');
  const [pedidoData, setPedidoData] = useState(() => new Date().toISOString().substring(0, 10));
  const [pedidoDataPrevista, setPedidoDataPrevista] = useState('');
  const [pedidoObservacoes, setPedidoObservacoes] = useState('');
  const [pedidoItens, setPedidoItens] = useState<Array<{
    produtoId: string;
    nomeProduto: string;
    quantidade: number;
    custoUnitario: number;
  }>>([]);
  const [itemSelecionadoProdutoId, setItemSelecionadoProdutoId] = useState('');
  const [itemQuantidade, setItemQuantidade] = useState('1');
  const [itemCustoUnitario, setItemCustoUnitario] = useState('');
  const [formErroPedido, setFormErroPedido] = useState<string | null>(null);

  // --- MODAL CONFIRMAÇÃO DE RECEBIMENTO ---
  const [pedidoRecebendo, setPedidoRecebendo] = useState<PedidoCompra | null>(null);
  const [recebidoPorNome, setRecebidoPorNome] = useState('Responsável da Loja');
  const [sucessoRecebimento, setSucessoRecebimento] = useState<string | null>(null);

  // --- FILTRO DE PERÍODO RELATÓRIO DE COMPRAS ---
  const [periodoRelatorio, setPeriodoRelatorio] = useState<'30dias' | 'mesAtual' | 'anoAtual' | 'todos'>('mesAtual');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return isoString;
    }
  };

  // Helper to check if order is delayed
  const isPedidoAtrasado = (pedido: PedidoCompra): boolean => {
    if (pedido.status === 'recebido' || pedido.status === 'cancelado') return false;
    if (!pedido.dataPrevistaEntrega) return false;
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const prevista = new Date(pedido.dataPrevistaEntrega);
      prevista.setHours(23, 59, 59, 999);
      return hoje > prevista;
    } catch {
      return false;
    }
  };

  const diasDeAtraso = (pedido: PedidoCompra): number => {
    if (!isPedidoAtrasado(pedido)) return 0;
    try {
      const hoje = new Date().getTime();
      const prevista = new Date(pedido.dataPrevistaEntrega).getTime();
      const diff = Math.floor((hoje - prevista) / (1000 * 60 * 60 * 24));
      return Math.max(1, diff);
    } catch {
      return 1;
    }
  };

  // -------------------------------------------------------------
  // HANDLERS FORNECEDOR
  // -------------------------------------------------------------
  const handleAbrirNovoFornecedor = () => {
    setFornecedorEditando(null);
    setFormNome('');
    setFormRazaoSocial('');
    setFormCnpjCpf('');
    setFormTelefone('');
    setFormWhatsapp('');
    setFormEmail('');
    setFormPrazoMedio('7');
    setFormPedidoMinimo('0');
    setFormFormasPagamento(['Pix', 'Boleto Bancário']);
    setNovaFormaPagamento('');
    setFormObservacoes('');
    setFormErroFornecedor(null);
    setModalFornecedorAberto(true);
  };

  const handleAbrirEditarFornecedor = (f: Fornecedor) => {
    setFornecedorEditando(f);
    setFormNome(f.nome || '');
    setFormRazaoSocial(f.razaoSocial || '');
    setFormCnpjCpf(f.cnpjOuCpf || '');
    setFormTelefone(f.telefone || '');
    setFormWhatsapp(f.whatsapp || '');
    setFormEmail(f.email || '');
    setFormPrazoMedio(f.prazoMedioEntregaDias ? String(f.prazoMedioEntregaDias) : '7');
    setFormPedidoMinimo(f.pedidoMinimo ? String(f.pedidoMinimo) : '0');
    setFormFormasPagamento(Array.isArray(f.formasPagamento) ? [...f.formasPagamento] : ['Pix']);
    setNovaFormaPagamento('');
    setFormObservacoes(f.observacoes || '');
    setFormErroFornecedor(null);
    setModalFornecedorAberto(true);
  };

  const handleToggleFormaPagamento = (forma: string) => {
    setFormFormasPagamento(prev => 
      prev.includes(forma) ? prev.filter(item => item !== forma) : [...prev, forma]
    );
  };

  const handleAdicionarFormaPersonalizada = () => {
    const trimmed = novaFormaPagamento.trim();
    if (trimmed && !formFormasPagamento.includes(trimmed)) {
      setFormFormasPagamento(prev => [...prev, trimmed]);
      setNovaFormaPagamento('');
    }
  };

  const handleSalvarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      setFormErroFornecedor('Informe o nome ou razão social do fornecedor.');
      return;
    }

    const prazoNum = parseInt(formPrazoMedio, 10);
    const pedidoMinNum = parseFloat(formPedidoMinimo.replace(',', '.'));

    try {
      if (fornecedorEditando) {
        await storage.updateFornecedor(fornecedorEditando.id, {
          nome: formNome.trim(),
          razaoSocial: formRazaoSocial.trim() || undefined,
          cnpjOuCpf: formCnpjCpf.trim() || undefined,
          telefone: formTelefone.trim() || undefined,
          whatsapp: formWhatsapp.trim() || undefined,
          email: formEmail.trim() || undefined,
          prazoMedioEntregaDias: !isNaN(prazoNum) && prazoNum >= 0 ? prazoNum : 7,
          pedidoMinimo: !isNaN(pedidoMinNum) && pedidoMinNum >= 0 ? pedidoMinNum : 0,
          formasPagamento: formFormasPagamento,
          observacoes: formObservacoes.trim() || undefined
        });
      } else {
        await storage.addFornecedor({
          nome: formNome.trim(),
          razaoSocial: formRazaoSocial.trim() || undefined,
          cnpjOuCpf: formCnpjCpf.trim() || undefined,
          telefone: formTelefone.trim() || undefined,
          whatsapp: formWhatsapp.trim() || undefined,
          email: formEmail.trim() || undefined,
          prazoMedioEntregaDias: !isNaN(prazoNum) && prazoNum >= 0 ? prazoNum : 7,
          pedidoMinimo: !isNaN(pedidoMinNum) && pedidoMinNum >= 0 ? pedidoMinNum : 0,
          formasPagamento: formFormasPagamento,
          observacoes: formObservacoes.trim() || undefined
        });
      }

      setModalFornecedorAberto(false);
      onRefresh();
    } catch (err: any) {
      setFormErroFornecedor(err?.message || 'Erro ao salvar fornecedor.');
    }
  };

  const handleExcluirFornecedor = async (id: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o fornecedor "${nome}"?`)) {
      await storage.deleteFornecedor(id);
      onRefresh();
    }
  };

  // -------------------------------------------------------------
  // HANDLERS PEDIDOS DE COMPRA
  // -------------------------------------------------------------
  const handleAbrirNovoPedido = (fornecedorIdPreselecionado?: string) => {
    const defaultFornId = fornecedorIdPreselecionado || (fornecedores[0]?.id || '');
    setPedidoFornecedorId(defaultFornId);
    
    const hojeStr = new Date().toISOString().substring(0, 10);
    setPedidoData(hojeStr);

    // Calcula previsão baseada no prazo médio do fornecedor
    const forn = fornecedores.find(f => f.id === defaultFornId);
    const prazo = forn?.prazoMedioEntregaDias || 7;
    const dataPrev = new Date();
    dataPrev.setDate(dataPrev.getDate() + prazo);
    setPedidoDataPrevista(dataPrev.toISOString().substring(0, 10));

    setPedidoObservacoes('');
    setPedidoItens([]);
    setItemSelecionadoProdutoId('');
    setItemQuantidade('5');
    setItemCustoUnitario('');
    setFormErroPedido(null);
    setModalNovoPedidoAberto(true);
  };

  // Quando muda o fornecedor no modal de pedido, recalcula previsão e reseta sugestões
  const handleMudarFornecedorPedido = (novoFornId: string) => {
    setPedidoFornecedorId(novoFornId);
    const forn = fornecedores.find(f => f.id === novoFornId);
    const prazo = forn?.prazoMedioEntregaDias || 7;
    const baseDate = pedidoData ? new Date(pedidoData) : new Date();
    baseDate.setDate(baseDate.getDate() + prazo);
    setPedidoDataPrevista(baseDate.toISOString().substring(0, 10));

    // Se houver produto selecionado, ajusta preço de custo para o do novo fornecedor
    if (itemSelecionadoProdutoId) {
      const prod = produtos.find(p => p.id === itemSelecionadoProdutoId);
      const vinculo = prod?.fornecedores?.find(v => v.fornecedorId === novoFornId);
      if (vinculo) {
        setItemCustoUnitario(String(vinculo.precoCusto));
      } else if (prod?.preco_custo) {
        setItemCustoUnitario(String(prod.preco_custo));
      }
    }
  };

  const handleSelecionarProdutoItem = (prodId: string) => {
    setItemSelecionadoProdutoId(prodId);
    const prod = produtos.find(p => p.id === prodId);
    if (!prod) return;

    // Busca se o produto já tem custo cadastrado com esse fornecedor
    const vinculo = prod.fornecedores?.find(v => v.fornecedorId === pedidoFornecedorId);
    if (vinculo && vinculo.precoCusto > 0) {
      setItemCustoUnitario(String(vinculo.precoCusto));
    } else if (prod.preco_custo && prod.preco_custo > 0) {
      setItemCustoUnitario(String(prod.preco_custo));
    } else {
      setItemCustoUnitario('');
    }
  };

  const handleAdicionarItemPedido = () => {
    if (!itemSelecionadoProdutoId) {
      setFormErroPedido('Selecione uma semijoia para incluir no pedido.');
      return;
    }
    const prod = produtos.find(p => p.id === itemSelecionadoProdutoId);
    if (!prod) return;

    const qtd = parseInt(itemQuantidade, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setFormErroPedido('Digite uma quantidade válida (1 ou mais).');
      return;
    }

    const custo = parseFloat(itemCustoUnitario.replace(',', '.'));
    if (isNaN(custo) || custo < 0) {
      setFormErroPedido('Digite um custo unitário válido.');
      return;
    }

    setFormErroPedido(null);

    // Se já estiver na lista, apenas soma quantidade
    setPedidoItens(prev => {
      const index = prev.findIndex(item => item.produtoId === prod.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          quantidade: copy[index].quantidade + qtd,
          custoUnitario: custo
        };
        return copy;
      }
      return [
        ...prev,
        {
          produtoId: prod.id,
          nomeProduto: prod.nome,
          quantidade: qtd,
          custoUnitario: custo
        }
      ];
    });

    // Limpa campos do item
    setItemSelecionadoProdutoId('');
    setItemQuantidade('5');
    setItemCustoUnitario('');
  };

  const handleRemoverItemPedido = (prodId: string) => {
    setPedidoItens(prev => prev.filter(i => i.produtoId !== prodId));
  };

  const totalCalculadoPedido = useMemo(() => {
    return pedidoItens.reduce((acc, item) => acc + (item.quantidade * item.custoUnitario), 0);
  }, [pedidoItens]);

  const fornecedorAtualDoPedido = useMemo(() => {
    return fornecedores.find(f => f.id === pedidoFornecedorId);
  }, [fornecedores, pedidoFornecedorId]);

  const handleSalvarNovoPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoFornecedorId) {
      setFormErroPedido('Selecione o fornecedor.');
      return;
    }
    if (pedidoItens.length === 0) {
      setFormErroPedido('Adicione ao menos um produto no pedido de compra.');
      return;
    }

    const forn = fornecedores.find(f => f.id === pedidoFornecedorId);

    const itensGravados: ItemPedidoCompra[] = pedidoItens.map(item => ({
      produtoId: item.produtoId,
      nomeProduto: item.nomeProduto,
      quantidade: item.quantidade,
      custoUnitario: item.custoUnitario,
      subtotal: Number((item.quantidade * item.custoUnitario).toFixed(2))
    }));

    try {
      await storage.addPedidoCompra({
        fornecedorId: pedidoFornecedorId,
        fornecedorNome: forn?.nome || 'Fornecedor',
        dataPedido: new Date(pedidoData).toISOString(),
        dataPrevistaEntrega: pedidoDataPrevista ? new Date(pedidoDataPrevista).toISOString() : new Date().toISOString(),
        status: 'solicitado',
        itens: itensGravados,
        valorTotal: Number(totalCalculadoPedido.toFixed(2)),
        observacoes: pedidoObservacoes.trim() || undefined
      });

      // Também sincroniza os vínculos dos produtos com esse fornecedor se ainda não tinham!
      for (const item of pedidoItens) {
        try {
          await storage.vincularOuAtualizarFornecedorNoProduto(
            item.produtoId,
            pedidoFornecedorId,
            item.custoUnitario
          );
        } catch (err) {
          console.warn('Aviso ao sincronizar vínculo no produto:', err);
        }
      }

      setModalNovoPedidoAberto(false);
      onRefresh();
    } catch (err: any) {
      setFormErroPedido(err?.message || 'Erro ao registrar pedido de compra.');
    }
  };

  // Status transitions
  const handleAlterarStatusRapido = async (pedidoId: string, novoStatus: StatusPedidoCompra) => {
    if (novoStatus === 'recebido') {
      const pedido = pedidosCompra.find(p => p.id === pedidoId);
      if (pedido) {
        setPedidoRecebendo(pedido);
        setRecebidoPorNome('Responsável da Loja');
      }
      return;
    }

    await storage.atualizarStatusPedidoCompra(pedidoId, novoStatus);
    onRefresh();
  };

  const handleConfirmarRecebimentoEstoque = async () => {
    if (!pedidoRecebendo) return;
    try {
      await storage.atualizarStatusPedidoCompra(
        pedidoRecebendo.id, 
        'recebido', 
        recebidoPorNome.trim() || 'Responsável da Loja'
      );
      setSucessoRecebimento(`Pedido #${pedidoRecebendo.id} recebido com sucesso! O estoque das semijoias foi somado automaticamente.`);
      setPedidoRecebendo(null);
      onRefresh();
      setTimeout(() => setSucessoRecebimento(null), 5000);
    } catch (err: any) {
      alert('Erro ao receber pedido: ' + err?.message);
    }
  };

  // -------------------------------------------------------------
  // LISTAS FILTRADAS
  // -------------------------------------------------------------
  const fornecedoresFiltrados = useMemo(() => {
    return fornecedores.filter(f => {
      const termo = buscaFornecedor.toLowerCase();
      return (
        f.nome.toLowerCase().includes(termo) ||
        (f.razaoSocial && f.razaoSocial.toLowerCase().includes(termo)) ||
        (f.cnpjOuCpf && f.cnpjOuCpf.toLowerCase().includes(termo)) ||
        (f.email && f.email.toLowerCase().includes(termo))
      );
    });
  }, [fornecedores, buscaFornecedor]);

  const pedidosFiltrados = useMemo(() => {
    return pedidosCompra.filter(p => {
      const termo = buscaPedido.toLowerCase();
      const matchBusca = 
        p.id.toLowerCase().includes(termo) ||
        (p.fornecedorNome && p.fornecedorNome.toLowerCase().includes(termo)) ||
        (p.itens && p.itens.some(i => i.nomeProduto.toLowerCase().includes(termo)));

      const matchStatus = 
        filtroStatusPedido === 'todos' 
          ? true 
          : filtroStatusPedido === 'atrasados' 
          ? isPedidoAtrasado(p) 
          : p.status === filtroStatusPedido;

      return matchBusca && matchStatus;
    });
  }, [pedidosCompra, buscaPedido, filtroStatusPedido]);

  // Alertas de Atraso
  const pedidosAtrasadosCount = useMemo(() => {
    return pedidosCompra.filter(p => isPedidoAtrasado(p)).length;
  }, [pedidosCompra]);

  // -------------------------------------------------------------
  // RELATÓRIOS
  // -------------------------------------------------------------
  // 1. Gasto total por fornecedor no período
  const dadosGastoPorFornecedor = useMemo(() => {
    const agora = new Date();
    let dataInicio: Date;

    if (periodoRelatorio === '30dias') {
      dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);
    } else if (periodoRelatorio === 'mesAtual') {
      dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    } else if (periodoRelatorio === 'anoAtual') {
      dataInicio = new Date(agora.getFullYear(), 0, 1);
    } else {
      dataInicio = new Date(2000, 0, 1); // todos
    }

    const pedidosNoPeriodo = pedidosCompra.filter(p => {
      if (p.status === 'cancelado') return false;
      try {
        const dt = new Date(p.dataPedido);
        return dt >= dataInicio;
      } catch {
        return true;
      }
    });

    const mapa = new Map<string, {
      fornecedorId: string;
      fornecedorNome: string;
      totalGasto: number;
      qtdPedidos: number;
      pedidosRecebidos: number;
      pedidosPendentes: number;
    }>();

    // Inicializa todos os fornecedores conhecidos
    for (const f of fornecedores) {
      mapa.set(f.id, {
        fornecedorId: f.id,
        fornecedorNome: f.nome,
        totalGasto: 0,
        qtdPedidos: 0,
        pedidosRecebidos: 0,
        pedidosPendentes: 0
      });
    }

    let totalGeralPeriodo = 0;

    for (const p of pedidosNoPeriodo) {
      totalGeralPeriodo += p.valorTotal;
      const reg = mapa.get(p.fornecedorId) || {
        fornecedorId: p.fornecedorId,
        fornecedorNome: p.fornecedorNome || 'Fornecedor',
        totalGasto: 0,
        qtdPedidos: 0,
        pedidosRecebidos: 0,
        pedidosPendentes: 0
      };

      reg.totalGasto += p.valorTotal;
      reg.qtdPedidos += 1;
      if (p.status === 'recebido') reg.pedidosRecebidos += 1;
      else reg.pedidosPendentes += 1;

      mapa.set(p.fornecedorId, reg);
    }

    const lista = Array.from(mapa.values())
      .filter(item => item.qtdPedidos > 0)
      .sort((a, b) => b.totalGasto - a.totalGasto);

    return {
      totalGeralPeriodo,
      totalPedidosPeriodo: pedidosNoPeriodo.length,
      lista
    };
  }, [pedidosCompra, fornecedores, periodoRelatorio]);

  // 2. Produtos com pedido pendente de recebimento
  const produtosPendentesDeRecebimento = useMemo(() => {
    const pedidosPendentes = pedidosCompra.filter(p => 
      ['solicitado', 'confirmado', 'em_transito'].includes(p.status)
    );

    const mapaProdutos = new Map<string, {
      produtoId: string;
      nomeProduto: string;
      categoria: string;
      imagem_url?: string;
      estoqueAtual: number;
      estoqueMinimo: number;
      quantidadePendente: number;
      pedidosDetalhados: Array<{
        pedidoId: string;
        fornecedorNome: string;
        quantidade: number;
        dataPrevista: string;
        atrasado: boolean;
      }>;
    }>();

    for (const p of pedidosPendentes) {
      const atrasado = isPedidoAtrasado(p);
      if (Array.isArray(p.itens)) {
        for (const item of p.itens) {
          const prodInfo = produtos.find(prod => prod.id === item.produtoId);
          const registro = mapaProdutos.get(item.produtoId) || {
            produtoId: item.produtoId,
            nomeProduto: item.nomeProduto || prodInfo?.nome || 'Produto',
            categoria: prodInfo?.categoria || 'Semijoias',
            imagem_url: prodInfo?.imagem_url,
            estoqueAtual: prodInfo?.quantidade_estoque ?? 0,
            estoqueMinimo: prodInfo?.estoque_minimo ?? 3,
            quantidadePendente: 0,
            pedidosDetalhados: []
          };

          registro.quantidadePendente += item.quantidade;
          registro.pedidosDetalhados.push({
            pedidoId: p.id,
            fornecedorNome: p.fornecedorNome || 'Fornecedor',
            quantidade: item.quantidade,
            dataPrevista: p.dataPrevistaEntrega,
            atrasado
          });

          mapaProdutos.set(item.produtoId, registro);
        }
      }
    }

    return Array.from(mapaProdutos.values()).sort((a, b) => a.estoqueAtual - b.estoqueAtual);
  }, [pedidosCompra, produtos]);

  // Exportação CSV do relatório de fornecedores
  const handleExportarCSVFornecedores = () => {
    const linhas = [
      ['Fornecedor', 'CNPJ/CPF', 'Telefone', 'Email', 'Prazo Médio (Dias)', 'Pedido Mínimo (R$)', 'Total de Pedidos', 'Total Gasto (R$)'].join(';')
    ];

    for (const f of fornecedores) {
      const gasto = pedidosCompra
        .filter(p => p.fornecedorId === f.id && p.status !== 'cancelado')
        .reduce((acc, p) => acc + p.valorTotal, 0);
      const totalPedidos = pedidosCompra.filter(p => p.fornecedorId === f.id).length;

      linhas.push([
        `"${f.nome.replace(/"/g, '""')}"`,
        `"${f.cnpjOuCpf || ''}"`,
        `"${f.whatsapp || f.telefone || ''}"`,
        `"${f.email || ''}"`,
        f.prazoMedioEntregaDias || 7,
        (f.pedidoMinimo || 0).toFixed(2).replace('.', ','),
        totalPedidos,
        gasto.toFixed(2).replace('.', ',')
      ].join(';'));
    }

    baixarArquivoCSV(linhas.join('\n'), `relatorio_fornecedores_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast de Sucesso ao Receber Pedido */}
      {sucessoRecebimento && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{sucessoRecebimento}</span>
          </div>
          <button 
            onClick={() => setSucessoRecebimento(null)}
            className="text-emerald-200 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner Principal com Navegação em Abas */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                Módulo de Fornecedores & Compras
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Gestão de parceiros, preços de custo, pedidos de reposição e acompanhamento com entrada automática no estoque.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleAbrirNovoPedido()}
            disabled={fornecedores.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-98"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Novo Pedido de Compra</span>
          </button>

          <button
            onClick={handleAbrirNovoFornecedor}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Fornecedor</span>
          </button>
        </div>
      </div>

      {/* Alerta Destacado de Pedidos Atrasados se houver */}
      {pedidosAtrasadosCount > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {pedidosAtrasadosCount === 1 
                  ? 'Atenção: 1 pedido de compra está atrasado!' 
                  : `Atenção: ${pedidosAtrasadosCount} pedidos de compra estão atrasados!`}
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                A data prevista de entrega já expirou e os produtos ainda não foram recebidos no estoque.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSubTab('pedidos');
              setFiltroStatusPedido('atrasados');
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0 cursor-pointer transition shadow-xs"
          >
            Ver Pedidos Atrasados
          </button>
        </div>
      )}

      {/* Navegação entre Sub-abas */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setSubTab('fornecedores')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
            subTab === 'fornecedores'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>Fornecedores</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-700 text-stone-200">
            {fornecedores.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('pedidos')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 relative ${
            subTab === 'pedidos'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>Pedidos de Compra</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-700 text-stone-200">
            {pedidosCompra.length}
          </span>
          {pedidosAtrasadosCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1.5 right-1.5" />
          )}
        </button>

        <button
          onClick={() => setSubTab('relatorios')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
            subTab === 'relatorios'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>Relatórios & Pendências</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: FORNECEDORES */}
      {/* ========================================================= */}
      {subTab === 'fornecedores' && (
        <div className="space-y-4">
          {/* Barra de Busca e Filtro */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, razão social, CNPJ ou email..."
                value={buscaFornecedor}
                onChange={e => setBuscaFornecedor(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="text-xs text-stone-500 shrink-0">
              {fornecedoresFiltrados.length} fornecedor(es) cadastrado(s)
            </div>
          </div>

          {/* Listagem em Cards */}
          {fornecedoresFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-800">Nenhum fornecedor encontrado</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {fornecedores.length === 0 
                  ? 'Você ainda não cadastrou fornecedores. Cadastre seus parceiros para vincular aos produtos e controlar pedidos de compra.'
                  : 'Nenhum fornecedor corresponde ao termo pesquisado.'}
              </p>
              {fornecedores.length === 0 && (
                <button
                  onClick={handleAbrirNovoFornecedor}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-xs shadow-xs hover:bg-amber-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Fornecedor</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fornecedoresFiltrados.map(f => {
                const pedidosForn = pedidosCompra.filter(p => p.fornecedorId === f.id);
                const totalGasto = pedidosForn
                  .filter(p => p.status !== 'cancelado')
                  .reduce((acc, p) => acc + p.valorTotal, 0);
                const pedidosAtrasados = pedidosForn.filter(p => isPedidoAtrasado(p)).length;

                return (
                  <div 
                    key={f.id}
                    className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-stone-900 text-base leading-tight">
                            {f.nome}
                          </h3>
                          {f.razaoSocial && f.razaoSocial !== f.nome && (
                            <p className="text-xs text-stone-500 mt-0.5">{f.razaoSocial}</p>
                          )}
                          {f.cnpjOuCpf && (
                            <span className="inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                              {f.cnpjOuCpf}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleAbrirEditarFornecedor(f)}
                            className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Editar fornecedor"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExcluirFornecedor(f.id, f.nome)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Excluir fornecedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Informações de Contato */}
                      <div className="space-y-1.5 pt-2 border-t border-stone-100 text-xs text-stone-600">
                        {f.whatsapp && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{f.whatsapp}</span>
                            </span>
                            <a
                              href={`https://wa.me/55${f.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Sou da Lima Semijoias.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold"
                            >
                              <span>Conversar</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {f.telefone && !f.whatsapp && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-stone-400" />
                            <span>{f.telefone}</span>
                          </div>
                        )}

                        {f.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <a href={`mailto:${f.email}`} className="hover:underline truncate">{f.email}</a>
                          </div>
                        )}
                      </div>

                      {/* Métricas Comerciais */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                        <div className="p-2 rounded-xl bg-stone-50 border border-stone-100">
                          <span className="text-[10px] text-stone-400 uppercase font-semibold block">Prazo Médio</span>
                          <span className="font-bold text-stone-800">
                            {f.prazoMedioEntregaDias || 7} dias úteis
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-stone-50 border border-stone-100">
                          <span className="text-[10px] text-stone-400 uppercase font-semibold block">Pedido Mínimo</span>
                          <span className="font-bold text-stone-800">
                            {f.pedidoMinimo && f.pedidoMinimo > 0 ? formatCurrency(f.pedidoMinimo) : 'Sem mínimo'}
                          </span>
                        </div>
                      </div>

                      {/* Formas de Pagamento Aceitas */}
                      {Array.isArray(f.formasPagamento) && f.formasPagamento.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {f.formasPagamento.map(forma => (
                            <span 
                              key={forma} 
                              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                            >
                              {forma}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Observações */}
                      {f.observacoes && (
                        <p className="text-[11px] text-stone-500 italic bg-stone-50 p-2 rounded-lg border border-stone-100 line-clamp-2">
                          "{f.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Rodapé com Total Comprado e Ação */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 block font-semibold uppercase">Total Comprado</span>
                        <span className="text-xs font-bold text-stone-900">{formatCurrency(totalGasto)}</span>
                        <span className="text-[10px] text-stone-500 ml-1">({pedidosForn.length} pedidos)</span>
                      </div>

                      <button
                        onClick={() => handleAbrirNovoPedido(f.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Novo Pedido</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: PEDIDOS DE COMPRA */}
      {/* ========================================================= */}
      {subTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Filtros de Pedidos */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código do pedido, fornecedor ou peça..."
                value={buscaPedido}
                onChange={e => setBuscaPedido(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setFiltroStatusPedido('todos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  filtroStatusPedido === 'todos' 
                    ? 'bg-stone-900 text-white' 
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Todos ({pedidosCompra.length})
              </button>

              <button
                onClick={() => setFiltroStatusPedido('atrasados')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  filtroStatusPedido === 'atrasados' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Atrasados ({pedidosAtrasadosCount})</span>
              </button>

              <button
                onClick={() => setFiltroStatusPedido('solicitado')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  filtroStatusPedido === 'solicitado' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                Solicitados
              </button>

              <button
                onClick={() => setFiltroStatusPedido('em_transito')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  filtroStatusPedido === 'em_transito' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                Em Trânsito
              </button>

              <button
                onClick={() => setFiltroStatusPedido('recebido')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  filtroStatusPedido === 'recebido' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                Recebidos
              </button>
            </div>
          </div>

          {/* Listagem de Pedidos */}
          {pedidosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-800">Nenhum pedido de compra encontrado</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {pedidosCompra.length === 0 
                  ? 'Você ainda não registrou nenhum pedido de compra junto aos fornecedores.'
                  : 'Nenhum pedido corresponde ao filtro selecionado.'}
              </p>
              <button
                onClick={() => handleAbrirNovoPedido()}
                disabled={fornecedores.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-xs shadow-xs hover:bg-amber-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Pedido</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosFiltrados.map(p => {
                const atrasado = isPedidoAtrasado(p);
                const diasAtraso = atrasado ? diasDeAtraso(p) : 0;

                return (
                  <div 
                    key={p.id}
                    className={`bg-white rounded-2xl p-5 shadow-xs transition border ${
                      atrasado 
                        ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-300' 
                        : 'border-stone-200/90 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Lado Esquerdo: Identificação, Fornecedor e Datas */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-900 text-amber-300">
                            #{p.id}
                          </span>

                          <span className="font-bold text-stone-900 text-base">
                            {p.fornecedorNome || 'Fornecedor'}
                          </span>

                          {/* Badge de Status */}
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            p.status === 'recebido' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : p.status === 'em_transito' 
                              ? 'bg-sky-100 text-sky-800 border border-sky-300' 
                              : p.status === 'confirmado' 
                              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                              : p.status === 'cancelado' 
                              ? 'bg-stone-200 text-stone-600' 
                              : 'bg-stone-100 text-stone-800 border border-stone-300'
                          }`}>
                            {p.status === 'em_transito' ? 'Em Trânsito' : p.status}
                          </span>

                          {/* ALERTA VISUAL DE ATRASO DESTACADO */}
                          {atrasado && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-600 text-white animate-pulse shadow-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>ATRASADO ({diasAtraso} {diasAtraso === 1 ? 'dia' : 'dias'})</span>
                            </span>
                          )}
                        </div>

                        {/* Datas do Pedido */}
                        <div className="flex items-center gap-4 text-xs text-stone-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-stone-400" />
                            <span>Pedido: <strong>{formatDate(p.dataPedido)}</strong></span>
                          </span>

                          <span className={`flex items-center gap-1 ${atrasado ? 'text-rose-700 font-bold' : ''}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Previsão: <strong>{formatDate(p.dataPrevistaEntrega)}</strong></span>
                          </span>

                          {p.status === 'recebido' && p.dataRecebimento && (
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Recebido em: {formatDate(p.dataRecebimento)} {p.recebidoPor ? `(${p.recebidoPor})` : ''}</span>
                            </span>
                          )}
                        </div>

                        {/* Itens do Pedido */}
                        <div className="pt-1">
                          <div className="text-xs text-stone-700 font-medium space-y-1">
                            {p.itens?.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="font-bold text-stone-900">{item.quantidade}x</span>
                                <span>{item.nomeProduto}</span>
                                <span className="text-stone-400">·</span>
                                <span className="text-stone-500">{formatCurrency(item.custoUnitario)} un</span>
                                <span className="text-stone-400 font-mono text-[11px]">(= {formatCurrency(item.subtotal || item.quantidade * item.custoUnitario)})</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {p.observacoes && (
                          <p className="text-xs text-stone-500 italic">
                            Obs: {p.observacoes}
                          </p>
                        )}
                      </div>

                      {/* Lado Direito: Valor Total e Ações de Transição */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block">Valor Total</span>
                          <span className="text-lg font-extrabold text-stone-900">{formatCurrency(p.valorTotal)}</span>
                        </div>

                        {/* Botões de Ação por Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.status !== 'recebido' && p.status !== 'cancelado' && (
                            <>
                              {p.status === 'solicitado' && (
                                <button
                                  onClick={() => handleAlterarStatusRapido(p.id, 'confirmado')}
                                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition cursor-pointer"
                                >
                                  Confirmar Pedido
                                </button>
                              )}

                              {p.status === 'confirmado' && (
                                <button
                                  onClick={() => handleAlterarStatusRapido(p.id, 'em_transito')}
                                  className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-semibold transition cursor-pointer"
                                >
                                  Marcar em Trânsito
                                </button>
                              )}

                              {/* BOTÃO PRINCIPAL DE ENTRADA NO ESTOQUE */}
                              <button
                                onClick={() => handleAlterarStatusRapido(p.id, 'recebido')}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Receber no Estoque</span>
                              </button>

                              <button
                                onClick={() => handleAlterarStatusRapido(p.id, 'cancelado')}
                                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg text-xs transition"
                                title="Cancelar pedido"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {p.status === 'recebido' && (
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                              <Check className="w-4 h-4" />
                              <span>Estoque Integrado</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 3: RELATÓRIOS & PENDÊNCIAS */}
      {/* ========================================================= */}
      {subTab === 'relatorios' && (
        <div className="space-y-6">
          {/* Seção 1: Gasto Total por Fornecedor no Período */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <span>Relatório de Gasto Total por Fornecedor</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Análise do volume financeiro negociado com cada fornecedor no período selecionado.
                </p>
              </div>

              {/* Seletor de Período e Botão de Exportar */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={periodoRelatorio}
                  onChange={e => setPeriodoRelatorio(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold bg-stone-50 focus:outline-none"
                >
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="mesAtual">Mês Atual</option>
                  <option value="anoAtual">Ano Atual</option>
                  <option value="todos">Todo o Histórico</option>
                </select>

                <button
                  onClick={handleExportarCSVFornecedores}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                <span className="text-[11px] font-semibold text-amber-800 uppercase block">Total Gasto no Período</span>
                <span className="text-xl font-black text-amber-950 mt-1 block">
                  {formatCurrency(dadosGastoPorFornecedor.totalGeralPeriodo)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[11px] font-semibold text-stone-500 uppercase block">Total de Pedidos</span>
                <span className="text-xl font-bold text-stone-900 mt-1 block">
                  {dadosGastoPorFornecedor.totalPedidosPeriodo} pedidos
                </span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[11px] font-semibold text-stone-500 uppercase block">Fornecedor Principal</span>
                <span className="text-sm font-bold text-stone-900 mt-1 block truncate">
                  {dadosGastoPorFornecedor.lista[0]?.fornecedorNome || 'Nenhum no período'}
                </span>
              </div>
            </div>

            {/* Tabela de Fornecedores por Gasto */}
            {dadosGastoPorFornecedor.lista.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center italic">
                Nenhum pedido de compra registrado para o período selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500 uppercase font-semibold border-y border-stone-100">
                    <tr>
                      <th className="py-2.5 px-3">Fornecedor</th>
                      <th className="py-2.5 px-3 text-center">Pedidos</th>
                      <th className="py-2.5 px-3 text-right">Total Gasto</th>
                      <th className="py-2.5 px-3 text-right">% do Total</th>
                      <th className="py-2.5 px-3">Distribuição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {dadosGastoPorFornecedor.lista.map(item => {
                      const perc = dadosGastoPorFornecedor.totalGeralPeriodo > 0 
                        ? (item.totalGasto / dadosGastoPorFornecedor.totalGeralPeriodo) * 100 
                        : 0;

                      return (
                        <tr key={item.fornecedorId} className="hover:bg-stone-50">
                          <td className="py-3 px-3 font-semibold text-stone-900">
                            {item.fornecedorNome}
                          </td>
                          <td className="py-3 px-3 text-center text-stone-600">
                            {item.qtdPedidos} ({item.pedidosRecebidos} recebidos)
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-stone-900">
                            {formatCurrency(item.totalGasto)}
                          </td>
                          <td className="py-3 px-3 text-right text-stone-600 font-mono">
                            {perc.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 w-40">
                            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-amber-500 h-full rounded-full" 
                                style={{ width: `${Math.min(100, Math.max(5, perc))}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Seção 2: Produtos com Pedido Pendente de Recebimento */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-sky-600" />
                <span>Produtos com Pedido Pendente de Recebimento</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Semijoias que já foram encomendadas e aguardam entrega para recomposição do estoque.
              </p>
            </div>

            {produtosPendentesDeRecebimento.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400 italic bg-stone-50 rounded-xl border border-stone-100">
                Não há produtos com pedidos de compra em trânsito ou pendentes no momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500 uppercase font-semibold border-y border-stone-100">
                    <tr>
                      <th className="py-2.5 px-3">Semijoia</th>
                      <th className="py-2.5 px-3 text-center">Estoque Atual</th>
                      <th className="py-2.5 px-3 text-center">A Receber</th>
                      <th className="py-2.5 px-3 text-center">Estoque Projetado</th>
                      <th className="py-2.5 px-3">Detalhes do Pedido</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {produtosPendentesDeRecebimento.map(item => {
                      const critico = item.estoqueAtual <= 0;
                      const baixo = item.estoqueAtual <= item.estoqueMinimo;

                      return (
                        <tr key={item.produtoId} className="hover:bg-stone-50">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {item.imagem_url ? (
                                <img 
                                  src={item.imagem_url} 
                                  alt={item.nomeProduto} 
                                  className="w-9 h-9 rounded-lg object-cover border border-stone-200 shrink-0" 
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 text-stone-400">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-stone-900 block leading-tight">
                                  {item.nomeProduto}
                                </span>
                                <span className="text-[10px] text-stone-400">{item.categoria}</span>
                              </div>
                            </div>
                          </td>

                          {/* Estoque Atual */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${
                              critico 
                                ? 'bg-rose-100 text-rose-800' 
                                : baixo 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-stone-100 text-stone-800'
                            }`}>
                              {item.estoqueAtual} un
                            </span>
                          </td>

                          {/* Quantidade a receber */}
                          <td className="py-3 px-3 text-center font-bold text-sky-700">
                            +{item.quantidadePendente} un
                          </td>

                          {/* Estoque Projetado */}
                          <td className="py-3 px-3 text-center font-extrabold text-stone-900">
                            {item.estoqueAtual + item.quantidadePendente} un
                          </td>

                          {/* Pedidos detalhados */}
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              {item.pedidosDetalhados.map((detalhe, dIdx) => (
                                <div key={dIdx} className="text-[11px] text-stone-600 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-stone-800">#{detalhe.pedidoId}</span>
                                  <span>({detalhe.fornecedorNome})</span>
                                  <span className="text-stone-400">·</span>
                                  <span>Prev: {formatDate(detalhe.dataPrevista)}</span>
                                  {detalhe.atrasado && (
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                                      Atrasado
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Ação */}
                          <td className="py-3 px-3 text-right">
                            {onNavegarParaEstoque && (
                              <button
                                onClick={() => onNavegarParaEstoque(item.produtoId)}
                                className="text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                              >
                                Ver no Estoque
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE FORNECEDOR */}
      {/* ========================================================= */}
      {modalFornecedorAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-900 text-stone-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-lg font-bold">
                  {fornecedorEditando ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}
                </h3>
              </div>
              <button
                onClick={() => setModalFornecedorAberto(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarFornecedor} className="p-6 space-y-4">
              {formErroFornecedor && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {formErroFornecedor}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Nome Fantasia / Fornecedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Joias do Brasil, Brilho & Cia..."
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Razão Social</label>
                  <input
                    type="text"
                    placeholder="Razão social completa..."
                    value={formRazaoSocial}
                    onChange={e => setFormRazaoSocial(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">CNPJ ou CPF</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={formCnpjCpf}
                    onChange={e => setFormCnpjCpf(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">WhatsApp (com DDD)</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={formWhatsapp}
                    onChange={e => setFormWhatsapp(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">E-mail</label>
                  <input
                    type="email"
                    placeholder="contato@fornecedor.com.br"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Prazo Médio Entrega (Dias)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="7"
                    value={formPrazoMedio}
                    onChange={e => setFormPrazoMedio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Pedido Mínimo (R$)</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={formPedidoMinimo}
                    onChange={e => setFormPedidoMinimo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Formas de Pagamento Aceitas */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700">Formas de Pagamento Aceitas</label>
                <div className="flex flex-wrap gap-1.5">
                  {FORMAS_PAGAMENTO_SUGESTOES.map(forma => (
                    <button
                      type="button"
                      key={forma}
                      onClick={() => handleToggleFormaPagamento(forma)}
                      className={`text-xs px-2.5 py-1 rounded-xl border transition cursor-pointer ${
                        formFormasPagamento.includes(forma)
                          ? 'bg-amber-500 text-stone-950 font-bold border-amber-600 shadow-xs'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {forma}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Outra forma de pagamento..."
                    value={novaFormaPagamento}
                    onChange={e => setNovaFormaPagamento(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarFormaPersonalizada}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 text-white text-xs font-semibold"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Informações sobre catálogo, frete, descontos para compras em atacado..."
                  value={formObservacoes}
                  onChange={e => setFormObservacoes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalFornecedorAberto(false)}
                  className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {fornecedorEditando ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NOVO PEDIDO DE COMPRA */}
      {/* ========================================================= */}
      {modalNovoPedidoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-900 text-stone-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-lg font-bold">Novo Pedido de Compra</h3>
              </div>
              <button
                onClick={() => setModalNovoPedidoAberto(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoPedido} className="p-6 space-y-5">
              {formErroPedido && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {formErroPedido}
                </div>
              )}

              {/* Seleção do Fornecedor e Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-xs font-bold text-stone-700">Fornecedor *</label>
                  <select
                    value={pedidoFornecedorId}
                    onChange={e => handleMudarFornecedorPedido(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm font-semibold bg-stone-50 focus:outline-none focus:border-amber-500"
                  >
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Data do Pedido</label>
                  <input
                    type="date"
                    required
                    value={pedidoData}
                    onChange={e => setPedidoData(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Previsão de Entrega</label>
                  <input
                    type="date"
                    required
                    value={pedidoDataPrevista}
                    onChange={e => setPedidoDataPrevista(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Informação sobre pedido mínimo e prazo */}
              {fornecedorAtualDoPedido && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                  <span>
                    Prazo médio deste fornecedor: <strong>{fornecedorAtualDoPedido.prazoMedioEntregaDias || 7} dias úteis</strong>
                  </span>
                  <span>
                    Pedido mínimo: <strong>{fornecedorAtualDoPedido.pedidoMinimo && fornecedorAtualDoPedido.pedidoMinimo > 0 ? formatCurrency(fornecedorAtualDoPedido.pedidoMinimo) : 'Não exigido'}</strong>
                  </span>
                </div>
              )}

              {/* Bloco de Adição de Itens */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-600" />
                  <span>Adicionar Semijoias ao Pedido</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[11px] font-semibold text-stone-600">Peça / Semijoia</label>
                    <select
                      value={itemSelecionadoProdutoId}
                      onChange={e => handleSelecionarProdutoItem(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none"
                    >
                      <option value="">Selecione uma peça do catálogo...</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} (Atual: {p.quantidade_estoque} un)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-stone-600">Qtd.</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQuantidade}
                      onChange={e => setItemQuantidade(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-center font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-stone-600">Custo Un (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={itemCustoUnitario}
                      onChange={e => setItemCustoUnitario(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-right font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAdicionarItemPedido}
                      className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Incluir
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista dos Itens Adicionados */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700">Itens do Pedido ({pedidoItens.length})</label>
                {pedidoItens.length === 0 ? (
                  <p className="text-xs text-stone-400 py-4 text-center italic bg-stone-50 rounded-xl border border-stone-100">
                    Nenhum item incluído ainda. Selecione peças acima para compor o pedido.
                  </p>
                ) : (
                  <div className="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-48 overflow-y-auto">
                    {pedidoItens.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-stone-900">{item.quantidade}x </span>
                          <span className="font-medium text-stone-800">{item.nomeProduto}</span>
                          <span className="text-stone-400 ml-2">({formatCurrency(item.custoUnitario)} un)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-stone-900">
                            {formatCurrency(item.quantidade * item.custoUnitario)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoverItemPedido(item.produtoId)}
                            className="text-stone-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total do Pedido e Alerta de Pedido Mínimo */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-500 uppercase block">Total do Pedido</span>
                  {fornecedorAtualDoPedido?.pedidoMinimo && totalCalculadoPedido < fornecedorAtualDoPedido.pedidoMinimo ? (
                    <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Abaixo do mínimo sugerido ({formatCurrency(fornecedorAtualDoPedido.pedidoMinimo)})</span>
                    </span>
                  ) : null}
                </div>
                <span className="text-xl font-black text-stone-900">
                  {formatCurrency(totalCalculadoPedido)}
                </span>
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Observações adicionais</label>
                <textarea
                  rows={2}
                  placeholder="Instruções de envio, pagamento, transportadora..."
                  value={pedidoObservacoes}
                  onChange={e => setPedidoObservacoes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none"
                />
              </div>

              {/* Botões Finais */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalNovoPedidoAberto(false)}
                  className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pedidoItens.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Confirmar e Registrar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE RECEBIMENTO NO ESTOQUE */}
      {/* ========================================================= */}
      {pedidoRecebendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[90dvh] flex flex-col">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <h3 className="font-serif text-lg font-bold">Confirmar Recebimento</h3>
              </div>
              <button
                onClick={() => setPedidoRecebendo(null)}
                className="w-8 h-8 rounded-full bg-emerald-900 hover:bg-emerald-700 text-emerald-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                <p className="font-bold">
                  Ao confirmar o recebimento, as peças deste pedido serão somadas automaticamente ao estoque atual!
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-stone-700 block">Peças a serem acrescidas ao estoque:</span>
                <div className="border border-stone-200 rounded-xl p-3 bg-stone-50 max-h-40 overflow-y-auto divide-y divide-stone-100">
                  {pedidoRecebendo.itens?.map((i, idx) => (
                    <div key={idx} className="py-1 flex items-center justify-between">
                      <span className="font-medium text-stone-800">{i.nomeProduto}</span>
                      <span className="font-bold text-emerald-700">+{i.quantidade} unidades</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Recebido por (Auditoria):</label>
                <input
                  type="text"
                  value={recebidoPorNome}
                  onChange={e => setRecebidoPorNome(e.target.value)}
                  placeholder="Nome do responsável pelo recebimento..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPedidoRecebendo(null)}
                  className="px-4 py-2 rounded-xl text-stone-600 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarRecebimentoEstoque}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Somar ao Estoque</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
