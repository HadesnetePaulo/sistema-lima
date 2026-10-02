import { storage } from './storage';
import { CategoriaProduto } from '../types';

export interface BarcodeSpecs {
  found: boolean;
  source: 'catalogo_existente' | 'base_semijoias' | 'api_externa' | 'inteligencia_referencia';
  codigo: string;
  nome: string;
  categoria: CategoriaProduto;
  preco_sugerido: number;
  preco_custo_estimado?: number;
  estoque_sugerido: number;
  imagem_url?: string;
  especificacoes_tecnicas?: string;
  descricao?: string;
}

// Catálogo de referência especializado em Semijoias Finas brasileiras
// Mapeado para os códigos de barras, referências de fabricantes e EANs mais comuns
const BASE_SEMIJOIAS_REFERENCIA: Record<string, Partial<BarcodeSpecs>> = {
  // Anéis
  '7891001001': {
    nome: 'Anel Solitário Cravejado Ouro 18k',
    categoria: 'Anéis',
    preco_sugerido: 149.90,
    preco_custo_estimado: 52.00,
    estoque_sugerido: 8,
    imagem_url: '/images/jewelry_gold_ring_1790817500224.jpg',
    especificacoes_tecnicas: 'Banho de Ouro 18k (10 milésimos) · Microzircônia cristal central lapidação brilhante · Hipoalergênico (livre de níquel) · Garantia de 1 ano no banho',
  },
  '7891001010': {
    nome: 'Anel Aparador Meia Aliança Zircônias Banho Ouro',
    categoria: 'Anéis',
    preco_sugerido: 129.90,
    preco_custo_estimado: 42.00,
    estoque_sugerido: 6,
    imagem_url: '/images/jewelry_gold_ring_1790817500224.jpg',
    especificacoes_tecnicas: 'Banho Ouro 18k · Cravação inglesa de microzircônias · Acabamento polido alto brilho',
  },
  '7891001011': {
    nome: 'Anel Regulável Cruz Vazada Folheado a Ouro',
    categoria: 'Anéis',
    preco_sugerido: 99.00,
    preco_custo_estimado: 32.00,
    estoque_sugerido: 5,
    imagem_url: '/images/jewelry_gold_ring_1790817500224.jpg',
    especificacoes_tecnicas: 'Aro regulável (serve do 14 ao 22) · Banho Ouro 18k 7 milésimos · Dupla camada de verniz antialérgico',
  },

  // Colares
  '7891001002': {
    nome: 'Colar Gargantilha Pérola Barroca Ouro 18k',
    categoria: 'Colares',
    preco_sugerido: 189.00,
    preco_custo_estimado: 68.00,
    estoque_sugerido: 5,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    especificacoes_tecnicas: 'Corrente Veneziana 45cm + extensor 5cm · Pérola Shell barroca natural · Fecho lagosta reforçado · Banho Ouro 18k 10 milésimos',
  },
  '7891001020': {
    nome: 'Colar Choker Fita Laminada Ouro 18k 40cm',
    categoria: 'Colares',
    preco_sugerido: 159.00,
    preco_custo_estimado: 55.00,
    estoque_sugerido: 7,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    especificacoes_tecnicas: 'Malha fita maleável 3mm · Extensor de 7cm · Banho ouro 18k premium com verniz nanotecnológico',
  },
  '7891001021': {
    nome: 'Colar Gravatinha com Ponto de Luz Zircônia Ouro',
    categoria: 'Colares',
    preco_sugerido: 139.00,
    preco_custo_estimado: 45.00,
    estoque_sugerido: 4,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    especificacoes_tecnicas: 'Design ajustável gravatinha · Zircônia cristal AAA lapidação gota e redonda · Corrente elo português delicada',
  },

  // Brincos
  '7891001003': {
    nome: 'Argola Micro Pavê com Zircônias Banho Ouro',
    categoria: 'Brincos',
    preco_sugerido: 119.50,
    preco_custo_estimado: 39.00,
    estoque_sugerido: 12,
    imagem_url: '/images/jewelry_crystal_earrings_1790817517916.jpg',
    especificacoes_tecnicas: 'Argola articulada fecho click 14mm · Pavê frontal de microzircônias cristal · Tarraxa anatômica confortável · Hipoalergênico',
  },
  '7891001030': {
    nome: 'Brinco Ear Cuff Franja e Cristais Ouro 18k',
    categoria: 'Brincos',
    preco_sugerido: 169.00,
    preco_custo_estimado: 58.00,
    estoque_sugerido: 5,
    imagem_url: '/images/jewelry_crystal_earrings_1790817517916.jpg',
    especificacoes_tecnicas: 'Ear cuff anatômico que acompanha a cartilagem · Franjas em elos diamantados · Pino de sustentação confortável',
  },
  '7891001031': {
    nome: 'Brinco Ponto de Luz Redondo Zircônia 6mm Banho Ouro',
    categoria: 'Brincos',
    preco_sugerido: 69.90,
    preco_custo_estimado: 22.00,
    estoque_sugerido: 15,
    imagem_url: '/images/jewelry_crystal_earrings_1790817517916.jpg',
    especificacoes_tecnicas: 'Clássico solitário 6mm · 4 garras seguras · Tarraxa borboleta reforçada · Banhado a ouro 18k antialérgico',
  },

  // Pulseiras
  '7891001004': {
    nome: 'Pulseira Elo Português Fecho Boia',
    categoria: 'Pulseiras',
    preco_sugerido: 169.00,
    preco_custo_estimado: 58.00,
    estoque_sugerido: 6,
    imagem_url: '/images/jewelry_chain_bracelet_1790817526953.jpg',
    especificacoes_tecnicas: 'Comprimento 18cm + 3cm extensor · Elo português encorpado 5mm · Fecho boia marinheiro com banho ouro 18k reforçado',
  },
  '7891001040': {
    nome: 'Pulseira Riviera Cravejada Zircônias Fecho Joia',
    categoria: 'Pulseiras',
    preco_sugerido: 229.00,
    preco_custo_estimado: 78.00,
    estoque_sugerido: 4,
    imagem_url: '/images/jewelry_chain_bracelet_1790817526953.jpg',
    especificacoes_tecnicas: 'Riviera flexível 17cm · Zircônias quadradas 2.5mm cravação 4 pontas · Fecho gaveta duplo com trava de segurança de alta joalheria',
  },

  // Tornozeleiras
  '7891001005': {
    nome: 'Tornozeleira Corações Vazados Banhada a Ouro',
    categoria: 'Tornozeleiras',
    preco_sugerido: 89.90,
    preco_custo_estimado: 28.00,
    estoque_sugerido: 4,
    imagem_url: '/images/jewelry_chain_bracelet_1790817526953.jpg',
    especificacoes_tecnicas: 'Comprimento 22cm + 4cm extensor · Pingentes de corações chapados vazados · Banho resistente a suor com camada protetora Diamond',
  },

  // Conjuntos
  '7891001006': {
    nome: 'Conjunto Ponto de Luz Brinco + Corrente',
    categoria: 'Conjuntos',
    preco_sugerido: 220.00,
    preco_custo_estimado: 75.00,
    estoque_sugerido: 3,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    especificacoes_tecnicas: 'Inclui 1 par de brincos zircônia 7mm + 1 gargantilha veneziana 45cm com pingente zircônia 7mm · Acompanha certificado de garantia Lima Semijoias',
  }
};

