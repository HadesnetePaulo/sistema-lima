import React, { useState } from 'react';
import { Venda } from '../types';
import { Printer, Copy, Check, X, Sparkles, Share2 } from 'lucide-react';

interface ReciboModalProps {
  venda: Venda;
  onClose: () => void;
}

export const ReciboModal: React.FC<ReciboModalProps> = ({ venda, onClose }) => {
  const [copied, setCopied] = useState(false);

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

  // Generate WhatsApp formatted text
  const generateWhatsAppText = () => {
    const itemsList = venda.itens
      .map(
        item =>
          `• ${item.quantidade}x ${item.nome_produto} (${formatCurrency(item.preco_unitario)}) = ${formatCurrency(
            item.quantidade * item.preco_unitario
          )}`
      )
      .join('\n');

    return `✨ *LIMA SEMIJOIAS — COMPROVANTE DE COMPRA* ✨\n` +
      `----------------------------------------\n` +
      `📄 *Comprovante:* ${venda.id}\n` +
      `📅 *Data:* ${formatDate(venda.created_at)}\n` +
      `💳 *Pagamento:* ${venda.forma_pagamento}\n` +
      `----------------------------------------\n` +
      `🛍️ *ITENS COMPRADOS:*\n${itemsList}\n` +
      `----------------------------------------\n` +
      `💰 *TOTAL: ${formatCurrency(venda.total)}*\n` +
      `----------------------------------------\n` +
      `Agradecemos muito pelo carinho e pela preferência! Volte sempre. 💖\n\n` +
      `_Recibo informativo de controle interno. Não possui valor fiscal._`;
  };

  const handleCopyWhatsApp = async () => {
    const text = generateWhatsAppText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Modal Top Actions Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-stone-900 text-stone-100 no-print">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-200">
              Recibo Gerado com Sucesso
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-6 bg-white text-stone-900 font-sans print-only-container">
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-stone-300">
            <h2 className="font-serif text-2xl font-bold tracking-widest text-stone-900">
              LIMA SEMIJOIAS
            </h2>
            <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-medium mt-0.5">
              Semijoias Finas & Acessórios
            </p>
            <p className="text-xs font-semibold text-stone-700 mt-2 bg-stone-100 inline-block px-2.5 py-0.5 rounded-full">
              COMPROVANTE DE VENDA
            </p>
          </div>

          {/* Meta Info */}
          <div className="py-3 text-xs text-stone-600 border-b border-dashed border-stone-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Nº do Comprovante:</span>
              <span className="font-mono font-semibold text-stone-800">{venda.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Data e Horário:</span>
              <span>{formatDate(venda.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Forma de Pagamento:</span>
              <span className="font-medium text-stone-800">{venda.forma_pagamento}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-4 border-b border-dashed border-stone-300">
            <div className="flex justify-between text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
              <span>Item / Qtd</span>
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
          <div className="py-4 border-b border-dashed border-stone-300">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-stone-800">TOTAL DA COMPRA:</span>
              <span className="text-xl font-bold font-serif text-stone-900 tabular-nums">
                {formatCurrency(venda.total)}
              </span>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-4 text-center">
            <p className="text-xs font-serif italic text-stone-700">
              Obrigada por escolher nossas semijoias! ✨
            </p>
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-[10px] text-stone-400 leading-tight">
                Documento informativo de controle interno emitido pela loja.
                <br />
                <strong>Não possui valor fiscal.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons (Excluded from print) */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 no-print flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleCopyWhatsApp}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300 rounded-xl transition cursor-pointer active:scale-98"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Copiado p/ WhatsApp!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-emerald-700" />
                <span>Copiar p/ WhatsApp</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition cursor-pointer active:scale-98 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-200/60 rounded-xl transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
