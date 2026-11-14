import {
  PlacedPod,
  MissionConfig,
  ResourceTelemetry,
  AdvisorWarning,
  SimulationResult,
  SimulationProblemSummary,
  SimulationAnomaly,
  DailySimulationLog,
  PodCategory,
  HelipadPlacement,
  LandingSite,
  RecommendedPodTarget,
  BudgetRebalanceResult,
} from '../types';
import { POD_MAP, ESSENTIAL_POD_IDS } from './podCatalog';
import { DEFAULT_LANDING_SITE, LANDING_SITE_MAP } from './landingSites';

export function getActiveLandingSite(config?: Partial<MissionConfig>) {
  if (config?.landingSiteId) {
    const found = LANDING_SITE_MAP.get(config.landingSiteId);
    if (found) return found;
  }
  return DEFAULT_LANDING_SITE;
}

/**
 * Deterministic nearest-empty-tile allocation for Ingenuity-style helicopter landing pads.
 * Every placed Rover Garage Pod reserves 1 unique adjacent empty tile for its Helicopter Landing Pad.
 */
export function computeHelipadPlacements(
  placedPods: PlacedPod[],
  gridHalfBound: number = 12
): HelipadPlacement[] {
  const garages = placedPods
    .filter((p) => p.podId === 'rover_garage_pod')
    .slice()
    .sort((a, b) => a.placedAt - b.placedAt || a.instanceId.localeCompare(b.instanceId));

  if (garages.length === 0) return [];

  const occupied = new Set<string>(placedPods.map((p) => `${p.gridX},${p.gridZ}`));
  const placements: HelipadPlacement[] = [];

  for (const garage of garages) {
    let assignedX: number | null = null;
    let assignedZ: number | null = null;

    // Search expanding rings around the garage, favoring closest free adjacent tile
    for (let radius = 1; radius <= gridHalfBound * 2 && assignedX === null; radius++) {
      const candidates: Array<{ x: number; z: number; distSq: number }> = [];
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const cx = garage.gridX + dx;
          const cz = garage.gridZ + dz;
          if (Math.abs(cx) > gridHalfBound || Math.abs(cz) > gridHalfBound) continue;
          if (occupied.has(`${cx},${cz}`)) continue;
          candidates.push({ x: cx, z: cz, distSq: dx * dx + dz * dz });
        }
      }

      // Prefer diagonal / front-side pads slightly over straight-behind when equidistant
      candidates.sort((a, b) => a.distSq - b.distSq || b.x - a.x || b.z - a.z);
      if (candidates.length > 0) {
        assignedX = candidates[0].x;
        assignedZ = candidates[0].z;
      }
    }

    if (assignedX !== null && assignedZ !== null) {
      occupied.add(`${assignedX},${assignedZ}`);
      placements.push({
        garageInstanceId: garage.instanceId,
        gridX: assignedX,
        gridZ: assignedZ,
        garageGridX: garage.gridX,
        garageGridZ: garage.gridZ,
        rotation: garage.rotation,
      });
    }
  }

  return placements;
}

export function isTileReservedForHelipad(
  gridX: number,
  gridZ: number,
  placedPods: PlacedPod[],
  gridHalfBound: number = 12
): boolean {
  const helipads = computeHelipadPlacements(placedPods, gridHalfBound);
  return helipads.some((h) => h.gridX === gridX && h.gridZ === gridZ);
}

