import React, { useState, useMemo, useRef } from 'react';
import { 
  Produto, 
  CATEGORIAS, 
  CategoriaProduto, 
  Fornecedor, 
  FornecedorProdutoRef, 
  HistoricoPrecoFornecedor 
} from '../types';
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
  Zap,
  Image as ImageIcon,
  Upload,
  Truck,
  History,
  Building2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

/**
 * Compresses and resizes an image file in the browser (max 900px, JPEG 0.85)
 * Resilient to mobile formats (HEIC, RAW, PNG, JPEG) with automatic raw fallback.
 */
async function compressImageFile(file: File, maxDimension = 900, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        resolve('');
        return;
      }
      try {
        const img = new window.Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(rawDataUrl);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl || rawDataUrl);
          } catch {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => {
          // If canvas can't decode (e.g. mobile format), use raw data url
          resolve(rawDataUrl);
        };
        img.src = rawDataUrl;
      } catch {
        resolve(rawDataUrl);
      }
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
}

interface ProdutosEstoqueProps {
  produtos: Produto[];
  onRefresh: () => void;
  onNavigateToFornecedores?: () => void;
}

export const ProdutosEstoque: React.FC<ProdutosEstoqueProps> = ({ 
  produtos, 
  onRefresh,
  onNavigateToFornecedores 
}) => {
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaProduto>('Todas');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'baixo' | 'zerado'>('todos');

  // Modal State for New/Edit Product
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [cameraCadastroAberta, setCameraCadastroAberta] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [mostrarUrlManual, setMostrarUrlManual] = useState(false);

  // Hidden File Inputs for Camera & Gallery
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galeriaInputRef = useRef<HTMLInputElement>(null);

  // Handle Camera or Gallery photo selection with instant optimization
  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessandoFoto(true);
    setFormErro(null);
    try {
      const dataUrl = await compressImageFile(file, 900, 0.85);
      setFormImagem(dataUrl);
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      setFormErro('Não foi possível carregar a foto selecionada. Tente novamente.');
    } finally {
      setProcessandoFoto(false);
      // Reset input values so picking the same file again still fires onChange
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galeriaInputRef.current) galeriaInputRef.current.value = '';
    }
  };

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

  // V3: Fornecedores vinculados ao produto
  const [formFornecedores, setFormFornecedores] = useState<FornecedorProdutoRef[]>([]);
  const [fornecedoresCadastrados, setFornecedoresCadastrados] = useState<Fornecedor[]>([]);
  const [novoFornId, setNovoFornId] = useState('');
  const [novoFornCusto, setNovoFornCusto] = useState('');
  const [historicoAbertoFornId, setHistoricoAbertoFornId] = useState<string | null>(null);

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
    setFormFornecedores([]);
    setFornecedoresCadastrados(storage.getFornecedores());
    setNovoFornId('');
    setNovoFornCusto('');
    setHistoricoAbertoFornId(null);
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
    setFormFornecedores(Array.isArray(prod.fornecedores) ? JSON.parse(JSON.stringify(prod.fornecedores)) : []);
    setFornecedoresCadastrados(storage.getFornecedores());
    setNovoFornId('');
    setNovoFornCusto('');
    setHistoricoAbertoFornId(null);
    setModalAberto(true);
  };

  // Vincula ou atualiza fornecedor na lista temporária do formulário
  const handleVincularFornecedorForm = () => {
    if (!novoFornId) {
      setFormErro('Selecione um fornecedor para vincular.');
      return;
    }
    const custo = parseFloat(novoFornCusto.replace(',', '.'));
    if (isNaN(custo) || custo < 0) {
      setFormErro('Digite um preço de custo válido para o fornecedor.');
      return;
    }

    const dataHoraIso = new Date().toISOString();
    setFormFornecedores(prev => {
      const idx = prev.findIndex(item => item.fornecedorId === novoFornId);
      if (idx >= 0) {
        const atual = prev[idx];
        if (Number(atual.precoCusto) !== custo) {
          const historico = Array.isArray(atual.historicoPrecos) ? [...atual.historicoPrecos] : [];
          historico.unshift({
            precoCusto: Number(atual.precoCusto),
            dataAtualizacaoPreco: atual.dataAtualizacaoPreco || dataHoraIso
          });
          const copy = [...prev];
          copy[idx] = {
            ...atual,
            precoCusto: custo,
            dataAtualizacaoPreco: dataHoraIso,
            historicoPrecos: historico
          };
          return copy;
        }
        return prev;
      }
      return [
        ...prev,
        {
          fornecedorId: novoFornId,
          precoCusto: custo,
          dataAtualizacaoPreco: dataHoraIso,
          historicoPrecos: []
        }
      ];
    });

    if (!formPrecoCusto || parseFloat(formPrecoCusto.replace(',', '.')) === 0) {
      setFormPrecoCusto(novoFornCusto);
    }

    setNovoFornId('');
    setNovoFornCusto('');
    setFormErro(null);
  };

  const handleAlterarCustoFornecedorExistente = (fornecedorId: string, novoCustoStr: string) => {
    const custo = parseFloat(novoCustoStr.replace(',', '.'));
    if (isNaN(custo) || custo < 0) return;

    const dataHoraIso = new Date().toISOString();
    setFormFornecedores(prev => {
      return prev.map(item => {
        if (item.fornecedorId === fornecedorId) {
          if (Number(item.precoCusto) !== custo) {
            const historico = Array.isArray(item.historicoPrecos) ? [...item.historicoPrecos] : [];
            historico.unshift({
              precoCusto: Number(item.precoCusto),
              dataAtualizacaoPreco: item.dataAtualizacaoPreco || dataHoraIso
            });
            return {
              ...item,
              precoCusto: custo,
              dataAtualizacaoPreco: dataHoraIso,
              historicoPrecos: historico
            };
          }
        }
        return item;
      });
    });
  };

  const handleRemoverFornecedorForm = (fornecedorId: string) => {
    setFormFornecedores(prev => prev.filter(item => item.fornecedorId !== fornecedorId));
  };

  // Busca e puxa as especificações a partir do código de barras
  const handleBuscarEspecificacoes = async (codigoOpcional?: string) => {
    const cod = (codigoOpcional !== undefined ? codigoOpcional : formCodigo).trim();
    if (!cod) {
      setFormErro('Por favor, informe ou escaneie um código de barras.');
      return;
    }

    setCarregandoSpecs(true);
    setFormErro(null);

    try {
      const specs = await buscarEspecificacoesPorCodigo(cod);
      if (specs && specs.found && specs.nome) {
        setFormNome(specs.nome);
        if (specs.categoria) setFormCategoria(specs.categoria);
        if (specs.preco_sugerido) setFormPreco(specs.preco_sugerido.toFixed(2));
        if (specs.preco_custo_estimado) setFormPrecoCusto(specs.preco_custo_estimado.toFixed(2));
        if (specs.imagem_url) setFormImagem(specs.imagem_url);
        if (specs.estoque_sugerido) setFormEstoque(specs.estoque_sugerido.toString());

        setSpecsInfo({
          texto: `Peça já existente encontrada: "${specs.nome}"`,
          detalhes: specs.especificacoes_tecnicas || 'Dados carregados do estoque atual da loja.',
          fonte: 'Estoque da Loja'
        });
      } else {
        // Código novo: não inventa dados falsos, apenas confirma o código
        setFormCodigo(cod);
        setSpecsInfo({
          texto: `Código ${cod} registrado com sucesso!`,
          detalhes: 'Preencha o nome, categoria e valor da nova semijoia.',
          fonte: 'Nova Peça'
        });
      }
    } catch (err: any) {
      setFormErro(err?.message || 'Erro ao consultar código.');
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
          imagem_url: formImagem.trim() || undefined,
          fornecedores: formFornecedores
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
          imagem_url: formImagem.trim() || undefined,
          fornecedores: formFornecedores
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

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToFornecedores && (
            <button
              onClick={onNavigateToFornecedores}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300 font-semibold text-xs transition cursor-pointer active:scale-98 whitespace-nowrap min-h-[42px]"
            >
              <Truck className="w-4 h-4 text-amber-600" />
              <span>Fornecedores & Pedidos</span>
            </button>
          )}

          <button
            onClick={handleNovoProduto}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-amber-600 text-white font-semibold text-xs shadow-md transition cursor-pointer active:scale-98 whitespace-nowrap min-h-[42px]"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Novo Produto</span>
          </button>
        </div>
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

                      {Array.isArray(prod.fornecedores) && prod.fornecedores.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1 w-fit">
                          <Truck className="w-3 h-3 text-amber-700" />
                          <span>{prod.fornecedores.length} fornecedor{prod.fornecedores.length === 1 ? '' : 'es'}</span>
                        </div>
                      )}
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
                <th className="py-3 px-4">Fornecedores</th>
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

                      {/* Fornecedores vinculados */}
                      <td className="py-3 px-4">
                        {Array.isArray(prod.fornecedores) && prod.fornecedores.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 w-fit">
                              <Truck className="w-3 h-3 text-amber-700" />
                              <span>{prod.fornecedores.length} fornecedor{prod.fornecedores.length === 1 ? '' : 'es'}</span>
                            </span>
                            {prod.fornecedores.slice(0, 2).map(vinculo => {
                              const forn = fornecedoresCadastrados.find(f => f.id === vinculo.fornecedorId);
                              return (
                                <span 
                                  key={vinculo.fornecedorId} 
                                  className="text-[10px] text-stone-600 truncate max-w-[130px]" 
                                  title={`${forn?.nome || 'Fornecedor'}: ${formatCurrency(vinculo.precoCusto)}`}
                                >
                                  {forn?.nome || 'Fornecedor'}: {formatCurrency(vinculo.precoCusto)}
                                </span>
                              );
                            })}
                            {prod.fornecedores.length > 2 && (
                              <span className="text-[9px] text-stone-400 italic">
                                +{prod.fornecedores.length - 2} outro(s)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-300 italic">—</span>
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

      {/* Modal: New / Edit Product with full scrolling and fixed header & footer */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header (Fixed at top) */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-stone-900 text-stone-100 shrink-0 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  {produtoEditando ? <Edit3 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="font-serif text-base sm:text-lg font-bold text-amber-200 leading-tight">
                    {produtoEditando ? 'Editar Semijoia' : 'Cadastrar Nova Semijoia'}
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    {produtoEditando ? `Código: ${produtoEditando.codigo_barras || produtoEditando.id}` : 'Preencha os dados da peça para estoque e PDV'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-100 flex items-center justify-center transition cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Container with Scrollable Body and Fixed Footer */}
            <form onSubmit={handleSalvarProduto} className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* Scrollable Form Body */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
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

                {/* Seção 1: Identificação da Peça */}
                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/80 space-y-3.5">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                    1. Identificação da Peça
                  </span>

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
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 shadow-2xs font-medium text-stone-900"
                    />
                  </div>

                  {/* Categoria & Código de Barras */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Categoria *
                      </label>
                      <select
                        value={formCategoria}
                        onChange={e => setFormCategoria(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 shadow-2xs font-medium text-stone-800"
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
                          className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold inline-flex items-center gap-1 cursor-pointer bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300 transition"
                        >
                          <Camera className="w-3 h-3 text-amber-700" />
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
                          className="w-full pl-3.5 pr-26 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 shadow-2xs font-mono"
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
                    </div>
                  </div>
                </div>

                {/* Seção 2: Precificação & Lucro */}
                <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/80 space-y-3.5">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                    2. Precificação & Margem de Lucro
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 font-mono font-bold text-amber-950 shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Preço de Custo (R$)
                      </label>
                      <input
                        type="text"
                        value={formPrecoCusto}
                        onChange={e => setFormPrecoCusto(e.target.value)}
                        placeholder="Ex: 52.00 (custo de fábrica)"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 font-mono text-stone-800 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Indicador de Lucro em tempo real */}
                  {Boolean(formPreco && parseFloat(formPreco.replace(',', '.')) > 0) && (
                    <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                      <span className="text-stone-600">Lucro Bruto Estimado:</span>
                      {(() => {
                        const venda = parseFloat(formPreco.replace(',', '.')) || 0;
                        const custo = parseFloat(formPrecoCusto.replace(',', '.')) || 0;
                        const lucro = venda - custo;
                        const margem = venda > 0 ? (lucro / venda) * 100 : 0;
                        return (
                          <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                            <span>{formatCurrency(lucro)}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                              {margem.toFixed(0)}% margem
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Seção 3: Fornecedores Vinculados & Preço de Custo */}
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/90 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                        3. Fornecedores da Peça & Histórico de Preço de Custo
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Vincule múltiplos fornecedores a este produto, cada um com seu preço de custo.
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      {formFornecedores.length} vinculado(s)
                    </span>
                  </div>

                  {/* Lista de Fornecedores Vinculados */}
                  {formFornecedores.length > 0 ? (
                    <div className="space-y-2">
                      {formFornecedores.map(vinculo => {
                        const forn = fornecedoresCadastrados.find(f => f.id === vinculo.fornecedorId);
                        const nomeForn = forn?.nome || `Fornecedor (${vinculo.fornecedorId})`;
                        const temHistorico = Array.isArray(vinculo.historicoPrecos) && vinculo.historicoPrecos.length > 0;
                        const aberto = historicoAbertoFornId === vinculo.fornecedorId;

                        return (
                          <div 
                            key={vinculo.fornecedorId}
                            className="bg-white rounded-xl border border-amber-200 p-3 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                                <div>
                                  <span className="font-bold text-stone-900 text-xs block leading-tight">
                                    {nomeForn}
                                  </span>
                                  <span className="text-[10px] text-stone-400">
                                    Atualizado: {vinculo.dataAtualizacaoPreco ? new Date(vinculo.dataAtualizacaoPreco).toLocaleDateString('pt-BR') : '-'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-stone-500 font-semibold">Custo:</span>
                                  <input
                                    type="text"
                                    value={vinculo.precoCusto}
                                    onChange={e => handleAlterarCustoFornecedorExistente(vinculo.fornecedorId, e.target.value)}
                                    className="w-20 px-2 py-1 bg-amber-50 rounded-lg border border-amber-300 text-xs font-mono font-bold text-right text-amber-950 focus:bg-white focus:outline-none"
                                    title="Alterar preço de custo (o valor anterior será arquivado no histórico)"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoverFornecedorForm(vinculo.fornecedorId)}
                                  className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Remover fornecedor deste produto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Botão de Histórico de Preços se houver */}
                            {temHistorico && (
                              <div className="pt-1 border-t border-stone-100">
                                <button
                                  type="button"
                                  onClick={() => setHistoricoAbertoFornId(aberto ? null : vinculo.fornecedorId)}
                                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                                >
                                  <History className="w-3 h-3 text-amber-600" />
                                  <span>Histórico de Preços ({vinculo.historicoPrecos?.length} anterior{vinculo.historicoPrecos?.length === 1 ? '' : 'es'})</span>
                                  {aberto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>

                                {aberto && (
                                  <div className="mt-2 bg-stone-50 rounded-lg p-2 space-y-1 text-[11px] text-stone-600 border border-stone-200">
                                    <div className="font-semibold text-stone-800 text-[10px] uppercase">Evolução do Preço de Custo:</div>
                                    <div className="flex items-center justify-between text-emerald-800 font-bold">
                                      <span>Preço Atual:</span>
                                      <span>{formatCurrency(vinculo.precoCusto)} ({vinculo.dataAtualizacaoPreco ? new Date(vinculo.dataAtualizacaoPreco).toLocaleDateString('pt-BR') : 'Hoje'})</span>
                                    </div>
                                    {vinculo.historicoPrecos?.map((hist, hIdx) => (
                                      <div key={hIdx} className="flex items-center justify-between text-stone-500">
                                        <span>Anterior #{vinculo.historicoPrecos!.length - hIdx}:</span>
                                        <span className="font-mono">{formatCurrency(hist.precoCusto)} em {new Date(hist.dataAtualizacaoPreco).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 italic bg-white/70 p-3 rounded-xl border border-amber-200/60">
                      Nenhum fornecedor vinculado a esta peça ainda. Selecione abaixo para vincular.
                    </p>
                  )}

                  {/* Adicionar Fornecedor */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                    <span className="text-[11px] font-bold text-stone-700 block">
                      + Vincular Fornecedor à Peça
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-7">
                        <select
                          value={novoFornId}
                          onChange={e => setNovoFornId(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-stone-50 focus:bg-white focus:outline-none"
                        >
                          <option value="">Selecione o fornecedor...</option>
                          {fornecedoresCadastrados
                            .filter(fc => !formFornecedores.some(v => v.fornecedorId === fc.id))
                            .map(fc => (
                              <option key={fc.id} value={fc.id}>
                                {fc.nome}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          placeholder="Custo R$"
                          value={novoFornCusto}
                          onChange={e => setNovoFornCusto(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-mono text-right"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleVincularFornecedorForm}
                          disabled={!novoFornId || !novoFornCusto}
                          className="w-full py-1.5 px-2 bg-stone-900 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Vincular
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 4: Controle de Estoque */}
                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/80 space-y-3.5">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                    4. Saldo Físico & Alerta de Atenção
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        placeholder="Ex: 8"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 shadow-2xs font-semibold"
                      />
                      <p className="text-[10px] text-stone-500 mt-1">Saldo físico disponível no balcão.</p>
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
                        className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 shadow-2xs font-semibold text-amber-950"
                      />
                      <p className="text-[10px] text-stone-500 mt-1">
                        Ativa a <strong>borda amarela</strong> e o <strong>selo de atenção</strong> na lista.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seção 4: Foto da Peça (Câmera ou Galeria) */}
                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200/80 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                      4. Foto da Semijoia (Câmera ou Galeria)
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarUrlManual(!mostrarUrlManual)}
                      className="text-[10px] text-stone-500 hover:text-stone-800 underline cursor-pointer"
                    >
                      {mostrarUrlManual ? 'Ocultar Link URL' : 'Colar Link URL'}
                    </button>
                  </div>

                  {/* Two Main Photo Action Labels (Native OS Tap - Zero JS Block) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Botão 1: Câmera do Celular */}
                    <label className="py-3 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs border border-amber-600/30">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFotoSelecionada}
                        disabled={processandoFoto}
                        className="sr-only"
                      />
                      <Camera className="w-4 h-4 text-stone-950 shrink-0" />
                      <div className="text-left leading-tight">
                        <span className="block font-bold">Tirar Foto na Hora</span>
                        <span className="text-[10px] font-normal opacity-85">Câmera do celular/PC</span>
                      </div>
                    </label>

                    {/* Botão 2: Escolher da Galeria */}
                    <label className="py-3 px-3.5 rounded-xl bg-white hover:bg-stone-100 active:scale-98 text-stone-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs border border-stone-300">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/*"
                        onChange={handleFotoSelecionada}
                        disabled={processandoFoto}
                        className="sr-only"
                      />
                      <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="text-left leading-tight">
                        <span className="block font-bold">Escolher da Galeria</span>
                        <span className="text-[10px] font-normal text-stone-500">Fotos salvas no celular</span>
                      </div>
                    </label>
                  </div>

                  {/* Processing indicator */}
                  {processandoFoto && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-amber-900 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                      <span>Otimizando e preparando a foto da joia...</span>
                    </div>
                  )}

                  {/* Preview da Imagem Selecionada */}
                  {Boolean(formImagem && formImagem.trim()) ? (
                    <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3.5 animate-in fade-in">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-stone-100 border-2 border-amber-400 shadow-sm shrink-0">
                        <img
                          src={formImagem}
                          alt="Prévia da joia"
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Foto Carregada com Sucesso</span>
                        </div>
                        <p className="text-xs text-stone-500 leading-tight">
                          Esta imagem aparecerá no catálogo, na busca rápida do PDV e no recibo impresso.
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition cursor-pointer"
                          >
                            Tirar Outra
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormImagem('')}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remover Foto</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-[11px] text-stone-400">
                      Nenhuma foto vinculada ainda. Use a câmera ou galeria acima para adicionar uma foto.
                    </div>
                  )}

                  {/* Campo de URL Manual (Opcional) */}
                  {mostrarUrlManual && (
                    <div className="pt-2 border-t border-stone-200/60 space-y-1 animate-in fade-in">
                      <label className="block text-[11px] font-medium text-stone-600">
                        Link URL da imagem (opcional):
                      </label>
                      <input
                        type="text"
                        value={formImagem}
                        onChange={e => setFormImagem(e.target.value)}
                        placeholder="https://... ou /images/..."
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 font-mono shadow-2xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer (Sticky at bottom, never cut off!) */}
              <div className="shrink-0 px-5 sm:px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{produtoEditando ? 'Salvar Alterações' : 'Cadastrar Produto'}</span>
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
