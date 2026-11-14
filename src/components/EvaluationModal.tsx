import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  XCircle,
  Award,
  Zap,
  Wind,
  Droplets,
  Apple,
  Shield,
  Smile,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { SimulationResult, MissionConfig, LandingSite } from '../types';
import { ResourceHistoryChart } from './ResourceHistoryChart';
import { audioManager } from '../utils/audioManager';

interface EvaluationModalProps {
  result: SimulationResult;
  config: MissionConfig;
  landingSite: LandingSite;
  onClose: () => void;
  onReset: () => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  result,
  config,
  landingSite,
  onClose,
  onReset,
}) => {
  useEffect(() => {
    if (result.passed) {
      audioManager.playVictory();
      confetti({
        particleCount: 110,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#5B2C98', '#8B5CF6', '#E9D5FF', '#22c55e'],
      });
    } else {
      audioManager.playError();
    }
  }, [result.passed]);

  const b = result.systemBreakdown;
  const summary = result.problemSummary;

  const systemChips = [
    { label: 'Power', val: b.powerReliability, icon: Zap, color: 'text-amber-400' },
    { label: 'Oxygen', val: b.oxygenStability, icon: Wind, color: 'text-[#A78BFA]' },
    { label: 'Water', val: b.waterReserve, icon: Droplets, color: 'text-sky-400' },
    { label: 'Food', val: b.foodSustainability, icon: Apple, color: 'text-emerald-400' },
    { label: 'Safety', val: b.lifeSupportIntegrity, icon: Shield, color: 'text-[#8B5CF6]' },
    { label: 'Crew Mood', val: b.crewMorale, icon: Smile, color: 'text-pink-400' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#09090F]/92"
      data-testid="evaluation-modal"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#10101A] border border-[#35285C] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Summary */}
        <div
          className={`p-5 sm:p-6 border-b border-[#2A2442] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            result.passed ? 'bg-[#151324]' : 'bg-[#1E101A]'
          }`}
        >
          <div className="text-left">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#09090F] border border-[#2A2442] text-xs font-bold">
                {result.passed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 uppercase tracking-wider">Mission Passed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-300 uppercase tracking-wider">Mission Failed</span>
                  </>
                )}
              </div>

              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#09090F] border border-[#2A2442] text-[#C4B5FD]">
                {landingSite.name} • {config.crewSize} Astronauts
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-[#E9D5FF]">
              {result.passed
                ? '30-Day Mars Mission Complete'
                : `Base Stopped on Day ${result.daysSurviving} of 30`}
            </h2>

            <p className="text-xs text-[#C4B5FD] mt-1 max-w-xl leading-relaxed">
              {result.passed
                ? 'Your base kept the crew supplied with power, oxygen, water, and food through dust storms and cold Martian nights.'
                : 'A critical system failed before Day 30. Review the Problem Summary Detail and daily resource curves below.'}
            </p>
          </div>

          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-[#09090F] border border-[#2A2442] shrink-0 self-start sm:self-center">
            <Award className={`w-7 h-7 ${result.passed ? 'text-emerald-400' : 'text-rose-400'}`} />
            <div className="text-left">
              <div className="text-[10px] text-[#9F8FC7] uppercase">Base Score</div>
              <div className="text-2xl font-bold text-[#E9D5FF] leading-tight">
                {result.habitabilityScore}
                <span className="text-sm font-normal text-[#9F8FC7]">/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Analytics Body */}
        <div className="flex-1 min-h-0 p-5 sm:p-6 overflow-y-auto space-y-5 text-left">
          {/* Unclipped Problem Summary Detail Box */}
          {(!result.passed || summary || result.criticalFailures.length > 0) && (
            <div
              data-testid="problem-summary-card"
              className="p-4 rounded-xl bg-[#1F121D] border border-rose-500/60 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    Problem Summary Detail
                    {summary?.title ? ` — ${summary.title}` : ''}
                  </span>
                </div>
                {!result.passed && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-rose-950 text-rose-200 border border-rose-500/40 font-bold shrink-0">
                    Stopped Day {result.daysSurviving}
                  </span>
                )}
              </div>

              {summary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-[#09090F] border border-[#2A2442]">
                    <div className="text-[10px] font-bold uppercase text-rose-400 mb-1">
                      What Happened
                    </div>
                    <p className="text-[#E9D5FF] leading-relaxed">{summary.issue}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#09090F] border border-[#2A2442]">
                    <div className="text-[10px] font-bold uppercase text-amber-300 mb-1">
                      Root Cause
                    </div>
                    <p className="text-[#C4B5FD] leading-relaxed">{summary.rootCause}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#09090F] border border-[#2A2442]">
                    <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      <span>How to Fix It</span>
                    </div>
                    <p className="text-[#E9D5FF] leading-relaxed">{summary.fix}</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-1.5 text-xs text-rose-200">
                  {result.criticalFailures.map((fail, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{fail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Compact System Ratings Chips */}
          <div>
            <div className="text-xs font-bold text-[#C4B5FD] uppercase tracking-wider mb-2">
              System Health Summary
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {systemChips.map((chip) => {
                const Icon = chip.icon;
                return (
                  <div
                    key={chip.label}
                    className="p-2.5 rounded-xl bg-[#151324] border border-[#2A2442] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 text-[#9F8FC7] text-[11px]">
                      <Icon className={`w-3.5 h-3.5 ${chip.color}`} />
                      <span>{chip.label}</span>
                    </span>
                    <span
                      className={`font-bold ${
                        chip.val >= 70
                          ? 'text-emerald-300'
                          : chip.val >= 35
                          ? 'text-amber-300'
                          : 'text-rose-400'
                      }`}
                    >
                      {chip.val}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 30-Day Resource Performance Graphs (Centerpiece Analytics) */}
          {result.logs.length > 0 && (
            <div data-testid="evaluation-charts">
              <ResourceHistoryChart
                logs={result.logs}
                isProjected={false}
                isBaseCertified={true}
                missingEssentialCount={0}
                passed={result.passed}
                daysSurviving={result.daysSurviving}
                anomalies={result.anomalies || []}
                failureDay={result.passed ? undefined : result.daysSurviving}
                hideStatusHeader={true}
              />
            </div>
          )}

          {/* Recommended Next Steps */}
          <div className="p-4 rounded-xl bg-[#151324] border border-[#2A2442]">
            <div className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider mb-2">
              Recommended Next Steps
            </div>
            <ul className="space-y-1.5 text-xs text-[#E9D5FF]">
              {result.actionableSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-[#2A2442] bg-[#151324] shrink-0 flex items-center justify-between">
          <button
            onClick={() => {
              audioManager.playClick();
              onReset();
            }}
            data-testid="evaluation-reset-btn"
            className="px-4 py-2 rounded-lg bg-[#09090F] hover:bg-[#1E1A33] text-[#E9D5FF] border border-[#2A2442] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Starter Base</span>
          </button>

          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            data-testid="evaluation-keep-building-btn"
            className="px-5 py-2 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>Keep Building</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
