import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ThreeCanvas } from './components/ThreeCanvas';
import { HeaderNav } from './components/HeaderNav';
import { PodCatalogSidebar } from './components/PodCatalogSidebar';
import { TelemetryDrawer } from './components/TelemetryDrawer';
import { WelcomeModal } from './components/WelcomeModal';
import { MarsLandingSelector } from './components/MarsLandingSelector';
import { TutorialModal } from './components/TutorialModal';
import { MissionSettingsModal } from './components/MissionSettingsModal';
import { PodInspectorModal } from './components/PodInspectorModal';
import { PreSimulationSequence } from './components/PreSimulationSequence';
import { SimulationOverlay } from './components/SimulationOverlay';
import { EvaluationModal } from './components/EvaluationModal';
import { FooterBar } from './components/FooterBar';
import {
  PlacedPod,
  PodDefinition,
  MissionConfig,
  SimulationResult,
  DailySimulationLog,
  SimulationPhase,
  CameraState,
  RoverState,
} from './types';
import { getStarterBaseForSite } from './utils/podCatalog';
import { LANDING_SITE_MAP, DEFAULT_LANDING_SITE } from './utils/landingSites';
import {
  calculateTelemetry,
  canLaunchSimulation,
  generateBaseAdvisorWarnings,
  run30DaySimulation,
  isTileReservedForHelipad,
  rebalanceBaseForBudget,
} from './utils/marsSimulation';
import { audioManager } from './utils/audioManager';

const DEFAULT_CONFIG: MissionConfig = {
  isInfiniteBudget: true,
  constructionBudget: 25000000000,
  launchBudget: 15000000000,
  costPerKg: 15000,
  crewSize: 4,
  landingSiteId: DEFAULT_LANDING_SITE.id,
};

type ActiveView = 'welcome' | 'site_select' | 'builder';
type PendingWorkflow = 'preset' | 'scratch' | 'tutorial' | 'switch_site';

