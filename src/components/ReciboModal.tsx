import React, { useState } from 'react';
import { Venda } from '../types';
import { Printer, Check, X, Sparkles, Send, Copy, Phone, MessageSquare, Truck } from 'lucide-react';

interface ReciboModalProps {
  venda: Venda;
  onClose: () => void;
}

export const ReciboModal: React.FC<ReciboModalProps> = ({ venda, onClose }) => {
  const [copiado, setCopiado] = useState(false);
  const [telefoneDestino, setTelefoneDestino] = useState(venda.cliente_whatsapp || '');
  const [mostrarCampoTelefone, setMostrarCampoTelefone] = useState(false);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Format date
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate WhatsApp formatted text for delivery receipt
  const generateWhatsAppText = () => {
    const itemsList = venda.itens
      .map(
        (item, idx) =>
          `${idx + 1}. *${item.nome_produto}*\n   ${item.quantidade} un × ${formatCurrency(item.preco_unitario)} = *${formatCurrency(
            item.quantidade * item.preco_unitario
          )}*`
      )
      .join('\n');

    const saudacaoCliente = venda.cliente_nome ? `Olá, *${venda.cliente_nome}*! Segue seu comprovante:` : `Olá! Segue seu comprovante da Lima Semijoias:`;

    return `✨ *LIMA SEMIJOIAS — COMPROVANTE DE ENTREGA & VENDA* ✨\n\n` +
      `${saudacaoCliente}\n\n` +
      `----------------------------------------\n` +
      `📄 *Comprovante:* ${venda.id}\n` +
      `📅 *Data:* ${formatDate(venda.created_at)}\n` +
      (venda.cliente_nome ? `👤 *Cliente:* ${venda.cliente_nome}\n` : '') +
      `📦 *Status:* Pedido Concluído / Pronto para Entrega\n` +
      `💳 *Forma de Pagamento:* ${venda.forma_pagamento}\n` +
      `----------------------------------------\n\n` +
      `🛍️ *ITENS SELECIONADOS:*\n${itemsList}\n\n` +
      `----------------------------------------\n` +
      `💰 *VALOR TOTAL: ${formatCurrency(venda.total)}*\n` +
      `----------------------------------------\n\n` +
      `💎 Todas as nossas peças são desenvolvidas com banho nobre e garantia de qualidade.\n\n` +
      `Agradecemos de coração pelo carinho e pela preferência! Volte sempre. 💖\n\n` +
      `_Lima Semijoias · Uso e controle de entrega interno._`;
  };

  /**
   * Abre o WhatsApp direto para o usuário escolher o contato
   * Se um telefone foi informado, direciona direto para ele; caso contrário,
   * abre o seletor nativo de contatos do WhatsApp.
   */
  const handleEnviarWhatsAppDireto = (forcarTelefone?: string) => {
    const texto = generateWhatsAppText();
    const tel = (forcarTelefone !== undefined ? forcarTelefone : telefoneDestino).replace(/\D/g, '');

    let url = '';
    if (tel.length >= 10) {
      const ddi = tel.startsWith('55') ? tel : `55${tel}`;
      url = `https://api.whatsapp.com/send?phone=${ddi}&text=${encodeURIComponent(texto)}`;
    } else {
      // Abre direto no WhatsApp sem número fixo -> O WhatsApp abre a lista para ela escolher para quem mandar!
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    }

    window.open(url, '_blank');
  };

  const handleCopiarTexto = async () => {
    const text = generateWhatsAppText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Top Actions Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-900 text-stone-100 no-print shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-200">
              Comprovante de Entrega & Venda
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 p-1.5 rounded-xl transition cursor-pointer"
            title="Fechar comprovante"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Callout for Direct WhatsApp (Top Priority) */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-3.5 sm:p-4 no-print space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <button
              onClick={() => handleEnviarWhatsAppDireto()}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>Mandar direto no WhatsApp</span>
              <span className="text-[11px] font-normal opacity-90">(Escolher Contato)</span>
            </button>

            <button
              type="button"
              onClick={() => setMostrarCampoTelefone(!mostrarCampoTelefone)}
              className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-2xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title="Digitar um número específico se preferir"
            >
              <Phone className="w-3.5 h-3.5 text-stone-500" />
              <span>{mostrarCampoTelefone ? 'Ocultar nº' : 'Digitar número'}</span>
            </button>
          </div>

          {/* Optional Direct Phone Input */}
          {mostrarCampoTelefone && (
            <div className="flex items-center gap-2 pt-1 animate-in fade-in">
              <input
                type="tel"
                value={telefoneDestino}
                onChange={e => setTelefoneDestino(e.target.value)}
                placeholder="DDD + WhatsApp do cliente (Ex: 11988887777)"
                className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleEnviarWhatsAppDireto(telefoneDestino)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Enviar p/ este nº
              </button>
            </div>
          )}

          <p className="text-[11px] text-stone-500 leading-tight">
            💡 Ao clicar em <strong>Mandar direto no WhatsApp</strong>, o WhatsApp abre na hora para você escolher a cliente ou grupo da entrega.
          </p>
        </div>

        {/* Printable Receipt Paper Container (Scrollable) */}
        <div className="p-6 bg-white text-stone-900 font-sans print-only-container overflow-y-auto flex-1 space-y-4">
          {/* Header with Official Logo */}
          <div className="text-center pb-4 border-b border-dashed border-stone-300 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-950 border border-amber-300/40 p-0.5 shadow-md mb-2">
              <img
                src="/logo-lima.jpg"
                alt="Lima Semijoias"
                className="w-full h-full object-cover rounded-[14px]"
              />
            </div>
            <h2 className="font-serif text-2xl font-bold tracking-widest text-stone-900">
              LIMA SEMIJOIAS
            </h2>
            <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-medium mt-0.5">
              Semijoias Finas & Acessórios
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-stone-100 px-3 py-1 rounded-full text-xs font-semibold text-stone-800">
              <Truck className="w-3.5 h-3.5 text-amber-600" />
              <span>COMPROVANTE DE ENTREGA & VENDA</span>
            </div>
          </div>

          {/* Meta Info */}
          <div className="py-2 text-xs text-stone-600 border-b border-dashed border-stone-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-stone-500">Nº do Comprovante:</span>
              <span className="font-mono font-semibold text-stone-800">{venda.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Data e Horário:</span>
              <span>{formatDate(venda.created_at)}</span>
            </div>
            {venda.cliente_nome && (
              <div className="flex justify-between">
                <span className="text-stone-500">Cliente:</span>
                <span className="font-semibold text-stone-800">{venda.cliente_nome}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Forma de Pagamento:</span>
              <span className="font-medium text-stone-800">{venda.forma_pagamento}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Status do Pedido:</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                Pronto para Entrega
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-stone-300">
            <div className="flex justify-between text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
              <span>Peça / Quantidade</span>
              <span>Subtotal</span>
            </div>
            <div className="space-y-2.5">
              {venda.itens.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <div className="pr-2">
                    <p className="font-medium text-stone-800 leading-tight">
                      {item.nome_produto}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {item.quantidade} un × {formatCurrency(item.preco_unitario)}
                    </p>
                  </div>
                  <span className="font-medium text-stone-900 tabular-nums shrink-0">
                    {formatCurrency(item.quantidade * item.preco_unitario)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total & Summary */}
          <div className="py-3 border-b border-dashed border-stone-300">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-stone-800">VALOR TOTAL:</span>
              <span className="text-2xl font-bold font-serif text-stone-900 tabular-nums">
                {formatCurrency(venda.total)}
              </span>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-2 text-center space-y-2">
            <p className="text-xs font-serif italic text-stone-700">
              Obrigada por escolher a Lima Semijoias! ✨💖
            </p>
            <p className="text-[10px] text-stone-400 leading-tight">
              Documento de controle interno e comprovante de entrega emitido pela loja.
              <br />
              <strong>Sem valor fiscal.</strong>
            </p>
          </div>
        </div>

        {/* Bottom Actions Bar (Excluded from print) */}
        <div className="p-3.5 bg-stone-50 border-t border-stone-200 no-print flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={handleCopiarTexto}
              className="flex-1 py-2 px-3 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiado ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 py-2 px-3 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-stone-500" />
              <span>Imprimir / PDF</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="py-2 px-4 text-xs font-semibold text-stone-700 hover:text-stone-950 bg-stone-200 hover:bg-stone-300 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
