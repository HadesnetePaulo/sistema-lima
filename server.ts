process.env.DISABLE_HMR = 'true';

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse port from CLI flags, env, or default 3000
const args = process.argv.slice(2);
let cliPort = 0;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    cliPort = parseInt(args[i + 1], 10);
  }
}
const PORT = cliPort || Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure data directory exists for persistent multi-device storage
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial catalog fallback
const DEFAULT_PRODUCTS = [
  {
    id: 'prod-001',
    nome: 'Anel Solitário Cravejado Ouro 18k',
    categoria: 'Anéis',
    codigo_barras: '7891001001',
    preco: 149.90,
    preco_custo: 52.00,
    quantidade_estoque: 8,
    estoque_minimo: 3,
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
    estoque_minimo: 3,
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
    estoque_minimo: 4,
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
    estoque_minimo: 3,
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
    estoque_minimo: 3,
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
    estoque_minimo: 3,
    imagem_url: '/images/jewelry_pearl_necklace_1790817509090.jpg',
    created_at: new Date('2026-09-06T16:00:00Z').toISOString(),
  }
];

interface ServerStore {
  produtos: any[];
  vendas: any[];
  caixa: any[];
  fiados: any[];
  masterPassword?: string;
  lastUpdated: string;
}

function loadDatabase(): ServerStore {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.produtos)) {
        return {
          produtos: parsed.produtos,
          vendas: Array.isArray(parsed.vendas) ? parsed.vendas : [],
          caixa: Array.isArray(parsed.caixa) ? parsed.caixa : [],
          fiados: Array.isArray(parsed.fiados) ? parsed.fiados : [],
          masterPassword: parsed.masterPassword || undefined,
          lastUpdated: parsed.lastUpdated || new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.error('Erro ao ler DB persistente, recriando:', err);
  }

  // Initialize with empty array if file missing
  const initialStore: ServerStore = {
    produtos: [],
    vendas: [],
    caixa: [],
    fiados: [],
    masterPassword: '123456',
    lastUpdated: new Date().toISOString()
  };
  saveDatabase(initialStore);
  return initialStore;
}

function saveDatabase(store: ServerStore): void {
  try {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar DB persistente:', err);
  }
}

// In-memory reference loaded from disk
let currentStore = loadDatabase();

// ----------------------------------------------------------------------
// PERSISTENT MULTI-DEVICE API ROUTES
// ----------------------------------------------------------------------

// 1. GET /api/sync - Master synchronization for all devices
app.get('/api/sync', (req, res) => {
  // Always ensure fresh disk reload
  currentStore = loadDatabase();
  res.json({
    success: true,
    lastUpdated: currentStore.lastUpdated,
    produtos: currentStore.produtos,
    vendas: currentStore.vendas,
    caixa: currentStore.caixa,
    fiados: currentStore.fiados,
    masterPassword: currentStore.masterPassword || '123456'
  });
});