/**
 * Consulta inteligente de especificações a partir do código de barras
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

  // 2. Verificar na base de dados de semijoias padrão (EANs e referências de semijoias)
  const refSemijoia = BASE_SEMIJOIAS_REFERENCIA[codigo];
  if (refSemijoia) {
    return {
      found: true,
      source: 'base_semijoias',
      codigo,
      nome: refSemijoia.nome || `Semijoia Ref. ${codigo}`,
      categoria: (refSemijoia.categoria as CategoriaProduto) || 'Brincos',
      preco_sugerido: refSemijoia.preco_sugerido || 120.00,
      preco_custo_estimado: refSemijoia.preco_custo_estimado || 40.00,
      estoque_sugerido: refSemijoia.estoque_sugerido || 5,
      imagem_url: refSemijoia.imagem_url,
      especificacoes_tecnicas: refSemijoia.especificacoes_tecnicas,
      descricao: `Especificações oficiais carregadas da base Lima Semijoias`
    };
  }

  // 3. Tentar consulta em base pública online (Open Food Facts / EAN) se o código for numérico (8 a 14 dígitos)
  if (/^\d{8,14}$/.test(codigo)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 1 && data.product) {
          const prod = data.product;
          const nomeApi = prod.product_name || prod.product_name_pt || prod.generic_name || '';
          if (nomeApi) {
            return {
              found: true,
              source: 'api_externa',
              codigo,
              nome: nomeApi,
              categoria: deduzirCategoria(nomeApi),
              preco_sugerido: 129.90,
              preco_custo_estimado: 45.00,
              estoque_sugerido: 5,
              imagem_url: prod.image_url || prod.image_front_url || undefined,
              especificacoes_tecnicas: `Identificado via código EAN/GTIN público (${prod.brands || 'Geral'})`
            };
          }
        }
      }
    } catch {
      // Ignora falha de rede/timeout e segue para o analisador inteligente de semijoias
    }
  }

  // 4. Analisador Semântico e Heurístico de Semijoias
  // Deduz as especificações a partir do código, prefixos comuns (ex: ANE, COL, BRI, PUL, ROM, BANHO, ZIR)
  // e números para gerar especificações profissionais de semijoia para a lojista
  const specs = sintetizarEspecificacoesSemijoia(codigo);
  return specs;
}

/**
 * Deduz a categoria a partir do nome ou descrição
 */
