-- ============================================================================
-- SISTEMA DE VENDAS SEMIJOIAS - SCHEMA SUPABASE (V1)
-- Execute este script no SQL Editor do seu projeto Supabase (supabase.com)
-- ============================================================================

-- 1. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  codigo_barras TEXT,
  preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
  quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
  imagem_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. TABELA DE VENDAS
CREATE TABLE IF NOT EXISTS public.vendas (
  id TEXT PRIMARY KEY,
  forma_pagamento TEXT NOT NULL,
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. TABELA DE ITENS DA VENDA (Preço unitário congelado no momento da venda)
CREATE TABLE IF NOT EXISTS public.itens_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id TEXT NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  nome_produto TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(10, 2) NOT NULL CHECK (preco_unitario >= 0),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON public.produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON public.vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_itens_venda_venda_id ON public.itens_venda(venda_id);

-- ============================================================================
-- 4. FUNÇÃO ATÔMICA: registrar_venda
-- Garante a baixa automática e atômica de estoque em uma única transação.
-- Bloqueia a venda se não houver estoque suficiente, sem corromper dados.
--
-- Parâmetros:
--   itens: JSONB contendo array de objetos: [{"produto_id": "...", "quantidade": 2}]
--   forma_pagamento: TEXT (ex: 'Pix', 'Cartão de Crédito', 'Dinheiro')
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registrar_venda(
  itens JSONB,
  forma_pagamento TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id TEXT;
  v_item RECORD;
  v_produto RECORD;
  v_total NUMERIC(10, 2) := 0;
  v_item_subtotal NUMERIC(10, 2);
  v_retorno JSONB;
BEGIN
  -- Gera ID amigável para o recibo (Ex: VND-834921)
  v_venda_id := 'VND-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');

  -- Verifica se a lista de itens não está vazia
  IF jsonb_array_length(itens) = 0 THEN
    RAISE EXCEPTION 'A lista de itens da venda não pode estar vazia.';
  END IF;

  -- 1ª ETAPA: Validação estrita e atômica com LOCK DE LINHA (FOR UPDATE)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(itens) AS x(produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = v_item.produto_id
    FOR UPDATE; -- Bloqueia a linha durante a transação concorrente

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto com ID % não foi encontrado no catálogo.', v_item.produto_id;
    END IF;

    IF v_produto.quantidade_estoque < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%". Disponível: %, Solicitado: %.',
        v_produto.nome, v_produto.quantidade_estoque, v_item.quantidade;
    END IF;

    -- Acumula total da venda
    v_item_subtotal := v_produto.preco * v_item.quantidade;
    v_total := v_total + v_item_subtotal;
  END LOOP;

  -- 2ª ETAPA: Insere a Venda Master
  INSERT INTO public.vendas (id, forma_pagamento, total, created_at)
  VALUES (v_venda_id, forma_pagamento, v_total, NOW());

  -- 3ª ETAPA: Grava itens com preço congelado e desconta o estoque
  FOR v_item IN SELECT * FROM jsonb_to_recordset(itens) AS x(produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = v_item.produto_id;

    -- Insere item da venda com preço congelado
    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    VALUES (v_venda_id, v_produto.id, v_produto.nome, v_item.quantidade, v_produto.preco);

    -- Baixa atômica do estoque
    UPDATE public.produtos
    SET quantidade_estoque = quantidade_estoque - v_item.quantidade
    WHERE id = v_produto.id;
  END LOOP;

  -- Monta objeto de retorno
  v_retorno := jsonb_build_object(
    'sucesso', true,
    'venda_id', v_venda_id,
    'total', v_total,
    'forma_pagamento', forma_pagamento,
    'created_at', NOW()
  );

  RETURN v_retorno;
END;
$$;

-- Permissões básicas
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Dados iniciais de demonstração (Opcional - caso queira popular)
INSERT INTO public.produtos (nome, categoria, codigo_barras, preco, quantidade_estoque)
VALUES
  ('Anel Solitário Cravejado Ouro 18k', 'Anéis', '7891001001', 149.90, 8),
  ('Colar Gargantilha Pérola Barroca Ouro 18k', 'Colares', '7891001002', 189.00, 5),
  ('Argola Micro Pavê com Zircônias Banho Ouro', 'Brincos', '7891001003', 119.50, 12),
  ('Pulseira Elo Português Fecho Boia', 'Pulseiras', '7891001004', 169.00, 6),
  ('Tornozeleira Corações Vazados Banhada a Ouro', 'Tornozeleiras', '7891001005', 89.90, 4),
  ('Conjunto Ponto de Luz Brinco + Corrente', 'Conjuntos', '7891001006', 220.00, 3)
ON CONFLICT DO NOTHING;
