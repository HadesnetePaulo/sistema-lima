import { 
  Produto, 
  Venda, 
  CartItem, 
  MovimentacaoCaixa, 
  LancamentoFiado, 
  ResumoClienteFiado, 
  ContaCliente,
  Fornecedor,
  PedidoCompra,
  StatusPedidoCompra,
  FornecedorProdutoRef
} from '../types';
import { safeLocalStorage, safeSessionStorage } from './safeStorage';
import {
  fetchStateFromFirestore,
  saveStateToFirestore,
  testFirestoreConnection
} from './firebase';
import {
  getSupabaseClient,
  fetchProdutosSupabase,
  addProdutoSupabase,
  updateProdutoSupabase,
  deleteProdutoSupabase,
  ajustarEstoqueSupabase,
  fetchVendasSupabase,
  registrarVendaSupabase,
  fetchMovimentacoesCaixaSupabase,
  addMovimentacaoCaixaSupabase,
  deleteMovimentacaoCaixaSupabase,
  fetchFiadosSupabase,
  addLancamentoFiadoSupabase,
  deleteLancamentoFiadoSupabase
} from './supabase';

// Default initial catalog for Lima Semijoias boutique (now with realistic wholesale cost preco_custo)
export const PRODUTOS_INICIAIS: Produto[] = [
  {
    id: 'prod-001',
    nome: 'Anel Solitário Cravejado Ouro 18k',
    categoria: 'Anéis',
    codigo_barras: '7891001001',
    preco: 149.90,
    preco_custo: 52.00,
    quantidade_estoque: 8,
    imagem_url: '/images/jewelry_gold_ring_1790817500224.jpg',
    created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
  },
  {
    id: 'prod-002',
    nome: 'Colar Gargantilha Pérola Barroca Ouro 18k',
    categoria: 'Colares',
    codigo_barras: '7891001002',
    preco: 189.00,
    preco_custo: 68.00,
    quantidade_estoque: 5,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    created_at: new Date('2026-09-02T11:00:00Z').toISOString(),
  },
  {
    id: 'prod-003',
    nome: 'Argola Micro Pavê com Zircônias Banho Ouro',
    categoria: 'Brincos',
    codigo_barras: '7891001003',
    preco: 119.50,
    preco_custo: 39.00,
    quantidade_estoque: 12,
    imagem_url: '/images/jewelry_crystal_earrings_1790817517916.jpg',
    created_at: new Date('2026-09-03T12:00:00Z').toISOString(),
  },
  {
    id: 'prod-004',
    nome: 'Pulseira Elo Português Fecho Boia',
    categoria: 'Pulseiras',
    codigo_barras: '7891001004',
    preco: 169.00,
    preco_custo: 58.00,
    quantidade_estoque: 6,
    imagem_url: '/images/jewelry_chain_bracelet_1790817526953.jpg',
    created_at: new Date('2026-09-04T14:30:00Z').toISOString(),
  },
  {
    id: 'prod-005',
    nome: 'Tornozeleira Corações Vazados Banhada a Ouro',
    categoria: 'Tornozeleiras',
    codigo_barras: '7891001005',
    preco: 89.90,
    preco_custo: 28.00,
    quantidade_estoque: 4,
    imagem_url: '/images/jewelry_chain_bracelet_1790817526953.jpg',
    created_at: new Date('2026-09-05T15:00:00Z').toISOString(),
  },
  {
    id: 'prod-006',
    nome: 'Conjunto Ponto de Luz Brinco + Corrente',
    categoria: 'Conjuntos',
    codigo_barras: '7891001006',
    preco: 220.00,
    preco_custo: 75.00,
    quantidade_estoque: 3,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    created_at: new Date('2026-09-06T16:00:00Z').toISOString(),
  }
];

const STORAGE_KEY_PRODUTOS = 'lima_semijoias_produtos_v1';
const STORAGE_KEY_VENDAS = 'lima_semijoias_vendas_v1';
const STORAGE_KEY_CAIXA = 'lima_semijoias_caixa_v2';
const STORAGE_KEY_FIADOS = 'lima_semijoias_fiados_v2';
const STORAGE_KEY_FORNECEDORES = 'lima_semijoias_fornecedores_v3';
const STORAGE_KEY_PEDIDOS_COMPRA = 'lima_semijoias_pedidos_compra_v3';
const STORAGE_KEY_AUTH = 'lima_semijoias_auth_v2';
const STORAGE_KEY_CUSTOM_PASSWORD = 'lima_semijoias_custom_password_v1';
const DEFAULT_PASSWORD = '123456';

