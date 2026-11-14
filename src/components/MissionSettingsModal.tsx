import React, { useState, useMemo } from 'react';
import { X, Users, Infinity as InfinityIcon, AlertTriangle, Check } from 'lucide-react';
import { MissionConfig, PlacedPod } from '../types';
import { rebalanceBaseForBudget } from '../utils/marsSimulation';
import { audioManager } from '../utils/audioManager';

interface MissionSettingsModalProps {
  config: MissionConfig;
  placedPods: PlacedPod[];
  onApplyConfig: (newConfig: MissionConfig) => void;
  onClose: () => void;
}

export const MissionSettingsModal: React.FC<MissionSettingsModalProps> = ({
  config,
  placedPods,
  onApplyConfig,
  onClose,
}) => {
  const [isInfiniteBudget, setIsInfiniteBudget] = useState(config.isInfiniteBudget ?? true);
  const [constructionBudget, setConstructionBudget] = useState(
    Math.min(60000000000, Math.max(4000000000, config.constructionBudget || 25000000000))
  );
  const [launchBudget, setLaunchBudget] = useState(
    Math.min(40000000000, Math.max(2000000000, config.launchBudget || 15000000000))
  );
  const [crewSize, setCrewSize] = useState(config.crewSize ?? 4);

  const previewDraftConfig: MissionConfig = useMemo(
    () => ({
      ...config,
      isInfiniteBudget,
      constructionBudget: isInfiniteBudget ? 100000000000 : constructionBudget,
      launchBudget: isInfiniteBudget ? 50000000000 : launchBudget,
      crewSize,
    }),
    [config, isInfiniteBudget, constructionBudget, launchBudget, crewSize]
  );

  const previewRebalance = useMemo(
    () => rebalanceBaseForBudget(placedPods, previewDraftConfig),
    [placedPods, previewDraftConfig]
  );

  const formatCurrencyBillions = (val: number) => {
    if (!Number.isFinite(val)) return 'Unlimited';
    return `$${(val / 1e9).toFixed(1)}B`;
  };

  const handleSave = () => {
    audioManager.playClick();
    onApplyConfig(previewDraftConfig);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090F]/90"
      data-testid="live-settings-modal"
    >
      <div className="w-full max-w-xl rounded-2xl bg-[#10101A] border border-[#35285C] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#2A2442] bg-[#151324] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/logo_new_f57edc92.png"
              alt="Cosmic Cupcake"
              className="w-7 h-7 rounded-full object-cover border border-[#5B2C98]"
            />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#E9D5FF]">
              Mission Settings
            </h3>
          </div>
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="p-1 rounded text-[#9F8FC7] hover:text-white cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-left">
          {/* Crew Capacity Slider */}
          <div className="p-4 rounded-xl bg-[#151324] border border-[#2A2442] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#A78BFA]" />
                  <span>Crew Size</span>
                </div>
                <p className="text-[11px] text-[#9F8FC7] mt-0.5">
                  Updates live life-support demand and recommended buildings immediately.
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
              data-testid="settings-crew-slider"
              className="w-full accent-[#8B5CF6] cursor-pointer"
            />
          </div>

          {/* Budget Mode & Sliders */}
          <div className="p-4 rounded-xl bg-[#151324] border border-[#2A2442] space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5">
                  <InfinityIcon className="w-4 h-4 text-[#A78BFA]" />
                  <span>Unlimited Budget</span>
                </div>
                <p className="text-[11px] text-[#9F8FC7] mt-0.5">
                  Lowered budgets automatically trim excess non-essential buildings to prevent budget exploits.
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
                  data-testid="settings-infinite-budget-toggle"
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2A2442] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#E9D5FF] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B5CF6]" />
              </label>
            </div>

            {!isInfiniteBudget && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#2A2442]">
                <div className="p-3 rounded-lg bg-[#09090F] border border-[#2A2442]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-[#C4B5FD]">Building Budget</label>
                    <span className="text-xs font-bold text-emerald-400">
                      {formatCurrencyBillions(constructionBudget)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4000000000}
                    max={60000000000}
                    step={500000000}
                    value={constructionBudget}
                    onChange={(e) => setConstructionBudget(Number(e.target.value))}
                    data-testid="settings-construction-budget-slider"
                    className="w-full accent-[#8B5CF6] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#9F8FC7] mt-1">
                    <span>$4.0B</span>
                    <span>$60B</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#09090F] border border-[#2A2442]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-[#C4B5FD]">Cargo Budget</label>
                    <span className="text-xs font-bold text-[#A78BFA]">
                      {formatCurrencyBillions(launchBudget)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2000000000}
                    max={40000000000}
                    step={500000000}
                    value={launchBudget}
                    onChange={(e) => setLaunchBudget(Number(e.target.value))}
                    data-testid="settings-launch-budget-slider"
                    className="w-full accent-[#8B5CF6] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#9F8FC7] mt-1">
                    <span>$2.0B</span>
                    <span>$40B</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Rebalance Warning Preview */}
          {previewRebalance.wasRebalanced && (
            <div
              data-testid="settings-rebalance-preview"
              className="p-3.5 rounded-xl bg-[#1F121D] border border-amber-500/60 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-[#E9D5FF] leading-relaxed">
                <div className="font-bold text-amber-300 mb-0.5">
                  Budget Limit Warning ({previewRebalance.removedPods.length} Buildings Over Cap)
                </div>
                {previewRebalance.warningMessage}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2A2442] bg-[#151324] flex items-center justify-end gap-2">
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-[#09090F] hover:bg-[#1E1A33] text-[#C4B5FD] border border-[#2A2442] text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            data-testid="apply-settings-btn"
            className="px-4 py-2 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
