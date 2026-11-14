import React, { useState } from 'react';
import {
  ArrowRight,
  GraduationCap,
  Sliders,
  Users,
  Infinity as InfinityIcon,
  Sparkles,
  Rocket,
  Globe,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { MissionConfig } from '../types';
import { audioManager } from '../utils/audioManager';

interface WelcomeModalProps {
  config: MissionConfig;
  onConfirm: (config: MissionConfig, mode: 'preset' | 'scratch' | 'tutorial') => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  config,
  onConfirm,
  onClose,
  canClose = false,
}) => {
  const [isInfiniteBudget, setIsInfiniteBudget] = useState(config.isInfiniteBudget ?? true);
  const [constructionBudget, setConstructionBudget] = useState(config.constructionBudget);
  const [launchBudget, setLaunchBudget] = useState(config.launchBudget);
  const [costPerKg] = useState(config.costPerKg);
  const [crewSize, setCrewSize] = useState(config.crewSize ?? 4);
  const [startStyle, setStartStyle] = useState<'preset' | 'scratch'>('preset');

  const totalBudget = isInfiniteBudget ? Infinity : constructionBudget + launchBudget;
  const transitTimeMonths = isInfiniteBudget
    ? '5.4'
    : Math.max(5.2, Math.min(9.4, 8.8 - (launchBudget / 30000000000) * 2.0)).toFixed(1);

  const handleLaunch = (mode: 'preset' | 'scratch' | 'tutorial' = startStyle) => {
    audioManager.playClick();
    onConfirm(
      {
        ...config,
        isInfiniteBudget,
        constructionBudget: isInfiniteBudget ? 100000000000 : constructionBudget,
        launchBudget: isInfiniteBudget ? 50000000000 : launchBudget,
        costPerKg,
        crewSize,
      },
      mode
    );
  };

  const formatCurrencyBillions = (val: number) => {
    if (!Number.isFinite(val)) return 'Unlimited';
    return `$${(val / 1e9).toFixed(1)}B`;
  };

  return (
    <div
      className="flex-1 min-h-0 relative overflow-hidden bg-[#09090F]"
      data-testid="welcome-modal"
    >
      {/* Cropped & Soft-Blurred Cosmic Cupcake Neon Banner Backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <img
          src="/assets/aistudio/Cosmic_Cupcake_Neon_Banner_3d5ec95c.png"
          alt=""
          className="w-full h-full object-cover object-center blur-[6px] scale-105 opacity-65"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090F]/55 via-[#09090F]/40 to-[#09090F]/80" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-8">
        {/* Main Home Mission Stage */}
        <div className="my-auto w-full max-w-4xl rounded-2xl bg-[#10101A]/92 border border-[#35285C] overflow-hidden shadow-2xl">
        {/* Hero Header */}
        <div className="p-5 sm:p-7 border-b border-[#2A2442] bg-[#151324]/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <img
              src="/assets/aistudio/logo_new_f57edc92.png"
              alt="Cosmic Cupcake"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#8B5CF6] shrink-0"
            />
            <div>
              <span className="text-[11px] uppercase tracking-widest text-[#A78BFA] font-bold block">
                Cosmic Cupcake Presents
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-wide text-[#E9D5FF]">
                mission-marz
              </h2>
              <p className="text-xs sm:text-sm text-[#C4B5FD] mt-1 max-w-xl leading-relaxed">
                Explore 18 real landing sites across Mars, design an air-tight colony for your crew,
                and test whether your base survives 30 Martian days.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              onClick={() => handleLaunch('tutorial')}
              data-testid="welcome-tutorial-btn"
              className="px-3 py-2 rounded-xl bg-[#09090F] hover:bg-[#1D1736] text-[#C4B5FD] hover:text-white border border-[#2A2442] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-[#A78BFA]" />
              <span>How to Play</span>
            </button>
            {canClose && onClose && (
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-[#1D1736] hover:bg-[#271F4A] text-[#E9D5FF] border border-[#5B2C98] text-xs font-semibold cursor-pointer"
              >
                Resume Base
              </button>
            )}
          </div>
        </div>

        {/* Mission Briefing & Interactive Mission Setup */}
        <div className="p-5 sm:p-7 space-y-5 text-left">
          {/* Top Mission Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[#09090F] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7] uppercase flex items-center justify-center gap-1">
                <Globe className="w-3 h-3 text-[#A78BFA]" />
                <span>Landing Sites</span>
              </div>
              <div className="text-sm font-bold text-[#E9D5FF] mt-0.5">18 NASA Regions</div>
            </div>

            <div className="p-3 rounded-xl bg-[#09090F] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7] uppercase flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-[#A78BFA]" />
                <span>Crew Size</span>
              </div>
              <div className="text-sm font-bold text-[#A78BFA] mt-0.5">{crewSize} Astronauts</div>
            </div>

            <div className="p-3 rounded-xl bg-[#09090F] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7] uppercase flex items-center justify-center gap-1">
                <Sliders className="w-3 h-3 text-emerald-400" />
                <span>Budget</span>
              </div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                {isInfiniteBudget ? 'Unlimited' : formatCurrencyBillions(totalBudget)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#09090F] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7] uppercase flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-amber-300" />
                <span>Flight &amp; Goal</span>
              </div>
              <div className="text-sm font-bold text-amber-300 mt-0.5">
                {transitTimeMonths}mo • 30 Days
              </div>
            </div>
          </div>

          {/* Direct Mission Settings Panel (Clean, Focused, Zero Clutter) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Crew Capacity Control */}
            <div className="p-4 rounded-xl bg-[#151324] border border-[#2A2442] flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#A78BFA]" />
                    <span>Mission Crew Size</span>
                  </div>
                  <p className="text-[11px] text-[#9F8FC7] mt-0.5">
                    Larger crews need more beds, oxygen, water, and fresh crops.
                  </p>
                </div>
                <span className="text-xs font-bold text-white bg-[#5B2C98] px-2.5 py-1 rounded-lg shrink-0">
                  {crewSize} Astronauts
                </span>
              </div>

              <input
                type="range"
                min={1}
                max={7}
                step={1}
                value={crewSize}
                onChange={(e) => {
                  setCrewSize(Number(e.target.value));
                  audioManager.playClick();
                }}
                data-testid="home-crew-slider"
                className="w-full accent-[#8B5CF6] cursor-pointer"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => {
                        setCrewSize(i + 1);
                        audioManager.playClick();
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer ${
                        i < crewSize
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#09090F] text-[#6D5B97] border border-[#2A2442]'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[#C4B5FD]">
                  Oxygen: {(crewSize * 0.84).toFixed(2)} kg/day
                </span>
              </div>
            </div>

            {/* Budget Mode Control */}
            <div className="p-4 rounded-xl bg-[#151324] border border-[#2A2442] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5">
                    <InfinityIcon className="w-4 h-4 text-[#A78BFA]" />
                    <span>Unlimited Budget</span>
                  </div>
                  <p className="text-[11px] text-[#9F8FC7] mt-0.5">
                    Turn off to challenge yourself with fixed building &amp; cargo limits.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isInfiniteBudget}
                    onChange={(e) => {
                      setIsInfiniteBudget(e.target.checked);
                      audioManager.playClick();
                    }}
                    data-testid="home-infinite-budget-toggle"
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#2A2442] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#E9D5FF] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B5CF6]" />
                </label>
              </div>

              {isInfiniteBudget ? (
                <div className="p-3 rounded-lg bg-[#09090F] border border-[#2A2442] text-[11px] text-[#C4B5FD] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Sandbox funding enabled: build freely across all 11 building categories without cost or weight caps.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-[#09090F] border border-[#2A2442]">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-[#C4B5FD]">Building Cap</label>
                      <span className="text-xs font-bold text-emerald-400">
                        {formatCurrencyBillions(constructionBudget)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10000000000}
                      max={60000000000}
                      step={1000000000}
                      value={constructionBudget}
                      onChange={(e) => setConstructionBudget(Number(e.target.value))}
                      className="w-full accent-[#8B5CF6] cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#09090F] border border-[#2A2442]">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-[#C4B5FD]">Cargo Cap</label>
                      <span className="text-xs font-bold text-[#A78BFA]">
                        {formatCurrencyBillions(launchBudget)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5000000000}
                      max={40000000000}
                      step={1000000000}
                      value={launchBudget}
                      onChange={(e) => setLaunchBudget(Number(e.target.value))}
                      className="w-full accent-[#8B5CF6] cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Starting Build Style + Primary Next-Step CTA */}
          <div className="p-4 rounded-xl bg-[#151324] border border-[#35285C] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartStyle('preset');
                  audioManager.playClick();
                }}
                data-testid="welcome-preset-btn"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer ${
                  startStyle === 'preset'
                    ? 'bg-[#1D1736] border-[#8B5CF6] text-white'
                    : 'bg-[#09090F] border-[#2A2442] text-[#9F8FC7] hover:text-[#E9D5FF]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Site-Matched Starter Base</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStartStyle('scratch');
                  audioManager.playClick();
                }}
                data-testid="welcome-scratch-btn"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer ${
                  startStyle === 'scratch'
                    ? 'bg-[#1D1736] border-[#8B5CF6] text-white'
                    : 'bg-[#09090F] border-[#2A2442] text-[#9F8FC7] hover:text-[#E9D5FF]'
                }`}
              >
                <Rocket className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Empty Grid</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleLaunch(startStyle)}
              data-testid="home-continue-site-select-btn"
              className="px-6 py-3 rounded-xl bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <span>Choose Landing Site on Mars</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