export function calculateTelemetry(placedPods: PlacedPod[], config: MissionConfig): ResourceTelemetry {
  let powerDemandKW = 0;
  let powerSupplyKW = 0;
  let waterDemandL = 0;
  let waterSupplyL = 0;
  let o2DemandKg = 0;
  let o2SupplyKg = 0;
  let foodSupplyKg = 0;
  let co2ScrubCapacityKg = 0;
  let wasteHandledKg = 0;
  let totalMassKg = 0;
  let totalCostUSD = 0;
  let crewCapacity = 0;

  const site = getActiveLandingSite(config);

  const categoryCounts: Record<string, number> = {};
  const podCounts: Record<string, number> = {};

  const crewCount = Math.max(1, Math.min(7, config.crewSize || 4));
  const crewO2NeedKg = crewCount * 0.84;
  const crewWaterNeedL = crewCount * 3.6;
  const crewFoodNeedKg = crewCount * 1.8;
  const crewCO2OutputKg = crewCount * 1.0;
  const crewWasteOutputKg = crewCount * 1.5;

  o2DemandKg += crewO2NeedKg;
  waterDemandL += crewWaterNeedL;
  const foodDemandKg = crewFoodNeedKg;
  const co2ProductionKg = crewCO2OutputKg;
  const wasteProducedKg = crewWasteOutputKg;

  // Extreme cold below -68°C draws extra base heating electricity once pods are placed
  if (placedPods.length > 0 && site.avgTempC < -68) {
    powerDemandKW += Math.round((-68 - site.avgTempC) * 1.15);
  }

  for (const placed of placedPods) {
    const pod = POD_MAP.get(placed.podId);
    if (!pod) continue;

    categoryCounts[pod.category] = (categoryCounts[pod.category] || 0) + 1;
    podCounts[pod.id] = (podCounts[pod.id] || 0) + 1;

    totalCostUSD += pod.cost;
    totalMassKg += pod.mass;

    if (pod.crewCapacity) {
      crewCapacity += pod.crewCapacity;
    }

    if (pod.powerKW > 0) {
      powerDemandKW += pod.powerKW;
    } else {
      const supply = Math.abs(pod.powerKW);
      powerSupplyKW += pod.id === 'solar_power_pod' ? supply * site.solarEfficiency : supply;
    }

    if (pod.waterRate > 0) {
      waterDemandL += pod.waterRate;
    } else {
      const waterSup = Math.abs(pod.waterRate);
      if (pod.id === 'water_extraction_pod') {
        // Dry volcanic plains/peaks have no shallow ice to drill
        waterSupplyL +=
          site.waterBonusL > 0 ? waterSup + site.waterBonusL : Math.round(waterSup * 0.15);
      } else {
        waterSupplyL += waterSup;
      }
    }

    if (pod.o2Rate > 0) {
      o2DemandKg += pod.o2Rate;
    } else {
      const o2Sup = Math.abs(pod.o2Rate);
      o2SupplyKg +=
        pod.id === 'oxygen_pod' ? o2Sup * (site.oxygenPlantMultiplier ?? 1.0) : o2Sup;
    }

    if (pod.foodRate && pod.foodRate < 0) {
      foodSupplyKg += Math.abs(pod.foodRate);
    }

    if (pod.co2ScrubKg) {
      co2ScrubCapacityKg += pod.co2ScrubKg;
    }

    if (pod.wasteCapacityKg) {
      wasteHandledKg += pod.wasteCapacityKg;
    }
  }

  const isInfinite = config.isInfiniteBudget ?? true;
  const launchCostSpent = totalMassKg * config.costPerKg;
  const totalBaseSpendUSD = totalCostUSD + launchCostSpent;

  const budgetRemainingUSD = isInfinite ? 999999999999 : config.constructionBudget - totalCostUSD;
  const launchCapacityKg = isInfinite ? 9999999 : Math.floor(config.launchBudget / config.costPerKg);
  const launchBudgetRemainingUSD = isInfinite ? 999999999999 : config.launchBudget - launchCostSpent;

  const categoryCaps: Record<PodCategory, { placed: number; maxAllowed: number }> = {
    'Essential': { placed: categoryCounts['Essential'] || 0, maxAllowed: Infinity },
    'Food & Agriculture': { placed: categoryCounts['Food & Agriculture'] || 0, maxAllowed: Infinity },
    'Life Support': { placed: categoryCounts['Life Support'] || 0, maxAllowed: Infinity },
    'Medical & Health': { placed: categoryCounts['Medical & Health'] || 0, maxAllowed: Infinity },
    'Science & Research': { placed: categoryCounts['Science & Research'] || 0, maxAllowed: Infinity },
    'Energy & Electricity': { placed: categoryCounts['Energy & Electricity'] || 0, maxAllowed: Infinity },
    'Engineering & Manufacturing': { placed: categoryCounts['Engineering & Manufacturing'] || 0, maxAllowed: Infinity },
    'Transportation & Exploration': {
      placed: categoryCounts['Transportation & Exploration'] || 0,
      maxAllowed: Infinity,
    },
    'Waste & Recycling': { placed: categoryCounts['Waste & Recycling'] || 0, maxAllowed: Infinity },
    'Recreation & Community': { placed: categoryCounts['Recreation & Community'] || 0, maxAllowed: Infinity },
    'Security & Emergency': { placed: categoryCounts['Security & Emergency'] || 0, maxAllowed: Infinity },
  };

  const podCaps: Record<string, { placed: number; maxAllowed: number; canAffordMore: number }> = {};
  const remainingBuildUSD = Math.max(0, budgetRemainingUSD);
  const remainingCargoUSD = Math.max(0, launchBudgetRemainingUSD);
  const costPerKg = Math.max(1, config.costPerKg || 15000);

  for (const pod of POD_MAP.values()) {
    const placed = podCounts[pod.id] || 0;
    if (isInfinite) {
      podCaps[pod.id] = {
        placed,
        maxAllowed: Infinity,
        canAffordMore: Infinity,
      };
    } else {
      const maxMoreByCost = pod.cost > 0 ? Math.floor(remainingBuildUSD / pod.cost) : Infinity;
      const podLaunchCost = pod.mass * costPerKg;
      const maxMoreByCargo = podLaunchCost > 0 ? Math.floor(remainingCargoUSD / podLaunchCost) : Infinity;
      const canAffordMore = Math.max(0, Math.min(maxMoreByCost, maxMoreByCargo));

      podCaps[pod.id] = {
        placed,
        maxAllowed: placed + canAffordMore,
        canAffordMore,
      };
    }
  }

  return {
    isInfiniteBudget: isInfinite,
    powerDemandKW: Math.round(powerDemandKW * 10) / 10,
    powerSupplyKW: Math.round(powerSupplyKW * 10) / 10,
    netPowerKW: Math.round((powerSupplyKW - powerDemandKW) * 10) / 10,
    waterDemandL: Math.round(waterDemandL * 10) / 10,
    waterSupplyL: Math.round(waterSupplyL * 10) / 10,
    netWaterL: Math.round((waterSupplyL - waterDemandL) * 10) / 10,
    o2DemandKg: Math.round(o2DemandKg * 10) / 10,
    o2SupplyKg: Math.round(o2SupplyKg * 10) / 10,
    netO2Kg: Math.round((o2SupplyKg - o2DemandKg) * 10) / 10,
    foodSupplyKg: Math.round(foodSupplyKg * 10) / 10,
    foodDemandKg: Math.round(foodDemandKg * 10) / 10,
    co2ScrubCapacityKg: Math.round(co2ScrubCapacityKg * 10) / 10,
    co2ProductionKg: Math.round(co2ProductionKg * 10) / 10,
    wasteHandledKg: Math.round(wasteHandledKg * 10) / 10,
    wasteProducedKg: Math.round(wasteProducedKg * 10) / 10,
    totalMassKg,
    totalCostUSD,
    totalBaseSpendUSD,
    budgetRemainingUSD,
    launchCapacityKg,
    launchBudgetRemainingUSD,
    crewCapacity,
    categoryCaps,
    podCaps,
  };
}

export function getMissingEssentialPods(placedPods: PlacedPod[]): string[] {
  const placedIds = new Set(placedPods.map((p) => p.podId));
  return ESSENTIAL_POD_IDS.filter((id) => !placedIds.has(id));
}

export function canLaunchSimulation(
  placedPods: PlacedPod[],
  config?: MissionConfig
): {
  canLaunch: boolean;
  missingCount: number;
  missingPodNames: string[];
  unmetRecommendations: RecommendedPodTarget[];
  totalRecommendedCount: number;
  metRecommendedCount: number;
} {
  const missingIds = getMissingEssentialPods(placedPods);
  const missingPodNames = missingIds.map((id) => POD_MAP.get(id)?.name || id);
  const site = getActiveLandingSite(config);
  const crewSize = Math.max(1, Math.min(7, config?.crewSize || 4));
  const recommended = getSiteRecommendedPods(site, placedPods, crewSize);
  const unmetRecommendations = recommended.filter((r) => r.placedCount < r.recommendedCount);

  return {
    canLaunch: missingIds.length === 0 && unmetRecommendations.length === 0,
    missingCount: missingIds.length,
    missingPodNames,
    unmetRecommendations,
    totalRecommendedCount: recommended.length,
    metRecommendedCount: recommended.length - unmetRecommendations.length,
  };
}

