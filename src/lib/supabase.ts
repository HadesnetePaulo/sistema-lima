import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Produto, Venda, CartItem, MovimentacaoCaixa, LancamentoFiado } from '../types';
import { safeLocalStorage } from './safeStorage';

const STORAGE_SUPABASE_URL = 'semijoias_supabase_url';
const STORAGE_SUPABASE_KEY = 'semijoias_supabase_key';

export interface SupabaseStatus {
  connected: boolean;
  hasUrl: boolean;
  hasKey: boolean;
  message: string;
  tablesFound?: {
    produtos: boolean;
    vendas: boolean;
    itens_venda: boolean;
    movimentacoes_caixa?: boolean;
    fiados?: boolean;
  };
}

export function getStoredSupabaseConfig() {
  const url = safeLocalStorage.getItem(STORAGE_SUPABASE_URL) || (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const key = safeLocalStorage.getItem(STORAGE_SUPABASE_KEY) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  return { url: url.trim(), key: key.trim() };
}

export function saveSupabaseConfig(url: string, key: string) {
  safeLocalStorage.setItem(STORAGE_SUPABASE_URL, url.trim());
  safeLocalStorage.setItem(STORAGE_SUPABASE_KEY, key.trim());
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) return null;

  if (cachedClient && url === lastUrl && key === lastKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}

/**
 * Tests connection to Supabase and verifies required tables
 */
export async function testSupabaseConnection(): Promise<SupabaseStatus> {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) {
    return {
      connected: false,
      hasUrl: !!url,
      hasKey: !!key,
      message: 'URL ou Chave do Supabase não configuradas.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      hasUrl: true,
      hasKey: true,
      message: 'Falha ao instanciar cliente do Supabase. Verifique o formato da URL.',
    };
  }

  try {
    const [
      { error: errProdutos },
      { error: errVendas },
      { error: errItens },
      { error: errCaixa },
      { error: errFiados }
    ] = await Promise.all([
      client.from('produtos').select('id', { head: true, count: 'exact' }),
      client.from('vendas').select('id', { head: true, count: 'exact' }),
      client.from('itens_venda').select('id', { head: true, count: 'exact' }),
      client.from('movimentacoes_caixa').select('id', { head: true, count: 'exact' }),
      client.from('fiados').select('id', { head: true, count: 'exact' }),
    ]);

    const produtosOk = !errProdutos;
    const vendasOk = !errVendas;
    const itensOk = !errItens;
    const caixaOk = !errCaixa;
    const fiadosOk = !errFiados;

    if (produtosOk && vendasOk && itensOk) {
      const v2Pronto = caixaOk && fiadosOk;
      return {
        connected: true,
        hasUrl: true,
        hasKey: true,
        message: v2Pronto 
          ? 'Conectado com sucesso ao Supabase! Todas as tabelas da V1 e V2 estão ativas.' 
          : 'Conectado ao Supabase (V1 ativa. Execute a Migration V2 para habilitar caixa e fiado no banco remoto).',
        tablesFound: {
          produtos: true,
          vendas: true,
          itens_venda: true,
          movimentacoes_caixa: caixaOk,
          fiados: fiadosOk,
        },
      };
    } else {
      const missing: string[] = [];
      if (!produtosOk) missing.push('produtos');
      if (!vendasOk) missing.push('vendas');
      if (!itensOk) missing.push('itens_venda');

      return {
        connected: false,
        hasUrl: true,
        hasKey: true,
        message: `Conectou ao Supabase, mas faltam tabelas: ${missing.join(', ')}. Execute o script SQL no editor do Supabase!`,
        tablesFound: {
          produtos: produtosOk,
          vendas: vendasOk,
          itens_venda: itensOk,
          movimentacoes_caixa: caixaOk,
          fiados: fiadosOk,
        },
      };
    }
  } catch (err: any) {
    return {
      connected: false,
      hasUrl: true,
      hasKey: true,
      message: `Erro ao testar conexão: ${err?.message || 'Verifique se a URL e a Chave estão corretas.'}`,
    };
  }
}

// -------------------------------------------------------------
// SUPABASE CRUD FOR PRODUTOS (com suporte a preco_custo)
// -------------------------------------------------------------

