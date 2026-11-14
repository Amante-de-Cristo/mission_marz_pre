import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Zap,
  Droplets,
  Wind,
  Apple,
  DollarSign,
  CheckCircle2,
  Info,
  Boxes,
  Users,
  MapPin,
  Search,
  Infinity as InfinityIcon,
} from 'lucide-react';
import {
  ResourceTelemetry,
  AdvisorWarning,
  PlacedPod,
  CameraState,
  RoverState,
  MissionConfig,
  LandingSite,
} from '../types';
import { MinimapRadar } from './MinimapRadar';
import { audioManager } from '../utils/audioManager';
import { CATEGORIES, POD_CATALOG, CATEGORY_COLORS } from '../utils/podCatalog';
import { getActiveLandingSite, getSiteRecommendedPods } from '../utils/marsSimulation';

interface TelemetryDrawerProps {
  telemetry: ResourceTelemetry;
  warnings: AdvisorWarning[];
  placedPods: PlacedPod[];
  cameraState: CameraState;
  rovers?: RoverState[];
  selectedPlacedPod?: PlacedPod | null;
  onMinimapClick?: (gridX: number, gridZ: number) => void;
  config: MissionConfig;
  landingSite?: LandingSite;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  telemetry,
  warnings,
  placedPods,
  cameraState,
  rovers = [],
  selectedPlacedPod,
  onMinimapClick,
  config,
  landingSite,
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'caps' | 'advisor'>('telemetry');
  const [limitsFilter, setLimitsFilter] = useState<'all' | 'placed'>('all');
  const [limitsQuery, setLimitsQuery] = useState('');

  const activeSite = landingSite || getActiveLandingSite(config);
  const recommendedPods = useMemo(
    () => getSiteRecommendedPods(activeSite, placedPods, config.crewSize),
    [activeSite, placedPods, config.crewSize]
  );

  const unmetRecommendations = useMemo(
    () => recommendedPods.filter((rec) => rec.placedCount < rec.recommendedCount),
    [recommendedPods]
  );
  const tipsBadgeCount = warnings.length + unmetRecommendations.length;

  const criticalWarnings = warnings.filter((w) => w.type === 'critical');
  const advisoryWarnings = warnings.filter((w) => w.type !== 'critical');

