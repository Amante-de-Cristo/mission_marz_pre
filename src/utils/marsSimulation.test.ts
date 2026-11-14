import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTelemetry,
  canLaunchSimulation,
  getMissingEssentialPods,
  run30DaySimulation,
  getResourceHistoryData,
  computeHelipadPlacements,
  isTileReservedForHelipad,
  getSiteRecommendedPods,
  rebalanceBaseForBudget,
} from './marsSimulation';
import { PRESET_MARS_BASE, ESSENTIAL_POD_IDS, getStarterBaseForSite } from './podCatalog';
import { MARS_LANDING_SITES, LANDING_SITE_MAP } from './landingSites';
import { MissionConfig, PlacedPod } from '../types';

const testConfig: MissionConfig = {
  isInfiniteBudget: false,
  constructionBudget: 25000000000,
  launchBudget: 15000000000,
  costPerKg: 15000,
  crewSize: 4,
  landingSiteId: 'jezero_crater',
};

const toPlacedPods = (template: Array<{ podId: string; gridX: number; gridZ: number; rotation: number }>): PlacedPod[] =>
  template.map((p, idx) => ({
    instanceId: `preset-${idx}`,
    podId: p.podId,
    gridX: p.gridX,
    gridZ: p.gridZ,
    rotation: p.rotation,
    placedAt: idx + 1,
  }));

test('MARS_LANDING_SITES contains all 18 required NASA Mars sites including Impossible sites', () => {
  assert.equal(MARS_LANDING_SITES.length, 18);
  const expectedNames = [
    'Chryse Planitia',
    'Utopia Planitia',
    'Ares Vallis',
    'Gusev Crater',
    'Meridiani Planum',
    'Vastitas Borealis',
    'Gale Crater',
    'Elysium Planitia',
    'Jezero Crater',
    'Arcadia Planitia',
    'Deuteronilus Mensae',
    'Amazonis Planitia',
    'Hebrus Valles',
    'Pavonis Mons',
    'Olympus Mons',
    'Valles Marineris',
    'Noctis Labyrinthus',
    'Hellas Planitia',
  ];
  const actualNames = new Set(MARS_LANDING_SITES.map((s) => s.name));
  for (const name of expectedNames) {
    assert.ok(actualNames.has(name), `Missing landing site: ${name}`);
  }
  const impossibleSites = MARS_LANDING_SITES.filter((s) => s.isImpossible);
  assert.ok(impossibleSites.length >= 2, 'Should classify extreme harsh sites as Impossible');
});

test('getStarterBaseForSite adapts base loadout to site environment and crew size', () => {
  const jezeroBase = getStarterBaseForSite('jezero_crater', 4);
  const polarBase = getStarterBaseForSite('vastitas_borealis', 4);
  const dryBase = getStarterBaseForSite('elysium_planitia', 4);
  const bigCrewBase = getStarterBaseForSite('jezero_crater', 7);

  assert.ok(polarBase.some((p) => p.podId === 'water_extraction_pod'));
  assert.ok(polarBase.some((p) => p.podId === 'nuclear_power_pod'));
  assert.ok(!dryBase.some((p) => p.podId === 'water_extraction_pod'));
  assert.ok(dryBase.some((p) => p.podId === 'water_recovery_pod'));
  assert.ok(
    bigCrewBase.filter((p) => p.podId === 'living_pod').length >
      jezeroBase.filter((p) => p.podId === 'living_pod').length,
    'Larger crew should scale living quarters'
  );
});

test('canLaunchSimulation returns false when pods are missing', () => {
  const emptyBase: PlacedPod[] = [];
  const check = canLaunchSimulation(emptyBase);
  assert.equal(check.canLaunch, false);
  assert.equal(check.missingCount, 10);
});

