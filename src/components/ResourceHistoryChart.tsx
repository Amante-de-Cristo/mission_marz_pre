import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Wind, Droplets, Zap, TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { DailySimulationLog, SimulationAnomaly } from '../types';
import { audioManager } from '../utils/audioManager';

type MetricKey = 'oxygen' | 'water' | 'power';
type ViewFilter = 'all' | MetricKey;

interface ResourceHistoryChartProps {
  logs: DailySimulationLog[];
  isProjected: boolean;
  isBaseCertified: boolean;
  missingEssentialCount: number;
  passed: boolean;
  daysSurviving: number;
  anomalies?: SimulationAnomaly[];
  failureDay?: number;
  hideStatusHeader?: boolean;
}

interface MetricConfig {
  key: MetricKey;
  title: string;
  shortLabel: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  prodColor: string;
  consColor: string;
  prodLabel: string;
  consLabel: string;
  getProd: (d: DailySimulationLog) => number;
  getCons: (d: DailySimulationLog) => number;
}

const METRICS: MetricConfig[] = [
  {
    key: 'oxygen',
    title: 'Oxygen Supply',
    shortLabel: 'Oxygen',
    unit: 'kg/d',
    icon: Wind,
    prodColor: '#A78BFA',
    consColor: '#fb7185',
    prodLabel: 'Made',
    consLabel: 'Used',
    getProd: (d) => d.o2ProductionKg,
    getCons: (d) => d.o2ConsumptionKg,
  },
  {
    key: 'water',
    title: 'Water Recycling',
    shortLabel: 'Water',
    unit: 'L/d',
    icon: Droplets,
    prodColor: '#38bdf8',
    consColor: '#f59e0b',
    prodLabel: 'Cleaned',
    consLabel: 'Used',
    getProd: (d) => d.waterProductionL,
    getCons: (d) => d.waterConsumptionL,
  },
  {
    key: 'power',
    title: 'Power Grid',
    shortLabel: 'Power',
    unit: 'kW',
    icon: Zap,
    prodColor: '#facc15',
    consColor: '#f43f5e',
    prodLabel: 'Generated',
    consLabel: 'Used',
    getProd: (d) => d.powerProductionKW,
    getCons: (d) => d.powerConsumptionKW,
  },
];

interface SingleTrendChartProps {
  logs: DailySimulationLog[];
  metric: MetricConfig;
  height: number;
  hoveredDay: number | null;
  onHoverDay: (day: number | null) => void;
  anomalies: SimulationAnomaly[];
  failureDay?: number;
}

