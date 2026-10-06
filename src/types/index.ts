export interface HistoricoPrecoFornecedor {
  precoCusto: number;
  dataAtualizacaoPreco: string; // ISO string ou timestamp
}

export interface FornecedorProdutoRef {
  fornecedorId: string;
  precoCusto: number;
  dataAtualizacaoPreco: string; // ISO string ou timestamp
  historicoPrecos?: HistoricoPrecoFornecedor[];
}

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  codigo_barras: string;
  preco: number;
  preco_custo?: number; // Preço de custo padrão da semijoia
  quantidade_estoque: number;
  estoque_minimo?: number; // Limite mínimo de estoque para alerta visual e selo de atenção (padrão: 3)
  imagem_url?: string;
  fornecedores?: FornecedorProdutoRef[]; // Vínculo com fornecedores e respectivos preços de custo
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
  'Conta Corrente' // Lançamento na conta comercial do cliente
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
// V2: CONTA CORRENTE (Controle Comercial & Débitos/Pagamentos)
// -------------------------------------------------------------
export type TipoLancamentoFiado = 'debito' | 'pagamento';

export interface LancamentoFiado {
  id: string;
  cliente_nome: string;
  cliente_whatsapp?: string;
  tipo: TipoLancamentoFiado; // 'debito' = compra na conta corrente, 'pagamento' = quando cliente pagou
  valor: number;
  descricao?: string;
  produto_id?: string;
  quantidade?: number;
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

export interface ContaCliente {
  nome: string;
  whatsapp?: string;
  saldoDevedor: number;
  totalVendas: number;
  totalGasto: number;
  ultimaVenda?: string;
}

// -------------------------------------------------------------
// V3: MÓDULO DE FORNECEDORES & PEDIDOS DE COMPRA
// -------------------------------------------------------------
export interface Fornecedor {
  id: string;
  nome: string; // Nome fantasia ou razão social
  razaoSocial?: string;
  cnpjOuCpf?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  prazoMedioEntregaDias?: number;
  pedidoMinimo?: number;
  formasPagamento?: string[];
  observacoes?: string;
  created_at: string;
  updated_at?: string;
}

export type StatusPedidoCompra = 'solicitado' | 'confirmado' | 'em_transito' | 'recebido' | 'cancelado';

export interface ItemPedidoCompra {
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  custoUnitario: number;
  subtotal: number;
}

export interface PedidoCompra {
  id: string;
  fornecedorId: string;
  fornecedorNome?: string;
  dataPedido: string;          // ISO string
  dataPrevistaEntrega: string;  // ISO string
  dataRecebimento?: string;     // ISO string quando recebido
  status: StatusPedidoCompra;
  itens: ItemPedidoCompra[];
  valorTotal: number;
  recebidoPor?: string;
  dataConfirmacaoRecebimento?: string;
  observacoes?: string;
  created_at: string;
  updated_at?: string;
}