/**
 * Dynamic location- & crew-aware recommended pod targets shown in the Builder Tips tab.
 */
export function getSiteRecommendedPods(
  site: LandingSite,
  placedPods: PlacedPod[],
  crewSize: number
): RecommendedPodTarget[] {
  const counts = placedPods.reduce<Record<string, number>>((acc, p) => {
    acc[p.podId] = (acc[p.podId] || 0) + 1;
    return acc;
  }, {});

  const targets: RecommendedPodTarget[] = [];
  const livingRec = Math.max(1, Math.ceil(crewSize / 4));
  targets.push({
    podId: 'living_pod',
    podName: POD_MAP.get('living_pod')?.name || 'Main Living Pod',
    recommendedCount: livingRec,
    placedCount: counts['living_pod'] || 0,
    reason: `Provides 4 pressurized beds each for your ${crewSize}-astronaut crew.`,
    priority: 'required',
  });

  const o2Rec = site.oxygenPlantMultiplier < 0.75 || crewSize >= 6 ? 2 : 1;
  targets.push({
    podId: 'oxygen_pod',
    podName: POD_MAP.get('oxygen_pod')?.name || 'Oxygen Generation Pod',
    recommendedCount: o2Rec,
    placedCount: counts['oxygen_pod'] || 0,
    reason:
      site.oxygenPlantMultiplier < 0.75
        ? `Thin atmosphere at ${site.name} reduces oxygen splitter efficiency (${Math.round(site.oxygenPlantMultiplier * 100)}%).`
        : `Supplies steady breathable oxygen for ${crewSize} astronauts.`,
    priority: 'required',
  });

  const powerCoreRec = site.avgTempC <= -75 || site.solarEfficiency < 0.8 || site.isImpossible ? 2 : 1;
  targets.push({
    podId: 'power_generation_pod',
    podName: POD_MAP.get('power_generation_pod')?.name || 'Power Generation Pod',
    recommendedCount: powerCoreRec,
    placedCount: (counts['power_generation_pod'] || 0) + (counts['nuclear_power_pod'] || 0),
    reason:
      powerCoreRec > 1
        ? `Cold nights (${site.avgTempC}°C) and weak sunlight need extra nuclear power.`
        : 'Steady day-and-night baseline electricity.',
    priority: 'required',
  });

  const waterDrillUnsuitable = site.unsuitablePods.some((u) => u.podId === 'water_extraction_pod');
  if (waterDrillUnsuitable || site.waterBonusL === 0) {
    targets.push({
      podId: 'water_recovery_pod',
      podName: POD_MAP.get('water_recovery_pod')?.name || 'Water Recovery Pod',
      recommendedCount: crewSize >= 5 ? 2 : 1,
      placedCount: counts['water_recovery_pod'] || 0,
      reason: `Dry surface soil at ${site.name} makes drilling weak—pair recycling with recovery.`,
      priority: 'recommended',
    });
  } else {
    targets.push({
      podId: 'water_extraction_pod',
      podName: POD_MAP.get('water_extraction_pod')?.name || 'Water Extraction Pod',
      recommendedCount: 1,
      placedCount: counts['water_extraction_pod'] || 0,
      reason: `Taps +${site.waterBonusL} L/day bonus subsurface ice at ${site.name}.`,
      priority: 'recommended',
    });
  }

  const solarUnsuitable = site.unsuitablePods.some((u) => u.podId === 'solar_power_pod');
  if (!solarUnsuitable && site.solarEfficiency >= 0.95) {
    targets.push({
      podId: 'solar_power_pod',
      podName: POD_MAP.get('solar_power_pod')?.name || 'Solar Power Pod',
      recommendedCount: site.solarEfficiency >= 1.1 ? 2 : 1,
      placedCount: counts['solar_power_pod'] || 0,
      reason: `${Math.round(site.solarEfficiency * 100)}% sunlight clarity makes solar panels cost-effective.`,
      priority: 'recommended',
    });
  }

  targets.push({
    podId: 'battery_storage_pod',
    podName: POD_MAP.get('battery_storage_pod')?.name || 'Battery Storage Pod',
    recommendedCount: site.dustStormSeverity >= 1.3 ? 2 : 1,
    placedCount: counts['battery_storage_pod'] || 0,
    reason:
      site.dustStormSeverity >= 1.3
        ? 'Heavy regional dust storms call for deep backup battery capacity.'
        : 'Bridges 12-hour Martian nights and short dust storms.',
    priority: 'recommended',
  });

  targets.push({
    podId: 'greenhouse_pod',
    podName: POD_MAP.get('greenhouse_pod')?.name || 'Greenhouse Pod',
    recommendedCount: Math.max(1, Math.ceil(crewSize / 4)),
    placedCount:
      (counts['greenhouse_pod'] || 0) +
      (counts['hydroponics_pod'] || 0) +
      (counts['aeroponics_pod'] || 0),
    reason: `Fresh crops prevent food pantry depletion for ${crewSize} crew members.`,
    priority: 'recommended',
  });

  return targets;
}

/**
 * Budget Exploit Protection:
 * Whenever budget shrinks below placed base spend/weight (or Unlimited Budget is disabled),
 * automatically removes the least critical buildings first until constraints are met.
 */
