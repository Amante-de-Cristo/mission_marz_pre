import React from 'react';
import { X, RotateCw, Trash2, Shield } from 'lucide-react';
import { PlacedPod } from '../types';
import { POD_MAP } from '../utils/podCatalog';
import { audioManager } from '../utils/audioManager';

interface PodInspectorModalProps {
  placedPod: PlacedPod | null;
  onClose: () => void;
  onRotatePod: (instanceId: string) => void;
  onDemolishPod: (instanceId: string) => void;
}

export const PodInspectorModal: React.FC<PodInspectorModalProps> = ({
  placedPod,
  onClose,
  onRotatePod,
  onDemolishPod,
}) => {
  if (!placedPod) return null;
  const def = POD_MAP.get(placedPod.podId);
  if (!def) return null;

  const formatCost = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    return `$${(val / 1e6).toFixed(0)}M`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090F]/85">
      <div className="w-full max-w-lg rounded-2xl bg-[#10101A] border border-[#35285C] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#2A2442] flex items-center justify-between bg-[#151324]">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: def.colorAccent }}
            />
            <div>
              <div className="text-[11px] text-[#9F8FC7] uppercase tracking-wider">
                {def.category}
              </div>
              <h3 className="text-base font-bold text-[#E9D5FF]">{def.name}</h3>
            </div>
          </div>

          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="p-1 rounded text-[#9F8FC7] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-left">
          <div className="p-3.5 rounded-xl bg-[#151324] border border-[#2A2442]">
            <div className="text-[11px] text-[#A78BFA] uppercase tracking-wider mb-1 font-bold">
              What It Does
            </div>
            <p className="text-xs text-[#E9D5FF] leading-relaxed">{def.description}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#151324] border border-[#2A2442]">
            <div className="text-[11px] text-[#A78BFA] uppercase tracking-wider mb-1 font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Design Notes</span>
            </div>
            <p className="text-xs text-[#C4B5FD] leading-relaxed">{def.nasaTechSpec}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7]">Cost</div>
              <div className="text-emerald-400 font-bold mt-0.5">{formatCost(def.cost)}</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7]">Weight</div>
              <div className="text-[#E9D5FF] font-bold mt-0.5">{(def.mass / 1000).toFixed(1)}t</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7]">Power</div>
              <div
                className={`font-bold mt-0.5 ${
                  def.powerKW <= 0 ? 'text-amber-300' : 'text-[#E9D5FF]'
                }`}
              >
                {def.powerKW <= 0 ? `+${Math.abs(def.powerKW)}` : `-${def.powerKW}`} kW
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442]">
              <div className="text-[10px] text-[#9F8FC7]">Oxygen</div>
              <div
                className={`font-bold mt-0.5 ${
                  def.o2Rate < 0 ? 'text-[#A78BFA]' : 'text-[#E9D5FF]'
                }`}
              >
                {def.o2Rate < 0 ? `+${Math.abs(def.o2Rate)}` : `-${def.o2Rate}`} kg/d
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#9F8FC7] flex items-center justify-between px-1">
            <span>
              Grid Position: [{placedPod.gridX}, {placedPod.gridZ}]
            </span>
            <span>Facing: {placedPod.rotation}°</span>
          </div>
        </div>

        <div className="p-4 border-t border-[#2A2442] bg-[#151324] flex items-center justify-between">
          <button
            onClick={() => {
              audioManager.playDemolish();
              onDemolishPod(placedPod.instanceId);
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Building</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                audioManager.playRotate();
                onRotatePod(placedPod.instanceId);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#09090F] hover:bg-[#1E1A33] text-[#E9D5FF] border border-[#2A2442] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate 90°</span>
            </button>

            <button
              onClick={() => {
                audioManager.playClick();
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
