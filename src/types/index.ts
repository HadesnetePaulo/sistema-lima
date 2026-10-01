export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  codigo_barras: string;
  preco: number;
  preco_custo?: number; // V2: Preço de custo da semijoia (opcional/padrão 0 nos antigos)
  quantidade_estoque: number;
  imagem_url?: string;
  created_at?: string;
}

export interface ItemVenda {
  id?: string;
  venda_id?: string;
  produto_id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number; // Preço de venda congelado no momento da venda
  preco_custo?: number;   // V2: Custo unitário congelado no momento da venda para apuração do lucro
}

export interface Venda {
  id: string;
  forma_pagamento: string;
  total: number;
  cliente_nome?: string;     // V2: Caso seja venda fiada ou cliente identificada
  cliente_whatsapp?: string; // V2: WhatsApp para cobrança amigável
  created_at: string;
  itens: ItemVenda[];
}

export interface CartItem {
  produto: Produto;
  quantidade: number;
}

export type CategoriaProduto = 
  | 'Todas'
  | 'Brincos'
  | 'Colares'
  | 'Pulseiras'
  | 'Anéis'
  | 'Tornozeleiras'
  | 'Conjuntos'
  | 'Outros';

export const CATEGORIAS: CategoriaProduto[] = [
  'Todas',
  'Brincos',
  'Colares',
  'Pulseiras',
  'Anéis',
  'Tornozeleiras',
  'Conjuntos',
  'Outros'
];

export const FORMAS_PAGAMENTO = [
  'Pix',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Transferência',
  'Fiado / A Prazo' // V2: Gera lançamento automático no controle de fiado
] as const;

export type FormaPagamento = typeof FORMAS_PAGAMENTO[number];

// -------------------------------------------------------------
// V2: MÓDULO DE CAIXA
// -------------------------------------------------------------
export type TipoMovimentacaoCaixa = 'entrada' | 'saida';

export interface MovimentacaoCaixa {
  id: string;
  tipo: TipoMovimentacaoCaixa;
  valor: number;
  descricao: string;
  created_at: string;
}

// -------------------------------------------------------------
// V2: CONTROLE DE FIADO
// -------------------------------------------------------------
export type TipoLancamentoFiado = 'debito' | 'pagamento';

export interface LancamentoFiado {
  id: string;
  cliente_nome: string;
  cliente_whatsapp?: string;
  tipo: TipoLancamentoFiado; // 'debito' = compra fiada, 'pagamento' = quando cliente pagou
  valor: number;
  descricao?: string;
  venda_id?: string;
  created_at: string;
}

export interface ResumoClienteFiado {
  cliente_nome: string;
  cliente_whatsapp?: string;
  total_compras: number;
  total_pago: number;
  saldo_devedor: number;
  ultimo_lancamento: string;
  historico: LancamentoFiado[];
}