export function rebalanceBaseForBudget(
  placedPods: PlacedPod[],
  config: MissionConfig
): BudgetRebalanceResult {
  if (config.isInfiniteBudget || placedPods.length === 0) {
    return {
      adjustedPods: placedPods,
      removedPods: [],
      wasRebalanced: false,
      warningMessage: null,
    };
  }

  const maxCostUSD = Math.max(0, config.constructionBudget);
  const maxMassKg = Math.max(0, Math.floor(config.launchBudget / Math.max(1, config.costPerKg)));

  let currentCost = 0;
  let currentMass = 0;
  for (const p of placedPods) {
    const def = POD_MAP.get(p.podId);
    if (!def) continue;
    currentCost += def.cost;
    currentMass += def.mass;
  }

  if (currentCost <= maxCostUSD && currentMass <= maxMassKg) {
    return {
      adjustedPods: placedPods,
      removedPods: [],
      wasRebalanced: false,
      warningMessage: null,
    };
  }

  // Score each pod: lower score = removed FIRST
  const firstEssentialSeen = new Set<string>();
  const scored = placedPods.map((pod, idx) => {
    const def = POD_MAP.get(pod.podId);
    const isEssential = Boolean(def?.isEssential);
    let tier = 1; // Optional/Luxury/Exploration/Science

    if (isEssential && !firstEssentialSeen.has(pod.podId)) {
      firstEssentialSeen.add(pod.podId);
      tier = 3; // Unique essential building (protected longest)
    } else if (
      isEssential ||
      pod.podId === 'greenhouse_pod' ||
      pod.podId === 'nuclear_power_pod' ||
      pod.podId === 'battery_storage_pod' ||
      pod.podId === 'water_recovery_pod' ||
      pod.podId === 'solar_power_pod'
    ) {
      tier = 2; // Core support or duplicate essential
    }

    return {
      pod,
      cost: def?.cost || 0,
      mass: def?.mass || 0,
      tier,
      order: idx,
    };
  });

  // Sort candidates for removal: lowest tier first, then newer/heavier/more expensive first
  const removalOrder = scored.slice().sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.cost !== b.cost) return b.cost - a.cost;
    return b.order - a.order;
  });

  const removedIds = new Set<string>();
  const removedPods: PlacedPod[] = [];

  for (const item of removalOrder) {
    if (currentCost <= maxCostUSD && currentMass <= maxMassKg) break;
    removedIds.add(item.pod.instanceId);
    removedPods.push(item.pod);
    currentCost -= item.cost;
    currentMass -= item.mass;
  }

  const adjustedPods = placedPods.filter((p) => !removedIds.has(p.instanceId));
  const removedNames = Array.from(
    new Set(removedPods.map((p) => POD_MAP.get(p.podId)?.name || p.podId))
  );

  const warningMessage =
    removedPods.length > 0
      ? `Budget limit lowered: automatically removed ${removedPods.length} least-critical building${
          removedPods.length > 1 ? 's' : ''
        } (${removedNames.slice(0, 4).join(', ')}${removedNames.length > 4 ? ', ...' : ''}) to fit within $${(
          maxCostUSD / 1e9
        ).toFixed(1)}B and ${(maxMassKg / 1000).toFixed(0)}t cargo capacity.`
      : null;

  return {
    adjustedPods,
    removedPods,
    wasRebalanced: removedPods.length > 0,
    warningMessage,
  };
}

