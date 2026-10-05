import React, { useMemo } from 'react';
import { SlotData } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Clock,
  Navigation,
  IndianRupee,
  Receipt,
  Bluetooth,
} from 'lucide-react';

interface SlotCardProps {
  slot: SlotData;
  isConnected?: boolean;
  isLightMode?: boolean;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  isConnected = false,
  isLightMode = false,
}) => {
  const isOccupied = slot.status === 'OCCUPIED';
  const isEmpty = slot.status === 'EMPTY' || slot.status === 'AVAILABLE';

  // Format time of last update
  const formattedTime = slot.lastUpdated
    ? new Date(slot.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Awaiting Bluetooth';

  const unit = slot.unit || 'cm';
  const distPercent = Math.min(100, Math.max(0, (slot.distance / 50) * 100));

  // Parked duration text
  const durationText = useMemo(() => {
    if (!isOccupied || !slot.parkedSince || !isConnected) return '00:00';
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - slot.parkedSince) / 1000));
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }, [isOccupied, slot.parkedSince, slot.currentCharge, isConnected]);

  return (
    <div
      className={`rounded-2xl p-3.5 sm:p-4 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-md ${
        isOccupied && isConnected
          ? isLightMode
            ? 'bg-rose-50/90 border-rose-300 text-slate-900 shadow-rose-100/50'
            : 'border-rose-500/40 bg-rose-950/20 text-white shadow-[0_4px_20px_rgba(244,63,94,0.15)]'
          : isEmpty && isConnected
          ? isLightMode
            ? 'bg-emerald-50/90 border-emerald-300 text-slate-900 shadow-emerald-100/50'
            : 'border-emerald-500/40 bg-emerald-950/20 text-white shadow-[0_4px_20px_rgba(16,185,129,0.15)]'
          : isLightMode
          ? 'bg-white border-slate-200 text-slate-800'
          : 'border-slate-800 bg-slate-900/40 text-slate-200'
      }`}
    >
      {/* Top Accent Line */}
      <div
        className={`absolute top-0 inset-x-0 h-1 transition-colors duration-300 ${
          isOccupied && isConnected
            ? 'bg-rose-500'
            : isEmpty && isConnected
            ? 'bg-emerald-500'
            : 'bg-slate-500/40'
        }`}
      />

      {/* Header: Bay ID & Status Badge */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm border shadow-xs ${
                isOccupied && isConnected
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
                  : isEmpty && isConnected
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/40'
              }`}
            >
              0{slot.id}
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black tracking-wide flex items-center gap-1.5">
                <span>{slot.name.toUpperCase().startsWith('LOT') ? slot.name : `LOT ${slot.id}`}</span>
                {slot.hasHardwareReading && isConnected && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40">
                    LIVE
                  </span>
                )}
              </h4>
              <p className={`text-[10px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Ultrasonic Bay Sensor
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold tracking-wider uppercase border flex items-center gap-1 shadow-xs transition-all ${
              isOccupied && isConnected
                ? 'bg-rose-600 text-white border-rose-400 shadow-rose-600/30'
                : isEmpty && isConnected
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/30'
                : 'bg-slate-600 text-slate-100 border-slate-400'
            }`}
          >
            {isOccupied && isConnected ? (
              <>
                <span className="text-xs">🔴</span>
                <span>OCCUPIED</span>
              </>
            ) : isEmpty && isConnected ? (
              <>
                <span className="text-xs">🟢</span>
                <span>EMPTY</span>
              </>
            ) : (
              <>
                <HelpCircle className="w-3 h-3" />
                <span>STANDBY</span>
              </>
            )}
          </div>
        </div>

        {/* PRICING & LIVE BILLING BOX */}
        <div className="mt-2.5 p-2.5 rounded-xl border bg-black/5 dark:bg-black/30 border-black/10 dark:border-white/10 space-y-1.5">
          {/* Rate Header & Total Collection */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
              <IndianRupee className="w-3 h-3" />
              <span>₹10 / MIN</span>
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Total Collection: <span className="text-amber-500 dark:text-amber-400 font-mono font-black tabular-nums">₹{slot.totalCollection || 0}</span>
            </span>
          </div>

          {/* Active Bill Display */}
          <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isConnected && isOccupied
                  ? 'Live Charge (Updates every 3s)'
                  : isConnected
                  ? 'Active Charge'
                  : 'Charge Status'}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className={`text-xl sm:text-2xl font-mono font-black tabular-nums ${
                    isConnected && isOccupied
                      ? 'text-emerald-600 dark:text-emerald-400 animate-pulse'
                      : 'text-slate-400'
                  }`}
                >
                  ₹{(isConnected ? slot.currentCharge || 0 : 0).toFixed(2)}
                </span>
                {isConnected && isOccupied && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    · {durationText}
                  </span>
                )}
              </div>
            </div>

            {/* Vehicle or Connection Indicator */}
            <div className="text-right">
              {isConnected ? (
                isOccupied ? (
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {slot.car.plate}
                    </span>
                    <span className="text-[8px] text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                      {slot.car.modelName}
                    </span>
                  </div>
                ) : (
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    ₹0.00 for next car
                  </span>
                )
              ) : (
                <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <Bluetooth className="w-2.5 h-2.5" />
                  <span>Connect BT</span>
                </div>
              )}
            </div>
          </div>

          {/* Last Automatic Cut Deduction Information */}
          {slot.lastDeduction && (
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
              <span className="flex items-center gap-1">
                <Receipt className="w-2.5 h-2.5 text-cyan-500" />
                <span>Last auto-deducted:</span>
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                ₹{slot.lastDeduction.amountPaid.toFixed(2)} ({Math.max(1, Math.round(slot.lastDeduction.durationSeconds / 60))}m)
              </span>
            </div>
          )}
        </div>

        {/* Distance Proximity Display */}
        <div className="mt-2.5 p-2 rounded-xl border bg-black/5 dark:bg-black/30 border-black/5 dark:border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span
              className={`font-semibold tracking-wide uppercase flex items-center gap-1 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              <Navigation className="w-2.5 h-2.5 text-cyan-500" />
              <span>Proximity</span>
            </span>
            <span
              className={`font-mono font-semibold ${
                isConnected
                  ? isOccupied
                    ? 'text-rose-500 font-bold'
                    : isEmpty
                    ? 'text-emerald-500 font-bold'
                    : 'text-slate-400'
                  : 'text-slate-400'
              }`}
            >
              {isConnected
                ? isOccupied
                  ? 'Vehicle Parked'
                  : isEmpty
                  ? 'Bay Cleared'
                  : 'Standby'
                : 'Connect Bluetooth'}
            </span>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-mono font-black tabular-nums tracking-tight">
              {slot.hasHardwareReading && isConnected ? slot.distance.toFixed(1) : '--.-'}
            </span>
            <span className="text-xs font-mono font-bold opacity-75">{unit}</span>
          </div>

          {/* Smooth Distance Gauge */}
          <div className="w-full bg-slate-300/80 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isConnected && isOccupied
                  ? 'bg-rose-500'
                  : isConnected && isEmpty
                  ? 'bg-emerald-500'
                  : 'bg-slate-500'
              }`}
              style={{ width: `${isConnected ? distPercent : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer: Live Timestamp */}
      <div
        className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
          isLightMode ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? isOccupied
                  ? 'bg-rose-500'
                  : isEmpty
                  ? 'bg-emerald-500'
                  : 'bg-slate-400'
                : 'bg-slate-400'
            }`}
          />
          <span>
            {isConnected
              ? isOccupied
                ? 'Occupied'
                : isEmpty
                ? 'Vacant'
                : 'Standby'
              : 'Bluetooth Standby'}
          </span>
        </span>

        <span className="flex items-center gap-1 opacity-75">
          <Clock className="w-2.5 h-2.5" />
          <span>{formattedTime}</span>
        </span>
      </div>
    </div>
  );
};
