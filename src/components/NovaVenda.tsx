import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Produto, CartItem, FormaPagamento, FORMAS_PAGAMENTO, CATEGORIAS, CategoriaProduto, Venda } from '../types';
import { storage } from '../lib/storage';
import { playBeepSuccess, playBeepError } from '../lib/audio';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag, 
  AlertCircle, 
  CheckCircle2, 
  CreditCard, 
  Banknote, 
  QrCode,
  ArrowRight,
  Sparkles,
  Barcode,
  Camera,
  ChevronUp,
  X,
  Zap,
  Users
} from 'lucide-react';

interface NovaVendaProps {
  produtos: Produto[];
  onVendaConcluida: (novaVenda: Venda) => void;
  onRefreshProdutos: () => void;
}

export const NovaVenda: React.FC<NovaVendaProps> = ({
  produtos,
  onVendaConcluida,
  onRefreshProdutos
}) => {
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaProduto>('Todas');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('Pix');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [erroVenda, setErroVenda] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [isFinalizando, setIsFinalizando] = useState(false);

  // Barcode scanner states
  const [cameraAberta, setCameraAberta] = useState(false);
  const [codigoLeitorUsb, setCodigoLeitorUsb] = useState('');
  const leitorInputRef = useRef<HTMLInputElement | null>(null);

  // Mobile Cart Drawer State
  const [carrinhoMobileAberto, setCarrinhoMobileAberto] = useState(false);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Filtered products list
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(prod => {
      const matchBusca = 
        prod.nome.toLowerCase().includes(busca.toLowerCase()) ||
        prod.codigo_barras.toLowerCase().includes(busca.toLowerCase()) ||
        prod.categoria.toLowerCase().includes(busca.toLowerCase());

      const matchCategoria = 
        categoriaAtiva === 'Todas' || prod.categoria === categoriaAtiva;

      return matchBusca && matchCategoria;
    });
  }, [produtos, busca, categoriaAtiva]);

  // Cart calculations
  const totalItens = useMemo(() => {
    return carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  }, [carrinho]);

  const valorTotal = useMemo(() => {
    return carrinho.reduce((sum, item) => sum + (item.quantidade * item.produto.preco), 0);
  }, [carrinho]);

  // Add to cart with atomic stock validation
  const adicionarAoCarrinho = (produto: Produto) => {
    setErroVenda(null);
    if (produto.quantidade_estoque <= 0) {
      playBeepError();
      setErroVenda(`O item "${produto.nome}" está sem estoque.`);
      return;
    }

    setCarrinho(prev => {
      const itemExistente = prev.find(i => i.produto.id === produto.id);
      if (itemExistente) {
        if (itemExistente.quantidade >= produto.quantidade_estoque) {
          playBeepError();
          setErroVenda(`Limite atingido: só há ${produto.quantidade_estoque} un de "${produto.nome}" em estoque.`);
          return prev;
        }
        playBeepSuccess();
        return prev.map(i =>
          i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      } else {
        playBeepSuccess();
        return [...prev, { produto, quantidade: 1 }];
      }
    });

    setSucessoMsg(`+1 "${produto.nome}" adicionado`);
    setTimeout(() => setSucessoMsg(null), 1800);
  };

  // Process barcode input (from USB gun or Camera scanner)
  const processarCodigoBarras = (codigoBruto: string) => {
    const code = codigoBruto.trim();
    if (!code) return;

    const encontrado = produtos.find(
      p => (p.codigo_barras && p.codigo_barras.toLowerCase() === code.toLowerCase()) || p.id === code
    );

    if (encontrado) {
      adicionarAoCarrinho(encontrado);
      setCodigoLeitorUsb('');
    } else {
      playBeepError();
      setErroVenda(`Código "${code}" não foi localizado no estoque.`);
      setCodigoLeitorUsb('');
    }
  };

  // USB Barcode Scanner hardware listener
  useEffect(() => {
    let keyBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isSearchInput = activeEl?.getAttribute('data-search-input') === 'true';

      if (e.key === 'Enter') {
        if (keyBuffer.length >= 3 && !isSearchInput) {
          e.preventDefault();
          processarCodigoBarras(keyBuffer);
          keyBuffer = '';
        }
      } else if (e.key.length === 1) {
        const now = Date.now();
        if (now - lastKeyTime > 100) {
          keyBuffer = '';
        }
        keyBuffer += e.key;
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [produtos, carrinho]);

  // Decrement from cart
  const removerUnidade = (produtoId: string) => {
    setErroVenda(null);
    setCarrinho(prev => {
      const itemExistente = prev.find(i => i.produto.id === produtoId);
      if (!itemExistente) return prev;

      if (itemExistente.quantidade <= 1) {
        return prev.filter(i => i.produto.id !== produtoId);
      }

      return prev.map(i =>
        i.produto.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i
      );
    });
  };

  // Remove completely from cart
  const removerDoCarrinho = (produtoId: string) => {
    setErroVenda(null);
    setCarrinho(prev => prev.filter(i => i.produto.id !== produtoId));
  };

  // Clear cart
  const limparCarrinho = () => {
    setCarrinho([]);
    setErroVenda(null);
  };

  // Finalize Sale with Atomic Stock Deduction
  const handleFinalizarVenda = async () => {
    if (carrinho.length === 0) {
      setErroVenda('Adicione pelo menos um item ao carrinho para registrar a venda.');
      return;
    }

    if (formaPagamento.toLowerCase().includes('fiado') && !clienteNome.trim()) {
      setErroVenda('Por favor, informe o Nome da Cliente para registrar a venda como Fiado / A Prazo.');
      return;
    }

    setIsFinalizando(true);
    setErroVenda(null);

    try {
      const novaVenda = await storage.registrarVenda(
        carrinho, 
        formaPagamento, 
        clienteNome.trim() || undefined, 
        clienteWhatsapp.trim() || undefined
      );

      setCarrinho([]);
      setClienteNome('');
      setClienteWhatsapp('');
      setCarrinhoMobileAberto(false);
      setSucessoMsg(`Venda ${novaVenda.id} registrada com sucesso!`);
      setTimeout(() => setSucessoMsg(null), 3000);

      onRefreshProdutos();
      onVendaConcluida(novaVenda);
    } catch (err: any) {
      setErroVenda(err?.message || 'Erro ao registrar venda e baixar estoque.');
    } finally {
      setIsFinalizando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-6 relative">
      {/* Camera Barcode Scanner Modal */}
      {cameraAberta && (
        <CameraBarcodeScanner
          title="Escanear Semijoia pela Câmera"
          continuous={true}
          onScan={code => {
            processarCodigoBarras(code);
          }}
          onClose={() => setCameraAberta(false)}
        />
      )}

      {/* Notifications */}
      {erroVenda && (
        <div className="mb-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 shadow-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Atenção ao estoque:</p>
            <p className="text-rose-700 mt-0.5">{erroVenda}</p>
          </div>
          <button onClick={() => setErroVenda(null)} className="text-rose-500 hover:text-rose-700 font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {sucessoMsg && (
        <div className="mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{sucessoMsg}</span>
        </div>
      )}

      {/* Desktop USB Pistola Scanner Banner (Hidden on Mobile to save viewport) */}
      <div className="hidden sm:block mb-4 bg-gradient-to-r from-stone-900 to-stone-950 rounded-2xl p-4 border border-stone-800 text-stone-100 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-100">
                  Leitor de Código de Barras
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pistola USB Ativa
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Bipe qualquer etiqueta física diretamente no balcão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <form
              onSubmit={e => {
                e.preventDefault();
                processarCodigoBarras(codigoLeitorUsb);
              }}
              className="w-52 relative"
            >
              <input
                ref={leitorInputRef}
                type="text"
                value={codigoLeitorUsb}
                onChange={e => setCodigoLeitorUsb(e.target.value)}
                placeholder="Pistola USB ou código..."
                className="w-full pl-8 pr-3 py-2 bg-stone-800/90 border border-stone-700 rounded-xl text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-400 font-mono"
              />
              <Zap className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </form>

            <button
              type="button"
              onClick={() => setCameraAberta(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap min-h-[38px]"
            >
              <Camera className="w-4 h-4" />
              <span>Câmera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Catalog on left, Desktop Cart on right (Generous pb-36 for floating cart bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pb-36 lg:pb-0">
        {/* Left Side: Product Catalog (Col 7 / 8) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Unified Search & Category Filter Bar */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200/90 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  data-search-input="true"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar semijoia, categoria ou código..."
                  className="w-full pl-10 pr-9 py-3 bg-stone-50 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
                {busca && (
                  <button
                    onClick={() => setBusca('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 p-1.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Mobile Quick Camera Trigger right in the search bar (min 44px hit target) */}
              <button
                type="button"
                onClick={() => setCameraAberta(true)}
                className="sm:hidden w-12 h-12 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-xs active:scale-95 transition"
                title="Escanear etiqueta pela câmera"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Pills (Generous touch target, easy swiping) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              {CATEGORIAS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaAtiva(cat)}
                  className={`px-4 py-2 rounded-xl whitespace-nowrap transition cursor-pointer font-semibold min-h-[40px] flex items-center shrink-0 text-xs active:scale-95 ${
                    categoriaAtiva === cat
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid: Spacious, comfortable cards on mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
            {produtosFiltrados.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-8 sm:p-12 text-center border border-dashed border-stone-300">
                <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">Nenhuma semijoia encontrada</p>
                <p className="text-xs text-stone-400 mt-1">
                  Tente alterar os termos da busca ou filtre por outra categoria.
                </p>
              </div>
            ) : (
              produtosFiltrados.map(prod => {
                const emEstoque = prod.quantidade_estoque > 0;
                const estoqueBaixo = prod.quantidade_estoque > 0 && prod.quantidade_estoque <= 3;
                const noCarrinho = carrinho.find(i => i.produto.id === prod.id)?.quantidade || 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => emEstoque && adicionarAoCarrinho(prod)}
                    className={`group bg-white rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between shadow-xs select-none ${
                      !emEstoque
                        ? 'opacity-60 bg-stone-50 border-stone-200 cursor-not-allowed'
                        : 'border-stone-200/90 hover:border-amber-400 hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      {/* Product Image: Clean Square ratio */}
                      <div className="aspect-square w-full rounded-xl bg-stone-100 overflow-hidden mb-2.5 relative flex items-center justify-center border border-stone-100">
                        {prod.imagem_url ? (
                          <img
                            src={prod.imagem_url}
                            alt={prod.nome}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="text-stone-300 flex flex-col items-center justify-center p-2 text-center">
                            <Sparkles className="w-6 h-6 text-amber-400/80 mb-1" />
                            <span className="text-[10px] text-stone-400 font-serif">Lima Semijoias</span>
                          </div>
                        )}

                        {/* Stock Badge Overlay */}
                        <div className="absolute top-1.5 right-1.5">
                          {!emEstoque ? (
                            <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded-md shadow-xs">
                              Esgotado
                            </span>
                          ) : estoqueBaixo ? (
                            <span className="text-[10px] font-bold bg-amber-500 text-stone-950 px-2 py-0.5 rounded-md shadow-xs">
                              Resta {prod.quantidade_estoque}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium bg-stone-950/75 text-stone-100 backdrop-blur-xs px-2 py-0.5 rounded-md">
                              {prod.quantidade_estoque} un
                            </span>
                          )}
                        </div>

                        {/* In cart badge */}
                        {noCarrinho > 0 && (
                          <div className="absolute bottom-1.5 left-1.5 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                            ✓ {noCarrinho} un
                          </div>
                        )}
                      </div>

                      {/* Product Title & Info */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span className="font-semibold text-amber-800 uppercase tracking-wide">
                            {prod.categoria}
                          </span>
                          {prod.codigo_barras && (
                            <span className="font-mono text-[10px] truncate max-w-[70px]">#{prod.codigo_barras}</span>
                          )}
                        </div>
                        {/* Minimum height so cards stay aligned regardless of 1 or 2 lines */}
                        <h3 className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2 leading-snug min-h-[2.4rem]">
                          {prod.nome}
                        </h3>
                      </div>
                    </div>

                    {/* Bottom Price & Add Action Button */}
                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-1.5">
                      <span className="text-sm sm:text-base font-bold text-stone-900 tabular-nums">
                        {formatCurrency(prod.preco)}
                      </span>

                      <button
                        type="button"
                        disabled={!emEstoque}
                        onClick={e => {
                          e.stopPropagation();
                          if (emEstoque) adicionarAoCarrinho(prod);
                        }}
                        className={`w-10 h-10 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0 ${
                          !emEstoque
                            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            : 'bg-stone-900 hover:bg-amber-600 text-white shadow-xs active:scale-90 cursor-pointer'
                        }`}
                        title="Adicionar à venda"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Desktop Checkout Module (Col 5 / 4) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-md p-5 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-600" />
              <h2 className="font-serif text-lg font-bold text-stone-900">
                Itens da Venda
              </h2>
            </div>
            {carrinho.length > 0 && (
              <button
                onClick={limparCarrinho}
                className="text-xs text-stone-400 hover:text-rose-600 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto my-3 pr-1">
            {carrinho.length === 0 ? (
              <div className="py-12 text-center text-stone-400">
                <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto mb-2 opacity-70" />
                <p className="text-xs font-medium text-stone-500">O carrinho está vazio</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Bipe o código de barras ou clique nos produtos para adicionar.
                </p>
              </div>
            ) : (
              carrinho.map(item => (
                <div key={item.produto.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-xs font-semibold text-stone-900 truncate">
                      {item.produto.nome}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {formatCurrency(item.produto.preco)} un · Subtotal:{' '}
                      <span className="font-medium text-stone-700">
                        {formatCurrency(item.quantidade * item.produto.preco)}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 bg-stone-100 p-1 rounded-lg">
                    <button
                      onClick={() => removerUnidade(item.produto.id)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-white text-stone-700 hover:bg-stone-200 transition"
                      title="Diminuir"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-stone-900 w-5 text-center tabular-nums">
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() => adicionarAoCarrinho(item.produto)}
                      disabled={item.quantidade >= item.produto.quantidade_estoque}
                      className={`w-6 h-6 rounded flex items-center justify-center transition ${
                        item.quantidade >= item.produto.quantidade_estoque
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                          : 'bg-white text-stone-700 hover:bg-stone-200'
                      }`}
                      title="Aumentar"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removerDoCarrinho(item.produto.id)}
                    className="text-stone-300 hover:text-rose-500 p-1 transition"
                    title="Remover item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="pt-3 border-t border-stone-100 space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              Forma de Pagamento:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMAS_PAGAMENTO.map(forma => (
                <button
                  key={forma}
                  type="button"
                  onClick={() => setFormaPagamento(forma)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left flex items-center gap-1.5 ${
                    formaPagamento === forma
                      ? 'bg-amber-100/90 text-amber-950 border border-amber-300 font-semibold'
                      : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200/70'
                  }`}
                >
                  {forma === 'Pix' && <QrCode className="w-3.5 h-3.5 text-emerald-600" />}
                  {forma.includes('Cartão') && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                  {forma === 'Dinheiro' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                  {forma === 'Transferência' && <ArrowRight className="w-3.5 h-3.5 text-purple-600" />}
                  {forma.includes('Fiado') && <Users className="w-3.5 h-3.5 text-amber-700" />}
                  <span className="truncate">{forma}</span>
                </button>
              ))}
            </div>

            {/* Client Info input when Fiado is selected */}
            {formaPagamento.toLowerCase().includes('fiado') && (
              <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-2 text-xs animate-in fade-in">
                <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-700" />
                  <span>Identificação da Cliente (Fiado V2):</span>
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-0.5">
                    Nome da Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={clienteNome}
                    onChange={e => setClienteNome(e.target.value)}
                    placeholder="Ex: Mariana Castro"
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-0.5">
                    WhatsApp (DDD + Número)
                  </label>
                  <input
                    type="text"
                    value={clienteWhatsapp}
                    onChange={e => setClienteWhatsapp(e.target.value)}
                    placeholder="Ex: 11987654321"
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="mt-4 pt-3 border-t border-stone-200 space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Quantidade de Peças:</span>
              <span className="font-semibold text-stone-800">{totalItens} un</span>
            </div>
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-semibold text-stone-900">Total da Venda:</span>
              <span className="text-2xl font-bold font-serif text-stone-900 tabular-nums">
                {formatCurrency(valorTotal)}
              </span>
            </div>
          </div>

          {/* Finalize Button */}
          <button
            type="button"
            disabled={carrinho.length === 0 || isFinalizando}
            onClick={handleFinalizarVenda}
            className={`w-full mt-4 py-3 rounded-xl font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md ${
              carrinho.length === 0 || isFinalizando
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 active:scale-98 shadow-amber-900/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isFinalizando ? 'Registrando Venda...' : `Concluir Venda (${formatCurrency(valorTotal)})`}
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE FLOATING CART BAR: Placed comfortably at bottom-20, clearing the fixed bottom navbar with generous air */}
      {carrinho.length > 0 && (
        <div className="lg:hidden fixed bottom-20 left-3 right-3 sm:left-6 sm:right-6 z-30 pointer-events-none animate-in slide-in-from-bottom duration-200">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setCarrinhoMobileAberto(true)}
              className="w-full bg-stone-950/95 text-white rounded-2xl p-4 shadow-2xl border border-stone-800 backdrop-blur-md flex items-center justify-between active:scale-98 transition cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-sm shadow-xs">
                  {totalItens}
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                    Carrinho ({totalItens} {totalItens === 1 ? 'peça' : 'peças'})
                  </p>
                  <p className="text-base font-bold text-amber-200 tabular-nums">
                    {formatCurrency(valorTotal)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 bg-stone-800/90 px-3.5 py-2 rounded-xl border border-stone-700/80 shadow-xs">
                <span>Ver Carrinho</span>
                <ChevronUp className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET CART DRAWER */}
      {carrinhoMobileAberto && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-h-[90vh] bg-white rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-250">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-3" />

            <div className="px-5 pb-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  Carrinho de Venda
                </h3>
                <span className="text-xs text-stone-500 font-medium">
                  ({totalItens} {totalItens === 1 ? 'peça' : 'peças'})
                </span>
              </div>
              <button
                onClick={() => setCarrinhoMobileAberto(false)}
                className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Items in Mobile Drawer with generous spacing */}
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-stone-100">
              {carrinho.length === 0 ? (
                <div className="py-12 text-center text-stone-400">
                  <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-2 opacity-70" />
                  <p className="text-sm font-semibold text-stone-600">O carrinho está vazio</p>
                </div>
              ) : (
                carrinho.map(item => (
                  <div key={item.produto.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {item.produto.nome}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {formatCurrency(item.produto.preco)} un ·{' '}
                        <strong className="text-stone-800">
                          {formatCurrency(item.quantidade * item.produto.preco)}
                        </strong>
                      </p>
                    </div>

                    {/* Touch Friendly Stepper Hitbox >= 44px */}
                    <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                      <button
                        onClick={() => removerUnidade(item.produto.id)}
                        className="w-10 h-10 rounded-lg bg-white text-stone-800 flex items-center justify-center active:scale-95 shadow-xs font-bold"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs tabular-nums text-stone-900">
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => adicionarAoCarrinho(item.produto)}
                        disabled={item.quantidade >= item.produto.quantidade_estoque}
                        className="w-10 h-10 rounded-lg bg-white text-stone-800 flex items-center justify-center active:scale-95 shadow-xs font-bold disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => removerDoCarrinho(item.produto.id)}
                      className="p-2.5 text-stone-400 hover:text-rose-600 active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Mobile Drawer Checkout Controls */}
            <div className="p-5 bg-stone-50 border-t border-stone-200 space-y-3.5 pb-safe">
              {/* Payment selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Forma de Pagamento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS_PAGAMENTO.map(forma => (
                    <button
                      key={forma}
                      type="button"
                      onClick={() => setFormaPagamento(forma)}
                      className={`px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer text-left flex items-center gap-2 min-h-[48px] active:scale-98 ${
                        formaPagamento === forma
                          ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 font-bold shadow-xs'
                          : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {forma === 'Pix' && <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {forma.includes('Cartão') && <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />}
                      {forma === 'Dinheiro' && <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {forma === 'Transferência' && <ArrowRight className="w-4 h-4 text-purple-600 shrink-0" />}
                      {forma.includes('Fiado') && <Users className="w-4 h-4 text-amber-700 shrink-0" />}
                      <span className="truncate">{forma}</span>
                    </button>
                  ))}
                </div>

                {/* V2: Client Info input in Mobile Drawer */}
                {formaPagamento.toLowerCase().includes('fiado') && (
                  <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl space-y-2.5 text-xs animate-in fade-in">
                    <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-700" />
                      <span>Identificação da Cliente (Fiado V2):</span>
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Nome da Cliente *
                      </label>
                      <input
                        type="text"
                        required
                        value={clienteNome}
                        onChange={e => setClienteNome(e.target.value)}
                        placeholder="Ex: Mariana Castro"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        WhatsApp (DDD + Número)
                      </label>
                      <input
                        type="text"
                        value={clienteWhatsapp}
                        onChange={e => setClienteWhatsapp(e.target.value)}
                        placeholder="Ex: 11987654321"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total & Action */}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs text-stone-500 font-medium">Total da Venda:</span>
                <span className="text-2xl font-bold font-serif text-stone-900 tabular-nums">
                  {formatCurrency(valorTotal)}
                </span>
              </div>

              <button
                type="button"
                disabled={carrinho.length === 0 || isFinalizando}
                onClick={handleFinalizarVenda}
                className={`w-full py-4 rounded-xl font-bold text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg min-h-[52px] active:scale-98 ${
                  carrinho.length === 0 || isFinalizando
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 shadow-amber-900/20'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {isFinalizando ? 'Finalizando...' : `Concluir Venda (${formatCurrency(valorTotal)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
