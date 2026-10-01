import React, { useState } from 'react';
import { Lock, Sparkles, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { storage } from '../lib/storage';

interface LoginScreenProps {
  onSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setError('Por favor, digite a senha.');
      return;
    }

    const success = storage.login(password);
    if (success) {
      setError(null);
      onSuccess();
    } else {
      setError('Senha incorreta. Tente novamente.');
      setPassword('');
    }
  };

  const handleKeyClick = (val: string) => {
    setError(null);
    if (val === 'backspace') {
      setPassword(prev => prev.slice(0, -1));
    } else if (val === 'clear') {
      setPassword('');
    } else {
      if (password.length < 12) {
        setPassword(prev => prev + val);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1C1917] p-4 text-stone-100 relative overflow-hidden">
      {/* Subtle luxury glow in background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand Lockup */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 p-0.5 shadow-xl shadow-amber-950/40 mb-3">
            <div className="w-full h-full bg-[#1C1917] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-wider text-amber-100">
            LIMA
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400 mt-0.5 font-medium">
            Semijoias Finas
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-stone-400">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Acesso Interno do Sistema</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#292524]/90 border border-stone-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                  placeholder="Digite sua senha"
                  className="w-full rounded-xl bg-stone-900 border border-stone-700 px-4 py-3 text-center text-lg tracking-widest text-amber-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Quick Mobile Number Pad */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyClick(num.toString())}
                  className="h-11 rounded-xl bg-stone-800/80 hover:bg-stone-750 text-stone-200 text-base font-semibold transition active:scale-95 border border-stone-750"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeyClick('clear')}
                className="h-11 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 text-xs font-medium transition active:scale-95 border border-stone-800"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                className="h-11 rounded-xl bg-stone-800/80 hover:bg-stone-750 text-stone-200 text-base font-semibold transition active:scale-95 border border-stone-750"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('backspace')}
                className="h-11 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 text-xs font-medium transition active:scale-95 border border-stone-800"
              >
                ⌫
              </button>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-semibold text-sm shadow-lg shadow-amber-950/30 transition cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Entrar no Sistema</span>
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-stone-800/80 text-center">
            <p className="text-[11px] text-stone-500">
              Senha padrão do sistema: <span className="font-mono text-amber-400/90 font-medium">123456</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
