-- ============================================================================
-- LIMA SEMIJOIAS - MIGRATION V2 (Executar no SQL Editor do Supabase)
-- Adiciona preco_custo, modulo de caixa e controle de fiado sem quebrar dados existentes
-- ============================================================================

-- 1. ADICIONA PREÇO DE CUSTO EM PRODUTOS (pode ser 0/nulo nos existentes)
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2) DEFAULT 0 CHECK (preco_custo >= 0);

-- 2. ADICIONA PREÇO DE CUSTO CONGELADO EM ITENS_VENDA (para cálculo de lucro real)
ALTER TABLE public.itens_venda 
ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2) DEFAULT 0 CHECK (preco_custo >= 0);

-- 3. ADICIONA DADOS DO CLIENTE EM VENDAS (opcional para fiado/identificação)
ALTER TABLE public.vendas 
ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT;

-- 4. TABELA DE MOVIMENTAÇÕES DE CAIXA (Entradas manuais e Saídas/Retiradas/Despesas)
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_data ON public.movimentacoes_caixa(created_at DESC);

-- 5. TABELA DE CONTROLE DE FIADO (Lançamentos de compras a prazo e pagamentos)
CREATE TABLE IF NOT EXISTS public.fiados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_whatsapp TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('debito', 'pagamento')),
  valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
  descricao TEXT,
  venda_id TEXT REFERENCES public.vendas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiados_cliente ON public.fiados(cliente_nome);
CREATE INDEX IF NOT EXISTS idx_fiados_created_at ON public.fiados(created_at DESC);

-- 6. ATUALIZAÇÃO DA FUNÇÃO ATÔMICA: registrar_venda (V2)
-- Grava preco_custo nos itens vendidos e, se a forma for 'Fiado', cria lançamento automático
CREATE OR REPLACE FUNCTION public.registrar_venda(
  itens JSONB,
  forma_pagamento TEXT,
  p_cliente_nome TEXT DEFAULT NULL,
  p_cliente_whatsapp TEXT DEFAULT NULL
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
  v_custo_unitario NUMERIC(10, 2);
  v_retorno JSONB;
BEGIN
  v_venda_id := 'VND-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');

  IF jsonb_array_length(itens) = 0 THEN
    RAISE EXCEPTION 'A lista de itens da venda não pode estar vazia.';
  END IF;

  -- 1ª ETAPA: Validação estrita e atômica com LOCK DE LINHA (FOR UPDATE)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(itens) AS x(produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = v_item.produto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    IF v_produto.quantidade_estoque < v_item.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%". Disponível: %, Solicitado: %.',
        v_produto.nome, v_produto.quantidade_estoque, v_item.quantidade;
    END IF;

    v_item_subtotal := v_produto.preco * v_item.quantidade;
    v_total := v_total + v_item_subtotal;
  END LOOP;

  -- 2ª ETAPA: Insere a Venda Master
  INSERT INTO public.vendas (id, forma_pagamento, total, cliente_nome, cliente_whatsapp, created_at)
  VALUES (v_venda_id, forma_pagamento, v_total, p_cliente_nome, p_cliente_whatsapp, NOW());

  -- 3ª ETAPA: Grava itens com preços e custos congelados e desconta o estoque
  FOR v_item IN SELECT * FROM jsonb_to_recordset(itens) AS x(produto_id UUID, quantidade INT)
  LOOP
    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = v_item.produto_id;

    v_custo_unitario := COALESCE(v_produto.preco_custo, 0);

    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario, preco_custo)
    VALUES (v_venda_id, v_produto.id, v_produto.nome, v_item.quantidade, v_produto.preco, v_custo_unitario);

    UPDATE public.produtos
    SET quantidade_estoque = quantidade_estoque - v_item.quantidade
    WHERE id = v_produto.id;
  END LOOP;

  -- 4ª ETAPA: Se for venda Fiada, cria o lançamento automático na conta do cliente
  IF forma_pagamento ILIKE '%fiado%' AND p_cliente_nome IS NOT NULL AND trim(p_cliente_nome) <> '' THEN
    INSERT INTO public.fiados (cliente_nome, cliente_whatsapp, tipo, valor, descricao, venda_id, created_at)
    VALUES (
      trim(p_cliente_nome),
      trim(p_cliente_whatsapp),
      'debito',
      v_total,
      'Compra a prazo #' || v_venda_id,
      v_venda_id,
      NOW()
    );
  END IF;

  v_retorno := jsonb_build_object(
    'sucesso', true,
    'venda_id', v_venda_id,
    'total', v_total,
    'forma_pagamento', forma_pagamento,
    'cliente_nome', p_cliente_nome,
    'created_at', NOW()
  );

  RETURN v_retorno;
END;
$$;

-- Permissões
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