test('getMissingEssentialPods identifies exact missing pods', () => {
  const partialBase: PlacedPod[] = [
    { instanceId: '1', podId: 'living_pod', gridX: 0, gridZ: 0, rotation: 0, placedAt: 1 },
    { instanceId: '2', podId: 'oxygen_pod', gridX: 1, gridZ: 0, rotation: 0, placedAt: 2 },
  ];
  const missing = getMissingEssentialPods(partialBase);
  assert.equal(missing.length, 8);
  assert.ok(!missing.includes('living_pod'));
  assert.ok(!missing.includes('oxygen_pod'));
  assert.ok(missing.includes('water_pod'));
});

test('Preset base satisfies all 10 essential pods requirement', () => {
  const presetPods = toPlacedPods(PRESET_MARS_BASE);
  const check = canLaunchSimulation(presetPods);
  assert.equal(check.canLaunch, true);
  assert.equal(check.missingCount, 0);
  assert.equal(check.missingPodNames.length, 0);
});

test('Rover Garage Pods have unlimited cap and allocate non-overlapping nearby helipad tiles', () => {
  const pods: PlacedPod[] = [
    { instanceId: 'g1', podId: 'rover_garage_pod', gridX: 0, gridZ: 0, rotation: 0, placedAt: 1 },
    { instanceId: 'g2', podId: 'rover_garage_pod', gridX: 1, gridZ: 0, rotation: 0, placedAt: 2 },
    { instanceId: 'g3', podId: 'rover_garage_pod', gridX: 0, gridZ: 1, rotation: 0, placedAt: 3 },
  ];

  const unlimitedTelemetry = calculateTelemetry(pods, { ...testConfig, isInfiniteBudget: true });
  assert.equal(unlimitedTelemetry.podCaps['rover_garage_pod'].maxAllowed, Infinity);
  assert.equal(unlimitedTelemetry.categoryCaps['Transportation & Exploration'].maxAllowed, Infinity);

  const limitedTelemetry = calculateTelemetry(pods, testConfig);
  assert.ok(Number.isFinite(limitedTelemetry.podCaps['rover_garage_pod'].canAffordMore));
  assert.equal(
    limitedTelemetry.podCaps['rover_garage_pod'].maxAllowed,
    3 + limitedTelemetry.podCaps['rover_garage_pod'].canAffordMore
  );

  const helipads = computeHelipadPlacements(pods);
  assert.equal(helipads.length, 3);

  const coordSet = new Set(helipads.map((h) => `${h.gridX},${h.gridZ}`));
  assert.equal(coordSet.size, 3, 'Each garage must get a distinct helipad tile');

  for (const h of helipads) {
    assert.ok(!pods.some((p) => p.gridX === h.gridX && p.gridZ === h.gridZ));
    assert.equal(isTileReservedForHelipad(h.gridX, h.gridZ, pods), true);
  }
});

test('calculateTelemetry calculates correct power, O2, and water with preset base', () => {
  const presetPods = toPlacedPods(PRESET_MARS_BASE);
  const telemetry = calculateTelemetry(presetPods, testConfig);
  assert.ok(telemetry.powerSupplyKW >= 100, 'Power supply should include nuclear and solar');
  assert.ok(telemetry.netPowerKW > 0, 'Net power should be positive');
  assert.ok(telemetry.netO2Kg > 0, 'Oxygen balance should be positive');
  assert.ok(telemetry.totalCostUSD > 0, 'Total cost calculated');
  assert.ok(telemetry.budgetRemainingUSD < testConfig.constructionBudget, 'Budget remaining reflects spend');
});

test('Landing site modifier affects solar generation and oxygen extraction', () => {
  const presetPods = toPlacedPods(PRESET_MARS_BASE);
  const jezeroTel = calculateTelemetry(presetPods, { ...testConfig, landingSiteId: 'jezero_crater' });
  const elysiumTel = calculateTelemetry(presetPods, { ...testConfig, landingSiteId: 'elysium_planitia' });
  const olympusTel = calculateTelemetry(presetPods, { ...testConfig, landingSiteId: 'olympus_mons' });

  assert.ok(elysiumTel.powerSupplyKW > jezeroTel.powerSupplyKW, 'Elysium Planitia should boost solar output');
  assert.ok(olympusTel.o2SupplyKg < jezeroTel.o2SupplyKg, 'High-altitude Olympus Mons should reduce O2 splitter yield');
});