export async function fetchProdutosSupabase(): Promise<Produto[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('produtos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erro ao buscar produtos no Supabase:', error.message);
      return null;
    }

    return (data || []).map(row => ({
      id: String(row.id),
      nome: row.nome,
      categoria: row.categoria,
      codigo_barras: row.codigo_barras || '',
      preco: Number(row.preco),
      preco_custo: row.preco_custo !== null && row.preco_custo !== undefined ? Number(row.preco_custo) : 0,
      quantidade_estoque: Number(row.quantidade_estoque),
      imagem_url: row.imagem_url || undefined,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn('Falha na requisição de produtos ao Supabase:', err);
    return null;
  }
}

export async function addProdutoSupabase(produto: Omit<Produto, 'id' | 'created_at'>): Promise<Produto | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload: any = {
      nome: produto.nome,
      categoria: produto.categoria,
      codigo_barras: produto.codigo_barras || null,
      preco: produto.preco,
      quantidade_estoque: produto.quantidade_estoque,
      imagem_url: produto.imagem_url || null,
    };

    if (produto.preco_custo !== undefined) {
      payload.preco_custo = produto.preco_custo;
    }

    const { data, error } = await client
      .from('produtos')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return {
      id: String(data.id),
      nome: data.nome,
      categoria: data.categoria,
      codigo_barras: data.codigo_barras || '',
      preco: Number(data.preco),
      preco_custo: Number(data.preco_custo || 0),
      quantidade_estoque: Number(data.quantidade_estoque),
      imagem_url: data.imagem_url || undefined,
      created_at: data.created_at,
    };
  } catch (err) {
    console.error('Erro ao adicionar produto no Supabase:', err);
    throw err;
  }
}

export async function updateProdutoSupabase(id: string, updates: Partial<Produto>): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload: any = {};
    if (updates.nome !== undefined) payload.nome = updates.nome;
    if (updates.categoria !== undefined) payload.categoria = updates.categoria;
    if (updates.codigo_barras !== undefined) payload.codigo_barras = updates.codigo_barras;
    if (updates.preco !== undefined) payload.preco = Number(updates.preco);
    if (updates.preco_custo !== undefined) payload.preco_custo = Number(updates.preco_custo);
    if (updates.quantidade_estoque !== undefined) payload.quantidade_estoque = Number(updates.quantidade_estoque);
    if (updates.imagem_url !== undefined) payload.imagem_url = updates.imagem_url;

    const { error } = await client
      .from('produtos')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao atualizar produto no Supabase:', err);
    throw err;
  }
}

export async function deleteProdutoSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('produtos').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao deletar produto no Supabase:', err);
    throw err;
  }
}

export async function ajustarEstoqueSupabase(id: string, delta: number): Promise<number | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: prod, error: errSelect } = await client
      .from('produtos')
      .select('quantidade_estoque')
      .eq('id', id)
      .single();

    if (errSelect || !prod) throw new Error('Produto não localizado no Supabase');

    const novoEstoque = Math.max(0, Number(prod.quantidade_estoque) + delta);

    const { error: errUpdate } = await client
      .from('produtos')
      .update({ quantidade_estoque: novoEstoque })
      .eq('id', id);

    if (errUpdate) throw errUpdate;
    return novoEstoque;
  } catch (err) {
    console.error('Erro ao ajustar estoque no Supabase:', err);
    throw err;
  }
}

// -------------------------------------------------------------
// SUPABASE VENDAS (com custo, baixa atômica e suporte a fiado)
// -------------------------------------------------------------