const D3ResourceTrendChart: React.FC<SingleTrendChartProps> = ({
  logs,
  metric,
  height,
  hoveredDay,
  onHoverDay,
  anomalies,
  failureDay,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(360);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 14, right: 12, bottom: 22, left: 38 };
  const innerWidth = Math.max(100, width - margin.left - margin.right);
  const innerHeight = Math.max(64, height - margin.top - margin.bottom);

  const chartData = useMemo(() => {
    const maxVal = d3.max(logs, (d) => Math.max(metric.getProd(d), metric.getCons(d))) ?? 10;
    const yMax = maxVal > 0 ? maxVal * 1.18 : 10;
    const maxDay = Math.max(30, logs[logs.length - 1]?.day || 30);

    const xScale = d3.scaleLinear().domain([1, maxDay]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, yMax]).nice(4).range([innerHeight, 0]);

    const curveType = d3.curveCatmullRom.alpha(0.5);

    const prodLineGen = d3
      .line<DailySimulationLog>()
      .x((d) => xScale(d.day))
      .y((d) => yScale(metric.getProd(d)))
      .curve(curveType);

    const consLineGen = d3
      .line<DailySimulationLog>()
      .x((d) => xScale(d.day))
      .y((d) => yScale(metric.getCons(d)))
      .curve(curveType);

    const prodAreaGen = d3
      .area<DailySimulationLog>()
      .x((d) => xScale(d.day))
      .y0(innerHeight)
      .y1((d) => yScale(metric.getProd(d)))
      .curve(curveType);

    const consAreaGen = d3
      .area<DailySimulationLog>()
      .x((d) => xScale(d.day))
      .y0(innerHeight)
      .y1((d) => yScale(metric.getCons(d)))
      .curve(curveType);

    const yTicks = yScale.ticks(3);
    const xTicks = [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= maxDay);

    const avgProd = d3.mean(logs, metric.getProd) ?? 0;
    const avgCons = d3.mean(logs, metric.getCons) ?? 0;

    return {
      xScale,
      yScale,
      prodPath: prodLineGen(logs) || '',
      consPath: consLineGen(logs) || '',
      prodAreaPath: prodAreaGen(logs) || '',
      consAreaPath: consAreaGen(logs) || '',
      yTicks,
      xTicks,
      avgProd,
      avgCons,
    };
  }, [logs, metric, innerWidth, innerHeight]);

  const bisectDay = useMemo(
    () => d3.bisector<DailySimulationLog, number>((d) => d.day).center,
    []
  );

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (logs.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const targetDay = chartData.xScale.invert(relX);
    const idx = bisectDay(logs, targetDay);
    const clamped = logs[Math.max(0, Math.min(logs.length - 1, idx))];
    if (clamped) onHoverDay(clamped.day);
  };

  const activePoint = useMemo(() => {
    if (hoveredDay == null || logs.length === 0) return null;
    return logs.find((l) => l.day === hoveredDay) || logs[logs.length - 1];
  }, [hoveredDay, logs]);

  const relevantAnomalies = useMemo(() => {
    return anomalies.filter((a) => a.metric === 'all' || a.metric === metric.key);
  }, [anomalies, metric.key]);

  const stormStartX = chartData.xScale(14);
  const stormEndX = chartData.xScale(16);
  const showStormBand = logs.some((l) => l.day >= 14);

  const failureLog = failureDay ? logs.find((l) => l.day === failureDay) : undefined;

  const Icon = metric.icon;
  const prodGradId = `prod-grad-${metric.key}`;
  const consGradId = `cons-grad-${metric.key}`;

  const activeProd = activePoint ? metric.getProd(activePoint) : chartData.avgProd;
  const activeCons = activePoint ? metric.getCons(activePoint) : chartData.avgCons;
  const activeNet = Math.round((activeProd - activeCons) * 10) / 10;

  return (
    <div className="p-3 rounded-xl bg-[#151324] border border-[#2A2442]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${metric.prodColor}22`,
              border: `1px solid ${metric.prodColor}44`,
            }}
          >
            <Icon className="w-3 h-3" />
          </span>
          <h4 className="text-[11px] font-bold text-[#E9D5FF] uppercase tracking-wide truncate">
            {metric.title}
          </h4>
        </div>

        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
            activeNet >= 0
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
              : 'bg-rose-950 text-rose-300 border border-rose-700/50'
          }`}
        >
          {activeNet >= 0 ? `+${activeNet.toFixed(1)}` : activeNet.toFixed(1)} {metric.unit}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] mb-1.5 px-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center gap-1 text-[#C4B5FD] whitespace-nowrap">
            <span
              className="w-2.5 h-0.5 rounded-full inline-block"
              style={{ backgroundColor: metric.prodColor }}
            />
            <span>{metric.prodLabel}:</span>
            <span className="font-bold" style={{ color: metric.prodColor }}>
              {activeProd.toFixed(1)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[#C4B5FD] whitespace-nowrap">
            <span
              className="w-2.5 h-0.5 rounded-full inline-block"
              style={{ backgroundColor: metric.consColor }}
            />
            <span>{metric.consLabel}:</span>
            <span className="font-bold" style={{ color: metric.consColor }}>
              {activeCons.toFixed(1)}
            </span>
          </span>
        </div>

        <span className="text-[10px] text-[#9F8FC7] whitespace-nowrap">
          {activePoint ? `Day ${activePoint.day}` : `Days 1–${logs[logs.length - 1]?.day || 30}`}
        </span>
      </div>

      <div ref={containerRef} className="w-full relative select-none">
        <svg width={width} height={height} className="overflow-visible block">
          <defs>
            <linearGradient id={prodGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.prodColor} stopOpacity={0.34} />
              <stop offset="100%" stopColor={metric.prodColor} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={consGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.consColor} stopOpacity={0.22} />
              <stop offset="100%" stopColor={metric.consColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {showStormBand && (
              <g>
                <rect
                  x={stormStartX}
                  y={0}
                  width={Math.max(4, stormEndX - stormStartX)}
                  height={innerHeight}
                  fill="#8B5CF6"
                  fillOpacity={0.14}
                />
                <text
                  x={(stormStartX + stormEndX) / 2}
                  y={8}
                  textAnchor="middle"
                  className="fill-[#C4B5FD] text-[8px] font-semibold"
                >
                  Storm
                </text>
              </g>
            )}

            {chartData.yTicks.map((tick) => {
              const y = chartData.yScale(tick);
              return (
                <g key={tick} transform={`translate(0, ${y})`}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={0}
                    y2={0}
                    stroke="#35285C"
                    strokeOpacity={0.5}
                    strokeDasharray="2,3"
                  />
                  <text x={-6} y={3} textAnchor="end" className="fill-[#9F8FC7] text-[9px]">
                    {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
                  </text>
                </g>
              );
            })}

            <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="#35285C" />
            {chartData.xTicks.map((dayTick) => {
              const x = chartData.xScale(dayTick);
              return (
                <g key={dayTick} transform={`translate(${x}, ${innerHeight})`}>
                  <line y1={0} y2={4} stroke="#5B2C98" />
                  <text y={14} textAnchor="middle" className="fill-[#9F8FC7] text-[9px]">
                    {dayTick}
                  </text>
                </g>
              );
            })}

            <path d={chartData.prodAreaPath} fill={`url(#${prodGradId})`} />
            <path d={chartData.consAreaPath} fill={`url(#${consGradId})`} />

            <path
              d={chartData.prodPath}
              fill="none"
              stroke={metric.prodColor}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <path
              d={chartData.consPath}
              fill="none"
              stroke={metric.consColor}
              strokeWidth={1.8}
              strokeDasharray="4,2.5"
              strokeLinecap="round"
            />

            {/* Highlighted Anomaly Markers (Event Triggers & Drop-Offs) */}
            {relevantAnomalies.map((anom, idx) => {
              const anomLog = logs.find((l) => l.day === anom.day);
              if (!anomLog) return null;
              const ax = chartData.xScale(anom.day);
              const ay = chartData.yScale(metric.getProd(anomLog));
              const color =
                anom.severity === 'critical'
                  ? '#f43f5e'
                  : anom.severity === 'warning'
                  ? '#f59e0b'
                  : '#38bdf8';

              return (
                <g key={`${anom.day}-${idx}`}>
                  <line
                    x1={ax}
                    x2={ax}
                    y1={0}
                    y2={innerHeight}
                    stroke={color}
                    strokeOpacity={anom.severity === 'critical' ? 0.65 : 0.32}
                    strokeDasharray={anom.severity === 'critical' ? '2,2' : '3,3'}
                  />
                  <circle
                    cx={ax}
                    cy={ay}
                    r={anom.severity === 'critical' ? 4.5 : 3.2}
                    fill={color}
                    stroke="#09090F"
                    strokeWidth={1.4}
                  />
                </g>
              );
            })}

            {/* Exact Failure Stop Line & Offline Region */}
            {failureDay && failureLog && (
              <g>
                {failureDay < 30 && (
                  <rect
                    x={chartData.xScale(failureDay)}
                    y={0}
                    width={Math.max(0, innerWidth - chartData.xScale(failureDay))}
                    height={innerHeight}
                    fill="#f43f5e"
                    fillOpacity={0.07}
                  />
                )}
                <line
                  x1={chartData.xScale(failureDay)}
                  x2={chartData.xScale(failureDay)}
                  y1={0}
                  y2={innerHeight}
                  stroke="#fb7185"
                  strokeWidth={1.6}
                />
                <text
                  x={Math.min(innerWidth - 26, Math.max(26, chartData.xScale(failureDay)))}
                  y={10}
                  textAnchor="middle"
                  className="fill-rose-400 text-[8px] font-bold"
                >
                  Stop D{failureDay}
                </text>
              </g>
            )}

            {activePoint && (
              <g>
                <line
                  x1={chartData.xScale(activePoint.day)}
                  x2={chartData.xScale(activePoint.day)}
                  y1={0}
                  y2={innerHeight}
                  stroke="#E9D5FF"
                  strokeOpacity={0.38}
                  strokeDasharray="3,3"
                />
                <circle
                  cx={chartData.xScale(activePoint.day)}
                  cy={chartData.yScale(metric.getProd(activePoint))}
                  r={3.5}
                  fill={metric.prodColor}
                  stroke="#09090F"
                  strokeWidth={1.5}
                />
                <circle
                  cx={chartData.xScale(activePoint.day)}
                  cy={chartData.yScale(metric.getCons(activePoint))}
                  r={3.5}
                  fill={metric.consColor}
                  stroke="#09090F"
                  strokeWidth={1.5}
                />
              </g>
            )}

            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              className="cursor-crosshair"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => onHoverDay(null)}
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