test('getSiteRecommendedPods adjusts recommended quantities dynamically for extreme sites & larger crews', () => {
  const olympus = LANDING_SITE_MAP.get('olympus_mons')!;
  const jezero = LANDING_SITE_MAP.get('jezero_crater')!;

  const recsOlympus = getSiteRecommendedPods(olympus, [], 7);
  const recsJezero = getSiteRecommendedPods(jezero, [], 2);

  const olympusLiving = recsOlympus.find((r) => r.podId === 'living_pod')!;
  const jezeroLiving = recsJezero.find((r) => r.podId === 'living_pod')!;
  assert.ok(olympusLiving.recommendedCount > jezeroLiving.recommendedCount);

  const olympusO2 = recsOlympus.find((r) => r.podId === 'oxygen_pod')!;
  assert.equal(olympusO2.recommendedCount, 2);
});

test('rebalanceBaseForBudget removes least critical pods automatically when budget shrinks', () => {
  const baseWithExtras: PlacedPod[] = [
    ...toPlacedPods(PRESET_MARS_BASE),
    { instanceId: 'rec-1', podId: 'entertainment_pod', gridX: 4, gridZ: 4, rotation: 0, placedAt: 200 },
    { instanceId: 'rec-2', podId: 'astronomy_observatory_pod', gridX: 4, gridZ: 5, rotation: 0, placedAt: 201 },
  ];

  // Tight $5.2B budget forces non-essential entertainment & observatory pods to be trimmed first
  const tightConfig: MissionConfig = {
    ...testConfig,
    isInfiniteBudget: false,
    constructionBudget: 5500000000,
    launchBudget: 15000000000,
  };

  const rebalanced = rebalanceBaseForBudget(baseWithExtras, tightConfig);
  assert.equal(rebalanced.wasRebalanced, true);
  assert.ok(rebalanced.removedPods.length > 0);
  assert.ok(rebalanced.warningMessage && rebalanced.warningMessage.includes('removed'));

  const newTel = calculateTelemetry(rebalanced.adjustedPods, tightConfig);
  assert.ok(newTel.totalCostUSD <= tightConfig.constructionBudget, 'Adjusted base must stay within construction budget');
  assert.ok(
    !rebalanced.adjustedPods.some((p) => p.instanceId === 'rec-1'),
    'Non-essential recreation pod should be removed before core essentials'
  );
});

test('run30DaySimulation succeeds with healthy preset base and includes anomaly triggers', () => {
  const presetPods = toPlacedPods(PRESET_MARS_BASE);
  const result = run30DaySimulation(presetPods, testConfig);
  assert.equal(result.passed, true);
  assert.equal(result.daysSurviving, 30);
  assert.ok(result.habitabilityScore >= 70, 'Habitability score should be high for preset base');
  assert.equal(result.logs.length, 30);
  assert.ok((result.anomalies?.length || 0) >= 3, 'Should highlight key events/anomalies');
});

test('run30DaySimulation stops immediately on exact failure day and generates structured problemSummary', () => {
  const overloadedBase: PlacedPod[] = ESSENTIAL_POD_IDS.map((id, idx) => ({
    instanceId: `ess-${idx}`,
    podId: id,
    gridX: idx - 5,
    gridZ: 0,
    rotation: 0,
    placedAt: idx,
  }));

  for (let i = 0; i < 6; i++) {
    overloadedBase.push({
      instanceId: `extra-green-${i}`,
      podId: 'greenhouse_pod',
      gridX: i - 3,
      gridZ: 2,
      rotation: 0,
      placedAt: 100 + i,
    });
  }

  const result = run30DaySimulation(overloadedBase, { ...testConfig, crewSize: 7 });
  assert.equal(result.passed, false);
  assert.ok(result.daysSurviving > 0 && result.daysSurviving < 30);
  assert.equal(result.logs.length, result.daysSurviving);
  assert.ok(result.criticalFailures.length > 0);
  assert.ok(result.problemSummary?.issue);
  assert.ok(result.problemSummary?.rootCause);
  assert.ok(result.problemSummary?.fix);
});

