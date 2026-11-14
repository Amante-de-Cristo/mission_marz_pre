export type PodCategory =
  | 'Essential'
  | 'Food & Agriculture'
  | 'Life Support'
  | 'Medical & Health'
  | 'Science & Research'
  | 'Energy & Electricity'
  | 'Engineering & Manufacturing'
  | 'Transportation & Exploration'
  | 'Waste & Recycling'
  | 'Recreation & Community'
  | 'Security & Emergency';

export interface PodDefinition {
  id: string;
  name: string;
  category: PodCategory;
  isEssential?: boolean;
  cost: number; // in USD
  mass: number; // in kg
  powerKW: number; // positive = consumes, negative = generates
  waterRate: number; // L/day, positive = consumes, negative = generates
  o2Rate: number; // kg/day, positive = consumes, negative = generates
  foodRate?: number; // kg/day, positive = consumes, negative = generates
  co2ScrubKg?: number; // kg/day scrubbed
  wasteCapacityKg?: number; // capacity handled
  crewCapacity?: number;
  description: string;
  nasaTechSpec: string;
  modelType: string;
  colorAccent: string;
}

export interface PlacedPod {
  instanceId: string;
  podId: string;
  gridX: number;
  gridZ: number;
  rotation: number; // in increments of 90 degrees (0, 90, 180, 270)
  placedAt: number;
}

export interface HelipadPlacement {
  garageInstanceId: string;
  gridX: number;
  gridZ: number;
  garageGridX: number;
  garageGridZ: number;
  rotation: number;
}

export type SiteDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'Extreme' | 'Impossible';

export interface UnsuitablePodRule {
  podId: string;
  reason: string;
  alternativePodIds: string[];
}

export interface LandingSite {
  id: string;
  name: string;
  region: string;
  lat: number; // degrees North (+) or South (-)
  lon: number; // degrees East (0..360)
  elevationLabel: string;
  avgTempC: number;
  solarEfficiency: number; // multiplier e.g. 1.0, 1.12
  waterBonusL: number; // extra subsurface ice water L/day if extracting
  sunlightLabel: string;
  iceAccessLabel: string;
  difficulty: SiteDifficulty;
  isImpossible: boolean;
  impossibleReason?: string;
  dustStormSeverity: number; // multiplier e.g. 1.0 normal, 1.5 severe
  oxygenPlantMultiplier: number; // multiplier for atmospheric CO2 density (e.g. 0.55 at summit)
  starterProfile: 'balanced' | 'solar_equatorial' | 'polar_ice' | 'canyon_shadow' | 'highland_dry';
  unsuitablePods: UnsuitablePodRule[];
  terrainColorHex: string;
  terrainAccentHex: string;
  skyHex: string;
  fogHex: string;
  description: string;
}

export interface MissionConfig {
  isInfiniteBudget: boolean; // default true (infinite / uncapped)
  constructionBudget: number; // $ if manual
  launchBudget: number; // $ if manual
  costPerKg: number; // $10,000 - $20,000 / kg
  crewSize: number; // 1 to 7 astronauts (default 4)
  landingSiteId: string; // Selected NASA Martian landing site
}

export interface ResourceTelemetry {
  isInfiniteBudget: boolean;
  powerDemandKW: number;
  powerSupplyKW: number;
  netPowerKW: number;
  waterDemandL: number;
  waterSupplyL: number;
  netWaterL: number;
  o2DemandKg: number;
  o2SupplyKg: number;
  netO2Kg: number;
  foodSupplyKg: number;
  foodDemandKg: number;
  co2ScrubCapacityKg: number;
  co2ProductionKg: number;
  wasteHandledKg: number;
  wasteProducedKg: number;
  totalMassKg: number;
  totalCostUSD: number;
  totalBaseSpendUSD: number;
  budgetRemainingUSD: number;
  launchCapacityKg: number;
  launchBudgetRemainingUSD: number;
  crewCapacity: number;
  categoryCaps: Record<PodCategory, { placed: number; maxAllowed: number }>;
  podCaps: Record<string, { placed: number; maxAllowed: number; canAffordMore: number }>;
}

export interface AdvisorWarning {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  suggestedAction?: string;
  relatedCategory?: PodCategory;
}

export interface DailySimulationLog {
  day: number;
  title: string;
  description: string;
  type: 'normal' | 'event' | 'hazard' | 'success';
  o2Level: number; // percentage 0-100
  powerLevel: number;
  waterLevel: number;
  temperatureC: number;
  o2ProductionKg: number;
  o2ConsumptionKg: number;
  waterProductionL: number;
  waterConsumptionL: number;
  powerProductionKW: number;
  powerConsumptionKW: number;
}

export interface SimulationProblemSummary {
  title: string;
  issue: string;
  rootCause: string;
  fix: string;
  failureDay?: number;
  failedSystem: 'power' | 'oxygen' | 'water' | 'food' | 'co2' | 'site_hazard' | 'missing_pods';
}

export interface SimulationAnomaly {
  day: number;
  label: string;
  severity: 'event' | 'warning' | 'critical';
  metric: 'power' | 'oxygen' | 'water' | 'all';
}

export interface SimulationResult {
  passed: boolean;
  habitabilityScore: number; // 0 - 100
  daysSurviving: number;
  totalDays: number;
  criticalFailures: string[];
  problemSummary?: SimulationProblemSummary;
  anomalies?: SimulationAnomaly[];
  systemBreakdown: {
    powerReliability: number;
    oxygenStability: number;
    waterReserve: number;
    foodSustainability: number;
    lifeSupportIntegrity: number;
    crewMorale: number;
  };
  actionableSteps: string[];
  logs: DailySimulationLog[];
}

export interface RecommendedPodTarget {
  podId: string;
  podName: string;
  recommendedCount: number;
  placedCount: number;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
}

export interface BudgetRebalanceResult {
  adjustedPods: PlacedPod[];
  removedPods: PlacedPod[];
  wasRebalanced: boolean;
  warningMessage: string | null;
}

export type SimulationPhase = 'idle' | 'transit' | 'construction' | 'operational' | 'evaluation';

export interface CameraState {
  x: number;
  z: number;
  rotationY: number;
  zoom: number;
}

export interface RoverState {
  id: string;
  x: number;
  z: number;
  angle: number;
  targetX: number;
  targetZ: number;
}