export const ResourceHistoryChart: React.FC<ResourceHistoryChartProps> = ({
  logs,
  isProjected,
  isBaseCertified,
  missingEssentialCount,
  passed,
  daysSurviving,
  anomalies = [],
  failureDay,
  hideStatusHeader = false,
}) => {
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const visibleMetrics = useMemo(() => {
    if (filter === 'all') return METRICS;
    return METRICS.filter((m) => m.key === filter);
  }, [filter]);

  const hoveredLog = useMemo(() => {
    if (hoveredDay == null) return null;
    return logs.find((l) => l.day === hoveredDay) || null;
  }, [hoveredDay, logs]);

  const chartHeight = filter === 'all' ? 132 : 210;

  return (
    <div className="space-y-2.5">
      <div className="p-2.5 rounded-xl bg-[#151324] border border-[#2A2442] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span className="text-[11px] font-bold text-[#E9D5FF] uppercase tracking-wide">
              Resource Performance Curves
            </span>
          </div>

          {!hideStatusHeader &&
            (!isProjected ? (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                  passed
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                    : 'bg-rose-950 text-rose-300 border-rose-700/50'
                }`}
              >
                {passed ? (
                  <CheckCircle2 className="w-2.5 h-2.5" />
                ) : (
                  <AlertTriangle className="w-2.5 h-2.5" />
                )}
                <span>{passed ? '30-Day Run Passed' : `Stopped Day ${daysSurviving}`}</span>
              </span>
            ) : (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                  isBaseCertified
                    ? 'bg-[#1D1736] text-[#C4B5FD] border-[#5B2C98]'
                    : 'bg-amber-950 text-amber-300 border-amber-700/50'
                }`}
              >
                <Info className="w-2.5 h-2.5" />
                <span>
                  {isBaseCertified ? '30-Day Forecast' : `Draft (${missingEssentialCount} Needed)`}
                </span>
              </span>
            ))}
        </div>

        <div className="grid grid-cols-4 gap-1 bg-[#09090F] p-1 rounded-lg border border-[#2A2442]">
          <button
            type="button"
            onClick={() => {
              audioManager.playClick();
              setFilter('all');
            }}
            className={`py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-[#5B2C98] text-white' : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
            }`}
          >
            All (3)
          </button>
          {METRICS.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => {
                audioManager.playClick();
                setFilter(m.key);
              }}
              className={`py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                filter === m.key ? 'bg-[#5B2C98] text-white' : 'text-[#9F8FC7] hover:text-[#E9D5FF]'
              }`}
            >
              {m.shortLabel}
            </button>
          ))}
        </div>

        {anomalies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {anomalies.map((a, idx) => (
              <button
                type="button"
                key={`${a.day}-${idx}`}
                onMouseEnter={() => setHoveredDay(a.day)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => setHoveredDay(a.day)}
                className={`text-[10px] px-2 py-0.5 rounded border font-semibold cursor-pointer ${
                  a.severity === 'critical'
                    ? 'bg-rose-950 border-rose-500/60 text-rose-200'
                    : a.severity === 'warning'
                    ? 'bg-amber-950 border-amber-500/50 text-amber-200'
                    : 'bg-[#09090F] border-[#35285C] text-sky-300'
                }`}
              >
                Day {a.day}: {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {hoveredLog ? (
        <div className="px-3 py-2 rounded-xl bg-[#1D1736] border border-[#5B2C98] text-[11px]">
          <div className="flex items-center justify-between mb-0.5">
            <span
              className={`font-bold ${
                hoveredLog.type === 'hazard'
                  ? 'text-rose-400'
                  : hoveredLog.type === 'success'
                  ? 'text-emerald-400'
                  : hoveredLog.type === 'event'
                  ? 'text-amber-300'
                  : 'text-[#E9D5FF]'
              }`}
            >
              {hoveredLog.title}
            </span>
            <span className="text-[#9F8FC7]">{hoveredLog.temperatureC}°C</span>
          </div>
          <p className="text-[#C4B5FD] text-[10px] leading-snug">{hoveredLog.description}</p>
        </div>
      ) : (
        <div className="px-3 py-1.5 rounded-xl bg-[#0D0D16] border border-[#2A2442] text-[10px] text-[#9F8FC7] flex items-center justify-between">
          <span>Hover charts or event badges to inspect exact daily values</span>
          <span className="text-[#A78BFA]">Solid: Made • Dashed: Used</span>
        </div>
      )}

      <div className={`grid gap-2.5 ${filter === 'all' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
        {visibleMetrics.map((metric) => (
          <D3ResourceTrendChart
            key={metric.key}
            logs={logs}
            metric={metric}
            height={chartHeight}
            hoveredDay={hoveredDay}
            onHoverDay={setHoveredDay}
            anomalies={anomalies}
            failureDay={failureDay}
          />
        ))}
      </div>
    </div>
  );
};