test('run30DaySimulation fails when essential pods are missing', () => {
  const invalidBase: PlacedPod[] = [
    { instanceId: '1', podId: 'living_pod', gridX: 0, gridZ: 0, rotation: 0, placedAt: 1 },
  ];
  const result = run30DaySimulation(invalidBase, testConfig);
  assert.equal(result.passed, false);
  assert.ok(result.criticalFailures.length > 0);
  assert.ok(result.criticalFailures[0].includes('Missing 9 required Essential Pods'));
});

test('getResourceHistoryData returns 30-day projection and recorded logs with anomalies', () => {
  const presetPods = toPlacedPods(PRESET_MARS_BASE);
  const projected = getResourceHistoryData(presetPods, testConfig, null);
  assert.equal(projected.isProjected, true);
  assert.equal(projected.isBaseCertified, true);
  assert.equal(projected.logs.length, 30);

  const simResult = run30DaySimulation(presetPods, testConfig);
  const recorded = getResourceHistoryData(presetPods, testConfig, simResult);
  assert.equal(recorded.isProjected, false);
  assert.equal(recorded.logs.length, 30);
  assert.ok(recorded.anomalies.length >= 3);
  assert.ok(
    recorded.logs.some((l) => l.day === 19 && l.title?.includes('Thermal Drop')),
    'Day 19 should trigger Sudden Thermal Drop hazard event'
  );
});

test('calculateTelemetry returns Infinity caps in Unlimited mode and dynamic canAffordMore in Limited mode', () => {
  const presetPods = toPlacedPods(PRESET_MARS_BASE);
  const unlimitedTel = calculateTelemetry(presetPods, { ...testConfig, isInfiniteBudget: true });
  assert.equal(unlimitedTel.podCaps['living_pod'].maxAllowed, Infinity);
  assert.equal(unlimitedTel.podCaps['living_pod'].canAffordMore, Infinity);
  assert.equal(unlimitedTel.categoryCaps['Essential'].maxAllowed, Infinity);

  const tightConfig: MissionConfig = {
    ...testConfig,
    isInfiniteBudget: false,
    constructionBudget: unlimitedTel.totalCostUSD + 1600000000, // room for 2 more $800M Living Pods
    launchBudget: 15000000000,
    costPerKg: 15000,
  };
  const limitedTel = calculateTelemetry(presetPods, tightConfig);
  assert.equal(limitedTel.podCaps['living_pod'].placed, 1);
  assert.equal(limitedTel.podCaps['living_pod'].canAffordMore, 2);
  assert.equal(limitedTel.podCaps['living_pod'].maxAllowed, 3);
});

test('canLaunchSimulation blocks launch until all Tips site-recommended targets are met', () => {
  // Only the 10 essentials — missing Greenhouse, Battery Storage, and Water Extraction recommended by Tips
  const essentialsOnly: PlacedPod[] = ESSENTIAL_POD_IDS.map((id, idx) => ({
    instanceId: `ess-${idx}`,
    podId: id,
    gridX: idx - 5,
    gridZ: 0,
    rotation: 0,
    placedAt: idx + 1,
  }));

  const blockedCheck = canLaunchSimulation(essentialsOnly, {
    ...testConfig,
    landingSiteId: 'jezero_crater',
    crewSize: 4,
  });
  assert.equal(blockedCheck.missingCount, 0);
  assert.ok(blockedCheck.unmetRecommendations.length > 0);
  assert.equal(blockedCheck.canLaunch, false);

  // Full site-matched starter base satisfies both essentials and Tips targets
  const starter = toPlacedPods(getStarterBaseForSite('jezero_crater', 4));
  const readyCheck = canLaunchSimulation(starter, {
    ...testConfig,
    landingSiteId: 'jezero_crater',
    crewSize: 4,
  });
  assert.equal(readyCheck.missingCount, 0);
  assert.equal(readyCheck.unmetRecommendations.length, 0);
  assert.equal(readyCheck.canLaunch, true);
});
