'use server';

import { createClient } from '@supabase/supabase-js';

/**
 * Parâmetros de filtro para o cálculo do lucro.
 * Ambas as datas são opcionais; se não informadas, o padrão é o mês atual até a data de hoje.
 */
export interface FiltroPeriodoLucro {
  dataInicio?: string | Date; // Ex: '2026-10-01' ou ISO string
  dataFim?: string | Date;    // Ex: '2026-10-31' ou ISO string
}

/**
 * Resumo financeiro calculado pela Server Action.
 */
export interface ResultadoCalculoLucro {
  sucesso: boolean;
  periodo: {
    inicio: string;
    fim: string;
  };
  // 1. Receita total das vendas no período
  receitaTotalVendas: number;
  // 2. Custo total dos produtos vendidos (custo unitário * quantidade)
  custoTotalItensVendidos: number;
  // 3. Lucro bruto das vendas (Receita Total - Custo dos Produtos)
  lucroBrutoVendas: number;
  // 4. Saídas manuais registradas na tabela movimentacoes_caixa (despesas, sangrias, etc.)
  totalSaidasCaixa: number;
  // 5. Lucro Final ajustado pelas saídas:
  // Lucro = Receita Total - Custo dos Itens Vendidos - Saídas do Caixa
  lucroFinal: number;
  // Métricas complementares do caixa e estoque
  totalEntradasManuaisCaixa: number;
  saldoFinalAjustadoComAportes: number; // (Receita - Custos - Saídas) + Entradas Manuais
  quantidadeVendas: number;
  quantidadePecasVendidas: number;
  pecasSemCustoCadastrado: number; // Peças legadas da V1 que estavam sem preco_custo definido
  erro?: string;
}

/**
 * Instancia o cliente do Supabase no ambiente de servidor com service_role/secret key.
 * Garante que a chave privilegiada nunca seja exposta ao navegador.
 */
function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SECRET_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.'
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * SERVER ACTION: calcularLucroPeriodo
 * 
 * Regra de Negócio solicitada:
 * 1. Soma a receita total das vendas registradas na tabela `vendas` no período.
 * 2. Subtrai o custo total dos itens vendidos (custo unitário * quantidade) a partir de `itens_venda`
 *    (com fallback para `produtos.preco_custo` caso a venda seja da V1 antes do preenchimento).
 * 3. Subtrai as saídas registradas na tabela `movimentacoes_caixa` (onde tipo = 'saida').
 * 
 * Fórmula:
 *   Lucro = Receita Total - Custo dos Itens Vendidos - Saídas do Caixa
 */