export async function fetchVendasSupabase(): Promise<Venda[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('vendas')
      .select(`
        id,
        forma_pagamento,
        total,
        cliente_nome,
        cliente_whatsapp,
        created_at,
        itens_venda (
          id,
          produto_id,
          nome_produto,
          quantidade,
          preco_unitario,
          preco_custo
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erro ao buscar vendas no Supabase:', error.message);
      return null;
    }

    return (data || []).map(row => ({
      id: row.id,
      forma_pagamento: row.forma_pagamento,
      total: Number(row.total),
      cliente_nome: row.cliente_nome || undefined,
      cliente_whatsapp: row.cliente_whatsapp || undefined,
      created_at: row.created_at,
      itens: (row.itens_venda || []).map((it: any) => ({
        id: it.id,
        venda_id: row.id,
        produto_id: String(it.produto_id),
        nome_produto: it.nome_produto,
        quantidade: Number(it.quantidade),
        preco_unitario: Number(it.preco_unitario),
        preco_custo: it.preco_custo ? Number(it.preco_custo) : 0,
      })),
    }));
  } catch (err) {
    console.warn('Falha na requisição de vendas ao Supabase:', err);
    return null;
  }
}

export async function registrarVendaSupabase(
  itens: CartItem[], 
  formaPagamento: string,
  clienteNome?: string,
  clienteWhatsapp?: string
): Promise<Venda> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cliente Supabase não configurado');

  const itensPayload = itens.map(i => ({
    produto_id: i.produto.id,
    quantidade: i.quantidade,
  }));

  // 1. Tenta RPC registrar_venda atualizada (V2)
  try {
    const { data: rpcResult, error: rpcError } = await client.rpc('registrar_venda', {
      itens: itensPayload,
      forma_pagamento: formaPagamento,
      p_cliente_nome: clienteNome || null,
      p_cliente_whatsapp: clienteWhatsapp || null,
    });

    if (!rpcError && rpcResult?.venda_id) {
      const vendaId = rpcResult.venda_id;
      const total = Number(rpcResult.total);

      return {
        id: vendaId,
        forma_pagamento: formaPagamento,
        total,
        cliente_nome: clienteNome,
        cliente_whatsapp: clienteWhatsapp,
        created_at: new Date().toISOString(),
        itens: itens.map(item => ({
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco,
          preco_custo: item.produto.preco_custo || 0,
        })),
      };
    }
  } catch (rpcErr) {
    console.warn('RPC com suporte a V2 não encontrada, executando transação manual no Supabase:', rpcErr);
  }

  // 2. Transação direta cliente-banco no Supabase
  const ids = itens.map(i => i.produto.id);
  const { data: produtosSupabase, error: errSelect } = await client
    .from('produtos')
    .select('id, nome, preco, preco_custo, quantidade_estoque')
    .in('id', ids);

  if (errSelect || !produtosSupabase) {
    throw new Error('Falha ao verificar estoque dos produtos no Supabase.');
  }

  const produtosMap = new Map(produtosSupabase.map(p => [String(p.id), p]));

  // Valida estoque
  for (const item of itens) {
    const prod = produtosMap.get(item.produto.id);
    if (!prod) {
      throw new Error(`Produto "${item.produto.nome}" não encontrado no Supabase.`);
    }
    if (prod.quantidade_estoque < item.quantidade) {
      throw new Error(
        `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.quantidade_estoque} un, Solicitado: ${item.quantidade} un.`
      );
    }
  }

  // Desconta estoque
  for (const item of itens) {
    const prod = produtosMap.get(item.produto.id)!;
    const novoEstoque = prod.quantidade_estoque - item.quantidade;
    await client
      .from('produtos')
      .update({ quantidade_estoque: novoEstoque })
      .eq('id', prod.id);
  }

  const vendaId = 'VND-' + Math.floor(100000 + Math.random() * 900000);
  const totalCalculado = itens.reduce((sum, i) => sum + i.quantidade * i.produto.preco, 0);

  // Insere Venda
  await client.from('vendas').insert([
    {
      id: vendaId,
      forma_pagamento: formaPagamento,
      total: Number(totalCalculado.toFixed(2)),
      cliente_nome: clienteNome || null,
      cliente_whatsapp: clienteWhatsapp || null,
      created_at: new Date().toISOString(),
    },
  ]);

  // Insere Itens com preco_unitario e preco_custo
  const itensInsert = itens.map(item => {
    const prod = produtosMap.get(item.produto.id);
    return {
      venda_id: vendaId,
      produto_id: item.produto.id,
      nome_produto: item.produto.nome,
      quantidade: item.quantidade,
      preco_unitario: item.produto.preco,
      preco_custo: prod?.preco_custo || 0,
    };
  });

  await client.from('itens_venda').insert(itensInsert);

  // Se for venda Fiada, insere débito em fiados
  if (formaPagamento.toLowerCase().includes('fiado') && clienteNome?.trim()) {
    try {
      await client.from('fiados').insert([
        {
          cliente_nome: clienteNome.trim(),
          cliente_whatsapp: clienteWhatsapp?.trim() || null,
          tipo: 'debito',
          valor: Number(totalCalculado.toFixed(2)),
          descricao: `Compra a prazo #${vendaId}`,
          venda_id: vendaId,
          created_at: new Date().toISOString(),
        }
      ]);
    } catch (e) {
      console.warn('Erro ao inserir débito de fiado no Supabase:', e);
    }
  }

  return {
    id: vendaId,
    forma_pagamento: formaPagamento,
    total: Number(totalCalculado.toFixed(2)),
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp,
    created_at: new Date().toISOString(),
    itens: itens.map(item => ({
      venda_id: vendaId,
      produto_id: item.produto.id,
      nome_produto: item.produto.nome,
      quantidade: item.quantidade,
      preco_unitario: item.produto.preco,
      preco_custo: item.produto.preco_custo || 0,
    })),
  };
}