// Helper for server API calls
async function callServerApi<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Helper to merge arrays of entities by ID:
// Adds local items first, and remote (cloud) items overlay existing IDs so stock updates and new sales are respected across devices!
function mergeArraysById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  // 1. Local items first (e.g. offline created items)
  for (const item of local) {
    if (item && item.id) map.set(item.id, item);
  }
  // 2. Remote items (Cloud / Shared Platform) take precedence for existing items
  for (const item of remote) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export const storage = {
  // Cloud & Multi-Device Persistent Synchronization (Firebase Firestore + Server)
  async persistirEmTodasNuvens(): Promise<void> {
    const produtos = this.getProdutos();
    const vendas = this.getVendas();
    const caixa = this.getMovimentacoesCaixa();
    const fiados = this.getFiados();
    const fornecedores = this.getFornecedores();
    const pedidosCompra = this.getPedidosCompra();
    const masterPassword = this.getMasterPassword();

    // 1. Firebase Firestore (nuvem permanente definitiva em tempo real)
    await saveStateToFirestore({ produtos, vendas, caixa, fiados, fornecedores, pedidosCompra });

    // 2. Servidor central (/api/sync)
    callServerApi('/api/sync', {
      method: 'POST',
      body: JSON.stringify({
        produtos,
        vendas,
        caixa,
        fiados,
        fornecedores,
        pedidosCompra,
        masterPassword
      })
    }).catch(() => {});
  },

  /**
   * Atualiza imediatamente o armazenamento local (localStorage) com o estado da nuvem.
   * Isso garante que qualquer aparelho conectado reflita instantaneamente os dados.
   */
  atualizarEstadoLocal(cloudState: {
    produtos?: Produto[];
    vendas?: Venda[];
    caixa?: MovimentacaoCaixa[];
    fiados?: LancamentoFiado[];
    fornecedores?: Fornecedor[];
    pedidosCompra?: PedidoCompra[];
    masterPassword?: string;
  }): void {
    if (cloudState.produtos !== undefined) {
      safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(cloudState.produtos || []));
    }
    if (cloudState.vendas !== undefined) {
      safeLocalStorage.setItem(STORAGE_KEY_VENDAS, JSON.stringify(cloudState.vendas || []));
    }
    if (cloudState.caixa !== undefined) {
      safeLocalStorage.setItem(STORAGE_KEY_CAIXA, JSON.stringify(cloudState.caixa || []));
    }
    if (cloudState.fiados !== undefined) {
      safeLocalStorage.setItem(STORAGE_KEY_FIADOS, JSON.stringify(cloudState.fiados || []));
    }
    if (cloudState.fornecedores !== undefined) {
      safeLocalStorage.setItem(STORAGE_KEY_FORNECEDORES, JSON.stringify(cloudState.fornecedores || []));
    }
    if (cloudState.pedidosCompra !== undefined) {
      safeLocalStorage.setItem(STORAGE_KEY_PEDIDOS_COMPRA, JSON.stringify(cloudState.pedidosCompra || []));
    }
    if (cloudState.masterPassword) {
      safeLocalStorage.setItem(STORAGE_KEY_CUSTOM_PASSWORD, cloudState.masterPassword);
    }
  },

  async sincronizarServidor(): Promise<{
    produtos: Produto[];
    vendas: Venda[];
    caixa: MovimentacaoCaixa[];
    fiados: LancamentoFiado[];
    fornecedores: Fornecedor[];
    pedidosCompra: PedidoCompra[];
    masterPassword?: string;
    fromFirebase?: boolean;
  } | null> {
    // 1. Prioridade máxima: Firebase Firestore na nuvem (fonte da verdade)
    try {
      const firestoreData = await fetchStateFromFirestore();
      if (firestoreData) {
        const produtos = firestoreData.produtos || [];
        const vendas = firestoreData.vendas || [];
        const caixa = firestoreData.caixa || [];
        const fiados = firestoreData.fiados || [];
        const fornecedores = firestoreData.fornecedores || [];
        const pedidosCompra = firestoreData.pedidosCompra || [];

        this.atualizarEstadoLocal({
          produtos,
          vendas,
          caixa,
          fiados,
          fornecedores,
          pedidosCompra
        });

        // Replica para servidor local se necessário
        callServerApi('/api/sync', {
          method: 'POST',
          body: JSON.stringify({
            produtos,
            vendas,
            caixa,
            fiados,
            fornecedores,
            pedidosCompra,
            masterPassword: this.getMasterPassword()
          })
        }).catch(() => {});

        return {
          produtos,
          vendas,
          caixa,
          fiados,
          fornecedores,
          pedidosCompra,
          masterPassword: this.getMasterPassword(),
          fromFirebase: true
        };
      }
    } catch (err) {
      console.warn('[Firebase] Fallback para servidor local:', err);
    }

    // 2. Se Firebase estiver temporariamente inacessível, busca no servidor Express
    const data = await callServerApi<{
      success: boolean;
      produtos: Produto[];
      vendas: Venda[];
      caixa: MovimentacaoCaixa[];
      fiados: LancamentoFiado[];
      fornecedores?: Fornecedor[];
      pedidosCompra?: PedidoCompra[];
      masterPassword?: string;
    }>('/api/sync');

    if (data && data.success) {
      const produtos = data.produtos || [];
      const vendas = data.vendas || [];
      const caixa = data.caixa || [];
      const fiados = data.fiados || [];
      const fornecedores = data.fornecedores || [];
      const pedidosCompra = data.pedidosCompra || [];

      this.atualizarEstadoLocal({
        produtos,
        vendas,
        caixa,
        fiados,
        fornecedores,
        pedidosCompra,
        masterPassword: data.masterPassword
      });

      return {
        produtos,
        vendas,
        caixa,
        fiados,
        fornecedores,
        pedidosCompra,
        masterPassword: data.masterPassword,
        fromFirebase: false
      };
    }
    return null;
  },

  // Authentication & Password Protection
  getMasterPassword(): string {
    return safeLocalStorage.getItem(STORAGE_KEY_CUSTOM_PASSWORD) || DEFAULT_PASSWORD;
  },

  setMasterPassword(newPassword: string): void {
    safeLocalStorage.setItem(STORAGE_KEY_CUSTOM_PASSWORD, newPassword);
    callServerApi('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword })
    }).catch(() => {});
  },

  /**
   * Inicialização direta só se já tiver colocado a senha anteriormente
   */
  isAuthenticated(): boolean {
    const localAuth = safeLocalStorage.getItem(STORAGE_KEY_AUTH);
    const sessionAuth = safeSessionStorage.getItem(STORAGE_KEY_AUTH);
    return localAuth === 'authenticated' || sessionAuth === 'authenticated';
  },

  login(password: string, remember: boolean = true): boolean {
    const currentPass = this.getMasterPassword();
    if (password.trim() === currentPass.trim()) {
      if (remember) {
        safeLocalStorage.setItem(STORAGE_KEY_AUTH, 'authenticated');
      }
      safeSessionStorage.setItem(STORAGE_KEY_AUTH, 'authenticated');
      return true;
    }
    return false;
  },

  logout(): void {
    safeLocalStorage.removeItem(STORAGE_KEY_AUTH);
    safeSessionStorage.removeItem(STORAGE_KEY_AUTH);
  },

  // -------------------------------------------------------------
  // PRODUTOS
  // -------------------------------------------------------------
  getProdutos(): Produto[] {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEY_PRODUTOS);
      if (data === null) {
        safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify([]));
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((p: Produto) => ({
        ...p,
        imagem_url: p.imagem_url ? p.imagem_url.replace('/src/assets/images/', '/images/') : undefined
      }));
    } catch {
      return [];
    }
  },

  /**
   * Zera completamente o sistema para entrega ao cliente:
   * Limpa produtos, vendas, movimentações de caixa e controle de fiado
   * tanto no dispositivo local quanto no servidor e na nuvem Firebase Firestore.
   */
  async zerarSistema(): Promise<void> {
    safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify([]));
    safeLocalStorage.setItem(STORAGE_KEY_VENDAS, JSON.stringify([]));
    safeLocalStorage.setItem(STORAGE_KEY_CAIXA, JSON.stringify([]));
    safeLocalStorage.setItem(STORAGE_KEY_FIADOS, JSON.stringify([]));

    // Salva estado zerado no Firebase Firestore
    await saveStateToFirestore({
      produtos: [],
      vendas: [],
      caixa: [],
      fiados: []
    });

    // Salva estado zerado no servidor Express
    await callServerApi('/api/sync', {
      method: 'POST',
      body: JSON.stringify({
        produtos: [],
        vendas: [],
        caixa: [],
        fiados: [],
        masterPassword: this.getMasterPassword()
      })
    }).catch(() => {});
  },

  resetToDefaults(): void {
    safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify([]));
  },

  saveProdutos(produtos: Produto[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(produtos));
    this.persistirEmTodasNuvens().catch(() => {});
  },

  async carregarProdutosAsync(): Promise<{ produtos: Produto[]; fromSupabase: boolean }> {
    const supabaseProdutos = await fetchProdutosSupabase();
    if (supabaseProdutos && supabaseProdutos.length > 0) {
      this.saveProdutos(supabaseProdutos);
      return { produtos: supabaseProdutos, fromSupabase: true };
    }
    return { produtos: this.getProdutos(), fromSupabase: false };
  },

  async addProduto(produtoData: Omit<Produto, 'id' | 'created_at'>): Promise<Produto> {
    const client = getSupabaseClient();
    let novoProduto: Produto | null = null;

    if (client) {
      try {
        novoProduto = await addProdutoSupabase(produtoData);
      } catch (err) {
        console.warn('Falha ao inserir no Supabase, gravando localmente:', err);
      }
    }

    if (!novoProduto) {
      novoProduto = {
        ...produtoData,
        preco_custo: produtoData.preco_custo ?? 0,
        id: 'prod-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        created_at: new Date().toISOString()
      };
    }

    const produtos = this.getProdutos();
    produtos.unshift(novoProduto);
    this.saveProdutos(produtos);

    // Persist to central server for multi-device sync
    callServerApi('/api/produtos', {
      method: 'POST',
      body: JSON.stringify(novoProduto)
    }).catch(() => {});

    return novoProduto;
  },

  async updateProduto(id: string, produtoData: Partial<Produto>): Promise<Produto> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await updateProdutoSupabase(id, produtoData);
      } catch (err) {
        console.warn('Falha ao atualizar no Supabase, atualizando localmente:', err);
      }
    }

    const produtos = this.getProdutos();
    const index = produtos.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Produto não encontrado');

    produtos[index] = {
      ...produtos[index],
      ...produtoData,
      preco: Number(produtoData.preco ?? produtos[index].preco),
      preco_custo: produtoData.preco_custo !== undefined ? Number(produtoData.preco_custo) : (produtos[index].preco_custo ?? 0),
      quantidade_estoque: Number(produtoData.quantidade_estoque ?? produtos[index].quantidade_estoque),
      estoque_minimo: produtoData.estoque_minimo !== undefined ? Number(produtoData.estoque_minimo) : (produtos[index].estoque_minimo ?? 3)
    };
    this.saveProdutos(produtos);

    // Persist to central server for multi-device sync
    callServerApi('/api/produtos', {
      method: 'POST',
      body: JSON.stringify(produtos[index])
    }).catch(() => {});

    return produtos[index];
  },

  async deleteProduto(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await deleteProdutoSupabase(id);
      } catch (err) {
        console.warn('Falha ao deletar no Supabase, deletando localmente:', err);
      }
    }

    const produtos = this.getProdutos().filter(p => p.id !== id);
    this.saveProdutos(produtos);

    // Persist deletion to central server
    callServerApi(`/api/produtos/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  },

  async ajustarEstoque(id: string, delta: number): Promise<Produto> {
    const client = getSupabaseClient();
    let novoEstoque: number | null = null;

    if (client) {
      try {
        novoEstoque = await ajustarEstoqueSupabase(id, delta);
      } catch (err) {
        console.warn('Falha ao ajustar estoque no Supabase, ajustando localmente:', err);
      }
    }

    const produtos = this.getProdutos();
    const index = produtos.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Produto não encontrado');

    if (novoEstoque === null) {
      novoEstoque = Math.max(0, produtos[index].quantidade_estoque + delta);
    }

    produtos[index].quantidade_estoque = novoEstoque;
    this.saveProdutos(produtos);

    // Persist quick adjustment to central server
    callServerApi(`/api/produtos/${id}/estoque`, {
      method: 'PATCH',
      body: JSON.stringify({ delta })
    }).catch(() => {});

    return produtos[index];
  },

  // -------------------------------------------------------------
  // VENDAS (V1 + V2 Fiado e Preço de Custo)
  // -------------------------------------------------------------
  getVendas(): Venda[] {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEY_VENDAS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveVendas(vendas: Venda[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_VENDAS, JSON.stringify(vendas));
    this.persistirEmTodasNuvens().catch(() => {});
  },

  async carregarVendasAsync(): Promise<{ vendas: Venda[]; fromSupabase: boolean }> {
    const supabaseVendas = await fetchVendasSupabase();
    if (supabaseVendas && supabaseVendas.length > 0) {
      this.saveVendas(supabaseVendas);
      return { vendas: supabaseVendas, fromSupabase: true };
    }
    return { vendas: this.getVendas(), fromSupabase: false };
  },

  /**
   * ATOMIC TRANSACTION: registrarVenda
   * Executa via Supabase (RPC registrar_venda ou transação remota) se conectado.
   * Se for Fiado, gera o lançamento de débito na conta do cliente automaticamente.
   */
  async registrarVenda(
    itens: CartItem[], 
    formaPagamento: string, 
    clienteNome?: string, 
    clienteWhatsapp?: string
  ): Promise<Venda> {
    if (!itens || itens.length === 0) {
      throw new Error('O carrinho está vazio.');
    }

    const client = getSupabaseClient();
    let novaVenda: Venda | null = null;

    // 1. Tenta no Supabase
    if (client) {
      try {
        novaVenda = await registrarVendaSupabase(itens, formaPagamento, clienteNome, clienteWhatsapp);
      } catch (err: any) {
        console.warn('Erro ao processar no Supabase, executando fallback local:', err);
        if (err.message && err.message.toLowerCase().includes('estoque')) {
          throw err;
        }
      }
    }

    // 2. Transação Atômica Local
    const produtos = this.getProdutos();
    const produtosMap = new Map<string, Produto>();
    produtos.forEach(p => produtosMap.set(p.id, { ...p }));

    // Validação Atômica prévia
    for (const item of itens) {
      const prod = produtosMap.get(item.produto.id);
      if (!prod) {
        throw new Error(`Produto "${item.produto.nome}" não localizado no catálogo.`);
      }

      if (prod.quantidade_estoque < item.quantidade) {
        throw new Error(
          `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.quantidade_estoque} un, Solicitado: ${item.quantidade} un.`
        );
      }
    }

    // Baixa atômica de estoque local e congelamento de preco_custo
    let totalVenda = 0;
    const itensGravados = itens.map(item => {
      const prod = produtosMap.get(item.produto.id)!;
      prod.quantidade_estoque -= item.quantidade;
      const subtotal = item.quantidade * prod.preco;
      totalVenda += subtotal;

      return {
        produto_id: prod.id,
        nome_produto: prod.nome,
        quantidade: item.quantidade,
        preco_unitario: prod.preco,
        preco_custo: prod.preco_custo || 0
      };
    });

    const produtosAtualizados = produtos.map(p => {
      const mod = produtosMap.get(p.id);
      return mod || p;
    });
    this.saveProdutos(produtosAtualizados);

    if (!novaVenda) {
      const vendaId = 'VND-' + Math.floor(100000 + Math.random() * 900000);
      novaVenda = {
        id: vendaId,
        forma_pagamento: formaPagamento,
        total: Number(totalVenda.toFixed(2)),
        cliente_nome: clienteNome,
        cliente_whatsapp: clienteWhatsapp,
        created_at: new Date().toISOString(),
        itens: itensGravados
      };
    }

    const vendas = this.getVendas();
    vendas.unshift(novaVenda);
    this.saveVendas(vendas);

    // Persist sale and stock deduction to central server for multi-device sync
    callServerApi('/api/vendas', {
      method: 'POST',
      body: JSON.stringify({
        itens: itens.map(i => ({
          produto_id: i.produto.id,
          nome_produto: i.produto.nome,
          quantidade: i.quantidade,
          preco_unitario: i.produto.preco,
          preco_custo: i.produto.preco_custo || 0
        })),
        forma_pagamento: formaPagamento,
        cliente_nome: clienteNome,
        cliente_whatsapp: clienteWhatsapp,
        total: novaVenda.total
      })
    }).catch(() => {});

    // V2: Se for compra na Conta Corrente (ou fiado), cria débito automático no controle comercial
    if ((formaPagamento.toLowerCase().includes('corrente') || formaPagamento.toLowerCase().includes('fiado')) && clienteNome?.trim()) {
      const descricaoItens = itens.map(i => `${i.quantidade}x ${i.produto.nome}`).join(', ');
      this.addLancamentoFiado({
        cliente_nome: clienteNome.trim(),
        cliente_whatsapp: clienteWhatsapp?.trim(),
        tipo: 'debito',
        valor: novaVenda.total,
        descricao: `Pedido #${novaVenda.id}: ${descricaoItens}`,
        venda_id: novaVenda.id,
      });
    }

    return novaVenda;
  },

  /**
   * CANCELAR VENDA / ESTORNO ATÔMICO
   * 1. Repõe o estoque de cada semijoia que foi vendida.
   * 2. Se a venda foi em Conta Corrente, remove o lançamento de débito do cliente.
   * 3. Remove a venda do histórico e sincroniza tudo com a nuvem Firebase e servidor central.
   */
  async cancelarVenda(vendaId: string, reporEstoque: boolean = true): Promise<boolean> {
    const vendas = this.getVendas();
    const venda = vendas.find(v => v.id === vendaId);
    if (!venda) return false;

    // 1. Reposição de estoque
    if (reporEstoque && Array.isArray(venda.itens)) {
      for (const item of venda.itens) {
        if (item.produto_id && item.quantidade > 0) {
          try {
            await this.ajustarEstoque(item.produto_id, item.quantidade);
          } catch (err) {
            console.warn(`Aviso ao repor estoque ao cancelar venda (${item.produto_id}):`, err);
          }
        }
      }
    }

    // 2. Se a venda foi lançada na Conta Corrente, cancela o débito correspondente
    if (venda.forma_pagamento.toLowerCase().includes('corrente') || venda.forma_pagamento.toLowerCase().includes('fiado')) {
      const fiados = this.getFiados();
      const fiadosRestantes = fiados.filter(f => f.venda_id !== venda.id && !(f.descricao && f.descricao.includes(venda.id)));
      if (fiadosRestantes.length !== fiados.length) {
        this.saveFiados(fiadosRestantes);
      }
    }

    // 3. Remove a venda local
    const novasVendas = vendas.filter(v => v.id !== vendaId);
    this.saveVendas(novasVendas);

    // 4. Supabase
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('vendas').delete().eq('id', vendaId);
      } catch (err) {
        console.warn('Aviso ao deletar venda no Supabase:', err);
      }
    }

    // 5. Servidor local & Nuvem Firebase Firestore
    callServerApi(`/api/vendas/${vendaId}`, {
      method: 'DELETE'
    }).catch(() => {});

    await this.persistirEmTodasNuvens().catch(() => {});
    return true;
  },

  // -------------------------------------------------------------
  // V2: MÓDULO DE CAIXA (Entradas e Saídas Manuais)
  // -------------------------------------------------------------
  getMovimentacoesCaixa(): MovimentacaoCaixa[] {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEY_CAIXA);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveMovimentacoesCaixa(movs: MovimentacaoCaixa[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_CAIXA, JSON.stringify(movs));
    this.persistirEmTodasNuvens().catch(() => {});
  },

  async carregarMovimentacoesCaixaAsync(): Promise<{ movs: MovimentacaoCaixa[]; fromSupabase: boolean }> {
    const supabaseMovs = await fetchMovimentacoesCaixaSupabase();
    if (supabaseMovs) {
      this.saveMovimentacoesCaixa(supabaseMovs);
      return { movs: supabaseMovs, fromSupabase: true };
    }
    return { movs: this.getMovimentacoesCaixa(), fromSupabase: false };
  },

  async addMovimentacaoCaixa(movData: Omit<MovimentacaoCaixa, 'id' | 'created_at'>): Promise<MovimentacaoCaixa> {
    const client = getSupabaseClient();
    let novaMov: MovimentacaoCaixa | null = null;

    if (client) {
      try {
        novaMov = await addMovimentacaoCaixaSupabase(movData);
      } catch (e) {
        console.warn('Erro ao salvar movimentação de caixa no Supabase:', e);
      }
    }

    if (!novaMov) {
      novaMov = {
        ...movData,
        id: 'cx-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        created_at: new Date().toISOString()
      };
    }

    const movs = this.getMovimentacoesCaixa();
    movs.unshift(novaMov);
    this.saveMovimentacoesCaixa(movs);

    // Persist cash movement to central server
    callServerApi('/api/caixa', {
      method: 'POST',
      body: JSON.stringify(novaMov)
    }).catch(() => {});

    return novaMov;
  },

  async deleteMovimentacaoCaixa(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await deleteMovimentacaoCaixaSupabase(id);
      } catch (e) {
        console.warn('Erro ao excluir no Supabase:', e);
      }
    }

    const movs = this.getMovimentacoesCaixa().filter(m => m.id !== id);
    this.saveMovimentacoesCaixa(movs);

    // Persist deletion to central server
    callServerApi(`/api/caixa/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  },

  // -------------------------------------------------------------
  // V2: CONTROLE DE FIADO
  // -------------------------------------------------------------
  getFiados(): LancamentoFiado[] {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEY_FIADOS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveFiados(fiados: LancamentoFiado[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_FIADOS, JSON.stringify(fiados));
    this.persistirEmTodasNuvens().catch(() => {});
  },

  async carregarFiadosAsync(): Promise<{ fiados: LancamentoFiado[]; fromSupabase: boolean }> {
    const supabaseFiados = await fetchFiadosSupabase();
    if (supabaseFiados) {
      this.saveFiados(supabaseFiados);
      return { fiados: supabaseFiados, fromSupabase: true };
    }
    return { fiados: this.getFiados(), fromSupabase: false };
  },

  async addLancamentoFiado(lancamentoData: Omit<LancamentoFiado, 'id' | 'created_at'>): Promise<LancamentoFiado> {
    const client = getSupabaseClient();
    let novoLancamento: LancamentoFiado | null = null;

    if (client) {
      try {
        novoLancamento = await addLancamentoFiadoSupabase(lancamentoData);
      } catch (e) {
        console.warn('Erro ao salvar fiado no Supabase:', e);
      }
    }

    if (!novoLancamento) {
      novoLancamento = {
        ...lancamentoData,
        id: 'fia-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        created_at: new Date().toISOString()
      };
    }

    const fiados = this.getFiados();
    fiados.unshift(novoLancamento);
    this.saveFiados(fiados);

    // Persist fiado to central server
    callServerApi('/api/fiados', {
      method: 'POST',
      body: JSON.stringify(novoLancamento)
    }).catch(() => {});

    return novoLancamento;
  },

  /**
   * Acrescenta uma nova peça ou débito avulso diretamente na Conta Corrente do cliente.
   * Se for selecionado um produto do catálogo, dá baixa automática no estoque!
   */
  async acrescentarContaCorrente(dados: {
    cliente_nome: string;
    cliente_whatsapp?: string;
    descricao: string;
    valor: number;
    produto_id?: string;
    quantidade?: number;
  }): Promise<LancamentoFiado> {
    // 1. Se for produto com estoque, dá baixa no estoque do catálogo
    if (dados.produto_id && dados.quantidade && dados.quantidade > 0) {
      try {
        await this.ajustarEstoque(dados.produto_id, -dados.quantidade);
      } catch (err) {
        console.warn('Aviso ao ajustar estoque ao acrescentar na conta corrente:', err);
      }
    }

    // 2. Registra o débito na conta corrente
    return await this.addLancamentoFiado({
      cliente_nome: dados.cliente_nome.trim(),
      cliente_whatsapp: dados.cliente_whatsapp?.trim(),
      tipo: 'debito',
      valor: dados.valor,
      descricao: dados.descricao.trim(),
      produto_id: dados.produto_id,
      quantidade: dados.quantidade,
    });
  },

  /**
   * Remove uma peça ou abate um valor da Conta Corrente do cliente (devolução, estorno ou item cancelado).
   * Se for selecionado um produto e devolverAoEstoque for true (padrão), devolve as peças automaticamente ao estoque!
   */
  async removerItemContaCorrente(dados: {
    cliente_nome: string;
    cliente_whatsapp?: string;
    descricao: string;
    valor: number;
    produto_id?: string;
    quantidade?: number;
    devolverAoEstoque?: boolean;
  }): Promise<LancamentoFiado> {
    // 1. Se for produto com estoque e deve repor, adiciona de volta ao catálogo
    if (dados.produto_id && dados.quantidade && dados.quantidade > 0 && dados.devolverAoEstoque !== false) {
      try {
        await this.ajustarEstoque(dados.produto_id, dados.quantidade);
      } catch (err) {
        console.warn('Aviso ao devolver estoque ao remover da conta corrente:', err);
      }
    }

    // 2. Registra o abatimento na conta corrente (tipo 'pagamento' sem registrar no caixa, pois é estorno/devolução)
    return await this.addLancamentoFiado({
      cliente_nome: dados.cliente_nome.trim(),
      cliente_whatsapp: dados.cliente_whatsapp?.trim(),
      tipo: 'pagamento',
      valor: dados.valor,
      descricao: dados.descricao.startsWith('Devolução') ? dados.descricao.trim() : `Devolução / Remoção: ${dados.descricao.trim()}`,
      produto_id: dados.produto_id,
      quantidade: dados.quantidade,
    });
  },

  async deleteLancamentoFiado(id: string, reporEstoque: boolean = true): Promise<void> {
    const fiados = this.getFiados();
    const item = fiados.find(f => f.id === id);

    // Se estiver excluindo um débito que tinha produto e optou por repor estoque
    if (item && reporEstoque && item.tipo === 'debito' && item.produto_id && item.quantidade && item.quantidade > 0) {
      try {
        await this.ajustarEstoque(item.produto_id, item.quantidade);
      } catch (err) {
        console.warn('Aviso ao repor estoque ao excluir lançamento:', err);
      }
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        await deleteLancamentoFiadoSupabase(id);
      } catch (e) {
        console.warn('Erro ao excluir fiado no Supabase:', e);
      }
    }

    const novosFiados = fiados.filter(f => f.id !== id);
    this.saveFiados(novosFiados);

    // Persist deletion to central server
    callServerApi(`/api/fiados/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  },

  /**
   * Calculates automatic account summaries per client:
   * saldo_devedor = sum(debitos) - sum(pagamentos)
   */
  getResumoFiados(): ResumoClienteFiado[] {
    const lancamentos = this.getFiados();
    const grupos = new Map<string, LancamentoFiado[]>();

    for (const l of lancamentos) {
      const nomeChave = l.cliente_nome.trim().toUpperCase();
      const lista = grupos.get(nomeChave) || [];
      lista.push(l);
      grupos.set(nomeChave, lista);
    }

    const resumos: ResumoClienteFiado[] = [];

    grupos.forEach((itens, _) => {
      // Find latest whatsapp phone if available
      const latestWithPhone = itens.find(i => i.cliente_whatsapp && i.cliente_whatsapp.trim() !== '');
      const clienteWhatsapp = latestWithPhone?.cliente_whatsapp;
      const clienteNome = itens[0].cliente_nome;

      let totalCompras = 0;
      let totalPago = 0;

      for (const item of itens) {
        if (item.tipo === 'debito') {
          totalCompras += item.valor;
        } else if (item.tipo === 'pagamento') {
          totalPago += item.valor;
        }
      }

      const saldoDevedor = Number((totalCompras - totalPago).toFixed(2));
      const ultimoLancamento = itens[0]?.created_at || new Date().toISOString();

      resumos.push({
        cliente_nome: clienteNome,
        cliente_whatsapp: clienteWhatsapp,
        total_compras: Number(totalCompras.toFixed(2)),
        total_pago: Number(totalPago.toFixed(2)),
        saldo_devedor: saldoDevedor,
        ultimo_lancamento: ultimoLancamento,
        historico: itens.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      });
    });

    // Sort by largest outstanding debt first
    return resumos.sort((a, b) => b.saldo_devedor - a.saldo_devedor);
  },

  /**
   * Retrieves all registered customer accounts across sales and fiados.
   * Enables selecting an existing customer account at POS ("como se fosse uma conta").
   */
  getContasClientes(): ContaCliente[] {
    const resumosFiados = this.getResumoFiados();
    const vendas = this.getVendas();

    const contasMap = new Map<string, ContaCliente>();

    // 1. Populate from fiado summaries (existing customer accounts)
    for (const r of resumosFiados) {
      if (!r.cliente_nome) continue;
      const chave = r.cliente_nome.trim().toUpperCase();
      contasMap.set(chave, {
        nome: r.cliente_nome.trim(),
        whatsapp: r.cliente_whatsapp,
        saldoDevedor: r.saldo_devedor,
        totalVendas: 0,
        totalGasto: r.total_compras,
        ultimaVenda: r.ultimo_lancamento
      });
    }

    // 2. Supplement from sales history
    for (const v of vendas) {
      if (v.cliente_nome && v.cliente_nome.trim()) {
        const nomeTrim = v.cliente_nome.trim();
        const chave = nomeTrim.toUpperCase();
        const existing = contasMap.get(chave);
        if (existing) {
          existing.totalVendas += 1;
          if (!existing.whatsapp && v.cliente_whatsapp) {
            existing.whatsapp = v.cliente_whatsapp;
          }
          if (v.created_at && (!existing.ultimaVenda || v.created_at > existing.ultimaVenda)) {
            existing.ultimaVenda = v.created_at;
          }
        } else {
          contasMap.set(chave, {
            nome: nomeTrim,
            whatsapp: v.cliente_whatsapp,
            saldoDevedor: 0,
            totalVendas: 1,
            totalGasto: v.total,
            ultimaVenda: v.created_at
          });
        }
      }
    }

    // Sort alphabetically by name
    return Array.from(contasMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  },

  // -------------------------------------------------------------
  // V3: FORNECEDORES
  // -------------------------------------------------------------
  getFornecedores(): Fornecedor[] {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEY_FORNECEDORES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveFornecedores(fornecedores: Fornecedor[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_FORNECEDORES, JSON.stringify(fornecedores));
    this.persistirEmTodasNuvens().catch(() => {});
  },

  async addFornecedor(fornecedorData: Omit<Fornecedor, 'id' | 'created_at'>): Promise<Fornecedor> {
    const novoFornecedor: Fornecedor = {
      ...fornecedorData,
      id: 'forn-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      created_at: new Date().toISOString()
    };

    const fornecedores = this.getFornecedores();
    fornecedores.unshift(novoFornecedor);
    this.saveFornecedores(fornecedores);

    // Persist to server
    callServerApi('/api/fornecedores', {
      method: 'POST',
      body: JSON.stringify(novoFornecedor)
    }).catch(() => {});

    return novoFornecedor;
  },

  async updateFornecedor(id: string, fornecedorData: Partial<Fornecedor>): Promise<Fornecedor> {
    const fornecedores = this.getFornecedores();
    const index = fornecedores.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Fornecedor não encontrado');

    fornecedores[index] = {
      ...fornecedores[index],
      ...fornecedorData,
      updated_at: new Date().toISOString()
    };
    this.saveFornecedores(fornecedores);

    // Persist to server
    callServerApi('/api/fornecedores', {
      method: 'POST',
      body: JSON.stringify(fornecedores[index])
    }).catch(() => {});

    return fornecedores[index];
  },

  async deleteFornecedor(id: string): Promise<void> {
    const fornecedores = this.getFornecedores().filter(f => f.id !== id);
    this.saveFornecedores(fornecedores);

    // Persist to server
    callServerApi(`/api/fornecedores/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  },

  // -------------------------------------------------------------
  // V3: VÍNCULO FORNECEDOR <-> PRODUTO COM HISTÓRICO DE PREÇOS
  // -------------------------------------------------------------
  async vincularOuAtualizarFornecedorNoProduto(
    produtoId: string,
    fornecedorId: string,
    novoPrecoCusto: number
  ): Promise<Produto> {
    const produtos = this.getProdutos();
    const index = produtos.findIndex(p => p.id === produtoId);
    if (index === -1) throw new Error('Produto não encontrado');

    const prod = { ...produtos[index] };
    const listaFornecedores: FornecedorProdutoRef[] = Array.isArray(prod.fornecedores)
      ? prod.fornecedores.map(f => ({
          ...f,
          historicoPrecos: Array.isArray(f.historicoPrecos) ? [...f.historicoPrecos] : []
        }))
      : [];

    const fornIndex = listaFornecedores.findIndex(f => f.fornecedorId === fornecedorId);
    const dataHoraIso = new Date().toISOString();

    if (fornIndex >= 0) {
      const atual = listaFornecedores[fornIndex];
      // Se o preço de custo mudou, move o valor antigo para o histórico antes de sobrescrever
      if (Number(atual.precoCusto) !== Number(novoPrecoCusto)) {
        const historico = Array.isArray(atual.historicoPrecos) ? [...atual.historicoPrecos] : [];
        historico.unshift({
          precoCusto: Number(atual.precoCusto),
          dataAtualizacaoPreco: atual.dataAtualizacaoPreco || dataHoraIso
        });
        listaFornecedores[fornIndex] = {
          ...atual,
          precoCusto: Number(novoPrecoCusto),
          dataAtualizacaoPreco: dataHoraIso,
          historicoPrecos: historico
        };
      }
    } else {
      listaFornecedores.push({
        fornecedorId,
        precoCusto: Number(novoPrecoCusto),
        dataAtualizacaoPreco: dataHoraIso,
        historicoPrecos: []
      });
    }

    prod.fornecedores = listaFornecedores;
    // Se o produto não tiver preco_custo padrão definido ou for zero, pode assumir como padrão o do fornecedor
    if (!prod.preco_custo || prod.preco_custo === 0) {
      prod.preco_custo = Number(novoPrecoCusto);
    }

    produtos[index] = prod;
    this.saveProdutos(produtos);
    return prod;
  },

  async desvincularFornecedorDoProduto(produtoId: string, fornecedorId: string): Promise<Produto> {
    const produtos = this.getProdutos();
    const index = produtos.findIndex(p => p.id === produtoId);
    if (index === -1) throw new Error('Produto não encontrado');

    const prod = { ...produtos[index] };
    prod.fornecedores = (prod.fornecedores || []).filter(f => f.fornecedorId !== fornecedorId);
    produtos[index] = prod;
    this.saveProdutos(produtos);
    return prod;
  },

  // -------------------------------------------------------------
  // V3: PEDIDOS DE COMPRA
  // -------------------------------------------------------------
  getPedidosCompra(): PedidoCompra[] {
    try {
      const data = safeLocalStorage.getItem(STORAGE_KEY_PEDIDOS_COMPRA);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePedidosCompra(pedidos: PedidoCompra[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_PEDIDOS_COMPRA, JSON.stringify(pedidos));
    this.persistirEmTodasNuvens().catch(() => {});
  },

  async addPedidoCompra(pedidoData: Omit<PedidoCompra, 'id' | 'created_at'>): Promise<PedidoCompra> {
    const novoPedido: PedidoCompra = {
      ...pedidoData,
      id: 'PED-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase(),
      created_at: new Date().toISOString()
    };

    const pedidos = this.getPedidosCompra();
    pedidos.unshift(novoPedido);
    this.savePedidosCompra(pedidos);

    // Persist to server
    callServerApi('/api/pedidos-compra', {
      method: 'POST',
      body: JSON.stringify(novoPedido)
    }).catch(() => {});

    return novoPedido;
  },

  async updatePedidoCompra(id: string, pedidoData: Partial<PedidoCompra>): Promise<PedidoCompra> {
    const pedidos = this.getPedidosCompra();
    const index = pedidos.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Pedido não encontrado');

    pedidos[index] = {
      ...pedidos[index],
      ...pedidoData,
      updated_at: new Date().toISOString()
    };
    this.savePedidosCompra(pedidos);

    callServerApi('/api/pedidos-compra', {
      method: 'POST',
      body: JSON.stringify(pedidos[index])
    }).catch(() => {});

    return pedidos[index];
  },

  async atualizarStatusPedidoCompra(
    id: string, 
    novoStatus: StatusPedidoCompra, 
    recebidoPor?: string
  ): Promise<PedidoCompra> {
    const pedidos = this.getPedidosCompra();
    const index = pedidos.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Pedido não encontrado');

    const pedido = { ...pedidos[index] };
    const statusAnterior = pedido.status;
    pedido.status = novoStatus;
    pedido.updated_at = new Date().toISOString();

    // Ao mudar o status de um pedido para "recebido", o sistema deve automaticamente
    // somar a quantidade de cada item ao estoque do produto correspondente na coleção de produtos.
    if (novoStatus === 'recebido' && statusAnterior !== 'recebido') {
      const nowIso = new Date().toISOString();
      pedido.dataRecebimento = nowIso;
      pedido.dataConfirmacaoRecebimento = nowIso;
      if (recebidoPor) {
        pedido.recebidoPor = recebidoPor;
      }

      if (Array.isArray(pedido.itens)) {
        for (const item of pedido.itens) {
          if (item.produtoId && item.quantidade > 0) {
            try {
              await this.ajustarEstoque(item.produtoId, item.quantidade);
            } catch (err) {
              console.warn(`Erro ao somar estoque ao receber pedido (${item.produtoId}):`, err);
            }
          }
        }
      }
    }

    pedidos[index] = pedido;
    this.savePedidosCompra(pedidos);

    // Sincroniza com servidor
    callServerApi(`/api/pedidos-compra/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: novoStatus, recebidoPor })
    }).catch(() => {});

    return pedido;
  },

  async deletePedidoCompra(id: string): Promise<void> {
    const pedidos = this.getPedidosCompra().filter(p => p.id !== id);
    this.savePedidosCompra(pedidos);
  },

  // -------------------------------------------------------------
  // BACKUP MANUAL & RESTAURAÇÃO (JSON)
  // -------------------------------------------------------------
  exportBackup(): {
    jsonString: string;
    filename: string;
    stats: {
      totalProdutos: number;
      totalVendas: number;
      totalCaixa: number;
      totalFiados: number;
      totalFornecedores: number;
      totalPedidosCompra: number;
      valorTotalEstoque: number;
      totalFaturadoVendas: number;
      saldoDevedorFiados: number;
      dataHoraLegivel: string;
    };
  } {
    const produtos = this.getProdutos();
    const vendas = this.getVendas();
    const caixa = this.getMovimentacoesCaixa();
    const fiados = this.getFiados();
    const fornecedores = this.getFornecedores();
    const pedidosCompra = this.getPedidosCompra();
    const resumosFiados = this.getResumoFiados();

    const valorTotalEstoque = Number(
      produtos.reduce((acc, p) => acc + (p.preco * (p.quantidade_estoque || 0)), 0).toFixed(2)
    );
    const totalFaturadoVendas = Number(
      vendas.reduce((acc, v) => acc + (v.total || 0), 0).toFixed(2)
    );
    const saldoDevedorFiados = Number(
      resumosFiados.reduce((acc, f) => acc + (f.saldo_devedor || 0), 0).toFixed(2)
    );

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dataHoraLegivel = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const filename = `backup_lima_semijoias_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}.json`;

    const data = {
      app: 'Lima Semijoias — Gestão & PDV',
      versao: '3.0',
      exportado_em: now.toISOString(),
      data_legivel: dataHoraLegivel,
      resumo: {
        total_produtos: produtos.length,
        total_vendas: vendas.length,
        total_movimentacoes_caixa: caixa.length,
        total_fiados: fiados.length,
        total_fornecedores: fornecedores.length,
        total_pedidos_compra: pedidosCompra.length,
        valor_total_estoque: valorTotalEstoque,
        total_faturado_vendas: totalFaturadoVendas,
        saldo_devedor_fiados: saldoDevedorFiados,
      },
      produtos,
      vendas,
      caixa,
      fiados,
      fornecedores,
      pedidosCompra
    };

    return {
      jsonString: JSON.stringify(data, null, 2),
      filename,
      stats: {
        totalProdutos: produtos.length,
        totalVendas: vendas.length,
        totalCaixa: caixa.length,
        totalFiados: fiados.length,
        totalFornecedores: fornecedores.length,
        totalPedidosCompra: pedidosCompra.length,
        valorTotalEstoque,
        totalFaturadoVendas,
        saldoDevedorFiados,
        dataHoraLegivel
      }
    };
  },

  validarArquivoBackup(jsonString: string): {
    valido: boolean;
    erro?: string;
    dados?: any;
    contagens?: {
      produtos: number;
      vendas: number;
      caixa: number;
      fiados: number;
      fornecedores: number;
      pedidosCompra: number;
    };
    exportadoEm?: string;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { valido: false, erro: 'O arquivo selecionado não é um arquivo JSON válido.' };
      }

      const temProdutos = Array.isArray(parsed.produtos);
      const temVendas = Array.isArray(parsed.vendas);
      const temCaixa = Array.isArray(parsed.caixa);
      const temFiados = Array.isArray(parsed.fiados);
      const temFornecedores = Array.isArray(parsed.fornecedores);
      const temPedidosCompra = Array.isArray(parsed.pedidosCompra);

      if (!temProdutos && !temVendas && !temCaixa && !temFiados && !temFornecedores && !temPedidosCompra) {
        return {
          valido: false,
          erro: 'O arquivo não contém dados reconhecidos da Lima Semijoias.'
        };
      }

      return {
        valido: true,
        dados: parsed,
        contagens: {
          produtos: temProdutos ? parsed.produtos.length : 0,
          vendas: temVendas ? parsed.vendas.length : 0,
          caixa: temCaixa ? parsed.caixa.length : 0,
          fiados: temFiados ? parsed.fiados.length : 0,
          fornecedores: temFornecedores ? parsed.fornecedores.length : 0,
          pedidosCompra: temPedidosCompra ? parsed.pedidosCompra.length : 0,
        },
        exportadoEm: parsed.data_legivel || parsed.exportado_em || parsed.exportDate || 'Data não especificada'
      };
    } catch {
      return { valido: false, erro: 'Falha ao ler o formato do arquivo JSON de backup.' };
    }
  },

  async importBackup(jsonString: string): Promise<{
    sucesso: boolean;
    erro?: string;
    contagens?: {
      produtos: number;
      vendas: number;
      caixa: number;
      fiados: number;
      fornecedores?: number;
      pedidosCompra?: number;
    };
  }> {
    const validacao = this.validarArquivoBackup(jsonString);
    if (!validacao.valido || !validacao.dados) {
      return { sucesso: false, erro: validacao.erro || 'Arquivo de backup inválido.' };
    }

    try {
      const parsed = validacao.dados;
      if (Array.isArray(parsed.produtos)) {
        this.saveProdutos(parsed.produtos);
      }
      if (Array.isArray(parsed.vendas)) {
        this.saveVendas(parsed.vendas);
      }
      if (Array.isArray(parsed.caixa)) {
        this.saveMovimentacoesCaixa(parsed.caixa);
      }
      if (Array.isArray(parsed.fiados)) {
        this.saveFiados(parsed.fiados);
      }
      if (Array.isArray(parsed.fornecedores)) {
        this.saveFornecedores(parsed.fornecedores);
      }
      if (Array.isArray(parsed.pedidosCompra)) {
        this.savePedidosCompra(parsed.pedidosCompra);
      }

      // Salva imediatamente em ambas as nuvens persistentes (Firestore e Express)
      await this.persistirEmTodasNuvens();

      return {
        sucesso: true,
        contagens: validacao.contagens
      };
    } catch (err: any) {
      return { sucesso: false, erro: err?.message || 'Falha ao restaurar dados do backup.' };
    }
  },

  // -------------------------------------------------------------
  // AUDITORIA & PREPARAÇÃO PARA ENTREGA AO CLIENTE (LIMPEZA DE TESTES)
  // -------------------------------------------------------------
  analisarDadosEntregaCliente(): {
    totalProdutos: number;
    produtosReais: Produto[];
    produtosTeste: Produto[];
    totalVendas: number;
    vendasReais: Venda[];
    vendasTeste: Venda[];
    totalCaixa: number;
    totalFiados: number;
  } {
    const produtos = this.getProdutos();
    const vendas = this.getVendas();
    const caixa = this.getMovimentacoesCaixa();
    const fiados = this.getFiados();

    // Identifica todos os IDs de produtos que já foram vendidos pelo cliente
    const idsVendidos = new Set<string>();
    for (const v of vendas) {
      if (Array.isArray(v.itens)) {
        for (const item of v.itens) {
          if (item && item.produto_id) idsVendidos.add(item.produto_id);
        }
      }
    }

    const defaultIds = new Set(['prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005', 'prod-006']);
    const produtosReais: Produto[] = [];
    const produtosTeste: Produto[] = [];

    for (const p of produtos) {
      const nomeLower = (p.nome || '').toLowerCase().trim();
      const jaVendido = idsVendidos.has(p.id);

      if (jaVendido) {
        // Se a joia já foi vendida pelo cliente, é 100% protegida e nunca pode ser apagada!
        produtosReais.push(p);
      } else if (defaultIds.has(p.id)) {
        // Item padrão de demonstração inicial que NUNCA foi vendido
        produtosTeste.push(p);
      } else if (nomeLower.includes('teste') || nomeLower === 'test' || nomeLower.includes('mock') || nomeLower.includes('exemplo')) {
        produtosTeste.push(p);
      } else {
        // Produto real cadastrado pelo cliente
        produtosReais.push(p);
      }
    }

    const vendasReais: Venda[] = [];
    const vendasTeste: Venda[] = [];
    for (const v of vendas) {
      const clienteLower = (v.cliente_nome || '').toLowerCase().trim();
      if (clienteLower === 'teste' || clienteLower === 'test') {
        vendasTeste.push(v);
      } else {
        vendasReais.push(v);
      }
    }

    return {
      totalProdutos: produtos.length,
      produtosReais,
      produtosTeste,
      totalVendas: vendas.length,
      vendasReais,
      vendasTeste,
      totalCaixa: caixa.length,
      totalFiados: fiados.length
    };
  },

  async limparDadosDeTesteEPreservarCliente(opcoes: { removerVendasTeste?: boolean } = {}): Promise<{
    produtosPreservados: number;
    produtosRemovidos: number;
    vendasPreservadas: number;
    vendasRemovidas: number;
  }> {
    const analise = this.analisarDadosEntregaCliente();

    // 1. Preserva todos os produtos reais do cliente e os que já tiveram vendas
    this.saveProdutos(analise.produtosReais);

    // 2. Preserva as vendas do cliente
    let vendasFinais = analise.vendasReais;
    let vendasRemovidasCount = 0;
    if (opcoes.removerVendasTeste && analise.vendasTeste.length > 0) {
      vendasFinais = analise.vendasReais;
      vendasRemovidasCount = analise.vendasTeste.length;
    } else {
      vendasFinais = this.getVendas();
    }
    this.saveVendas(vendasFinais);

    // Sincroniza em ambas as nuvens persistentes (Firestore e Express)
    await this.persistirEmTodasNuvens();

    return {
      produtosPreservados: analise.produtosReais.length,
      produtosRemovidos: analise.produtosTeste.length,
      vendasPreservadas: vendasFinais.length,
      vendasRemovidas: vendasRemovidasCount
    };
  },

  resetCatalogToDefault(): void {
    this.saveProdutos(PRODUTOS_INICIAIS);
    this.persistirEmTodasNuvens();
  }
};