export async function calcularLucroPeriodo(
  filtro?: FiltroPeriodoLucro
): Promise<ResultadoCalculoLucro> {
  try {
    const supabase = getSupabaseServerClient();

    // 1. Normalização do intervalo de datas (início do dia até o final do dia)
    const agora = new Date();

    let dataInicioISO: string;
    if (filtro?.dataInicio) {
      const dInicio = typeof filtro.dataInicio === 'string' ? new Date(filtro.dataInicio) : new Date(filtro.dataInicio);
      dInicio.setHours(0, 0, 0, 0);
      dataInicioISO = dInicio.toISOString();
    } else {
      // Padrão: 1º dia do mês corrente às 00:00:00.000
      const primeiroDiaMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      dataInicioISO = primeiroDiaMes.toISOString();
    }

    let dataFimISO: string;
    if (filtro?.dataFim) {
      const dFim = typeof filtro.dataFim === 'string' ? new Date(filtro.dataFim) : new Date(filtro.dataFim);
      dFim.setHours(23, 59, 59, 999);
      dataFimISO = dFim.toISOString();
    } else {
      // Padrão: fim do dia de hoje às 23:59:59.999
      const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
      dataFimISO = fimHoje.toISOString();
    }

    // 2. Consulta de Vendas com seus respectivos Itens e Produtos associados
    const { data: vendas, error: errVendas } = await supabase
      .from('vendas')
      .select(`
        id,
        total,
        created_at,
        itens_venda (
          id,
          produto_id,
          quantidade,
          preco_unitario,
          preco_custo,
          produtos (
            preco_custo
          )
        )
      `)
      .gte('created_at', dataInicioISO)
      .lte('created_at', dataFimISO)
      .order('created_at', { ascending: false });

    if (errVendas) {
      throw new Error(`Falha ao buscar vendas no Supabase: ${errVendas.message}`);
    }

    // 3. Consulta de Movimentações de Caixa no período
    const { data: movimentacoes, error: errCaixa } = await supabase
      .from('movimentacoes_caixa')
      .select('id, tipo, valor, created_at')
      .gte('created_at', dataInicioISO)
      .lte('created_at', dataFimISO);

    if (errCaixa) {
      throw new Error(`Falha ao buscar movimentações de caixa no Supabase: ${errCaixa.message}`);
    }

    // 4. Somar a receita total de vendas e calcular o custo total dos itens vendidos
    let receitaTotalVendas = 0;
    let custoTotalItensVendidos = 0;
    let quantidadePecasVendidas = 0;
    let pecasSemCustoCadastrado = 0;

    for (const venda of vendas || []) {
      receitaTotalVendas += Number(venda.total || 0);

      const itens = (venda as any).itens_venda || [];
      for (const item of itens) {
        const qtd = Number(item.quantidade || 0);
        quantidadePecasVendidas += qtd;

        // Prioridade 1: Preço de custo gravado no item_venda no momento da venda
        let custoUnitario = Number(item.preco_custo || 0);

        // Prioridade 2 (Fallback): Vendas antigas da V1 sem custo no item_venda buscam o preco_custo da tabela produtos
        if (custoUnitario <= 0 && item.produtos?.preco_custo) {
          custoUnitario = Number(item.produtos.preco_custo || 0);
        }

        if (custoUnitario > 0) {
          custoTotalItensVendidos += custoUnitario * qtd;
        } else {
          pecasSemCustoCadastrado += qtd;
        }
      }
    }

    // 5. Apurar as saídas (despesas/retiradas) registradas na tabela movimentacoes_caixa
    let totalSaidasCaixa = 0;
    let totalEntradasManuaisCaixa = 0;

    for (const mov of movimentacoes || []) {
      const valor = Number(mov.valor || 0);
      if (mov.tipo === 'saida') {
        totalSaidasCaixa += valor;
      } else if (mov.tipo === 'entrada') {
        totalEntradasManuaisCaixa += valor;
      }
    }

    // 6. Cálculo do Lucro conforme a regra solicitada:
    // Lucro Bruto = Receita Total de Vendas - Custo Total dos Itens Vendidos
    const lucroBrutoVendas = Number((receitaTotalVendas - custoTotalItensVendidos).toFixed(2));

    // Lucro Final = Receita Total - Custo dos Itens Vendidos - Saídas de Caixa
    const lucroFinal = Number((lucroBrutoVendas - totalSaidasCaixa).toFixed(2));

    // Saldo Final Ajustado com eventuais aportes de caixa:
    const saldoFinalAjustadoComAportes = Number(
      (lucroFinal + totalEntradasManuaisCaixa).toFixed(2)
    );

    return {
      sucesso: true,
      periodo: {
        inicio: dataInicioISO,
        fim: dataFimISO,
      },
      receitaTotalVendas: Number(receitaTotalVendas.toFixed(2)),
      custoTotalItensVendidos: Number(custoTotalItensVendidos.toFixed(2)),
      lucroBrutoVendas,
      totalSaidasCaixa: Number(totalSaidasCaixa.toFixed(2)),
      lucroFinal,
      totalEntradasManuaisCaixa: Number(totalEntradasManuaisCaixa.toFixed(2)),
      saldoFinalAjustadoComAportes,
      quantidadeVendas: (vendas || []).length,
      quantidadePecasVendidas,
      pecasSemCustoCadastrado,
    };
  } catch (error: any) {
    console.error('Erro na Server Action calcularLucroPeriodo:', error);
    return {
      sucesso: false,
      periodo: {
        inicio: filtro?.dataInicio?.toString() || new Date().toISOString(),
        fim: filtro?.dataFim?.toString() || new Date().toISOString(),
      },
      receitaTotalVendas: 0,
      custoTotalItensVendidos: 0,
      lucroBrutoVendas: 0,
      totalSaidasCaixa: 0,
      lucroFinal: 0,
      totalEntradasManuaisCaixa: 0,
      saldoFinalAjustadoComAportes: 0,
      quantidadeVendas: 0,
      quantidadePecasVendidas: 0,
      pecasSemCustoCadastrado: 0,
      erro: error?.message || 'Falha ao calcular lucro no servidor.',
    };
  }
}