export function generateBaseAdvisorWarnings(
  placedPods: PlacedPod[],
  telemetry: ResourceTelemetry,
  config?: MissionConfig
): AdvisorWarning[] {
  const warnings: AdvisorWarning[] = [];
  const placedIds = new Set(placedPods.map((p) => p.podId));
  const site = getActiveLandingSite(config);

  if (site.isImpossible && site.impossibleReason) {
    warnings.push({
      id: 'site-impossible-hazard',
      type: 'critical',
      title: `${site.name}: Extreme Survival Hazard`,
      message: site.impossibleReason,
      suggestedAction:
        'Expect severe failures unless heavily reinforced with double Nuclear Power, Water Recycling, and Backup Life Support—or pick a safer landing site.',
    });
  }

  // Unsuitable pod checks for active site
  for (const rule of site.unsuitablePods) {
    if (placedIds.has(rule.podId)) {
      const badName = POD_MAP.get(rule.podId)?.name || rule.podId;
      const altNames = rule.alternativePodIds
        .map((id) => POD_MAP.get(id)?.name || id)
        .join(', ');
      warnings.push({
        id: `unsuitable-${rule.podId}`,
        type: 'warning',
        title: `${badName} Limited at ${site.name}`,
        message: rule.reason,
        suggestedAction: `Recommended instead: ${altNames}.`,
      });
    }
  }

  const missingEssential = getMissingEssentialPods(placedPods);
  if (missingEssential.length > 0) {
    const missingNames = missingEssential.map((id) => POD_MAP.get(id)?.name || id).join(', ');
    warnings.push({
      id: 'missing-essential',
      type: 'critical',
      title: `Missing ${missingEssential.length} Required Pod(s)`,
      message: `All 10 Essential Pods must be placed before starting the 30-day test. Missing: ${missingNames}.`,
      suggestedAction: 'Place the missing pods from the Essential category.',
      relatedCategory: 'Essential',
    });
  }

  if (telemetry.netPowerKW < 0) {
    warnings.push({
      id: 'power-deficit',
      type: 'critical',
      title: 'Not Enough Power',
      message: `Your base uses ${Math.abs(telemetry.netPowerKW)} kW more electricity than it makes. Systems will lose power.`,
      suggestedAction: 'Add a Nuclear Power Pod or Power Generation Pod.',
      relatedCategory: 'Energy & Electricity',
    });
  } else if (telemetry.netPowerKW < 15 && telemetry.powerDemandKW > 0) {
    warnings.push({
      id: 'power-low-margin',
      type: 'warning',
      title: 'Low Spare Power',
      message: `Spare power is only ${telemetry.netPowerKW} kW. A dust storm could cause blackouts.`,
      suggestedAction: 'Add Battery Storage or another Nuclear Power Pod.',
      relatedCategory: 'Energy & Electricity',
    });
  }

  const hasSolar = placedIds.has('solar_power_pod');
  const hasBattery = placedIds.has('battery_storage_pod');
  const hasNuclear = placedIds.has('power_generation_pod') || placedIds.has('nuclear_power_pod');
  if (hasSolar && !hasBattery && !hasNuclear) {
    warnings.push({
      id: 'solar-no-storage',
      type: 'warning',
      title: 'Solar Panels Need Night Storage',
      message: 'Solar panels make zero power during the 12-hour Martian night without batteries or a nuclear generator.',
      suggestedAction: 'Add a Battery Storage Pod or Power Generation Pod.',
      relatedCategory: 'Energy & Electricity',
    });
  }

  if (telemetry.netO2Kg < 0) {
    warnings.push({
      id: 'o2-deficit',
      type: 'critical',
      title: 'Oxygen Running Low',
      message: `Your crew and pods use ${Math.abs(telemetry.netO2Kg)} kg/day more oxygen than the base produces.`,
      suggestedAction: 'Add an Oxygen Generation Pod or Greenhouse Pod.',
      relatedCategory: 'Life Support',
    });
  }

  if (telemetry.netWaterL < 0) {
    warnings.push({
      id: 'water-deficit',
      type: 'critical',
      title: 'Water Running Low',
      message: `Your base is losing ${Math.abs(telemetry.netWaterL)} L of water each day.`,
      suggestedAction: 'Add a Water Recovery Pod or Water Recycling Pod.',
      relatedCategory: 'Life Support',
    });
  }

  if (telemetry.foodSupplyKg < telemetry.foodDemandKg) {
    const deficit = Math.round((telemetry.foodDemandKg - telemetry.foodSupplyKg) * 10) / 10;
    warnings.push({
      id: 'food-deficit',
      type: 'warning',
      title: 'Food Output Too Low',
      message: `Crop harvest is short by ${deficit} kg/day, so the crew is eating stored rations.`,
      suggestedAction: 'Add a Greenhouse, Hydroponics, or Aeroponics Pod.',
      relatedCategory: 'Food & Agriculture',
    });
  }

  const hasAgri = placedIds.has('greenhouse_pod') || placedIds.has('hydroponics_pod') || placedIds.has('aeroponics_pod');
  const hasWaterRecycling = placedIds.has('water_pod') || placedIds.has('water_purification_pod');
  if (hasAgri && !hasWaterRecycling) {
    warnings.push({
      id: 'agri-water-leak',
      type: 'warning',
      title: 'Crops Losing Moisture',
      message: 'Plants release large amounts of humidity. Add water recycling to capture that moisture.',
      suggestedAction: 'Add a Water Recycling Pod or Humidity Control Pod.',
      relatedCategory: 'Life Support',
    });
  }

  if (telemetry.co2ScrubCapacityKg < telemetry.co2ProductionKg) {
    warnings.push({
      id: 'co2-buildup',
      type: 'warning',
      title: 'Carbon Dioxide Building Up',
      message: `Crew breathes out ${telemetry.co2ProductionKg} kg of carbon dioxide per day, but your scrubbers only clear ${telemetry.co2ScrubCapacityKg} kg/day.`,
      suggestedAction: 'Add a Carbon Dioxide Removal Pod or Air Filtration Pod.',
      relatedCategory: 'Life Support',
    });
  }

  const targetCrew = config?.crewSize || 4;
  if (telemetry.crewCapacity < targetCrew && placedPods.length > 0) {
    warnings.push({
      id: 'insufficient-berthing',
      type: 'warning',
      title: 'Not Enough Crew Beds',
      message: `Your mission has ${targetCrew} astronauts, but your habitats only hold ${telemetry.crewCapacity} beds.`,
      suggestedAction: 'Add another Main Living Pod.',
      relatedCategory: 'Essential',
    });
  }

  if (!telemetry.isInfiniteBudget) {
    if (telemetry.budgetRemainingUSD < 0) {
      warnings.push({
        id: 'budget-exceeded',
        type: 'warning',
        title: 'Over Construction Budget',
        message: `Building costs are over budget by $${Math.abs(telemetry.budgetRemainingUSD).toLocaleString()}.`,
        suggestedAction: 'Remove extra pods or enable Infinite Budget in Settings.',
      });
    }

    if (telemetry.launchBudgetRemainingUSD < 0) {
      warnings.push({
        id: 'launch-mass-overrun',
        type: 'warning',
        title: 'Over Rocket Weight Limit',
        message: `Total weight (${telemetry.totalMassKg.toLocaleString()} kg) is too heavy for your launch budget.`,
        suggestedAction: 'Trim heavy modules or enable Infinite Budget in Settings.',
        relatedCategory: 'Transportation & Exploration',
      });
    }
  }

  return warnings;
}

