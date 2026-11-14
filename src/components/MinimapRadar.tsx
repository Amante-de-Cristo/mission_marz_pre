import React, { useRef, useEffect } from 'react';
import { Compass } from 'lucide-react';
import { PlacedPod, CameraState, RoverState } from '../types';
import { POD_MAP, CATEGORY_COLORS } from '../utils/podCatalog';
import { computeHelipadPlacements } from '../utils/marsSimulation';

interface MinimapRadarProps {
  placedPods: PlacedPod[];
  cameraState: CameraState;
  rovers?: RoverState[];
  selectedPlacedPod?: PlacedPod | null;
  onMinimapClick?: (gridX: number, gridZ: number) => void;
}

export const MinimapRadar: React.FC<MinimapRadarProps> = ({
  placedPods,
  cameraState,
  rovers = [],
  selectedPlacedPod,
  onMinimapClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radarRadius = width / 2 - 12;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#09090F';
    ctx.fill();
    ctx.strokeStyle = '#5B2C98';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const rings = [0.33, 0.66, 1.0];
    rings.forEach((rScale, i) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radarRadius * rScale, 0, Math.PI * 2);
      ctx.strokeStyle = i === 2 ? '#8B5CF6' : '#2A2442';
      ctx.lineWidth = 1;
      ctx.setLineDash(i === 2 ? [] : [3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    ctx.beginPath();
    ctx.moveTo(centerX - radarRadius, centerY);
    ctx.lineTo(centerX + radarRadius, centerY);
    ctx.moveTo(centerX, centerY - radarRadius);
    ctx.lineTo(centerX, centerY + radarRadius);
    ctx.strokeStyle = '#2A2442';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radarRadius - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.save();
    ctx.translate(centerX, centerY);
    const yaw = -cameraState.rotationY;
    ctx.rotate(yaw);

    const scale = (radarRadius * 0.88) / 72;

    ctx.strokeStyle = '#1E1A33';
    ctx.lineWidth = 0.75;
    for (let g = -12; g <= 12; g += 2) {
      const pos = g * 6 * scale;
      ctx.beginPath();
      ctx.moveTo(pos, -radarRadius);
      ctx.lineTo(pos, radarRadius);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-radarRadius, pos);
      ctx.lineTo(radarRadius, pos);
      ctx.stroke();
    }

    for (const pod of placedPods) {
      const def = POD_MAP.get(pod.podId);
      const catColor = def ? CATEGORY_COLORS[def.category]?.hex || '#8B5CF6' : '#8B5CF6';

      const px = pod.gridX * 6 * scale;
      const pz = pod.gridZ * 6 * scale;
      const isSelected = selectedPlacedPod?.instanceId === pod.instanceId;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(px, pz, 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#E9D5FF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(px, pz, isSelected ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = catColor;
      ctx.fill();
      ctx.strokeStyle = '#09090F';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const helipads = computeHelipadPlacements(placedPods);
    for (const hp of helipads) {
      const hx = hp.gridX * 6 * scale;
      const hz = hp.gridZ * 6 * scale;
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - 2.6, hz - 2.6, 5.2, 5.2);
      ctx.fillStyle = '#E9D5FF';
      ctx.beginPath();
      ctx.arc(hx, hz, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const rover of rovers) {
      const rx = rover.x * scale;
      const rz = rover.z * scale;

      ctx.beginPath();
      ctx.arc(rx, rz, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(rx, rz);
      ctx.lineTo(rx + Math.sin(rover.angle) * 6, rz + Math.cos(rover.angle) * 6);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-22, -44);
    ctx.lineTo(22, -44);
    ctx.closePath();
    const fovGrad = ctx.createLinearGradient(0, 0, 0, -44);
    fovGrad.addColorStop(0, 'rgba(167, 139, 250, 0.35)');
    fovGrad.addColorStop(1, 'rgba(167, 139, 250, 0.0)');
    ctx.fillStyle = fovGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#A78BFA';
    ctx.fill();
    ctx.strokeStyle = '#E9D5FF';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    ctx.save();
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const compassPts = [
      { label: 'N', angle: -yaw - Math.PI / 2, color: '#A78BFA' },
      { label: 'E', angle: -yaw, color: '#9F8FC7' },
      { label: 'S', angle: -yaw + Math.PI / 2, color: '#9F8FC7' },
      { label: 'W', angle: -yaw + Math.PI, color: '#9F8FC7' },
    ];

    compassPts.forEach((pt) => {
      const cx = centerX + Math.cos(pt.angle) * (radarRadius + 7);
      const cy = centerY + Math.sin(pt.angle) * (radarRadius + 7);
      ctx.fillStyle = pt.color;
      ctx.fillText(pt.label, cx, cy);
    });

    ctx.restore();
  }, [placedPods, cameraState, rovers, selectedPlacedPod]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onMinimapClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;

    const yaw = -cameraState.rotationY;
    const cos = Math.cos(-yaw);
    const sin = Math.sin(-yaw);
    const unrotatedX = x * cos - y * sin;
    const unrotatedZ = x * sin + y * cos;

    const radarRadius = canvas.width / 2 - 12;
    const scale = (radarRadius * 0.88) / 72;
    const gx = Math.round(unrotatedX / (6 * scale));
    const gz = Math.round(unrotatedZ / (6 * scale));

    onMinimapClick(gx, gz);
  };

  return (
    <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442] text-left">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#E9D5FF]">
            Base Map
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#09090F] text-[#9F8FC7] border border-[#2A2442]">
          Click to Focus
        </span>
      </div>

      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={168}
          height={168}
          onClick={handleCanvasClick}
          className="cursor-pointer rounded-full bg-[#09090F]"
          title="Click any building dot to center camera there"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#9F8FC7] mt-2 px-1">
        <span>Buildings: {placedPods.length}</span>
        {rovers.length > 0 && <span className="text-amber-400">Rovers: {rovers.length}</span>}
        {computeHelipadPlacements(placedPods).length > 0 ? (
          <span className="text-[#A78BFA]">Pads: {computeHelipadPlacements(placedPods).length}</span>
        ) : (
          <span>24×24 Grid</span>
        )}
      </div>
    </div>
  );
};