export default function App() {
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_CONFIG);
  const [placedPods, setPlacedPods] = useState<PlacedPod[]>([]);
  const [selectedCatalogPod, setSelectedCatalogPod] = useState<PodDefinition | null>(null);
  const [selectedPlacedPod, setSelectedPlacedPod] = useState<PlacedPod | null>(null);
  const [placementRotation, setPlacementRotation] = useState<number>(0);

  const [activeView, setActiveView] = useState<ActiveView>('welcome');
  const [pendingWorkflow, setPendingWorkflow] = useState<PendingWorkflow>('preset');
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState<boolean>(false);
  const [budgetAlert, setBudgetAlert] = useState<string | null>(null);

  const [simulationPhase, setSimulationPhase] = useState<SimulationPhase>('idle');
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [currentSimulationDay, setCurrentSimulationDay] = useState<number>(1);
  const [currentSimulationLog, setCurrentSimulationLog] = useState<DailySimulationLog | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>({
    x: 0,
    z: 48,
    rotationY: 0,
    zoom: 60,
  });
  const [rovers, setRovers] = useState<RoverState[]>([]);
  const [targetFocusCoord, setTargetFocusCoord] = useState<{ gridX: number; gridZ: number } | null>(
    null
  );

  const simRafRef = useRef<number | null>(null);
  const activeSimResultRef = useRef<SimulationResult | null>(null);

  const activeLandingSite = useMemo(
    () => LANDING_SITE_MAP.get(config.landingSiteId) || DEFAULT_LANDING_SITE,
    [config.landingSiteId]
  );

  const loadStarterBaseForSite = useCallback(
    (siteId: string, targetConfig: MissionConfig, playSound: boolean = true) => {
      const template = getStarterBaseForSite(siteId, targetConfig.crewSize);
      const rawPods: PlacedPod[] = template.map((p, index) => ({
        instanceId: `starter_${siteId}_${p.podId}_${index}`,
        podId: p.podId,
        gridX: p.gridX,
        gridZ: p.gridZ,
        rotation: p.rotation,
        placedAt: Date.now() + index,
      }));

      const rebalanced = rebalanceBaseForBudget(rawPods, targetConfig);
      setPlacedPods(rebalanced.adjustedPods);
      setSelectedCatalogPod(null);
      setSelectedPlacedPod(null);
      setSimulationResult(null);
      activeSimResultRef.current = null;
      setBudgetAlert(rebalanced.wasRebalanced ? rebalanced.warningMessage : null);

      if (playSound) {
        if (rebalanced.wasRebalanced) {
          audioManager.playError();
        } else {
          audioManager.playPlacePod();
        }
      }
    },
    []
  );

  // Support ?autostart=1 shortcut straight into Base Builder
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('autostart') === '1') {
        setActiveView('builder');
        loadStarterBaseForSite(DEFAULT_CONFIG.landingSiteId, DEFAULT_CONFIG, false);
      }
    }
  }, [loadStarterBaseForSite]);

  // Cleanup active simulation RAF on unmount
  useEffect(() => {
    return () => {
      if (simRafRef.current !== null) {
        cancelAnimationFrame(simRafRef.current);
      }
    };
  }, []);

  const telemetry = useMemo(() => {
    return calculateTelemetry(placedPods, config);
  }, [placedPods, config]);

  const advisorWarnings = useMemo(() => {
    return generateBaseAdvisorWarnings(placedPods, telemetry, config);
  }, [placedPods, telemetry, config]);

  const launchCheck = useMemo(() => {
    return canLaunchSimulation(placedPods, config);
  }, [placedPods, config]);

  const handleClearBase = () => {
    setPlacedPods([]);
    setSelectedCatalogPod(null);
    setSelectedPlacedPod(null);
    setSimulationResult(null);
    setBudgetAlert(null);
    activeSimResultRef.current = null;
    audioManager.playDemolish();
  };

  const handlePlacePod = (gridX: number, gridZ: number, rotation: number) => {
    if (!selectedCatalogPod) return;
    const isOccupied = placedPods.some((p) => p.gridX === gridX && p.gridZ === gridZ);
    const isHelipadReserved = isTileReservedForHelipad(gridX, gridZ, placedPods);
    if (isOccupied || isHelipadReserved) {
      audioManager.playError();
      return;
    }

    const newPlaced: PlacedPod = {
      instanceId: `pod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      podId: selectedCatalogPod.id,
      gridX,
      gridZ,
      rotation: rotation ?? placementRotation,
      placedAt: Date.now(),
    };

    setPlacedPods((prev) => [...prev, newPlaced]);
    setSimulationResult(null);
    activeSimResultRef.current = null;
    audioManager.playPlacePod();
  };

  const handleRotateGhost = () => {
    setPlacementRotation((prev) => (prev + 90) % 360);
  };

  const handleRotatePlacedPod = (instanceId: string) => {
    setPlacedPods((prev) =>
      prev.map((p) =>
        p.instanceId === instanceId ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
    if (selectedPlacedPod?.instanceId === instanceId) {
      setSelectedPlacedPod((prev) =>
        prev ? { ...prev, rotation: (prev.rotation + 90) % 360 } : null
      );
    }
  };

  const handleDemolishPlacedPod = (instanceId: string) => {
    setPlacedPods((prev) => prev.filter((p) => p.instanceId !== instanceId));
    setSimulationResult(null);
    activeSimResultRef.current = null;
    if (selectedPlacedPod?.instanceId === instanceId) {
      setSelectedPlacedPod(null);
    }
  };

  const handleApplyLiveSettings = (newConfig: MissionConfig) => {
    const rebalance = rebalanceBaseForBudget(placedPods, newConfig);
    setConfig(newConfig);
    setSimulationResult(null);
    activeSimResultRef.current = null;

    if (rebalance.wasRebalanced) {
      setPlacedPods(rebalance.adjustedPods);
      if (
        selectedPlacedPod &&
        !rebalance.adjustedPods.some((p) => p.instanceId === selectedPlacedPod.instanceId)
      ) {
        setSelectedPlacedPod(null);
      }
      setBudgetAlert(rebalance.warningMessage);
      audioManager.playError();
    } else {
      setBudgetAlert(null);
    }
  };

  const handleStartSimulationSequence = () => {
    if (!launchCheck.canLaunch || simulationPhase !== 'idle') return;

    audioManager.playClick();
    setSelectedCatalogPod(null);
    setSelectedPlacedPod(null);

    const fullResult = run30DaySimulation(placedPods, config);
    activeSimResultRef.current = fullResult;
    setSimulationResult(fullResult);
    setSimulationPhase('transit');
  };

  // Wall-clock RAF 30-day operational loop that stops IMMEDIATELY on failure day
  const startMainOperationalLoop = useCallback(() => {
    if (simRafRef.current !== null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }

    const fullResult =
      activeSimResultRef.current || simulationResult || run30DaySimulation(placedPods, config);
    activeSimResultRef.current = fullResult;
    setSimulationResult(fullResult);

    const maxSimDay = fullResult.passed ? 30 : Math.max(1, fullResult.daysSurviving);
    const totalSimDurationMs = Math.max(2500, (maxSimDay / 30) * 14000);
    const startTime = performance.now();
    let lastSoundDay = 0;

    setSimulationPhase('operational');
    setSimulationProgress(0);
    setCurrentSimulationDay(1);
    setCurrentSimulationLog(fullResult.logs[0] || null);

    const stepLoop = (now: number) => {
      const elapsed = now - startTime;
      const timeFrac = Math.max(0, Math.min(1, elapsed / totalSimDurationMs));
      const dayFloat = 1 + timeFrac * (maxSimDay - 1);
      const day = Math.min(maxSimDay, Math.floor(dayFloat));
      const barProgress = fullResult.passed
        ? timeFrac
        : Math.min(maxSimDay / 30, timeFrac * (maxSimDay / 30));

      setSimulationProgress(barProgress);
      setCurrentSimulationDay(day);
      setCurrentSimulationLog(
        fullResult.logs.find((l) => l.day === day) ||
          fullResult.logs[fullResult.logs.length - 1] ||
          null
      );

      if (day !== lastSoundDay) {
        lastSoundDay = day;
        audioManager.playDayTick();
      }

      if (elapsed >= totalSimDurationMs) {
        simRafRef.current = null;
        setSimulationProgress(fullResult.passed ? 1 : maxSimDay / 30);
        setCurrentSimulationDay(maxSimDay);
        setSimulationPhase('evaluation');
        setShowEvaluationModal(true);
        return;
      }

      simRafRef.current = requestAnimationFrame(stepLoop);
    };

    simRafRef.current = requestAnimationFrame(stepLoop);
  }, [placedPods, config, simulationResult]);

  const handleSkipToEvaluation = () => {
    if (simRafRef.current !== null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }
    const res =
      activeSimResultRef.current || simulationResult || run30DaySimulation(placedPods, config);
    activeSimResultRef.current = res;
    setSimulationResult(res);

    const maxSimDay = res.passed ? 30 : Math.max(1, res.daysSurviving);
    setSimulationProgress(res.passed ? 1 : maxSimDay / 30);
    setCurrentSimulationDay(maxSimDay);
    setSimulationPhase('evaluation');
    setShowEvaluationModal(true);
  };

  // Home Screen -> Interactive 3D Mars Landing Site Selector
  const handleWelcomeConfirm = (
    newConfig: MissionConfig,
    mode: 'preset' | 'scratch' | 'tutorial'
  ) => {
    setConfig(newConfig);
    setPendingWorkflow(mode);
    setActiveView('site_select');
    audioManager.playMusic();
  };

  // Confirm landing site -> Enter Base Builder with Site-Matched Starter Base
  const handleConfirmLandingSite = (siteId: string) => {
    const nextConfig: MissionConfig = { ...config, landingSiteId: siteId };
    setConfig(nextConfig);
    setSimulationResult(null);
    activeSimResultRef.current = null;

    if (pendingWorkflow === 'tutorial') {
      loadStarterBaseForSite(siteId, nextConfig, true);
      setShowTutorialModal(true);
    } else if (pendingWorkflow === 'preset') {
      loadStarterBaseForSite(siteId, nextConfig, true);
    } else if (pendingWorkflow === 'scratch') {
      handleClearBase();
    }
    setActiveView('builder');
  };

  const handleMinimapClick = (gridX: number, gridZ: number) => {
    setTargetFocusCoord({ gridX, gridZ });
    const pod = placedPods.find((p) => p.gridX === gridX && p.gridZ === gridZ);
    if (pod) setSelectedPlacedPod(pod);
  };

  const isSimulating = simulationPhase === 'operational';
  const isPreSimulating = simulationPhase === 'transit' || simulationPhase === 'construction';

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#09090F] text-[#E9D5FF] font-sans select-none">
      {/* Screen 1: Home Screen */}
      {activeView === 'welcome' && (
        <WelcomeModal
          config={config}
          onConfirm={handleWelcomeConfirm}
          onClose={() => setActiveView('builder')}
          canClose={placedPods.length > 0}
        />
      )}

      {/* Screen 2: Interactive 3D Mars Globe Landing Site Selector */}
      {activeView === 'site_select' && (
        <MarsLandingSelector
          selectedSiteId={config.landingSiteId}
          onSelectSite={(siteId) => setConfig((prev) => ({ ...prev, landingSiteId: siteId }))}
          onConfirmSite={handleConfirmLandingSite}
          onBack={() =>
            setActiveView(pendingWorkflow === 'switch_site' ? 'builder' : 'welcome')
          }
        />
      )}

      {/* Screen 3: Mars Base Builder */}
      {activeView === 'builder' && (
        <>
          <HeaderNav
            telemetry={telemetry}
            canLaunch={launchCheck.canLaunch}
            missingEssentialCount={launchCheck.missingCount}
            missingPodNames={launchCheck.missingPodNames}
            unmetRecommendations={launchCheck.unmetRecommendations}
            totalRecommendedCount={launchCheck.totalRecommendedCount}
            metRecommendedCount={launchCheck.metRecommendedCount}
            isSimulating={isSimulating || isPreSimulating}
            landingSite={activeLandingSite}
            crewSize={config.crewSize}
            onStartSimulation={handleStartSimulationSequence}
            onOpenTutorial={() => setShowTutorialModal(true)}
            onOpenConfig={() => setShowSettingsModal(true)}
            onOpenHome={() => setActiveView('welcome')}
            onOpenSiteSelector={() => {
              setPendingWorkflow('switch_site');
              setActiveView('site_select');
            }}
            onLoadPreset={() => loadStarterBaseForSite(config.landingSiteId, config, true)}
            onClearBase={handleClearBase}
          />

          <div className="flex-1 min-h-0 flex gap-3 p-3">
            {!isSimulating && !isPreSimulating && (
              <PodCatalogSidebar
                selectedCatalogPod={selectedCatalogPod}
                onSelectCatalogPod={(pod) => {
                  setSelectedCatalogPod(pod);
                  if (pod) setSelectedPlacedPod(null);
                }}
                placedPods={placedPods}
                landingSite={activeLandingSite}
                telemetry={telemetry}
              />
            )}

            <main className="flex-1 min-w-0 h-full relative">
              {budgetAlert && (
                <div
                  data-testid="budget-rebalance-alert"
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-xl px-3.5 py-2.5 rounded-xl bg-[#1F121D] border border-amber-500/70 shadow-xl flex items-start justify-between gap-3 text-left"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-[#E9D5FF] leading-snug">{budgetAlert}</span>
                  </div>
                  <button
                    onClick={() => setBudgetAlert(null)}
                    className="p-0.5 text-[#9F8FC7] hover:text-white shrink-0 cursor-pointer"
                    aria-label="Dismiss Budget Warning"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <ThreeCanvas
                placedPods={placedPods}
                selectedCatalogPod={selectedCatalogPod}
                selectedPlacedPod={selectedPlacedPod}
                onPlacePod={handlePlacePod}
                onSelectPlacedPod={(pod) => setSelectedPlacedPod(pod)}
                onCancelPlacement={() => setSelectedCatalogPod(null)}
                isSimulating={isSimulating}
                simulationProgress={simulationProgress}
                currentSimulationDay={currentSimulationDay}
                currentSimulationLog={currentSimulationLog}
                telemetry={telemetry}
                crewSize={config.crewSize}
                landingSite={activeLandingSite}
                onCameraUpdate={setCameraState}
                onRoversUpdate={setRovers}
                targetFocusCoord={targetFocusCoord}
                externalRotation={placementRotation}
                onRotateGhost={handleRotateGhost}
              />
            </main>

            {!isSimulating && !isPreSimulating && (
              <TelemetryDrawer
                telemetry={telemetry}
                warnings={advisorWarnings}
                placedPods={placedPods}
                cameraState={cameraState}
                rovers={rovers}
                selectedPlacedPod={selectedPlacedPod}
                onMinimapClick={handleMinimapClick}
                config={config}
                landingSite={activeLandingSite}
              />
            )}
          </div>
        </>
      )}

      {/* Persistent App Footer visible across Home, Site Selector, and Base Builder */}
      <FooterBar />

      {/* Stage 1 & 2: Solar System Transit & Base Assembly */}
      {isPreSimulating && (
        <PreSimulationSequence
          onComplete={startMainOperationalLoop}
          onSkip={startMainOperationalLoop}
          transitDays={210}
          constructionDays={14}
          placedPods={placedPods}
          landingSite={activeLandingSite}
          crewSize={config.crewSize}
        />
      )}

      {/* Stage 3: 30-Day Simulation Progress HUD */}
      {isSimulating && (
        <SimulationOverlay
          currentDay={currentSimulationDay}
          totalDays={30}
          progress={simulationProgress}
          currentLog={currentSimulationLog}
          onSkip={handleSkipToEvaluation}
        />
      )}

      {/* Building Inspector Modal */}
      {selectedPlacedPod && activeView === 'builder' && !isSimulating && !isPreSimulating && (
        <PodInspectorModal
          placedPod={selectedPlacedPod}
          onClose={() => setSelectedPlacedPod(null)}
          onRotatePod={handleRotatePlacedPod}
          onDemolishPod={handleDemolishPlacedPod}
        />
      )}

      {/* Live Mission Settings Modal inside Base Builder */}
      {showSettingsModal && (
        <MissionSettingsModal
          config={config}
          placedPods={placedPods}
          onApplyConfig={handleApplyLiveSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Onboarding Tutorial Modal */}
      {showTutorialModal && <TutorialModal onClose={() => setShowTutorialModal(false)} />}

      {/* Final 30-Day Simulation Evaluation Modal with Analytics Curves & Problem Summary */}
      {showEvaluationModal && simulationResult && (
        <EvaluationModal
          result={simulationResult}
          config={config}
          landingSite={activeLandingSite}
          onClose={() => {
            setShowEvaluationModal(false);
            setSimulationPhase('idle');
          }}
          onReset={() => {
            setShowEvaluationModal(false);
            setSimulationPhase('idle');
            loadStarterBaseForSite(config.landingSiteId, config, true);
          }}
        />
      )}
    </div>
  );
}
