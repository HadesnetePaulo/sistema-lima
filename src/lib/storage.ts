import { Produto, Venda, CartItem, MovimentacaoCaixa, LancamentoFiado, ResumoClienteFiado } from '../types';
import { safeLocalStorage, safeSessionStorage } from './safeStorage';
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
const STORAGE_KEY_AUTH = 'lima_semijoias_auth_v2';
const STORAGE_KEY_CUSTOM_PASSWORD = 'lima_semijoias_custom_password_v1';
const DEFAULT_PASSWORD = '123456';

export const storage = {
  // Authentication & Password Protection
  getMasterPassword(): string {
    return safeLocalStorage.getItem(STORAGE_KEY_CUSTOM_PASSWORD) || DEFAULT_PASSWORD;
  },

  setMasterPassword(newPassword: string): void {
    safeLocalStorage.setItem(STORAGE_KEY_CUSTOM_PASSWORD, newPassword);
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
      if (!data) {
        safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(PRODUTOS_INICIAIS));
        return PRODUTOS_INICIAIS;
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(PRODUTOS_INICIAIS));
        return PRODUTOS_INICIAIS;
      }
      return parsed.map((p: Produto) => ({
        ...p,
        imagem_url: p.imagem_url ? p.imagem_url.replace('/src/assets/images/', '/images/') : undefined
      }));
    } catch {
      return PRODUTOS_INICIAIS;
    }
  },

  resetToDefaults(): void {
    safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(PRODUTOS_INICIAIS));
  },

  saveProdutos(produtos: Produto[]): void {
    safeLocalStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(produtos));
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
      quantidade_estoque: Number(produtoData.quantidade_estoque ?? produtos[index].quantidade_estoque)
    };
    this.saveProdutos(produtos);
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

    // V2: Se for compra Fiada, cria débito automático no controle de fiado local
    if (formaPagamento.toLowerCase().includes('fiado') && clienteNome?.trim()) {
      this.addLancamentoFiado({
        cliente_nome: clienteNome.trim(),
        cliente_whatsapp: clienteWhatsapp?.trim(),
        tipo: 'debito',
        valor: novaVenda.total,
        descricao: `Compra a prazo #${novaVenda.id}`,
        venda_id: novaVenda.id,
      });
    }

    return novaVenda;
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
    return novoLancamento;
  },

  async deleteLancamentoFiado(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      try {
        await deleteLancamentoFiadoSupabase(id);
      } catch (e) {
        console.warn('Erro ao excluir fiado no Supabase:', e);
      }
    }

    const fiados = this.getFiados().filter(f => f.id !== id);
    this.saveFiados(fiados);
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

  // -------------------------------------------------------------
  // BACKUP & RESTAURAR
  // -------------------------------------------------------------
  exportBackup(): string {
    const data = {
      app: 'Lima Semijoias',
      version: '2.0',
      exportDate: new Date().toISOString(),
      produtos: this.getProdutos(),
      vendas: this.getVendas(),
      caixa: this.getMovimentacoesCaixa(),
      fiados: this.getFiados()
    };
    return JSON.stringify(data, null, 2);
  },

  importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
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
      return true;
    } catch {
      return false;
    }
  },

  resetCatalogToDefault(): void {
    this.saveProdutos(PRODUTOS_INICIAIS);
  }
};
