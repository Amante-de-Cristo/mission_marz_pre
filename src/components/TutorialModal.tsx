import React from 'react';
import {
  X,
  Compass,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Layers,
  Eye,
} from 'lucide-react';
import { audioManager } from '../utils/audioManager';

interface TutorialModalProps {
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090F]/90">
      <div className="w-full max-w-xl rounded-2xl bg-[#10101A] border border-[#35285C] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#2A2442] flex items-center justify-between bg-[#151324]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
            <h3 className="text-sm font-bold uppercase text-[#E9D5FF] tracking-wider">
              How to Build &amp; Run Your Base
            </h3>
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

        <div className="p-5 overflow-y-auto space-y-4 text-left">
          <div>
            <div className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              <span>Camera &amp; Mouse Controls</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442] flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-[#5B2C98] text-white font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <RotateCw className="w-3 h-3" />
                  Rotate
                </span>
                <span className="text-[#C4B5FD] text-[11px]">
                  Use the on-screen Rotate button while placing or inspecting any building.
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442] flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-[#5B2C98] text-white font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <Eye className="w-3 h-3" />
                  Inspect
                </span>
                <span className="text-[#C4B5FD] text-[11px]">
                  Click any placed building on Mars to check its stats, rotate it, or remove it.
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442] flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-[#09090F] text-[#E9D5FF] border border-[#2A2442] font-bold text-[10px] shrink-0">
                  Left-Drag
                </span>
                <span className="text-[#C4B5FD] text-[11px]">
                  Drag across the terrain to pan the camera, or click a tile to place a building.
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#151324] border border-[#2A2442] flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-[#09090F] text-[#E9D5FF] border border-[#2A2442] font-bold text-[10px] shrink-0">
                  Right-Drag
                </span>
                <span className="text-[#C4B5FD] text-[11px]">
                  Drag to turn the camera angle around your base. Use your scroll wheel to zoom.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#151324] border border-[#2A2442]">
            <div className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Automatic Tunnels</span>
            </div>
            <p className="text-xs text-[#C4B5FD] leading-relaxed">
              Whenever you place two buildings next to each other on the grid, a sealed walkway
              tunnel connects them automatically so your crew can move indoors safely.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1F121D] border border-rose-500/40">
            <div className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>10 Required Buildings Before Launch</span>
            </div>
            <p className="text-xs text-[#E9D5FF] leading-relaxed mb-2">
              Your base needs all 10 required buildings before you can start the 30-day test:
            </p>
            <div className="text-[11px] text-[#C4B5FD] grid grid-cols-2 gap-1 bg-[#09090F] p-2.5 rounded-lg border border-[#2A2442]">
              <span>• Main Living Dome</span>
              <span>• Oxygen Plant</span>
              <span>• Water Recycling Plant</span>
              <span>• Entry Airlock</span>
              <span>• Storm Shelter</span>
              <span>• Nuclear Power Core</span>
              <span>• Medical Clinic</span>
              <span>• Earth Radio Dish</span>
              <span>• Waste Recycling Hub</span>
              <span>• Supply Warehouse</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#151324] border border-[#2A2442]">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Keep Power, Water &amp; Oxygen Balanced</span>
            </div>
            <p className="text-xs text-[#C4B5FD] leading-relaxed">
              Watch the Status and Tips tabs on the right for site-specific building targets. After
              your 30-day mission finishes, inspect full oxygen, water, and power graphs in the
              simulation report.
            </p>
          </div>
        </div>

        <div className="p-3.5 border-t border-[#2A2442] bg-[#151324] flex justify-end">
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Got It, Start Building
          </button>
        </div>
      </div>
    </div>
  );
};
