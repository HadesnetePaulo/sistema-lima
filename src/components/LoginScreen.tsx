import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck, Check } from 'lucide-react';
import { storage } from '../lib/storage';

interface LoginScreenProps {
  onSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setError('Por favor, digite a senha.');
      return;
    }

    const success = storage.login(password, rememberDevice);
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
    <div className="min-h-screen flex items-center justify-center bg-[#1C1917] p-4 text-stone-100 relative overflow-hidden select-none">
      {/* Subtle luxury glow in background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10">
        {/* Brand Lockup */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-2xl shadow-amber-950/60 mb-3.5">
            <div className="w-full h-full bg-white rounded-[14px] overflow-hidden flex items-center justify-center p-1.5 shadow-inner">
              <img
                src="/logo-lima.jpg"
                alt="Lima Semijoias"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-wider text-amber-100">
            LIMA SEMIJOIAS
          </h1>
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-amber-400/80 mt-1 font-medium">
            Semijoias Finas & Acessórios
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-stone-400 bg-stone-900/90 border border-stone-800 px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Acesso Restrito do Balcão</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#292524]/95 border border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-stone-300">
                  Senha de Acesso
                </label>
                <span className="text-[11px] text-stone-500 hidden sm:inline">
                  Pressione [Enter] para entrar
                </span>
              </div>
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
                  className="w-full rounded-2xl bg-stone-900/90 border border-stone-700 px-4 py-3 text-center text-xl tracking-widest text-amber-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-1.5 cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2.5 justify-center bg-rose-950/40 border border-rose-800/50 py-1.5 px-3 rounded-xl animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Remember Device Option (Direct Initialization) */}
            <label className="flex items-center gap-2.5 cursor-pointer pt-1 group">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={e => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 bg-stone-900 border-stone-700 cursor-pointer accent-amber-500"
              />
              <span className="text-xs text-stone-400 group-hover:text-stone-300 transition">
                Inicialização direta neste computador / dispositivo
              </span>
            </label>

            {/* Quick Numeric Keypad (Comfortable for touch & mouse) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyClick(num.toString())}
                  className="h-11 sm:h-12 rounded-xl bg-stone-850/80 hover:bg-stone-800 text-stone-100 text-lg font-semibold transition active:scale-95 border border-stone-800 cursor-pointer shadow-xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeyClick('clear')}
                className="h-11 sm:h-12 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 text-xs font-semibold transition active:scale-95 border border-stone-800/80 cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('0')}
                className="h-11 sm:h-12 rounded-xl bg-stone-850/80 hover:bg-stone-800 text-stone-100 text-lg font-semibold transition active:scale-95 border border-stone-800 cursor-pointer shadow-xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeyClick('backspace')}
                className="h-11 sm:h-12 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 text-sm font-semibold transition active:scale-95 border border-stone-800/80 cursor-pointer flex items-center justify-center"
                title="Apagar dígito"
              >
                ⌫
              </button>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold text-sm shadow-xl shadow-amber-950/40 transition cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Entrar no Sistema</span>
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-stone-800/80 text-center">
            <p className="text-[11px] text-stone-500">
              Senha padrão de fábrica: <span className="font-mono text-amber-400 font-semibold bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800">123456</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