function simulateDailyTelemetryLogs(
  telemetry: ResourceTelemetry,
  config: MissionConfig,
  stopOnFailure: boolean,
  placedPods: PlacedPod[]
): {
  logs: DailySimulationLog[];
  passed: boolean;
  daysSurviving: number;
  criticalFailures: string[];
  problemSummary?: SimulationProblemSummary;
  anomalies: SimulationAnomaly[];
  powerHealth: number;
  lifeSupportHealth: number;
  crewMorale: number;
  o2TankKg: number;
  waterTankL: number;
} {
  const logs: DailySimulationLog[] = [];
  const criticalFailures: string[] = [];
  const anomalies: SimulationAnomaly[] = [];
  let problemSummary: SimulationProblemSummary | undefined;

  const site = getActiveLandingSite(config);
  const placedIds = new Set(placedPods.map((p) => p.podId));
  const hasRadiationShelter = placedIds.has('radiation_shelter_pod');
  const hasBackupEclss = placedIds.has('backup_life_support_pod');
  const nuclearCount = placedPods.filter(
    (p) => p.podId === 'power_generation_pod' || p.podId === 'nuclear_power_pod'
  ).length;

  let o2TankKg = 150;
  let waterTankL = 600;
  let foodPantryKg = 300;
  let powerHealth = 100;
  let lifeSupportHealth = 100;
  let crewMorale = 95;

  let passed = true;
  let daysSurviving = 30;

  for (let day = 1; day <= 30; day++) {
    let tempC = site.avgTempC + Math.sin(day * 0.4) * 14;
    let solarMultiplier = 1.0;
    let dailyLogType: 'normal' | 'event' | 'hazard' | 'success' = 'normal';
    let logTitle = `Day ${day}: Smooth Operations`;
    let logDesc = `Cabin air pressure steady and indoor temperature comfortable at 21°C at ${site.name}.`;
    const stormPenalty = site.dustStormSeverity || 1.0;

    if (day === 4) {
      logTitle = `Day 4: Clear Sunny Skies`;
      logDesc = `Bright Martian sunlight gives solar panels an extra energy boost.`;
      dailyLogType = 'success';
      solarMultiplier = 1.12;
      crewMorale = Math.min(100, crewMorale + 2);
      anomalies.push({ day, label: 'Solar Peak', severity: 'event', metric: 'power' });
    } else if (day === 9) {
      logTitle = `Day 9: Passing Dust Whirlwind`;
      logDesc = `A dust whirlwind passed north of camp, leaving light dust on outdoor panels.`;
      dailyLogType = 'event';
      solarMultiplier = Math.max(0.75, 0.94 / stormPenalty);
    } else if (day === 14) {
      logTitle = `Day 14: Dust Storm Arrives`;
      logDesc = `Thick red dust clouds block over half the sunlight across ${site.name}.`;
      dailyLogType = 'hazard';
      solarMultiplier = Math.max(0.18, 0.45 / stormPenalty);
      anomalies.push({ day, label: 'Dust Storm Starts', severity: 'warning', metric: 'power' });
    } else if (day === 15) {
      logTitle = `Day 15: Peak Dust Storm`;
      logDesc = `Storm winds continue. The base relies heavily on nuclear power and batteries.`;
      dailyLogType = 'hazard';
      solarMultiplier = Math.max(0.12, 0.4 / stormPenalty);
    } else if (day === 16) {
      logTitle = `Day 16: Dust Storm Clearing`;
      logDesc = `Skies begin to clear as panel shakers brush away settled dust.`;
      dailyLogType = 'event';
      solarMultiplier = Math.max(0.5, 0.8 / Math.sqrt(stormPenalty));
      anomalies.push({ day, label: 'Storm Clearing', severity: 'event', metric: 'power' });
    } else if (day === 19) {
      tempC -= 22;
      logTitle = `Day 19: Sudden Thermal Drop`;
      logDesc = `A freezing polar cold front plunges outside temperatures to ${Math.round(tempC)}°C, spiking base heater power.`;
      dailyLogType = 'hazard';
      anomalies.push({ day, label: 'Thermal Drop', severity: 'warning', metric: 'power' });
    } else if (day === 21) {
      logTitle = `Day 21: Fresh Crop Harvest`;
      logDesc = `Greenhouse beds deliver fresh sweet potatoes and crisp leafy greens for dinner.`;
      dailyLogType = 'success';
      crewMorale = Math.min(100, crewMorale + 5);
    } else if (day === 25) {
      logTitle = `Day 25: Solar Storm Warning`;
      logDesc = `Sensors spotted a burst of solar radiation. Crew stayed safely inside the shielded shelter.`;
      dailyLogType = 'hazard';
      anomalies.push({ day, label: 'Solar Flare', severity: 'warning', metric: 'all' });
    } else if (day === 30) {
      logTitle = `Day 30: 30-Day Trial Complete`;
      logDesc = `All base life support checks completed after a full month on Mars.`;
      dailyLogType = 'success';
    }

    const coldLoadFactor = tempC < -60 ? 1 + ((-60 - tempC) / 15) * 0.05 : 1 - ((tempC + 60) / 15) * 0.02;
    const eventPowerLoadFactor = day === 16 ? 1.06 : day === 19 ? 1.12 : day === 25 ? 1.05 : 1.0;
    const powerConsumptionKW = Math.round(telemetry.powerDemandKW * coldLoadFactor * eventPowerLoadFactor * 10) / 10;

    const diurnalSolarJitter = day === 14 || day === 15 || day === 16 || day === 4 || day === 9
      ? 1.0
      : 1 + Math.sin(day * 0.35) * 0.03;
    const effectivePowerGen = telemetry.powerSupplyKW * solarMultiplier * diurnalSolarJitter;
    const powerProductionKW = Math.round(effectivePowerGen * 10) / 10;
    const dailyNetPower = powerProductionKW - powerConsumptionKW;

    // Impossible-site critical hazard stresses (e.g. Hellas storm surge, Olympus summit radiation & cold)
    if (site.isImpossible && day >= 14 && day <= 17 && nuclearCount < 2) {
      powerHealth = Math.max(0, powerHealth - 16);
      lifeSupportHealth = Math.max(0, lifeSupportHealth - 10);
    }
    if (site.isImpossible && day === 25 && !hasRadiationShelter) {
      lifeSupportHealth = Math.max(0, lifeSupportHealth - 35);
      crewMorale = Math.max(10, crewMorale - 25);
    }

    if (dailyNetPower < 0) {
      powerHealth = Math.max(0, powerHealth - 8);
      if (powerHealth <= 0 && passed) {
        passed = false;
        daysSurviving = day;
        criticalFailures.push(`Day ${day}: Electricity ran out completely. Heaters and air circulation shut down.`);
        problemSummary = {
          title: 'Colony Power Blackout',
          issue: `Base electrical reserves hit 0% on Day ${day} at ${site.name}.`,
          rootCause: `Power usage (${powerConsumptionKW} kW) exceeded generation (${powerProductionKW} kW), amplified by ${site.avgTempC}°C heating loads and dust-storm sunlight drops.`,
          fix: 'Add an extra Nuclear Power Pod or Power Generation Pod, plus Battery Storage Pods to survive dust storms.',
          failureDay: day,
          failedSystem: 'power',
        };
        anomalies.push({ day, label: 'Power Blackout', severity: 'critical', metric: 'power' });
        logTitle = `Day ${day}: Base Blackout`;
        logDesc = `Power reserves dropped to zero and critical life support systems lost electricity.`;
        dailyLogType = 'hazard';
      }
    } else {
      powerHealth = Math.min(100, powerHealth + 2);
    }

    const o2ProdMod = 1 + Math.sin(day * 0.45) * 0.025 + (day === 21 ? 0.06 : 0) - (solarMultiplier < 0.7 ? 0.07 : 0);
    const o2ConsMod = 1 + Math.cos(day * 0.5) * 0.025 + (day % 6 === 0 ? 0.07 : 0) + (day === 25 ? 0.05 : 0);
    const o2ProductionKg = Math.round(telemetry.o2SupplyKg * o2ProdMod * 10) / 10;
    const o2ConsumptionKg = Math.round(telemetry.o2DemandKg * o2ConsMod * 10) / 10;

    o2TankKg += o2ProductionKg - o2ConsumptionKg;
    if (o2TankKg <= 0 && passed) {
      o2TankKg = 0;
      passed = false;
      daysSurviving = day;
      criticalFailures.push(`Day ${day}: Breathable oxygen tanks ran empty.`);
      problemSummary = {
        title: 'Oxygen Supply Depleted',
        issue: `Breathable oxygen reserves ran dry on Day ${day} for your ${config.crewSize}-person crew.`,
        rootCause:
          site.oxygenPlantMultiplier < 0.75
            ? `Thin high-altitude air at ${site.name} reduced oxygen plant output to ${Math.round(site.oxygenPlantMultiplier * 100)}%, falling behind demand.`
            : `Daily oxygen demand (${o2ConsumptionKg} kg/day) exceeded production (${o2ProductionKg} kg/day).`,
        fix: 'Add a second Oxygen Generation Pod, Greenhouse Pods, or a Backup Life Support Pod.',
        failureDay: day,
        failedSystem: 'oxygen',
      };
      anomalies.push({ day, label: 'Oxygen Depleted', severity: 'critical', metric: 'oxygen' });
      logTitle = `Day ${day}: Oxygen Depleted`;
      logDesc = `The colony used up all backup oxygen tanks before enough fresh air could be made.`;
      dailyLogType = 'hazard';
    }

    const waterProdMod = 1 + Math.sin(day * 0.3 + 0.6) * 0.025 + (day === 21 ? 0.05 : 0);
    const waterConsMod = 1 + Math.cos(day * 0.4) * 0.03 + (day === 16 ? 0.07 : 0) + (day === 21 ? 0.04 : 0);
    const waterProductionL = Math.round(telemetry.waterSupplyL * waterProdMod * 10) / 10;
    const waterConsumptionL = Math.round(telemetry.waterDemandL * waterConsMod * 10) / 10;

    waterTankL += waterProductionL - waterConsumptionL;
    if (waterTankL <= 0 && passed) {
      waterTankL = 0;
      passed = false;
      daysSurviving = day;
      criticalFailures.push(`Day ${day}: Water reserves ran dry because demand exceeded recycling.`);
      problemSummary = {
        title: 'Water Reserves Exhausted',
        issue: `Base water storage ran completely empty on Day ${day}.`,
        rootCause: `Daily water consumption (${waterConsumptionL} L/day) outpaced recycling & extraction (${waterProductionL} L/day) at ${site.name}.`,
        fix:
          site.waterBonusL === 0
            ? 'This dry site has no underground ice—add a Water Recovery Pod and Water Purification Pod instead of drilling.'
            : 'Add a Water Extraction Pod or Water Recovery Pod to boost daily water supply.',
        failureDay: day,
        failedSystem: 'water',
      };
      anomalies.push({ day, label: 'Water Empty', severity: 'critical', metric: 'water' });
      logTitle = `Day ${day}: Water Exhausted`;
      logDesc = `Base water tanks emptied completely and could no longer supply drinking water or oxygen makers.`;
      dailyLogType = 'hazard';
    }

    const netFood = telemetry.foodSupplyKg - telemetry.foodDemandKg;
    foodPantryKg += netFood;
    if (foodPantryKg <= 0 && passed) {
      foodPantryKg = 0;
      passed = false;
      daysSurviving = day;
      criticalFailures.push(`Day ${day}: Food rations ran out before the next harvest.`);
      problemSummary = {
        title: 'Crew Food Pantry Empty',
        issue: `Food rations ran out on Day ${day}.`,
        rootCause: `Your ${config.crewSize} astronauts consumed ${telemetry.foodDemandKg} kg/day while base farms produced ${telemetry.foodSupplyKg} kg/day.`,
        fix: 'Add Greenhouse Pods, Hydroponics Pods, or Aeroponics Pods.',
        failureDay: day,
        failedSystem: 'food',
      };
      anomalies.push({ day, label: 'Food Depleted', severity: 'critical', metric: 'all' });
      logTitle = `Day ${day}: Food Supply Empty`;
      logDesc = `Stored rations and greenhouse harvests could not keep up with the crew's daily meals.`;
      dailyLogType = 'hazard';
    }

    if (telemetry.co2ScrubCapacityKg < telemetry.co2ProductionKg) {
      lifeSupportHealth = Math.max(0, lifeSupportHealth - 4);
    }

    if (lifeSupportHealth < 30 && passed) {
      passed = false;
      daysSurviving = day;
      const isHazardFailure = site.isImpossible && (!hasRadiationShelter || !hasBackupEclss);
      criticalFailures.push(
        isHazardFailure
          ? `Day ${day}: Extreme environmental hazards at ${site.name} damaged critical life-support systems.`
          : `Day ${day}: Carbon dioxide built up too high because air scrubbers could not keep pace.`
      );
      problemSummary = isHazardFailure
        ? {
            title: `Extreme Site Failure at ${site.name}`,
            issue: `Unprotected life-support systems failed under severe ${site.name} environmental hazards on Day ${day}.`,
            rootCause: site.impossibleReason || 'Extreme local storms, temperature drops, and thin atmosphere overwhelmed single-layer systems.',
            fix: 'Select a safer NASA landing site—or reinforce with 2x Nuclear Power, a Radiation Shelter Pod, and a Backup Life Support Pod.',
            failureDay: day,
            failedSystem: 'site_hazard',
          }
        : {
            title: 'Cabin Carbon Dioxide Overload',
            issue: `Indoor cabin air became unsafe on Day ${day}.`,
            rootCause: `Crew exhaled ${telemetry.co2ProductionKg} kg/day of CO2 while scrubbers only cleared ${telemetry.co2ScrubCapacityKg} kg/day.`,
            fix: 'Add a Carbon Dioxide Removal Pod or Air Filtration Pod.',
            failureDay: day,
            failedSystem: 'co2',
          };
      anomalies.push({ day, label: 'Life Support Failure', severity: 'critical', metric: 'oxygen' });
      logTitle = isHazardFailure ? `Day ${day}: Site Hazard Failure` : `Day ${day}: Cabin Air Unsafe`;
      logDesc = problemSummary.issue;
      dailyLogType = 'hazard';
    }

    if (telemetry.foodSupplyKg > 5) crewMorale = Math.min(100, crewMorale + 0.5);
    if (telemetry.netPowerKW < 0) crewMorale = Math.max(10, crewMorale - 5);

    logs.push({
      day,
      title: logTitle,
      description: logDesc,
      type: dailyLogType,
      o2Level: Math.max(0, Math.min(100, Math.round((o2TankKg / 150) * 100))),
      powerLevel: Math.round(powerHealth),
      waterLevel: Math.max(0, Math.min(100, Math.round((waterTankL / 600) * 100))),
      temperatureC: Math.round(tempC),
      o2ProductionKg,
      o2ConsumptionKg,
      waterProductionL,
      waterConsumptionL,
      powerProductionKW,
      powerConsumptionKW,
    });

    if (stopOnFailure && !passed && daysSurviving === day) {
      break;
    }
  }

  return {
    logs,
    passed,
    daysSurviving,
    criticalFailures,
    problemSummary,
    anomalies,
    powerHealth,
    lifeSupportHealth,
    crewMorale,
    o2TankKg,
    waterTankL,
  };
}

