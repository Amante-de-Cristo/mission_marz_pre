import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Apple,
  Wind,
  HeartPulse,
  Microscope,
  Zap,
  Wrench,
  Compass,
  Recycle,
  Users,
  Shield,
  Search,
  Check,
  Plus,
} from 'lucide-react';
import { PodCategory, PodDefinition, PlacedPod, LandingSite, ResourceTelemetry } from '../types';
import { CATEGORIES, POD_CATALOG, POD_MAP, CATEGORY_COLORS } from '../utils/podCatalog';
import { audioManager } from '../utils/audioManager';

interface PodCatalogSidebarProps {
  selectedCatalogPod: PodDefinition | null;
  onSelectCatalogPod: (pod: PodDefinition | null) => void;
  placedPods: PlacedPod[];
  landingSite?: LandingSite;
  telemetry?: ResourceTelemetry;
}

const CATEGORY_ICONS: Record<PodCategory, React.ComponentType<{ className?: string }>> = {
  Essential: ShieldAlert,
  'Food & Agriculture': Apple,
  'Life Support': Wind,
  'Medical & Health': HeartPulse,
  'Science & Research': Microscope,
  'Energy & Electricity': Zap,
  'Engineering & Manufacturing': Wrench,
  'Transportation & Exploration': Compass,
  'Waste & Recycling': Recycle,
  'Recreation & Community': Users,
  'Security & Emergency': Shield,
};

