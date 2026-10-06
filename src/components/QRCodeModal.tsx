import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Globe,
  Radio,
  ExternalLink,
  Printer,
  Sparkles,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { cloudSync } from '../services/cloudSyncService';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLightMode?: boolean;
  totalOccupied: number;
  totalSlots: number;
  isHardwareConnected: boolean;
  connectionMode: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  isLightMode = false,
  totalOccupied,
  totalSlots,
  isHardwareConnected,
  connectionMode,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(cloudSync.getBroadcasting());
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Build clean public link with view=live parameter
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'live');
      // Remove local action params
      url.searchParams.delete('action');
      setPublicUrl(url.toString());

      // Generate crisp QR code
      QRCode.toDataURL(url.toString(), {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((dataUrl) => {
          setQrDataUrl(dataUrl);
        })
        .catch((err) => {
          console.error('Failed to generate QR code', err);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleBroadcast = () => {
    const next = !isBroadcasting;
    setIsBroadcasting(next);
    cloudSync.setBroadcasting(next);
  };

  const freeSlots = Math.max(0, totalSlots - totalOccupied);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isLightMode
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <QrCode className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Public Live QR Code</h3>
              <p className="text-xs text-slate-400 font-mono">
                કોઈપણ વ્યક્તિ સ્કેન કરીને લાઈવ પાર્કિંગ જોઈ શકશે
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Cloud Sync Status Banner */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              isBroadcasting
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Radio
                className={`w-4 h-4 shrink-0 ${isBroadcasting ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`}
              />
              <div className="text-xs">
                <span className="font-bold">
                  {isBroadcasting ? 'ક્લાઉડ લાઇવ સિન્ક ચાલુ છે' : 'ક્લાઉડ સિન્ક બંધ છે'}
                </span>
                <p className="text-[11px] opacity-80">
                  {isHardwareConnected
                    ? 'તમારો ફોન આર્ડ્યુનો ડેટા ઇન્ટરનેટ પર શેર કરી રહ્યો છે'
                    : 'સિમ્યુલેટર / સર્વર ડેટા ઇન્ટરનેટ પર લાઈવ છે'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleBroadcast}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                isBroadcasting
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isBroadcasting ? 'Active' : 'Turn On'}
            </button>
          </div>

          {/* QR Code Presentation Box */}
          <div
            className={`p-5 rounded-2xl border text-center flex flex-col items-center justify-center space-y-3 ${
              isLightMode
                ? 'bg-slate-50 border-slate-200 shadow-inner'
                : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            {/* Real QR Code Display */}
            <div className="p-3 bg-white rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Public Live Parking QR Code"
                  className="w-52 h-52 object-contain rounded-lg"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-400">
                  <QrCode className="w-12 h-12 animate-spin" />
                </div>
              )}
            </div>

            {/* Live Status Tag */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>
                  {freeSlots > 0
                    ? `🟢 ${freeSlots} સ્લોટ ખાલી (Available)`
                    : '🔴 પાર્કિંગ ફૂલ (All Full)'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                🔒 100% Read-Only
              </span>
            </div>

            <p className="text-xs text-slate-400 max-w-sm">
              આ QR કોડ પબ્લિક લાઈવ લિંક (<span className="text-cyan-400 font-mono">?view=live</span>) ખોલે છે. કોઈપણ મુલાકાતી સ્કેન કરશે તો માત્ર પાર્કિંગ સ્ટેટસ દેખાશે — બ્લૂટૂથ કનેક્ટ બટન, એડમિન સેટિંગ્સ કે કંટ્રોલ દેખાશે નહીં.
            </p>
          </div>

          {/* Public Link Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Public Live Web Link:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-hidden select-all ${
                  isLightMode
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-600/20"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => window.open(publicUrl, '_blank')}
              className={`flex-1 py-2.5 px-3 rounded-xl border font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isLightMode
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
              }`}
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
              <span>ટેસ્ટ કરો (Open Live)</span>
            </button>
            <button
              onClick={handlePrint}
              className={`flex-1 py-2.5 px-3 rounded-xl border font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isLightMode
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
              }`}
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>પ્રિન્ટ QR કોડ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