  const formatCurrency = (val: number) => {
    if (!Number.isFinite(val)) return 'Unlimited';
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <aside
      data-testid="telemetry-drawer"
      className="w-80 xl:w-[370px] shrink-0 h-full flex flex-col rounded-2xl bg-[#10101A] border border-[#2A2442] overflow-hidden"
    >
      {/* Permanent 3-Tab Switcher Header */}
      <div className="p-2 border-b border-[#2A2442] bg-[#151324]">
        <div className="grid grid-cols-3 gap-1 bg-[#09090F] p-1 rounded-xl border border-[#2A2442]">
          <button
            onClick={() => {
              audioManager.playClick();
              setActiveTab('telemetry');
            }}
            data-testid="tab-status"
            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-[#5B2C98] text-white'
                : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Status</span>
          </button>

          <button
            onClick={() => {
              audioManager.playClick();
              setActiveTab('caps');
            }}
            data-testid="tab-limits"
            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'caps'
                ? 'bg-[#5B2C98] text-white'
                : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 shrink-0" />
            <span>Limits</span>
          </button>

          <button
            onClick={() => {
              audioManager.playClick();
              setActiveTab('advisor');
            }}
            data-testid="tab-tips"
            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors relative cursor-pointer ${
              activeTab === 'advisor'
                ? 'bg-[#5B2C98] text-white'
                : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Tips</span>
            {tipsBadgeCount > 0 && (
              <span className="px-1 rounded bg-rose-600 text-[9px] text-white font-bold">
                {tipsBadgeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3 text-left">
        <MinimapRadar
          placedPods={placedPods}
          cameraState={cameraState}
          rovers={rovers}
          selectedPlacedPod={selectedPlacedPod}
          onMinimapClick={onMinimapClick}
        />

        {/* TAB 1: Base Status */}
        {activeTab === 'telemetry' && (
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-[#E9D5FF]">
                    {telemetry.isInfiniteBudget ? 'Total Base Cost' : 'Budget Remaining'}
                  </span>
                </div>
                <span
                  className={`text-xs font-bold ${
                    telemetry.isInfiniteBudget || telemetry.budgetRemainingUSD >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {telemetry.isInfiniteBudget
                    ? formatCurrency(telemetry.totalBaseSpendUSD)
                    : formatCurrency(telemetry.budgetRemainingUSD)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#C4B5FD]">
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Building Cost</div>
                  <div className="text-[#E9D5FF] font-bold">
                    {formatCurrency(telemetry.totalCostUSD)}
                  </div>
                </div>
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Cargo Weight</div>
                  <div className="text-[#A78BFA] font-bold">
                    {(telemetry.totalMassKg / 1000).toFixed(1)} tons
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-[#E9D5FF]">Power Grid</span>
                </div>
                <span
                  className={`text-xs font-bold ${
                    telemetry.netPowerKW >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {telemetry.netPowerKW >= 0 ? `+${telemetry.netPowerKW}` : telemetry.netPowerKW} kW
                </span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#09090F] overflow-hidden mb-2">
                <div
                  className="bg-amber-400 h-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (telemetry.powerDemandKW / Math.max(1, telemetry.powerSupplyKW)) * 100
                    )}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#C4B5FD]">
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Power Made</div>
                  <div className="text-[#E9D5FF] font-bold">{telemetry.powerSupplyKW} kW</div>
                </div>
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Power Used</div>
                  <div className="text-[#E9D5FF] font-bold">{telemetry.powerDemandKW} kW</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-[#E9D5FF]">Water Supply</span>
                </div>
                <span
                  className={`text-xs font-bold ${
                    telemetry.netWaterL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {telemetry.netWaterL >= 0 ? `+${telemetry.netWaterL}` : telemetry.netWaterL} L/day
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#C4B5FD]">
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Cleaned Daily</div>
                  <div className="text-sky-300 font-bold">{telemetry.waterSupplyL} L</div>
                </div>
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Used Daily</div>
                  <div className="text-[#E9D5FF] font-bold">{telemetry.waterDemandL} L</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-[#A78BFA]" />
                  <span className="text-xs font-bold text-[#E9D5FF]">Oxygen Supply</span>
                </div>
                <span
                  className={`text-xs font-bold ${
                    telemetry.netO2Kg >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {telemetry.netO2Kg >= 0 ? `+${telemetry.netO2Kg}` : telemetry.netO2Kg} kg/day
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#C4B5FD]">
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Oxygen Made</div>
                  <div className="text-[#A78BFA] font-bold">{telemetry.o2SupplyKg} kg/day</div>
                </div>
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Crew Needs</div>
                  <div className="text-[#E9D5FF] font-bold">{telemetry.o2DemandKg} kg/day</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Apple className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-[#E9D5FF]">Food &amp; Crops</span>
                </div>
                <span
                  className={`text-xs font-bold ${
                    telemetry.foodSupplyKg >= telemetry.foodDemandKg
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {telemetry.foodSupplyKg} kg/day
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#C4B5FD]">
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Daily Harvest</div>
                  <div className="text-emerald-300 font-bold">{telemetry.foodSupplyKg} kg</div>
                </div>
                <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                  <div className="text-[#9F8FC7] text-[10px]">Crew Needs</div>
                  <div className="text-[#E9D5FF] font-bold">{telemetry.foodDemandKg} kg</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#A78BFA]" />
                  <span className="text-xs font-bold text-[#E9D5FF]">Crew Beds</span>
                </div>
                <span className="text-xs font-bold text-[#E9D5FF]">
                  {config.crewSize} / {telemetry.crewCapacity} Beds
                </span>
              </div>
              <div className="text-[11px] text-[#9F8FC7]">
                Pressurized sleeping quarters for your {config.crewSize}-astronaut crew.
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Building Limits */}
        {activeTab === 'caps' && (
          <div className="space-y-3" data-testid="limits-tab-panel">
            {/* Budget Mode Header Banner */}
            {telemetry.isInfiniteBudget ? (
              <div
                data-testid="limits-unlimited-banner"
                className="p-3 rounded-xl bg-[#151324] border border-emerald-700/50 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5">
                    <InfinityIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Unlimited Budget Active</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-bold">
                    Unlimited
                  </span>
                </div>
                <p className="text-[11px] text-[#C4B5FD] leading-snug">
                  All building placement caps are Unlimited. Showing how many of each building you
                  currently have on Mars.
                </p>
              </div>
            ) : (
              <div
                data-testid="limits-limited-banner"
                className="p-3 rounded-xl bg-[#151324] border border-[#35285C] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#E9D5FF]">Dynamic Budget Limits</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#09090F] text-[#A78BFA] border border-[#2A2442] font-semibold">
                    Limited Budget
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                    <div className="text-[#9F8FC7] text-[10px]">Build Funds Left</div>
                    <div
                      className={`font-bold ${
                        telemetry.budgetRemainingUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatCurrency(Math.max(0, telemetry.budgetRemainingUSD))}
                    </div>
                  </div>
                  <div className="bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                    <div className="text-[#9F8FC7] text-[10px]">Launch Funds Left</div>
                    <div
                      className={`font-bold ${
                        telemetry.launchBudgetRemainingUSD >= 0
                          ? 'text-[#A78BFA]'
                          : 'text-rose-400'
                      }`}
                    >
                      {formatCurrency(Math.max(0, telemetry.launchBudgetRemainingUSD))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Filter & Search for Per-Pod Limits */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9F8FC7] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter buildings..."
                  value={limitsQuery}
                  onChange={(e) => setLimitsQuery(e.target.value)}
                  data-testid="limits-search-input"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#09090F] border border-[#2A2442] text-xs text-[#E9D5FF] placeholder-[#6D5B97] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-1 bg-[#09090F] p-1 rounded-xl border border-[#2A2442]">
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    setLimitsFilter('all');
                  }}
                  data-testid="limits-filter-all"
                  className={`py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    limitsFilter === 'all'
                      ? 'bg-[#5B2C98] text-white'
                      : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
                  }`}
                >
                  All Buildings ({POD_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playClick();
                    setLimitsFilter('placed');
                  }}
                  data-testid="limits-filter-placed"
                  className={`py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    limitsFilter === 'placed'
                      ? 'bg-[#5B2C98] text-white'
                      : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
                  }`}
                >
                  Placed Only ({placedPods.length})
                </button>
              </div>
            </div>

            {/* Per-Category & Per-Pod Dynamic Counts */}
            <div className="space-y-2.5">
              {CATEGORIES.map((cat) => {
                const theme = CATEGORY_COLORS[cat];
                const q = limitsQuery.trim().toLowerCase();
                const podsInCat = POD_CATALOG.filter((p) => {
                  if (p.category !== cat) return false;
                  const podCap = telemetry.podCaps?.[p.id];
                  const placed = podCap?.placed ?? 0;
                  if (limitsFilter === 'placed' && placed === 0) return false;
                  if (q && !p.name.toLowerCase().includes(q) && !cat.toLowerCase().includes(q)) {
                    return false;
                  }
                  return true;
                });

                if (podsInCat.length === 0) return null;

                const catPlaced = telemetry.categoryCaps?.[cat]?.placed ?? 0;

                return (
                  <div
                    key={cat}
                    className="p-2.5 rounded-xl bg-[#151324] border border-[#2A2442] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#2A2442]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: theme.hex }}
                        />
                        <span className="text-xs font-bold text-[#E9D5FF] truncate">{cat}</span>
                      </div>
                      <span className="text-[10px] text-[#9F8FC7] font-semibold shrink-0">
                        {telemetry.isInfiniteBudget
                          ? `${catPlaced} Placed · Unlimited`
                          : `${catPlaced} Placed`}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {podsInCat.map((pod) => {
                        const podCap = telemetry.podCaps?.[pod.id];
                        const placed = podCap?.placed ?? 0;
                        const canAffordMore = podCap?.canAffordMore ?? Infinity;
                        const isUnlimitedPod =
                          telemetry.isInfiniteBudget || !Number.isFinite(canAffordMore);

                        return (
                          <div
                            key={pod.id}
                            data-testid={`limit-row-${pod.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-[#09090F] border border-[#2A2442] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-[#E9D5FF] truncate">
                                {pod.name}
                              </div>
                              {!isUnlimitedPod && (
                                <div className="text-[10px] text-[#9F8FC7]">
                                  {formatCurrency(pod.cost)} +{' '}
                                  {formatCurrency(pod.mass * (config.costPerKg || 15000))} launch
                                </div>
                              )}
                            </div>

                            {isUnlimitedPod ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-bold text-[#E9D5FF]">
                                  {placed} Placed
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-semibold">
                                  Unlimited
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-bold text-[#C4B5FD]">
                                  {placed} Placed
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                    canAffordMore > 0
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                                      : 'bg-rose-950 text-rose-300 border-rose-700/50'
                                  }`}
                                >
                                  {canAffordMore > 0 ? `+${canAffordMore} left` : '+0 (Maxed)'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Site-Recommended Loadout & Base Tips */}
        {activeTab === 'advisor' && (
          <div className="space-y-3">
            {/* Location-Specific Recommended Buildings (Mandatory for Launch) */}
            <div
              data-testid="site-recommended-buildings"
              className={`p-3 rounded-xl bg-[#151324] border space-y-2 ${
                unmetRecommendations.length === 0 ? 'border-emerald-700/60' : 'border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A78BFA] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Recommended for {activeSite.name}</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#09090F] text-[#C4B5FD] border border-[#2A2442]">
                  {config.crewSize} Crew
                </span>
              </div>

              <div
                data-testid="tips-launch-readiness"
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between border ${
                  unmetRecommendations.length === 0
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                    : 'bg-[#1F1729] text-amber-300 border-amber-500/40'
                }`}
              >
                <span>
                  {unmetRecommendations.length === 0
                    ? 'All site targets green — ready for launch'
                    : `${unmetRecommendations.length} target${
                        unmetRecommendations.length === 1 ? '' : 's'
                      } must turn green before launch`}
                </span>
                <span className="font-bold">
                  {recommendedPods.length - unmetRecommendations.length}/{recommendedPods.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {recommendedPods.map((rec) => {
                  const isMet = rec.placedCount >= rec.recommendedCount;
                  return (
                    <div
                      key={rec.podId}
                      data-testid={`tip-rec-${rec.podId}`}
                      className="p-2 rounded-lg bg-[#09090F] border border-[#2A2442]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] font-bold text-[#E9D5FF] truncate">
                          {rec.podName}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            isMet
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                              : 'bg-[#1D1736] text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {rec.placedCount} / {rec.recommendedCount}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#9F8FC7] leading-snug">{rec.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[11px] text-[#9F8FC7] flex items-center justify-between">
              <span>Base Health Check</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#151324] text-[#E9D5FF] border border-[#2A2442]">
                {warnings.length} Alerts
              </span>
            </div>

            {warnings.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#151324] border border-emerald-700/50 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-[#E9D5FF] mb-1">All Systems Balanced</h4>
                <p className="text-[11px] text-[#C4B5FD] leading-relaxed">
                  Power, oxygen, water, and required buildings are ready for the 30-day mission.
                </p>
              </div>
            ) : (
              <>
                {criticalWarnings.map((warn) => (
                  <div
                    key={warn.id}
                    className="p-3 rounded-xl bg-[#1F121D] border border-rose-500/50 text-left"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300 mb-1">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{warn.title}</span>
                    </div>
                    <p className="text-[11px] text-[#E9D5FF] leading-relaxed mb-2">
                      {warn.message}
                    </p>
                    {warn.suggestedAction && (
                      <div className="text-[10px] text-amber-300 bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                        <span className="font-bold">How to fix:</span> {warn.suggestedAction}
                      </div>
                    )}
                  </div>
                ))}

                {advisoryWarnings.map((warn) => (
                  <div
                    key={warn.id}
                    className="p-3 rounded-xl bg-[#151324] border border-amber-500/40 text-left"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{warn.title}</span>
                    </div>
                    <p className="text-[11px] text-[#C4B5FD] leading-relaxed mb-2">
                      {warn.message}
                    </p>
                    {warn.suggestedAction && (
                      <div className="text-[10px] text-[#A78BFA] bg-[#09090F] p-2 rounded-lg border border-[#2A2442]">
                        <span className="font-bold">Tip:</span> {warn.suggestedAction}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