// -------------------------------------------------------------
// V2: SUPABASE CRUD MOVIMENTAÇÕES DE CAIXA
// -------------------------------------------------------------

export async function fetchMovimentacoesCaixaSupabase(): Promise<MovimentacaoCaixa[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('movimentacoes_caixa')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return null;

    return (data || []).map(row => ({
      id: String(row.id),
      tipo: row.tipo,
      valor: Number(row.valor),
      descricao: row.descricao,
      created_at: row.created_at,
    }));
  } catch {
    return null;
  }
}

export async function addMovimentacaoCaixaSupabase(mov: Omit<MovimentacaoCaixa, 'id' | 'created_at'>): Promise<MovimentacaoCaixa | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('movimentacoes_caixa')
      .insert([{ tipo: mov.tipo, valor: mov.valor, descricao: mov.descricao }])
      .select()
      .single();

    if (error) throw error;
    return {
      id: String(data.id),
      tipo: data.tipo,
      valor: Number(data.valor),
      descricao: data.descricao,
      created_at: data.created_at,
    };
  } catch (err) {
    console.warn('Erro ao inserir movimentação de caixa no Supabase:', err);
    return null;
  }
}

export async function deleteMovimentacaoCaixaSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('movimentacoes_caixa').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// V2: SUPABASE CRUD CONTROLE DE FIADO
// -------------------------------------------------------------

export async function fetchFiadosSupabase(): Promise<LancamentoFiado[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('fiados')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return null;

    return (data || []).map(row => ({
      id: String(row.id),
      cliente_nome: row.cliente_nome,
      cliente_whatsapp: row.cliente_whatsapp || undefined,
      tipo: row.tipo,
      valor: Number(row.valor),
      descricao: row.descricao || undefined,
      venda_id: row.venda_id || undefined,
      created_at: row.created_at,
    }));
  } catch {
    return null;
  }
}

export async function addLancamentoFiadoSupabase(lancamento: Omit<LancamentoFiado, 'id' | 'created_at'>): Promise<LancamentoFiado | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('fiados')
      .insert([
        {
          cliente_nome: lancamento.cliente_nome.trim(),
          cliente_whatsapp: lancamento.cliente_whatsapp?.trim() || null,
          tipo: lancamento.tipo,
          valor: lancamento.valor,
          descricao: lancamento.descricao || null,
          venda_id: lancamento.venda_id || null,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return {
      id: String(data.id),
      cliente_nome: data.cliente_nome,
      cliente_whatsapp: data.cliente_whatsapp || undefined,
      tipo: data.tipo,
      valor: Number(data.valor),
      descricao: data.descricao || undefined,
      venda_id: data.venda_id || undefined,
      created_at: data.created_at,
    };
  } catch (err) {
    console.warn('Erro ao inserir fiado no Supabase:', err);
    return null;
  }
}

export async function deleteLancamentoFiadoSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('fiados').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Uploads local products to Supabase (Initial seed / sync)
 */
export async function pushProdutosToSupabase(produtos: Produto[]): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { count: 0, error: 'Supabase não conectado' };

  try {
    const payload = produtos.map(p => ({
      nome: p.nome,
      categoria: p.categoria,
      codigo_barras: p.codigo_barras || null,
      preco: p.preco,
      preco_custo: p.preco_custo || 0,
      quantidade_estoque: p.quantidade_estoque,
      imagem_url: p.imagem_url || null,
    }));

    const { data, error } = await client.from('produtos').insert(payload).select();
    if (error) throw error;
    return { count: data?.length || payload.length };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Falha ao sincronizar produtos com Supabase' };
  }
}
