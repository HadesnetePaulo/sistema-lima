import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Flashlight, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { playBeepSuccess, playBeepError } from '../lib/audio';

interface CameraBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
  continuous?: boolean;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  onClose,
  title = 'Escanear Código de Barras',
  continuous = true,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-reader-container';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanCooldown, setScanCooldown] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ];

        const html5QrCode = new Html5Qrcode(containerId, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        // Ideal configuration for small jewelry tags (high resolution & frame rate)
        const config = {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!isMounted) return;
            handleBarcodeSuccess(decodedText);
          },
          () => {
            // Frame scan without detection - ignore
          }
        );

        if (isMounted) {
          setHasPermission(true);
          // Check if torch/flashlight is supported
          try {
            const capabilities = html5QrCode.getRunningTrackCapabilities();
            if (capabilities && (capabilities as any).torch) {
              setHasTorch(true);
            }
          } catch {
            // Torch capability check not supported
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Erro ao iniciar câmera:', err);
        setHasPermission(false);
        setErrorMsg(
          err?.message?.includes('Permission')
            ? 'Acesso à câmera bloqueado. Por favor, libere a permissão de câmera no seu navegador.'
            : 'Não foi possível acessar a câmera traseira do dispositivo.'
        );
        playBeepError();
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch((e) => console.warn('Erro ao parar scanner:', e));
      }
    };
  }, []);

  const handleBarcodeSuccess = (code: string) => {
    if (scanCooldown) return;

    // Trigger visual and audio confirmation
    playBeepSuccess();
    setLastScanned(code);
    setScanCooldown(true);

    onScan(code.trim());

    if (!continuous) {
      setTimeout(() => {
        onClose();
      }, 400);
    } else {
      // Cooldown of 1.6s before scanning the exact same item again in continuous mode
      setTimeout(() => {
        setScanCooldown(false);
      }, 1600);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-800 text-stone-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-amber-100 leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-stone-400">
                Aponte para o código da etiqueta da semijoia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition active:scale-95"
            title="Fechar Câmera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport Container */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
          <div id={containerId} className="w-full h-full" />

          {/* Aiming Reticle Overlay */}
          {hasPermission && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="relative w-64 h-36 border-2 border-amber-400/80 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center">
                {/* Red Laser Scanning Line animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />

                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-300 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-300 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-300 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-300 rounded-br-xl" />
              </div>

              <p className="mt-3 text-[11px] text-amber-200/90 font-medium bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Mantenha a etiqueta reta e iluminada
              </p>
            </div>
          )}

          {/* Flashlight toggle */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition shadow-lg ${
                torchOn ? 'bg-amber-400 text-stone-950 font-bold' : 'bg-stone-900/80 text-stone-200'
              }`}
              title="Ligar Lanterna"
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}

          {/* Last scanned feedback banner */}
          {lastScanned && (
            <div className="absolute bottom-4 inset-x-4 bg-emerald-950/90 border border-emerald-500/60 rounded-xl p-2.5 text-xs text-emerald-200 flex items-center justify-between shadow-xl backdrop-blur-md animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Lido:{' '}
                  <strong className="font-mono text-emerald-100">{lastScanned}</strong>
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">Bipe OK!</span>
            </div>
          )}

          {/* Permission / Loading / Error states */}
          {hasPermission === null && (
            <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-stone-200">Iniciando câmera...</p>
              <p className="text-xs text-stone-400 mt-1">Aguardando autorização do navegador</p>
            </div>
          )}

          {hasPermission === false && (
            <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
              <p className="text-sm font-semibold text-rose-200">Câmera Indisponível</p>
              <p className="text-xs text-stone-400 mt-2 max-w-xs">{errorMsg}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-semibold hover:bg-stone-700 transition"
              >
                Digitar código manualmente
              </button>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-4 bg-stone-950 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
          <span className="text-[11px]">
            {continuous ? '• Modo contínuo (escaneia vários)' : '• Fecha ao escanear'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