export const PodCatalogSidebar: React.FC<PodCatalogSidebarProps> = ({
  selectedCatalogPod,
  onSelectCatalogPod,
  placedPods,
  landingSite,
  telemetry,
}) => {
  const [openCategory, setOpenCategory] = useState<PodCategory | null>('Essential');
  const [searchQuery, setSearchQuery] = useState('');

  const placedCounts = placedPods.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.podId] = (acc[curr.podId] || 0) + 1;
    return acc;
  }, {});

  const filteredPods = POD_CATALOG.filter((pod) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pod.name.toLowerCase().includes(query) ||
      pod.description.toLowerCase().includes(query) ||
      pod.category.toLowerCase().includes(query) ||
      pod.nasaTechSpec.toLowerCase().includes(query)
    );
  });

  const toggleCategory = (cat: PodCategory) => {
    setOpenCategory(openCategory === cat ? null : cat);
    audioManager.playClick();
  };

  const formatCost = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    return `$${(val / 1e6).toFixed(0)}M`;
  };

  return (
    <aside
      data-testid="pod-catalog-sidebar"
      className="w-72 xl:w-80 shrink-0 h-full flex flex-col rounded-2xl bg-[#10101A] border border-[#2A2442] overflow-hidden"
    >
      {/* Permanent Sidebar Header */}
      <div className="p-3 border-b border-[#2A2442] flex items-center justify-between bg-[#151324]">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E9D5FF]">
          Base Buildings
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-[#09090F] text-[#A78BFA] border border-[#2A2442]">
          {POD_CATALOG.length} Types
        </span>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-[#2A2442]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#9F8FC7] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search buildings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#09090F] border border-[#2A2442] text-xs text-[#E9D5FF] placeholder-[#6D5B97] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
      </div>

      {/* Active Placement Notice */}
      {selectedCatalogPod && (
        <div className="mx-2.5 mt-2 p-2.5 rounded-xl bg-[#1D1736] border border-[#8B5CF6] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedCatalogPod.colorAccent }}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#E9D5FF] truncate">
                {selectedCatalogPod.name}
              </div>
              <div className="text-[10px] text-[#C4B5FD] truncate">
                Click the Mars grid to place
              </div>
            </div>
          </div>
          <button
            onClick={() => onSelectCatalogPod(null)}
            data-testid="sidebar-cancel-placement-btn"
            className="px-2 py-1 rounded-lg bg-[#09090F] hover:bg-[#2A2442] text-[11px] font-semibold text-[#E9D5FF] shrink-0 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const theme = CATEGORY_COLORS[category];
          const podsInCat = filteredPods.filter((p) => p.category === category);
          if (searchQuery && podsInCat.length === 0) return null;

          const isOpen = openCategory === category || Boolean(searchQuery);

          return (
            <div
              key={category}
              className={`rounded-xl border overflow-hidden ${
                isOpen
                  ? 'border-[#5B2C98] bg-[#151324]'
                  : 'border-[#2A2442] bg-[#0D0D16] hover:border-[#35285C]'
              }`}
            >
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-3 py-2 flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: theme.hex }}
                  />
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${theme.text}`} />
                  <span className="text-xs font-bold text-[#E9D5FF] truncate">
                    {category}
                  </span>
                  {category === 'Essential' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#5B2C98] text-white font-semibold uppercase shrink-0">
                      Required
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#9F8FC7] shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#09090F]">
                    {podsInCat.length}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="p-2 space-y-2 border-t border-[#2A2442] bg-[#09090F]">
                  {podsInCat.map((pod) => {
                    const isSelected = selectedCatalogPod?.id === pod.id;
                    const placedCount = placedCounts[pod.id] || 0;
                    const unsuitableRule = landingSite?.unsuitablePods.find(
                      (u) => u.podId === pod.id
                    );
                    const isUnlimitedGarage = pod.id === 'rover_garage_pod';

                    return (
                      <div
                        key={pod.id}
                        className={`p-2.5 rounded-xl border text-left ${
                          isSelected
                            ? 'bg-[#1D1736] border-[#8B5CF6]'
                            : unsuitableRule
                            ? 'bg-[#181322] border-amber-500/40 hover:border-amber-400'
                            : 'bg-[#151324] border-[#2A2442] hover:border-[#5B2C98]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: pod.colorAccent }}
                            />
                            <h4 className="text-xs font-bold text-[#E9D5FF] truncate">
                              {pod.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isUnlimitedGarage && (
                              <span
                                title="Unlimited garages — each adds 1 Rover, 1 Helicopter, and 1 nearest Helipad"
                                className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-bold"
                              >
                                ∞
                              </span>
                            )}
                            {unsuitableRule && (
                              <span
                                title={unsuitableRule.reason}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/60 font-bold"
                              >
                                Limited
                              </span>
                            )}
                            {placedCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-0.5 shrink-0">
                                <Check className="w-2.5 h-2.5" />
                                <span>{placedCount}</span>
                              </span>
                            )}
                            {telemetry && !telemetry.isInfiniteBudget && telemetry.podCaps?.[pod.id] && (
                              <span
                                title={
                                  telemetry.podCaps[pod.id].canAffordMore > 0
                                    ? `You can afford ${telemetry.podCaps[pod.id].canAffordMore} more with current budget`
                                    : 'Insufficient remaining build or cargo budget'
                                }
                                className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${
                                  telemetry.podCaps[pod.id].canAffordMore > 0
                                    ? 'bg-[#09090F] text-[#C4B5FD] border-[#2A2442]'
                                    : 'bg-rose-950 text-rose-300 border-rose-700/50'
                                }`}
                              >
                                {telemetry.podCaps[pod.id].canAffordMore > 0
                                  ? `+${telemetry.podCaps[pod.id].canAffordMore}`
                                  : 'Maxed'}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-[#C4B5FD] leading-snug mb-2 line-clamp-2">
                          {pod.description}
                        </p>

                        {unsuitableRule && (
                          <div className="mb-2 px-2 py-1 rounded bg-[#1F1622] border border-amber-500/40 text-[10px] text-amber-200 leading-snug">
                            <span className="font-bold text-amber-300">Site Warning:</span>{' '}
                            {unsuitableRule.reason} Use{' '}
                            <span className="font-semibold text-[#E9D5FF]">
                              {unsuitableRule.alternativePodIds
                                .map((id) => POD_MAP.get(id)?.name || id)
                                .join(' or ')}
                            </span>
                            .
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] bg-[#09090F] p-1.5 rounded-lg mb-2 text-[#C4B5FD]">
                          <div>
                            <span className="text-[#9F8FC7]">Cost: </span>
                            <span className="text-emerald-400 font-bold">
                              {formatCost(pod.cost)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#9F8FC7]">Weight: </span>
                            <span>{(pod.mass / 1000).toFixed(1)}t</span>
                          </div>
                          <div>
                            <span className="text-[#9F8FC7]">Power: </span>
                            <span className={pod.powerKW <= 0 ? 'text-amber-300 font-bold' : ''}>
                              {pod.powerKW <= 0
                                ? `+${Math.abs(pod.powerKW)}`
                                : `-${pod.powerKW}`}{' '}
                              kW
                            </span>
                          </div>
                          <div>
                            <span className="text-[#9F8FC7]">Air/Water: </span>
                            <span>
                              {pod.o2Rate < 0
                                ? `+${Math.abs(pod.o2Rate)} kg O2`
                                : `${pod.waterRate} L Water`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-[10px] text-[#9F8FC7] truncate"
                            title={pod.nasaTechSpec}
                          >
                            {pod.nasaTechSpec}
                          </span>
                          <button
                            onClick={() => {
                              audioManager.playClick();
                              onSelectCatalogPod(isSelected ? null : pod);
                            }}
                            data-testid={`select-pod-${pod.id}`}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                              isSelected
                                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                : 'bg-[#5B2C98] hover:bg-[#8B5CF6] text-white'
                            }`}
                          >
                            {isSelected ? (
                              <span>Cancel</span>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Select</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