// 2. POST /api/sync - Bidirectional synchronization / merge from any device
app.post('/api/sync', (req, res) => {
  try {
    const { produtos, vendas, caixa, fiados, masterPassword } = req.body;
    let changed = false;

    if (Array.isArray(produtos) && produtos.length > 0) {
      currentStore.produtos = produtos;
      changed = true;
    }
    if (Array.isArray(vendas)) {
      currentStore.vendas = vendas;
      changed = true;
    }
    if (Array.isArray(caixa)) {
      currentStore.caixa = caixa;
      changed = true;
    }
    if (Array.isArray(fiados)) {
      currentStore.fiados = fiados;
      changed = true;
    }
    if (masterPassword && typeof masterPassword === 'string' && masterPassword.trim()) {
      currentStore.masterPassword = masterPassword.trim();
      changed = true;
    }

    if (changed) {
      saveDatabase(currentStore);
    }

    res.json({
      success: true,
      lastUpdated: currentStore.lastUpdated,
      produtos: currentStore.produtos,
      vendas: currentStore.vendas,
      caixa: currentStore.caixa,
      fiados: currentStore.fiados,
      masterPassword: currentStore.masterPassword || '123456'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// POST /api/reset - Complete system reset to zero
app.post('/api/reset', (req, res) => {
  currentStore = {
    produtos: [],
    vendas: [],
    caixa: [],
    fiados: [],
    masterPassword: currentStore.masterPassword || '123456',
    lastUpdated: new Date().toISOString()
  };
  saveDatabase(currentStore);
  res.json({ success: true, ...currentStore });
});

// Auth & Master Password endpoint
app.get('/api/auth/password', (req, res) => {
  currentStore = loadDatabase();
  res.json({
    success: true,
    password: currentStore.masterPassword || '123456'
  });
});

app.post('/api/auth/password', (req, res) => {
  try {
    const { password } = req.body;
    if (password && typeof password === 'string' && password.trim()) {
      currentStore.masterPassword = password.trim();
      saveDatabase(currentStore);
    }
    res.json({ success: true, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 3. POST /api/produtos - Save or update product
app.post('/api/produtos', (req, res) => {
  try {
    const prod = req.body;
    if (!prod || !prod.nome) {
      return res.status(400).json({ success: false, error: 'Nome do produto é obrigatório' });
    }

    const index = currentStore.produtos.findIndex(p => p.id === prod.id);
    if (index >= 0) {
      currentStore.produtos[index] = {
        ...currentStore.produtos[index],
        ...prod,
        quantidade_estoque: Number(prod.quantidade_estoque),
        preco: Number(prod.preco),
        preco_custo: Number(prod.preco_custo || 0),
        estoque_minimo: Number(prod.estoque_minimo || 3)
      };
    } else {
      currentStore.produtos.unshift({
        id: prod.id || 'prod-' + Date.now().toString(36),
        nome: prod.nome,
        categoria: prod.categoria || 'Brincos',
        codigo_barras: prod.codigo_barras || '',
        preco: Number(prod.preco || 0),
        preco_custo: Number(prod.preco_custo || 0),
        quantidade_estoque: Number(prod.quantidade_estoque || 0),
        estoque_minimo: Number(prod.estoque_minimo || 3),
        imagem_url: prod.imagem_url || undefined,
        created_at: prod.created_at || new Date().toISOString()
      });
    }

    saveDatabase(currentStore);
    res.json({ success: true, produto: prod, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 4. DELETE /api/produtos/:id - Delete product
app.delete('/api/produtos/:id', (req, res) => {
  try {
    const { id } = req.params;
    currentStore.produtos = currentStore.produtos.filter(p => p.id !== id);
    saveDatabase(currentStore);
    res.json({ success: true, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 5. PATCH /api/produtos/:id/estoque - Quick stock adjustment
app.patch('/api/produtos/:id/estoque', (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    const prod = currentStore.produtos.find(p => p.id === id);
    if (!prod) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    }

    prod.quantidade_estoque = Math.max(0, Number(prod.quantidade_estoque || 0) + Number(delta || 0));
    saveDatabase(currentStore);
    res.json({ success: true, produto: prod, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 6. POST /api/vendas - Register sale with atomic stock deduction across devices
app.post('/api/vendas', (req, res) => {
  try {
    const { itens, forma_pagamento, cliente_nome, cliente_whatsapp, total } = req.body;
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ success: false, error: 'Carrinho vazio' });
    }

    // Atomic stock deduction
    for (const item of itens) {
      const prod = currentStore.produtos.find(p => p.id === item.produto_id || p.id === item.produto?.id);
      if (prod) {
        prod.quantidade_estoque = Math.max(0, Number(prod.quantidade_estoque || 0) - Number(item.quantidade));
      }
    }

    const novaVenda = {
      id: 'VENDA-' + Date.now().toString().slice(-6),
      forma_pagamento: forma_pagamento || 'Pix',
      total: Number(total || 0),
      cliente_nome: cliente_nome || undefined,
      cliente_whatsapp: cliente_whatsapp || undefined,
      created_at: new Date().toISOString(),
      itens: itens.map((i: any) => ({
        produto_id: i.produto_id || i.produto?.id,
        nome_produto: i.nome_produto || i.produto?.nome,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario || i.produto?.preco || 0),
        preco_custo: Number(i.preco_custo || i.produto?.preco_custo || 0)
      }))
    };

    currentStore.vendas.unshift(novaVenda);

    // Auto-create fiado debit if payment method is fiado
    if (forma_pagamento && forma_pagamento.toLowerCase().includes('fiado')) {
      currentStore.fiados.unshift({
        id: 'fiado-' + Date.now().toString(36),
        cliente_nome: (cliente_nome || 'Cliente não identificado').trim(),
        cliente_whatsapp: cliente_whatsapp || undefined,
        tipo: 'debito',
        valor: Number(novaVenda.total),
        descricao: `Compra a prazo #${novaVenda.id}`,
        venda_id: novaVenda.id,
        created_at: new Date().toISOString()
      });
    }

    saveDatabase(currentStore);
    res.json({
      success: true,
      venda: novaVenda,
      produtos: currentStore.produtos,
      fiados: currentStore.fiados,
      lastUpdated: currentStore.lastUpdated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 7. POST & DELETE /api/caixa
app.post('/api/caixa', (req, res) => {
  try {
    const mov = req.body;
    const novo = {
      id: mov.id || 'mov-' + Date.now().toString(36),
      tipo: mov.tipo,
      valor: Number(mov.valor),
      descricao: mov.descricao || '',
      created_at: mov.created_at || new Date().toISOString()
    };
    currentStore.caixa.unshift(novo);
    saveDatabase(currentStore);
    res.json({ success: true, movimentacao: novo, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

app.delete('/api/caixa/:id', (req, res) => {
  try {
    const { id } = req.params;
    currentStore.caixa = currentStore.caixa.filter(c => c.id !== id);
    saveDatabase(currentStore);
    res.json({ success: true, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 8. POST & DELETE /api/fiados
app.post('/api/fiados', (req, res) => {
  try {
    const lanc = req.body;
    const novo = {
      id: lanc.id || 'fiado-' + Date.now().toString(36),
      cliente_nome: (lanc.cliente_nome || '').trim(),
      cliente_whatsapp: lanc.cliente_whatsapp || undefined,
      tipo: lanc.tipo,
      valor: Number(lanc.valor),
      descricao: lanc.descricao || '',
      venda_id: lanc.venda_id || undefined,
      created_at: lanc.created_at || new Date().toISOString()
    };
    currentStore.fiados.unshift(novo);
    saveDatabase(currentStore);
    res.json({ success: true, fiado: novo, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

app.delete('/api/fiados/:id', (req, res) => {
  try {
    const { id } = req.params;
    currentStore.fiados = currentStore.fiados.filter(f => f.id !== id);
    saveDatabase(currentStore);
    res.json({ success: true, lastUpdated: currentStore.lastUpdated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 9. Reset catalog endpoint
app.post('/api/reset-catalog', (req, res) => {
  currentStore.produtos = DEFAULT_PRODUCTS;
  saveDatabase(currentStore);
  res.json({ success: true, produtos: currentStore.produtos, lastUpdated: currentStore.lastUpdated });
});

// ----------------------------------------------------------------------
// START SERVER WITH VITE (DEV OR PROD)
// ----------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // In development, attach Vite middlewares with HMR disabled (as required in iframe environment)
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback for HTML in dev
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        // Ensure inline suppression script is placed before any @vite/client injection
        if (template.includes('/@vite/client') && template.includes('// Suppress Vite HMR WebSocket connection errors')) {
          template = template.replace(/<script type="module" src="\/@vite\/client"><\/script>\s*/i, '');
          template = template.replace('</script>\n    <meta charset="UTF-8" />', '</script>\n    <script type="module" src="/@vite/client"></script>\n    <meta charset="UTF-8" />');
        }
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // In production, serve dist folder
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Lima Semijoias Server] Rodando na porta ${PORT} com sincronização persistente multi-dispositivo.`);
  });
}

startServer().catch(err => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