export function getResourceHistoryData(
  placedPods: PlacedPod[],
  config: MissionConfig,
  simulationResult: SimulationResult | null
): {
  logs: DailySimulationLog[];
  isProjected: boolean;
  isBaseCertified: boolean;
  missingEssentialCount: number;
  passed: boolean;
  daysSurviving: number;
  anomalies: SimulationAnomaly[];
} {
  if (simulationResult && simulationResult.logs.length > 0) {
    return {
      logs: simulationResult.logs,
      isProjected: false,
      isBaseCertified: true,
      missingEssentialCount: 0,
      passed: simulationResult.passed,
      daysSurviving: simulationResult.daysSurviving,
      anomalies: simulationResult.anomalies || [],
    };
  }

  const telemetry = calculateTelemetry(placedPods, config);
  const missingCheck = canLaunchSimulation(placedPods, config);
  const sim = simulateDailyTelemetryLogs(telemetry, config, false, placedPods);

  return {
    logs: sim.logs,
    isProjected: true,
    isBaseCertified: missingCheck.canLaunch,
    missingEssentialCount: missingCheck.missingCount,
    passed: missingCheck.canLaunch && sim.passed,
    daysSurviving: sim.daysSurviving,
    anomalies: sim.anomalies,
  };
}

export function run30DaySimulation(placedPods: PlacedPod[], config: MissionConfig): SimulationResult {
  const missingIds = getMissingEssentialPods(placedPods);
  const missingPodNames = missingIds.map((id) => POD_MAP.get(id)?.name || id);
  const telemetry = calculateTelemetry(placedPods, config);

  if (missingIds.length > 0) {
    return {
      passed: false,
      habitabilityScore: 12,
      daysSurviving: 0,
      totalDays: 30,
      criticalFailures: [
        `Base could not start: Missing ${missingIds.length} required Essential Pods: ${missingPodNames.join(', ')}.`,
      ],
      problemSummary: {
        title: 'Missing Essential Buildings',
        issue: `Base was missing ${missingIds.length} required Essential Pods before launch.`,
        rootCause: `Missing modules: ${missingPodNames.join(', ')}.`,
        fix: 'Place all 10 Essential Pods from the Essential category before launching.',
        failureDay: 0,
        failedSystem: 'missing_pods',
      },
      anomalies: [],
      systemBreakdown: {
        powerReliability: 0,
        oxygenStability: 0,
        waterReserve: 0,
        foodSustainability: 0,
        lifeSupportIntegrity: 0,
        crewMorale: 10,
      },
      actionableSteps: [
        'Place all 10 Essential Pods from the Essential category.',
        'Make sure total power generation is higher than total power usage.',
      ],
      logs: [],
    };
  }

  const {
    logs,
    passed,
    daysSurviving,
    criticalFailures,
    problemSummary,
    anomalies,
    powerHealth,
    lifeSupportHealth,
    crewMorale,
    o2TankKg,
    waterTankL,
  } = simulateDailyTelemetryLogs(telemetry, config, true, placedPods);

  const powerReliability = Math.max(0, Math.min(100, Math.round(powerHealth * (telemetry.netPowerKW >= 0 ? 1 : 0.4))));
  const oxygenStability = Math.max(0, Math.min(100, Math.round(Math.min(100, (o2TankKg / 150) * 100))));
  const waterReserve = Math.max(0, Math.min(100, Math.round(Math.min(100, (waterTankL / 600) * 100))));
  const foodSustainability = Math.max(
    0,
    Math.min(100, Math.round((telemetry.foodSupplyKg / Math.max(1, telemetry.foodDemandKg)) * 100))
  );
  const lifeSupportIntegrity = Math.max(0, Math.min(100, Math.round(lifeSupportHealth)));

  let habitabilityScore = Math.round(
    powerReliability * 0.25 +
      oxygenStability * 0.25 +
      waterReserve * 0.2 +
      lifeSupportIntegrity * 0.15 +
      foodSustainability * 0.1 +
      crewMorale * 0.05
  );

  if (!passed) {
    habitabilityScore = Math.min(48, habitabilityScore);
  }

  const actionableSteps: string[] = [];
  if (telemetry.netPowerKW < 20) {
    actionableSteps.push('Add an extra Nuclear Power Pod or Battery Storage Pod to handle 3-day dust storms.');
  }
  if (telemetry.netO2Kg < 5) {
    actionableSteps.push('Add a second Oxygen Generation Pod or Greenhouse Pod for a healthy oxygen margin.');
  }
  if (telemetry.netWaterL < 4) {
    actionableSteps.push('Add a Water Extraction Pod or Water Recovery Pod so water tanks stay full.');
  }
  if (telemetry.foodSupplyKg < telemetry.foodDemandKg) {
    actionableSteps.push('Expand with Hydroponics or Aeroponics Pods so the base grows enough fresh food.');
  }
  if (telemetry.co2ScrubCapacityKg < telemetry.co2ProductionKg) {
    actionableSteps.push('Add a Carbon Dioxide Removal Pod to keep indoor air fresh.');
  }
  if (actionableSteps.length === 0) {
    actionableSteps.push('Great base design! You can expand with Science Labs, Observatory Domes, or extra Rover Garages.');
  }

  return {
    passed,
    habitabilityScore,
    daysSurviving,
    totalDays: 30,
    criticalFailures,
    problemSummary,
    anomalies,
    systemBreakdown: {
      powerReliability,
      oxygenStability,
      waterReserve,
      foodSustainability,
      lifeSupportIntegrity,
      crewMorale: Math.round(crewMorale),
    },
    actionableSteps,
    logs,
  };
}
