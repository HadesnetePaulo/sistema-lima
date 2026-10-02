import React, { useState, useMemo } from 'react';
import { Produto, CATEGORIAS, CategoriaProduto } from '../types';
import { storage } from '../lib/storage';
import { buscarEspecificacoesPorCodigo } from '../lib/barcodeLookup';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  Check, 
  X, 
  Sparkles,
  Barcode,
  RotateCcw,
  Camera,
  Loader2,
  Wand2,
  Zap
} from 'lucide-react';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface ProdutosEstoqueProps {
  produtos: Produto[];
  onRefresh: () => void;
}

export const ProdutosEstoque: React.FC<ProdutosEstoqueProps> = ({ produtos, onRefresh }) => {
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaProduto>('Todas');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'baixo' | 'zerado'>('todos');

  // Modal State for New/Edit Product
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [cameraCadastroAberta, setCameraCadastroAberta] = useState(false);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState<string>('Brincos');
  const [formCodigo, setFormCodigo] = useState('');
  const [formPreco, setFormPreco] = useState('');
  const [formPrecoCusto, setFormPrecoCusto] = useState('');
  const [formEstoque, setFormEstoque] = useState('');
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState('3');
  const [formImagem, setFormImagem] = useState('');
  const [formErro, setFormErro] = useState<string | null>(null);
  const [carregandoSpecs, setCarregandoSpecs] = useState(false);
  const [specsInfo, setSpecsInfo] = useState<{
    texto: string;
    detalhes?: string;
    fonte?: string;
  } | null>(null);

  // Confirm delete
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Filtered Products
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(prod => {
      const matchBusca =
        prod.nome.toLowerCase().includes(busca.toLowerCase()) ||
        prod.codigo_barras.toLowerCase().includes(busca.toLowerCase()) ||
        prod.categoria.toLowerCase().includes(busca.toLowerCase());

      const matchCategoria =
        categoriaFiltro === 'Todas' || prod.categoria === categoriaFiltro;

      const limiteMin = prod.estoque_minimo && prod.estoque_minimo > 0 ? prod.estoque_minimo : 3;

      const matchStatus =
        filtroStatus === 'todos'
          ? true
          : filtroStatus === 'baixo'
          ? prod.quantidade_estoque > 0 && prod.quantidade_estoque <= limiteMin
          : prod.quantidade_estoque <= 0;

      return matchBusca && matchCategoria && matchStatus;
    });
  }, [produtos, busca, categoriaFiltro, filtroStatus]);

  // Executive Desktop Stock Metrics
  const metricasEstoque = useMemo(() => {
    let totalPecas = 0;
    let capitalInvestido = 0;
    let receitaProjetada = 0;
    let zerados = 0;
    let baixos = 0;

    for (const p of produtos) {
      const limiteMin = p.estoque_minimo && p.estoque_minimo > 0 ? p.estoque_minimo : 3;
      totalPecas += p.quantidade_estoque;
      capitalInvestido += (p.preco_custo || 0) * p.quantidade_estoque;
      receitaProjetada += p.preco * p.quantidade_estoque;
      if (p.quantidade_estoque <= 0) zerados++;
      else if (p.quantidade_estoque <= limiteMin) baixos++;
    }

    const lucroProjetado = receitaProjetada - capitalInvestido;
    const margemMedia = capitalInvestido > 0 ? (lucroProjetado / capitalInvestido) * 100 : 0;

    return {
      totalPecas,
      capitalInvestido,
      receitaProjetada,
      lucroProjetado,
      margemMedia,
      zerados,
      baixos
    };
  }, [produtos]);

  // Open modal for new product
  const handleNovoProduto = () => {
    setProdutoEditando(null);
    setFormNome('');
    setFormCategoria('Brincos');
    setFormCodigo('');
    setFormPreco('');
    setFormPrecoCusto('');
    setFormEstoque('5');
    setFormEstoqueMinimo('3');
    setFormImagem('');
    setFormErro(null);
    setSpecsInfo(null);
    setModalAberto(true);
  };

  // Open modal for editing
  const handleEditarProduto = (prod: Produto) => {
    setProdutoEditando(prod);
    setFormNome(prod.nome);
    setFormCategoria(prod.categoria);
    setFormCodigo(prod.codigo_barras || '');
    setFormPreco(prod.preco.toString());
    setFormPrecoCusto(prod.preco_custo ? prod.preco_custo.toString() : '');
    setFormEstoque(prod.quantidade_estoque.toString());
    setFormEstoqueMinimo((prod.estoque_minimo && prod.estoque_minimo > 0 ? prod.estoque_minimo : 3).toString());
    setFormImagem(prod.imagem_url || '');
    setFormErro(null);
    setSpecsInfo(null);
    setModalAberto(true);
  };

  // Busca e puxa as especificações completas a partir do código de barras
  const handleBuscarEspecificacoes = async (codigoOpcional?: string) => {
    const cod = (codigoOpcional !== undefined ? codigoOpcional : formCodigo).trim();
    if (!cod) {
      setFormErro('Por favor, informe ou escaneie um código de barras para puxar as especificações.');
      return;
    }

    setCarregandoSpecs(true);
    setFormErro(null);

    try {
      const specs = await buscarEspecificacoesPorCodigo(cod);
      if (specs && specs.found) {
        setFormNome(specs.nome);
        setFormCategoria(specs.categoria);
        setFormPreco(specs.preco_sugerido.toFixed(2));
        if (specs.preco_custo_estimado) {
          setFormPrecoCusto(specs.preco_custo_estimado.toFixed(2));
        }
        if (specs.imagem_url) {
          setFormImagem(specs.imagem_url);
        }
        if (!formEstoque || formEstoque === '0') {
          setFormEstoque(specs.estoque_sugerido.toString());
        }

        let fonteNome = 'Catálogo Lima Semijoias';
        if (specs.source === 'catalogo_existente') fonteNome = 'Item Existente no Estoque';
        if (specs.source === 'api_externa') fonteNome = 'Base Nacional de Produtos (EAN/GTIN)';
        if (specs.source === 'inteligencia_referencia') fonteNome = 'Inteligência de Joalheria';

        setSpecsInfo({
          texto: `Especificações de "${specs.nome}" preenchidas com sucesso!`,
          detalhes: specs.especificacoes_tecnicas,
          fonte: fonteNome
        });
      }
    } catch (err: any) {
      setFormErro(err?.message || 'Não foi possível encontrar especificações para este código.');
    } finally {
      setCarregandoSpecs(false);
    }
  };

  // Quick adjust stock +1 or -1 (Supabase + Local)
  const handleAjusteRapido = async (id: string, delta: number) => {
    await storage.ajustarEstoque(id, delta);
    onRefresh();
  };

  // Save Product (Create or Update)
  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      setFormErro('O nome do produto é obrigatório.');
      return;
    }

    const precoNum = parseFloat(formPreco.replace(',', '.'));
    if (isNaN(precoNum) || precoNum < 0) {
      setFormErro('Digite um preço de venda válido em Reais (ex: 89,90).');
      return;
    }

    let precoCustoNum = 0;
    if (formPrecoCusto.trim()) {
      precoCustoNum = parseFloat(formPrecoCusto.replace(',', '.'));
      if (isNaN(precoCustoNum) || precoCustoNum < 0) {
        setFormErro('Digite um preço de custo válido.');
        return;
      }
    }

    const estoqueNum = parseInt(formEstoque, 10);
    if (isNaN(estoqueNum) || estoqueNum < 0) {
      setFormErro('Digite uma quantidade de estoque válida (0 ou mais).');
      return;
    }

    const estoqueMinimoNum = parseInt(formEstoqueMinimo, 10);
    const finalEstoqueMinimo = !isNaN(estoqueMinimoNum) && estoqueMinimoNum >= 0 ? estoqueMinimoNum : 3;

    try {
      if (produtoEditando) {
        await storage.updateProduto(produtoEditando.id, {
          nome: formNome.trim(),
          categoria: formCategoria,
          codigo_barras: formCodigo.trim(),
          preco: precoNum,
          preco_custo: precoCustoNum,
          quantidade_estoque: estoqueNum,
          estoque_minimo: finalEstoqueMinimo,
          imagem_url: formImagem.trim() || undefined
        });
      } else {
        await storage.addProduto({
          nome: formNome.trim(),
          categoria: formCategoria,
          codigo_barras: formCodigo.trim(),
          preco: precoNum,
          preco_custo: precoCustoNum,
          quantidade_estoque: estoqueNum,
          estoque_minimo: finalEstoqueMinimo,
          imagem_url: formImagem.trim() || undefined
        });
      }

      setModalAberto(false);
      onRefresh();
    } catch (err: any) {
      setFormErro(err?.message || 'Erro ao salvar produto.');
    }
  };

  // Delete product
  const handleExcluir = async (id: string) => {
    await storage.deleteProduto(id);
    setDeletandoId(null);
    onRefresh();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
              Catálogo de Produtos & Controle de Estoque
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Gerenciamento do catálogo oficial Lima Semijoias, preços de custo, margens de lucro e código de barras.
          </p>
        </div>

        <button
          onClick={handleNovoProduto}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-amber-600 text-white font-semibold text-xs shadow-md transition cursor-pointer active:scale-98 whitespace-nowrap min-h-[42px]"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Cadastrar Novo Produto</span>
        </button>
      </div>

      {/* Desktop Inventory Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Peças em Estoque
          </p>
          <p className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1 tabular-nums">
            {metricasEstoque.totalPecas} <span className="text-xs font-sans font-normal text-stone-500">unidades</span>
          </p>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {produtos.length} modelos cadastrados
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Capital Investido (Custo)
          </p>
          <p className="text-xl sm:text-2xl font-serif font-bold text-stone-800 mt-1 tabular-nums">
            {formatCurrency(metricasEstoque.capitalInvestido)}
          </p>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Custo total das semijoias no estoque
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Faturamento Projetado
          </p>
          <p className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1 tabular-nums">
            {formatCurrency(metricasEstoque.receitaProjetada)}
          </p>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Valor a preço de venda de balcão
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Lucro Bruto Estimado
            </p>
            {metricasEstoque.margemMedia > 0 && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                +{metricasEstoque.margemMedia.toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xl sm:text-2xl font-serif font-bold text-emerald-700 mt-1 tabular-nums">
            {formatCurrency(metricasEstoque.lucroProjetado)}
          </p>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">
            Retorno projetado sobre o estoque
          </p>
        </div>
      </div>

      {/* Prominent Visual Alert Banner for Low Stock */}
      {metricasEstoque.baixos > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 bg-amber-50/90 border-2 border-amber-400 rounded-2xl shadow-xs animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-amber-950 rounded-xl shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5 fill-amber-950 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-amber-950 text-xs sm:text-sm flex items-center gap-2">
                <span>Alerta de Reposição de Estoque</span>
                <span className="px-2 py-0.5 bg-amber-200/80 border border-amber-300 text-amber-900 rounded-full text-[11px] font-extrabold">
                  {metricasEstoque.baixos} {metricasEstoque.baixos === 1 ? 'peça' : 'peças'}
                </span>
              </h3>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Existem {metricasEstoque.baixos} {metricasEstoque.baixos === 1 ? 'semijoia com estoque igual ou abaixo' : 'semijoias com estoque igual ou abaixo'} do limite mínimo configurado. Elas estão sinalizadas com <strong>borda amarela e selo de atenção</strong> para agilizar a reposição.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFiltroStatus(filtroStatus === 'baixo' ? 'todos' : 'baixo')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer shrink-0 border flex items-center justify-center gap-1.5 ${
              filtroStatus === 'baixo'
                ? 'bg-stone-900 text-white border-stone-800 hover:bg-stone-800'
                : 'bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-500'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 fill-current" />
            <span>{filtroStatus === 'baixo' ? 'Ver Todos os Produtos' : `Filtrar ${metricasEstoque.baixos} em Alerta`}</span>
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, categoria ou código de barras..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-amber-500 focus:bg-white min-h-[44px] transition"
            />
          </div>

          {/* Quick Stock Status Filter */}
          <div className="flex items-center gap-1.5 shrink-0 bg-stone-100 p-1.5 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-3.5 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap ${
                filtroStatus === 'todos' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Todos ({produtos.length})
            </button>
            <button
              onClick={() => setFiltroStatus('baixo')}
              className={`px-3.5 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap flex items-center gap-1.5 ${
                filtroStatus === 'baixo'
                  ? 'bg-amber-400 text-amber-950 font-bold shadow-xs border border-amber-500'
                  : metricasEstoque.baixos > 0
                  ? 'bg-amber-100 text-amber-950 font-bold hover:bg-amber-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 fill-amber-500 text-amber-950" />
              <span>⚠️ Estoque Baixo ({metricasEstoque.baixos})</span>
            </button>
            <button
              onClick={() => setFiltroStatus('zerado')}
              className={`px-3.5 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap ${
                filtroStatus === 'zerado' ? 'bg-rose-100 text-rose-950 font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Zerados ({metricasEstoque.zerados})
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition cursor-pointer font-semibold min-h-[38px] ${
                categoriaFiltro === cat
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        {/* Mobile View: Pattern B Touch Cards */}
        <div className="md:hidden divide-y divide-stone-100">
          {produtosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              Nenhuma semijoia cadastrada ou correspondente ao filtro.
            </div>
          ) : (
            produtosFiltrados.map(prod => {
              const limiteMin = prod.estoque_minimo && prod.estoque_minimo > 0 ? prod.estoque_minimo : 3;
              const semEstoque = prod.quantidade_estoque <= 0;
              const estoqueBaixo = prod.quantidade_estoque > 0 && prod.quantidade_estoque <= limiteMin;

              return (
                <div
                  key={prod.id}
                  className={`p-4 space-y-3 transition-all ${
                    estoqueBaixo
                      ? 'bg-amber-50/70 border-2 border-amber-400 rounded-2xl m-2.5 shadow-sm shadow-amber-200/60 ring-2 ring-amber-300/40'
                      : semEstoque
                      ? 'bg-rose-50/50 border border-rose-200 rounded-2xl m-2'
                      : ''
                  }`}
                >
                  {/* Visual Low Stock Alert Seal (Selo de Atenção) */}
                  {estoqueBaixo && (
                    <div className="flex items-center justify-between px-3.5 py-2 bg-amber-400 text-amber-950 font-bold text-xs rounded-xl shadow-xs border border-amber-500">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 fill-amber-950 text-amber-400 shrink-0" />
                        <span>SELO DE ATENÇÃO: ESTOQUE BAIXO</span>
                      </div>
                      <span className="text-[11px] font-extrabold bg-amber-950/15 px-2.5 py-0.5 rounded-full">
                        {prod.quantidade_estoque} de {limiteMin} un (Mínimo)
                      </span>
                    </div>
                  )}

                  {semEstoque && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-rose-100 text-rose-900 font-bold text-xs rounded-xl border border-rose-200">
                      <span className="flex items-center gap-1.5">
                        <X className="w-4 h-4 text-rose-600" />
                        ESTOQUE ZERADO / ESGOTADO
                      </span>
                      <span className="text-[11px] font-semibold text-rose-700">0 unidades</span>
                    </div>
                  )}

                  <div className="flex items-start gap-3.5">
                    <div className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border ${
                      estoqueBaixo ? 'bg-amber-100/50 border-amber-300' : 'bg-stone-100 border-stone-200'
                    }`}>
                      {prod.imagem_url ? (
                        <img
                          src={prod.imagem_url}
                          alt={prod.nome}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.target as HTMLImageElement).src = '/logo-lima.jpg';
                          }}
                        />
                      ) : (
                        <Sparkles className="w-6 h-6 text-amber-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-0.5">
                        <span className="font-bold text-amber-800 uppercase tracking-wide">{prod.categoria}</span>
                        {prod.codigo_barras && (
                          <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                            #{prod.codigo_barras}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm leading-snug">
                        {prod.nome}
                      </h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-bold text-stone-900 text-base tabular-nums">
                          {formatCurrency(prod.preco)}
                        </span>
                        {prod.preco_custo && prod.preco_custo > 0 ? (
                          <span className="text-[11px] text-stone-500">
                            Custo: {formatCurrency(prod.preco_custo)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Stepper & Actions: Clean spacing, >= 40px touch hitboxes */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500 font-semibold">Estoque:</span>
                      <div className="inline-flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                        <button
                          onClick={() => handleAjusteRapido(prod.id, -1)}
                          disabled={prod.quantidade_estoque <= 0}
                          className="w-9 h-9 rounded-lg bg-white text-stone-800 hover:bg-stone-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95"
                          title="Diminuir"
                        >
                          -
                        </button>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold tabular-nums min-w-[2.5rem] text-center ${
                          semEstoque
                            ? 'bg-rose-100 text-rose-700'
                            : estoqueBaixo
                            ? 'bg-amber-400 text-amber-950 font-extrabold border border-amber-500 shadow-2xs'
                            : 'text-stone-900'
                        }`}>
                          {prod.quantidade_estoque} un
                        </span>
                        <button
                          onClick={() => handleAjusteRapido(prod.id, 1)}
                          className="w-9 h-9 rounded-lg bg-white text-stone-800 hover:bg-stone-200 flex items-center justify-center text-sm font-bold shadow-xs active:scale-95"
                          title="Aumentar"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditarProduto(prod)}
                        className="w-9 h-9 text-stone-600 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center"
                        title="Editar produto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {deletandoId === prod.id ? (
                        <div className="inline-flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200">
                          <button
                            onClick={() => handleExcluir(prod.id)}
                            className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setDeletandoId(null)}
                            className="px-1.5 text-stone-400 text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletandoId(prod.id)}
                          className="w-9 h-9 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Wide Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Cód. Barras / Ref</th>
                <th className="py-3 px-4">Preço Venda</th>
                <th className="py-3 px-4">Preço Custo</th>
                <th className="py-3 px-4">Margem Bruta</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    Nenhum produto cadastrado ou correspondente ao filtro.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map(prod => {
                  const limiteMin = prod.estoque_minimo && prod.estoque_minimo > 0 ? prod.estoque_minimo : 3;
                  const semEstoque = prod.quantidade_estoque <= 0;
                  const estoqueBaixo = prod.quantidade_estoque > 0 && prod.quantidade_estoque <= limiteMin;
                  const lucroUnitario = prod.preco_custo ? prod.preco - prod.preco_custo : 0;
                  const margemPercentual = prod.preco_custo && prod.preco_custo > 0 ? (lucroUnitario / prod.preco_custo) * 100 : 0;

                  return (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${
                        estoqueBaixo
                          ? 'bg-amber-50/90 border-l-4 border-l-amber-500 hover:bg-amber-100/80 font-medium'
                          : semEstoque
                          ? 'bg-rose-50/40 border-l-4 border-l-rose-400 hover:bg-rose-50'
                          : 'hover:bg-stone-50/80'
                      }`}
                    >
                      {/* Product Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border ${
                            estoqueBaixo ? 'bg-amber-100/50 border-amber-300 ring-2 ring-amber-200' : 'bg-stone-100 border-stone-200'
                          }`}>
                            {prod.imagem_url ? (
                              <img
                                src={prod.imagem_url}
                                alt={prod.nome}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={e => {
                                  (e.target as HTMLImageElement).src = '/logo-lima.jpg';
                                }}
                              />
                            ) : (
                              <Sparkles className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-stone-900 text-xs sm:text-sm">
                                {prod.nome}
                              </p>
                              {estoqueBaixo && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400 text-amber-950 border border-amber-500 shadow-2xs shrink-0">
                                  <AlertTriangle className="w-3 h-3 fill-amber-950 text-amber-400" />
                                  Selo de Atenção (Mín: {limiteMin} un)
                                </span>
                              )}
                              {semEstoque && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                                  Esgotado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-stone-400">ID: {prod.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-stone-600 font-medium">
                        {prod.categoria}
                      </td>

                      {/* Barcode / SKU */}
                      <td className="py-3 px-4 font-mono text-stone-500">
                        {prod.codigo_barras ? (
                          <span className="inline-flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-stone-400" />
                            <span>{prod.codigo_barras}</span>
                          </span>
                        ) : (
                          <span className="text-stone-300 italic">—</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-bold text-stone-900 tabular-nums">
                        {formatCurrency(prod.preco)}
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-4 text-stone-600 tabular-nums">
                        {prod.preco_custo && prod.preco_custo > 0 ? (
                          <span className="font-medium text-stone-700">
                            {formatCurrency(prod.preco_custo)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400 italic">
                            Não informado
                          </span>
                        )}
                      </td>

                      {/* Margem Bruta */}
                      <td className="py-3 px-4 tabular-nums">
                        {prod.preco_custo && prod.preco_custo > 0 ? (
                          <div>
                            <span className="inline-block text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              +{margemPercentual.toFixed(0)}%
                            </span>
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              Lucro: {formatCurrency(lucroUnitario)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Stock with quick buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-xl ${
                          estoqueBaixo ? 'bg-amber-100/80 border border-amber-300' : 'bg-stone-100'
                        }`}>
                          <button
                            onClick={() => handleAjusteRapido(prod.id, -1)}
                            disabled={prod.quantidade_estoque <= 0}
                            className="w-5 h-5 rounded bg-white text-stone-700 hover:bg-stone-200 flex items-center justify-center text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Diminuir 1 un"
                          >
                            -
                          </button>

                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-bold tabular-nums min-w-[2.5rem] text-center ${
                              semEstoque
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : estoqueBaixo
                                ? 'bg-amber-400 text-amber-950 font-extrabold border border-amber-500 shadow-2xs'
                                : 'text-stone-900 bg-white'
                            }`}
                          >
                            {prod.quantidade_estoque} un
                          </span>

                          <button
                            onClick={() => handleAjusteRapido(prod.id, 1)}
                            className="w-5 h-5 rounded bg-white text-stone-700 hover:bg-stone-200 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                            title="Aumentar 1 un"
                          >
                            +
                          </button>
                        </div>
                        {estoqueBaixo && (
                          <span className="text-[10px] text-amber-900 font-bold block mt-1">
                            ⚠️ Abaixo do mín. ({limiteMin})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditarProduto(prod)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                            title="Editar produto"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {deletandoId === prod.id ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                              <button
                                onClick={() => handleExcluir(prod.id)}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeletandoId(null)}
                                className="px-1 text-stone-400 hover:text-stone-600 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletandoId(prod.id)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Modal: New / Edit Product */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-stone-100">
              <h2 className="font-serif text-lg font-bold text-amber-200">
                {produtoEditando ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="text-stone-400 hover:text-stone-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarProduto} className="p-6 space-y-4">
              {formErro && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formErro}</span>
                </div>
              )}

              {/* Specs Auto-Filled Banner */}
              {specsInfo && (
                <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {specsInfo.texto}
                    </span>
                    {specsInfo.fonte && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                        {specsInfo.fonte}
                      </span>
                    )}
                  </div>
                  {specsInfo.detalhes && (
                    <p className="text-[11px] text-emerald-700 leading-relaxed pl-5">
                      {specsInfo.detalhes}
                    </p>
                  )}
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome da Semijoia *
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Anel Solitário Banhado a Ouro 18k"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* Categoria & Código de Barras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={formCategoria}
                    onChange={e => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                  >
                    {CATEGORIAS.filter(c => c !== 'Todas').map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-stone-700">
                      Código de Barras / Ref
                    </label>
                    <button
                      type="button"
                      onClick={() => setCameraCadastroAberta(true)}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200"
                    >
                      <Camera className="w-3 h-3 text-amber-600" />
                      <span>Câmera</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formCodigo}
                      onChange={e => setFormCodigo(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBuscarEspecificacoes();
                        }
                      }}
                      placeholder="Ex: 7891001001"
                      className="w-full pl-3.5 pr-28 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-mono"
                    />
                    <button
                      type="button"
                      disabled={carregandoSpecs || !formCodigo.trim()}
                      onClick={() => handleBuscarEspecificacoes()}
                      className="absolute right-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-200 disabled:text-stone-400 text-stone-950 font-bold text-[11px] rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer disabled:cursor-not-allowed"
                      title="Puxar especificações automaticamente pelo código"
                    >
                      {carregandoSpecs ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Puxando...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3 text-stone-950 fill-stone-950" />
                          <span>Puxar Specs</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Digite ou escaneie o código para puxar fotos, preços e especificações automaticamente.
                  </p>
                </div>
              </div>

              {/* Preços: Venda e Custo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPreco}
                    onChange={e => setFormPreco(e.target.value)}
                    placeholder="Ex: 149.90"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Preço de Custo (R$) (V2)
                  </label>
                  <input
                    type="text"
                    value={formPrecoCusto}
                    onChange={e => setFormPrecoCusto(e.target.value)}
                    placeholder="Ex: 45.00 (opcional)"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-mono"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Usado para apurar o lucro real no caixa.</p>
                </div>
              </div>

              {/* Estoque Atual e Limite Mínimo para Alerta de Atenção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Quantidade em Estoque *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formEstoque}
                    onChange={e => setFormEstoque(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Saldo físico disponível para venda.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
                    <span>Estoque Mínimo de Alerta *</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Selo Atenção
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formEstoqueMinimo}
                    onChange={e => setFormEstoqueMinimo(e.target.value)}
                    placeholder="Ex: 3"
                    className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-semibold text-amber-950"
                  />
                  <p className="text-[10px] text-amber-800 mt-1">
                    Abaixo deste valor o produto recebe destaque com <strong>borda amarela</strong> e <strong>selo de atenção</strong>.
                  </p>
                </div>
              </div>

              {/* Imagem URL (opcional) */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  URL da Foto (Opcional)
                </label>
                <input
                  type="text"
                  value={formImagem}
                  onChange={e => setFormImagem(e.target.value)}
                  placeholder="https://... ou caminho local da foto"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* Footer actions */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs rounded-xl shadow-xs transition"
                >
                  {produtoEditando ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Camera Barcode Scanner for Product Form */}
      {cameraCadastroAberta && (
        <CameraBarcodeScanner
          title="Escanear Etiqueta do Produto"
          continuous={false}
          onScan={code => {
            setFormCodigo(code);
            setCameraCadastroAberta(false);
            handleBuscarEspecificacoes(code);
          }}
          onClose={() => setCameraCadastroAberta(false)}
        />
      )}
    </div>
  );
};
