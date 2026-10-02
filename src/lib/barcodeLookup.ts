import { storage } from './storage';
import { CategoriaProduto } from '../types';

export interface BarcodeSpecs {
  found: boolean;
  source: 'catalogo_existente' | 'novo_codigo';
  codigo: string;
  nome?: string;
  categoria?: CategoriaProduto;
  preco_sugerido?: number;
  preco_custo_estimado?: number;
  estoque_sugerido?: number;
  imagem_url?: string;
  especificacoes_tecnicas?: string;
  descricao?: string;
}

/**
 * Consulta de código de barras ou referência no catálogo real da loja.
 * Não inventa dados fictícios nem consulta bases de terceiros que não tenham relação com semijoias.
 */
export async function buscarEspecificacoesPorCodigo(codigoBruto: string): Promise<BarcodeSpecs> {
  const codigo = codigoBruto.trim();
  if (!codigo) {
    throw new Error('Código de barras não informado');
  }

  // 1. Verificar se já existe um produto cadastrado no próprio sistema com esse código
  try {
    const produtosLocais = storage.getProdutos();
    const produtoExistente = produtosLocais.find(
      p => p.codigo_barras && p.codigo_barras.trim().toLowerCase() === codigo.toLowerCase()
    );

    if (produtoExistente) {
      return {
        found: true,
        source: 'catalogo_existente',
        codigo,
        nome: produtoExistente.nome,
        categoria: (produtoExistente.categoria as CategoriaProduto) || 'Brincos',
        preco_sugerido: produtoExistente.preco,
        preco_custo_estimado: produtoExistente.preco_custo,
        estoque_sugerido: produtoExistente.quantidade_estoque || 5,
        imagem_url: produtoExistente.imagem_url,
        especificacoes_tecnicas: `Produto já registrado no estoque · ${produtoExistente.categoria}`,
        descricao: `Identificado produto existente: ${produtoExistente.nome}`
      };
    }
  } catch (err) {
    console.warn('Erro ao consultar produtos locais:', err);
  }

  // 2. Se for um código novo (etiqueta nova), não inventa dados falsos
  return {
    found: false,
    source: 'novo_codigo',
    codigo,
    descricao: `Código ${codigo} pronto para cadastro.`
  };
}
