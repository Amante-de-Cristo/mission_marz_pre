import React from 'react';
import { FastForward, AlertTriangle, ShieldCheck, Thermometer } from 'lucide-react';
import { DailySimulationLog } from '../types';

interface SimulationOverlayProps {
  currentDay: number;
  totalDays: number;
  progress: number; // 0 to 1
  currentLog: DailySimulationLog | null;
  onSkip: () => void;
}

export const SimulationOverlay: React.FC<SimulationOverlayProps> = ({
  currentDay,
  totalDays,
  progress,
  currentLog,
  onSkip,
}) => {
  const clampedScale = Math.max(0, Math.min(1, progress));

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-6 pt-18"
      data-testid="simulation-overlay"
    >
      {/* Top Action Row (Status & Day/Night badges removed — shown visually in 3D scene) */}
      <div className="flex items-center justify-end pointer-events-auto">
        <button
          onClick={onSkip}
          data-testid="skip-simulation-btn"
          className="px-3.5 py-2 rounded-lg bg-[#151324] hover:bg-[#1E1A33] text-[#E9D5FF] border border-[#35285C] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span>Skip to Results</span>
        </button>
      </div>

      {/* Event Notice Card */}
      {currentLog && currentLog.type !== 'normal' && (
        <div
          className={`self-center pointer-events-auto max-w-md p-3.5 rounded-xl bg-[#10101A] border text-center ${
            currentLog.type === 'hazard' ? 'border-rose-500/70' : 'border-[#8B5CF6]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold mb-1">
            {currentLog.type === 'hazard' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span className={currentLog.type === 'hazard' ? 'text-rose-300' : 'text-[#E9D5FF]'}>
              {currentLog.title}
            </span>
          </div>
          <p className="text-xs text-[#C4B5FD] leading-relaxed">{currentLog.description}</p>
        </div>
      )}

      {/* Bottom Progress & Telemetry HUD */}
      <div className="pointer-events-auto max-w-3xl w-full mx-auto p-4 rounded-2xl bg-[#10101A] border border-[#35285C]">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#E9D5FF]">
              Day {currentDay} of {totalDays}
            </span>
            <span className="text-[11px] text-[#9F8FC7]">
              ({Math.round(clampedScale * 100)}%)
            </span>
          </div>

          <div className="flex items-center gap-4 text-[#C4B5FD]">
            <div className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-amber-300" />
              <span>{currentLog?.temperatureC ?? -58}°C</span>
            </div>
            <div>
              <span>Oxygen: </span>
              <span className="text-[#A78BFA] font-bold">{currentLog?.o2Level ?? 100}%</span>
            </div>
            <div>
              <span>Power: </span>
              <span className="text-amber-300 font-bold">{currentLog?.powerLevel ?? 100}%</span>
            </div>
          </div>
        </div>

        {/* GPU-composited scaleX progress bar without transition lag */}
        <div className="w-full h-3 rounded-full bg-[#09090F] border border-[#2A2442] overflow-hidden">
          <div
            className="h-full w-full bg-[#8B5CF6] origin-left will-change-transform"
            style={{ transform: `scaleX(${clampedScale})` }}
          />
        </div>

        <div className="mt-2 text-xs text-[#C4B5FD] truncate">
          {currentLog
            ? currentLog.description
            : 'Running daily power, water, oxygen, and food checks...'}
        </div>
      </div>
    </div>
  );
};
