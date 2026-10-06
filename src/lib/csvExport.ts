import { Produto, Venda } from '../types/index';

/**
 * Utilitários para exportação de dados em CSV (Excel e Planilhas)
 * Utiliza delimitador ponto-e-vírgula (;) e vírgula como separador decimal para compatibilidade nativa
 * com Excel no Brasil e outros softwares em língua portuguesa, incluindo BOM UTF-8 (\uFEFF).
 */

const pad = (n: number) => String(n).padStart(2, '0');

function escaparCSV(valor: any): string {
  if (valor === null || valor === undefined) return '';
  const str = String(valor);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatarDataHora(isoString?: string): { data: string; hora: string; dataHora: string } {
  if (!isoString) {
    return { data: '', hora: '', dataHora: '' };
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { data: isoString, hora: '', dataHora: isoString };
    }
    const data = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { data, hora, dataHora: `${data} ${hora}` };
  } catch {
    return { data: isoString, hora: '', dataHora: isoString };
  }
}

function formatarNumero(valor?: number): string {
  if (valor === undefined || valor === null || isNaN(valor)) return '0,00';
  return Number(valor).toFixed(2).replace('.', ',');
}

function gerarCarimboDataHora(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}`;
}

/**
 * Dispara o download de um arquivo CSV no navegador
 */
export function baixarArquivoCSV(conteudoCSV: string, nomeArquivo: string): void {
  // UTF-8 BOM (\uFEFF) garante que acentuações e caracteres em português abram perfeitamente no Excel
  const blob = new Blob(['\uFEFF' + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', nomeArquivo);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera o conteúdo CSV do Estoque de Produtos
 */
export function gerarCSVEstoque(produtos: Produto[]): string {
  const cabecalhos = [
    'Código / ID',
    'Código de Barras / Ref',
    'Nome da Semijoia',
    'Categoria',
    'Qtd em Estoque',
    'Estoque Mínimo',
    'Status do Estoque',
    'Preço de Custo Unitário (R$)',
    'Preço de Venda Unitário (R$)',
    'Lucro Unitário Estimado (R$)',
    'Margem Bruta (%)',
    'Valor Total Custo (R$)',
    'Valor Total Venda (R$)',
    'Data de Cadastro'
  ];

  const linhas: string[] = [cabecalhos.map(escaparCSV).join(';')];

  for (const p of produtos) {
    const estoque = Number(p.quantidade_estoque || 0);
    const estoqueMin = Number(p.estoque_minimo || 3);
    const custo = Number(p.preco_custo || 0);
    const preco = Number(p.preco || 0);
    const lucroUnit = preco - custo;
    const margem = preco > 0 ? ((lucroUnit / preco) * 100).toFixed(1).replace('.', ',') : '0,0';
    const totalCusto = custo * estoque;
    const totalVenda = preco * estoque;

    let status = 'Normal';
    if (estoque <= 0) {
      status = 'Esgotado';
    } else if (estoque <= estoqueMin) {
      status = 'Estoque Baixo';
    }

    const { dataHora } = formatarDataHora(p.created_at);

    linhas.push([
      escaparCSV(p.id),
      escaparCSV(p.codigo_barras || ''),
      escaparCSV(p.nome),
      escaparCSV(p.categoria || 'Outros'),
      escaparCSV(estoque),
      escaparCSV(estoqueMin),
      escaparCSV(status),
      escaparCSV(formatarNumero(custo)),
      escaparCSV(formatarNumero(preco)),
      escaparCSV(formatarNumero(lucroUnit)),
      escaparCSV(margem + '%'),
      escaparCSV(formatarNumero(totalCusto)),
      escaparCSV(formatarNumero(totalVenda)),
      escaparCSV(dataHora)
    ].join(';'));
  }

  return linhas.join('\r\n');
}

/**
 * Gera o conteúdo CSV consolidado das Vendas Realizadas (1 linha por venda)
 */
export function gerarCSVVendasConsolidadas(vendas: Venda[]): string {
  const cabecalhos = [
    'ID da Venda',
    'Data da Venda',
    'Hora da Venda',
    'Nome da Cliente',
    'WhatsApp da Cliente',
    'Forma de Pagamento',
    'Qtd Total de Peças',
    'Resumo das Peças Vendidas',
    'Custo Total das Peças (R$)',
    'Valor Total da Venda (R$)',
    'Lucro Bruto da Venda (R$)',
    'Margem de Lucro (%)'
  ];

  const linhas: string[] = [cabecalhos.map(escaparCSV).join(';')];

  for (const v of vendas) {
    const { data, hora } = formatarDataHora(v.created_at);
    const itens = v.itens || [];
    const qtdTotal = itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
    const resumoItens = itens.map(i => `${i.quantidade}x ${i.nome_produto}`).join(' | ');

    const custoTotal = itens.reduce((acc, i) => {
      const custoUnit = Number(i.preco_custo || 0);
      return acc + (custoUnit * (Number(i.quantidade) || 1));
    }, 0);

    const totalVenda = Number(v.total || 0);
    const lucroBruto = totalVenda - custoTotal;
    const margem = totalVenda > 0 ? ((lucroBruto / totalVenda) * 100).toFixed(1).replace('.', ',') : '0,0';

    linhas.push([
      escaparCSV(v.id),
      escaparCSV(data),
      escaparCSV(hora),
      escaparCSV(v.cliente_nome || 'Cliente Balcão'),
      escaparCSV(v.cliente_whatsapp || ''),
      escaparCSV(v.forma_pagamento || 'Outro'),
      escaparCSV(qtdTotal),
      escaparCSV(resumoItens),
      escaparCSV(formatarNumero(custoTotal)),
      escaparCSV(formatarNumero(totalVenda)),
      escaparCSV(formatarNumero(lucroBruto)),
      escaparCSV(margem + '%')
    ].join(';'));
  }

  return linhas.join('\r\n');
}

/**
 * Gera o conteúdo CSV detalhado dos Itens Vendidos (1 linha por peça vendida)
 */
export function gerarCSVItensVendidos(vendas: Venda[]): string {
  const cabecalhos = [
    'ID da Venda',
    'Data da Venda',
    'Hora da Venda',
    'Cliente',
    'WhatsApp',
    'Forma de Pagamento',
    'ID do Produto',
    'Nome da Semijoia',
    'Quantidade Vendida',
    'Preço Unitário de Venda (R$)',
    'Custo Unitário (R$)',
    'Subtotal Venda (R$)',
    'Subtotal Custo (R$)',
    'Lucro Bruto Item (R$)'
  ];

  const linhas: string[] = [cabecalhos.map(escaparCSV).join(';')];

  for (const v of vendas) {
    const { data, hora } = formatarDataHora(v.created_at);
    const itens = v.itens || [];

    for (const item of itens) {
      const qtd = Number(item.quantidade) || 1;
      const precoUnit = Number(item.preco_unitario) || 0;
      const custoUnit = Number(item.preco_custo) || 0;
      const subtotalVenda = precoUnit * qtd;
      const subtotalCusto = custoUnit * qtd;
      const lucroItem = subtotalVenda - subtotalCusto;

      linhas.push([
        escaparCSV(v.id),
        escaparCSV(data),
        escaparCSV(hora),
        escaparCSV(v.cliente_nome || 'Cliente Balcão'),
        escaparCSV(v.cliente_whatsapp || ''),
        escaparCSV(v.forma_pagamento || 'Outro'),
        escaparCSV(item.produto_id || ''),
        escaparCSV(item.nome_produto || 'Semijoia'),
        escaparCSV(qtd),
        escaparCSV(formatarNumero(precoUnit)),
        escaparCSV(formatarNumero(custoUnit)),
        escaparCSV(formatarNumero(subtotalVenda)),
        escaparCSV(formatarNumero(subtotalCusto)),
        escaparCSV(formatarNumero(lucroItem))
      ].join(';'));
    }
  }

  return linhas.join('\r\n');
}

/**
 * Função de conveniência: Exportar Estoque para CSV
 */
export function exportarEstoqueCSV(produtos: Produto[]): { filename: string; totalRegistros: number } {
  const csv = gerarCSVEstoque(produtos);
  const filename = `estoque_lima_semijoias_${gerarCarimboDataHora()}.csv`;
  baixarArquivoCSV(csv, filename);
  return { filename, totalRegistros: produtos.length };
}

/**
 * Função de conveniência: Exportar Vendas Consolidadas para CSV
 */
export function exportarVendasCSV(vendas: Venda[]): { filename: string; totalRegistros: number } {
  const csv = gerarCSVVendasConsolidadas(vendas);
  const filename = `vendas_lima_semijoias_${gerarCarimboDataHora()}.csv`;
  baixarArquivoCSV(csv, filename);
  return { filename, totalRegistros: vendas.length };
}

/**
 * Função de conveniência: Exportar Itens de Vendas Detalhados para CSV
 */
export function exportarItensVendasCSV(vendas: Venda[]): { filename: string; totalRegistros: number } {
  const csv = gerarCSVItensVendidos(vendas);
  const filename = `itens_vendas_detalhados_lima_semijoias_${gerarCarimboDataHora()}.csv`;
  baixarArquivoCSV(csv, filename);
  const totalItens = vendas.reduce((acc, v) => acc + (v.itens?.length || 0), 0);
  return { filename, totalRegistros: totalItens };
}

/**
 * Função de conveniência: Exportar Estoque + Vendas juntos em sequência
 */
export function exportarTudoCSV(produtos: Produto[], vendas: Venda[]): {
  arquivoEstoque: string;
  arquivoVendas: string;
  totalProdutos: number;
  totalVendas: number;
} {
  const resEstoque = exportarEstoqueCSV(produtos);
  // Pequeno timeout para permitir que o navegador abra o segundo download sem bloquear
  setTimeout(() => {
    exportarVendasCSV(vendas);
  }, 400);

  return {
    arquivoEstoque: resEstoque.filename,
    arquivoVendas: `vendas_lima_semijoias_${gerarCarimboDataHora()}.csv`,
    totalProdutos: produtos.length,
    totalVendas: vendas.length
  };
}