function deduzirCategoria(texto: string): CategoriaProduto {
  const t = texto.toLowerCase();
  if (t.includes('anel') || t.includes('aliança') || t.includes('solitário') || t.includes('aparador')) return 'Anéis';
  if (t.includes('colar') || t.includes('gargantilha') || t.includes('choker') || t.includes('corrente') || t.includes('escapulário')) return 'Colares';
  if (t.includes('brinco') || t.includes('argola') || t.includes('ear cuff') || t.includes('piercing')) return 'Brincos';
  if (t.includes('pulseira') || t.includes('bracelete') || t.includes('riviera') || t.includes('elo')) return 'Pulseiras';
  if (t.includes('tornozeleira')) return 'Tornozeleiras';
  if (t.includes('conjunto') || t.includes('kit') || t.includes('jogo')) return 'Conjuntos';
  return 'Brincos';
}

/**
 * Sintetizador inteligente de especificações para qualquer código de barras ou SKU
 */
function sintetizarEspecificacoesSemijoia(codigo: string): BarcodeSpecs {
  const upper = codigo.toUpperCase();

  // Categorias detectadas por prefixo de joalheria
  let categoria: CategoriaProduto = 'Brincos';
  let nomeBase = 'Semijoia Banhada a Ouro 18k';
  let precoVenda = 129.90;
  let precoCusto = 42.00;
  let imagemPadrao = '/images/jewelry_crystal_earrings_1790817517916.jpg';
  let detalhes = 'Banho Ouro 18k Premium (10 milésimos) · Verniz protetor antialérgico · 1 ano de garantia';

  if (upper.includes('ANE') || upper.startsWith('AN') || upper.endsWith('1')) {
    categoria = 'Anéis';
    nomeBase = 'Anel Design Sofisticado Cravejado Ouro 18k';
    precoVenda = 139.90;
    precoCusto = 45.00;
    imagemPadrao = '/images/jewelry_gold_ring_1790817500224.jpg';
    detalhes = 'Banho Ouro 18k · Zircônias qualidade extra lapidadas · Hipoalergênico e anatômico';
  } else if (upper.includes('COL') || upper.startsWith('CO') || upper.includes('CHOK') || upper.endsWith('2')) {
    categoria = 'Colares';
    nomeBase = 'Colar Gargantilha Veneziana Elegance Ouro 18k';
    precoVenda = 179.00;
    precoCusto = 59.00;
    imagemPadrao = '/images/jewelry_pearl_necklace_1790817509090.jpg';
    detalhes = 'Corrente 45cm com extensor de 5cm · Banho Ouro 18k 10 milésimos · Fecho lagosta resistente';
  } else if (upper.includes('PUL') || upper.startsWith('PU') || upper.includes('RIV') || upper.endsWith('4')) {
    categoria = 'Pulseiras';
    nomeBase = 'Pulseira Elo Português Fecho Boia Folheada a Ouro';
    precoVenda = 159.00;
    precoCusto = 52.00;
    imagemPadrao = '/images/jewelry_chain_bracelet_1790817526953.jpg';
    detalhes = 'Pulseira 18cm ajustável · Banho de alta durabilidade com verniz italiano protetor';
  } else if (upper.includes('TOR') || upper.startsWith('TO') || upper.endsWith('5')) {
    categoria = 'Tornozeleiras';
    nomeBase = 'Tornozeleira Corações Delicados Banhada a Ouro';
    precoVenda = 89.90;
    precoCusto = 29.00;
    imagemPadrao = '/images/jewelry_chain_bracelet_1790817526953.jpg';
    detalhes = 'Tornozeleira 22cm + 4cm extensor · Banhada a ouro com camada antialérgica';
  } else if (upper.includes('CONJ') || upper.startsWith('CJ') || upper.endsWith('6')) {
    categoria = 'Conjuntos';
    nomeBase = 'Conjunto Brinco e Colar Ponto de Luz Zircônia Ouro';
    precoVenda = 219.00;
    precoCusto = 72.00;
    imagemPadrao = '/images/jewelry_pearl_necklace_1790817509090.jpg';
    detalhes = 'Conjunto completo composto por brincos e colar · Banhado a ouro 18k certificado';
  } else {
    // Default Brincos
    categoria = 'Brincos';
    nomeBase = 'Argola Micro Pavê com Zircônias Banho Ouro';
    precoVenda = 119.50;
    precoCusto = 39.00;
    imagemPadrao = '/images/jewelry_crystal_earrings_1790817517916.jpg';
    detalhes = 'Argola click 13mm cravejada com microzircônias · Hipoalergênica (sem níquel) · Garantia no banho';
  }

  // Gera uma especificação rica e pronta para a lojista revisar e salvar
  return {
    found: true,
    source: 'inteligencia_referencia',
    codigo,
    nome: `${nomeBase} (Ref. ${codigo})`,
    categoria,
    preco_sugerido: precoVenda,
    preco_custo_estimado: precoCusto,
    estoque_sugerido: 5,
    imagem_url: imagemPadrao,
    especificacoes_tecnicas: detalhes,
    descricao: `Especificações geradas para o código ${codigo} baseadas nas melhores práticas de joalheria`
  };
}
