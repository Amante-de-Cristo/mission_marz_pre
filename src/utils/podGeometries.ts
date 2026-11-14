import * as THREE from 'three';
import { PodDefinition } from '../types';

// Shared materials caching for 60fps performance
const sharedMaterials = new Map<string, THREE.Material>();
const dynamicBeacons = new Set<THREE.MeshStandardMaterial>();

function getOrCreateMaterial(key: string, creator: () => THREE.Material): THREE.Material {
  if (!sharedMaterials.has(key)) {
    sharedMaterials.set(key, creator());
  }
  return sharedMaterials.get(key)!;
}

/**
 * Dynamically modulates interior/exterior lights across Habitat Pods, Observatory modules,
 * connecting tunnels, and pod roof beacons as power & day/night change.
 */
export function setColonyPowerLighting(powerFactor: number, nightFactor: number): void {
  const clampedPower = Math.max(0, Math.min(1, powerFactor));
  const clampedNight = Math.max(0, Math.min(1, nightFactor));
  // Brighter contrast at night when powered, sharp dimming when power drops low
  const nightBoost = 0.65 + clampedNight * 0.85;
  const effectiveIntensity = clampedPower < 0.08 ? 0.02 : Math.pow(clampedPower, 1.35) * nightBoost;

  const habInt = sharedMaterials.get('habitatInteriorLight') as THREE.MeshStandardMaterial | undefined;
  if (habInt) {
    habInt.emissiveIntensity = 0.02 + effectiveIntensity * 1.15;
    habInt.opacity = 0.35 + clampedPower * 0.55;
  }

  const habExt = sharedMaterials.get('habitatExteriorLight') as THREE.MeshStandardMaterial | undefined;
  if (habExt) {
    habExt.emissiveIntensity = 0.01 + effectiveIntensity * 1.35;
  }

  const obsInt = sharedMaterials.get('observatoryInteriorLight') as THREE.MeshStandardMaterial | undefined;
  if (obsInt) {
    obsInt.emissiveIntensity = 0.02 + effectiveIntensity * 1.25;
  }

  const obsExt = sharedMaterials.get('observatoryExteriorLight') as THREE.MeshStandardMaterial | undefined;
  if (obsExt) {
    obsExt.emissiveIntensity = 0.01 + effectiveIntensity * 1.35;
  }

  const tunnelStrip = sharedMaterials.get('tunnelStrip') as THREE.MeshStandardMaterial | undefined;
  if (tunnelStrip) {
    tunnelStrip.emissiveIntensity = 0.03 + clampedPower * 0.7;
  }

  const growLight = sharedMaterials.get('growLightMat') as THREE.MeshStandardMaterial | undefined;
  if (growLight) {
    growLight.emissiveIntensity = 0.04 + clampedPower * 0.8;
  }

  for (const beaconMat of dynamicBeacons) {
    beaconMat.emissiveIntensity = 0.03 + clampedPower * (0.75 + clampedNight * 0.45);
  }
}

// Soft radial sprite texture for blowing dust, frost crystals, and solar flare motes
export function createSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural Martian soil texture generator supporting landing-site color adaptation
export function createMarsRegolithTexture(
  baseHex: string = '#b34728',
  accentHex: string = '#7c2d12'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Deterministic dust, basalt pebbles, and wind-blown sand speckles
  for (let i = 0; i < 4200; i++) {
    const x = ((i * 173 + 19) % 512) + Math.sin(i * 1.7) * 2;
    const y = ((i * 293 + 37) % 512) + Math.cos(i * 1.3) * 2;
    const r = (i % 5) * 0.45 + 0.5;
    const tone = i % 10;
    if (tone < 3) {
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.42;
    } else if (tone < 7) {
      ctx.fillStyle = 'rgba(197, 94, 58, 0.45)';
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(232, 146, 102, 0.3)';
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dune ripples
  ctx.strokeStyle = 'rgba(64, 20, 10, 0.2)';
  ctx.lineWidth = 3.2;
  for (let y = 10; y < 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(150, y + 10, 350, y - 10, 512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Bump Map for Mars Surface
export function createMarsBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1800; i++) {
    const x = (i * 89 + 11) % 256;
    const y = (i * 137 + 23) % 256;
    const r = (i % 4) + 1;
    const v = 75 + ((i * 29) % 110);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

// Build procedural multi-part 3D model for any Pod Definition
export function createPodMesh(
  pod: PodDefinition,
  isGhost: boolean = false,
  isValidPlacement: boolean = true
): THREE.Group {
  const group = new THREE.Group();
  group.name = `pod_${pod.id}`;

  const opacity = isGhost ? 0.6 : 1.0;

  const ghostMat = (color: string) =>
    new THREE.MeshStandardMaterial({
      color: isValidPlacement ? (isGhost ? 0x22c55e : color) : 0xef4444,
      transparent: true,
      opacity,
      roughness: 0.35,
      metalness: 0.2,
      emissive: isValidPlacement ? 0x14532d : 0x7f1d1d,
      emissiveIntensity: 0.25,
    });

  const hullWhite = isGhost
    ? ghostMat('#ffffff')
    : (getOrCreateMaterial('hullWhite', () =>
        new THREE.MeshStandardMaterial({
          color: 0xeaeef6,
          metalness: 0.25,
          roughness: 0.38,
        })
      ) as THREE.MeshStandardMaterial);

  const hullDark = isGhost
    ? ghostMat('#222222')
    : (getOrCreateMaterial('hullDark', () =>
        new THREE.MeshStandardMaterial({
          color: 0x1e202c,
          metalness: 0.72,
          roughness: 0.32,
        })
      ) as THREE.MeshStandardMaterial);

  const accentMat = isGhost
    ? ghostMat(pod.colorAccent)
    : (getOrCreateMaterial(`accent_${pod.colorAccent}`, () =>
        new THREE.MeshStandardMaterial({
          color: pod.colorAccent,
          metalness: 0.45,
          roughness: 0.28,
          emissive: pod.colorAccent,
          emissiveIntensity: 0.28,
        })
      ) as THREE.MeshStandardMaterial);

  const goldThermalMat = isGhost
    ? ghostMat('#d97706')
    : (getOrCreateMaterial('goldThermal', () =>
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.88,
          roughness: 0.18,
        })
      ) as THREE.MeshStandardMaterial);

  const solarPanelMat = isGhost
    ? ghostMat('#0284c7')
    : (getOrCreateMaterial('solarPanel', () =>
        new THREE.MeshStandardMaterial({
          color: 0x0b1f3b,
          metalness: 0.85,
          roughness: 0.12,
          emissive: 0x0c4a6e,
          emissiveIntensity: 0.25,
        })
      ) as THREE.MeshStandardMaterial);

  const glassMat = isGhost
    ? ghostMat('#38bdf8')
    : (getOrCreateMaterial('glassCupola', () =>
        new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          metalness: 0.15,
          roughness: 0.1,
          transparent: true,
          opacity: 0.62,
        })
      ) as THREE.MeshStandardMaterial);

  const habitatInteriorLightMat = isGhost
    ? ghostMat('#fde68a')
    : (getOrCreateMaterial('habitatInteriorLight', () =>
        new THREE.MeshStandardMaterial({
          color: 0xfef3c7,
          emissive: 0xffc857,
          emissiveIntensity: 0.95,
          metalness: 0.1,
          roughness: 0.18,
          transparent: true,
          opacity: 0.88,
        })
      ) as THREE.MeshStandardMaterial);

  const habitatExteriorLightMat = isGhost
    ? ghostMat('#fcd34d')
    : (getOrCreateMaterial('habitatExteriorLight', () =>
        new THREE.MeshStandardMaterial({
          color: 0xfffbeb,
          emissive: 0xfde047,
          emissiveIntensity: 1.05,
          roughness: 0.2,
          metalness: 0.1,
        })
      ) as THREE.MeshStandardMaterial);

  const observatoryInteriorLightMat = isGhost
    ? ghostMat('#c4b5fd')
    : (getOrCreateMaterial('observatoryInteriorLight', () =>
        new THREE.MeshStandardMaterial({
          color: 0xe9d5ff,
          emissive: 0xa78bfa,
          emissiveIntensity: 1.05,
          roughness: 0.2,
          metalness: 0.15,
        })
      ) as THREE.MeshStandardMaterial);

  const observatoryExteriorLightMat = isGhost
    ? ghostMat('#93c5fd')
    : (getOrCreateMaterial('observatoryExteriorLight', () =>
        new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x38bdf8,
          emissiveIntensity: 1.05,
          roughness: 0.2,
          metalness: 0.15,
        })
      ) as THREE.MeshStandardMaterial);

  const foliageMat = isGhost
    ? ghostMat('#22c55e')
    : (getOrCreateMaterial('foliageGreen', () =>
        new THREE.MeshStandardMaterial({
          color: 0x16a34a,
          metalness: 0.08,
          roughness: 0.82,
        })
      ) as THREE.MeshStandardMaterial);

  // 1. Ground Leveling Footpads & Struts
  const padGeo = new THREE.CylinderGeometry(0.55, 0.75, 0.25, 8);
  const strutGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.95, 6);
  const legPositions = [
    [-1.6, 0.12, -1.6],
    [1.6, 0.12, -1.6],
    [-1.6, 0.12, 1.6],
    [1.6, 0.12, 1.6],
  ];

  for (const [lx, ly, lz] of legPositions) {
    const pad = new THREE.Mesh(padGeo, hullDark);
    pad.position.set(lx, ly, lz);
    pad.castShadow = !isGhost;
    group.add(pad);

    const strut = new THREE.Mesh(strutGeo, hullDark);
    strut.position.set(lx * 0.8, 0.55, lz * 0.8);
    strut.rotation.z = lx > 0 ? -0.22 : 0.22;
    strut.rotation.x = lz > 0 ? 0.22 : -0.22;
    group.add(strut);
  }

  // 2. Subfloor Platform
  const floorGeo = new THREE.CylinderGeometry(2.2, 2.35, 0.45, 8);
  const floorMesh = new THREE.Mesh(floorGeo, hullDark);
  floorMesh.position.y = 0.85;
  floorMesh.castShadow = !isGhost;
  group.add(floorMesh);

  // 3. Primary Main Hull Geometry
  const mt = pod.modelType;

  if (mt === 'living' || mt === 'atrium_dome' || mt === 'rec_hall') {
    const domeGeo = new THREE.SphereGeometry(1.9, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const mainHull = new THREE.Mesh(domeGeo, hullWhite);
    mainHull.position.y = 1.05;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    for (let w = 0; w < 6; w++) {
      const wAngle = (w * Math.PI) / 3;
      const winGeo = new THREE.BoxGeometry(0.46, 0.36, 0.08);
      const win = new THREE.Mesh(winGeo, habitatInteriorLightMat);
      win.position.set(Math.sin(wAngle) * 1.82, 1.9, Math.cos(wAngle) * 1.82);
      win.rotation.y = wAngle;
      group.add(win);
    }

    // Exterior porch floodlight fixtures on habitat perimeter
    for (let f = 0; f < 4; f++) {
      const fAngle = (f * Math.PI) / 2 + Math.PI / 4;
      const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.14), habitatExteriorLightMat);
      sconce.position.set(Math.sin(fAngle) * 2.08, 1.32, Math.cos(fAngle) * 2.08);
      sconce.rotation.y = fAngle;
      group.add(sconce);
    }

    const cupolaGeo = new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const cupola = new THREE.Mesh(cupolaGeo, habitatInteriorLightMat);
    cupola.position.y = 2.75;
    group.add(cupola);

    const spireGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.2, 6);
    const spire = new THREE.Mesh(spireGeo, hullDark);
    spire.position.y = 3.8;
    group.add(spire);
  } else if (mt === 'observatory') {
    const obsBase = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.0, 1.35, 12), hullWhite);
    obsBase.position.y = 1.7;
    obsBase.castShadow = !isGhost;
    group.add(obsBase);

    const obsDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.72, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hullWhite
    );
    obsDome.position.y = 2.35;
    obsDome.castShadow = !isGhost;
    group.add(obsDome);

    // Illuminated dome slit aperture & interior instrument light
    const slitGlow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 1.72), observatoryInteriorLightMat);
    slitGlow.position.set(0, 3.05, 0.45);
    slitGlow.rotation.x = -0.35;
    group.add(slitGlow);

    // Protruding optical telescope barrel
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.55, 12), hullDark);
    scopeTube.position.set(0, 3.42, 0.92);
    scopeTube.rotation.x = Math.PI * 0.34;
    scopeTube.castShadow = !isGhost;
    group.add(scopeTube);

    const lensRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12), observatoryInteriorLightMat);
    lensRim.position.set(0, 3.79, 1.58);
    lensRim.rotation.x = Math.PI * 0.34;
    group.add(lensRim);

    // Exterior perimeter safety lights around observatory platform
    for (let f = 0; f < 4; f++) {
      const fAngle = (f * Math.PI) / 2;
      const extLamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.12), observatoryExteriorLightMat);
      extLamp.position.set(Math.sin(fAngle) * 1.98, 2.15, Math.cos(fAngle) * 1.98);
      extLamp.rotation.y = fAngle;
      group.add(extLamp);
    }
  } else if (mt === 'greenhouse' || mt === 'hydroponics' || mt === 'aeroponics') {
    const bioGeo = new THREE.CylinderGeometry(1.85, 2.05, 1.6, 6);
    const mainHull = new THREE.Mesh(bioGeo, hullWhite);
    mainHull.position.y = 1.85;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const roofGeo = new THREE.ConeGeometry(1.95, 1.2, 6);
    const roofMesh = new THREE.Mesh(roofGeo, glassMat);
    roofMesh.position.y = 3.25;
    group.add(roofMesh);

    for (let c = 0; c < 5; c++) {
      const cAngle = (c * Math.PI * 2) / 5;
      const plantGeo = new THREE.DodecahedronGeometry(0.35, 0);
      const plant = new THREE.Mesh(plantGeo, foliageMat);
      plant.position.set(Math.cos(cAngle) * 0.9, 1.65, Math.sin(cAngle) * 0.9);
      group.add(plant);
    }

    const growLightGeo = new THREE.BoxGeometry(0.2, 0.1, 2.4);
    const growLightMat = isGhost
      ? ghostMat('#ec4899')
      : (getOrCreateMaterial('growLightMat', () =>
          new THREE.MeshStandardMaterial({
            color: 0xec4899,
            emissive: 0xec4899,
            emissiveIntensity: 0.75,
          })
        ) as THREE.MeshStandardMaterial);
    const growLight = new THREE.Mesh(growLightGeo, growLightMat);
    growLight.position.y = 2.6;
    group.add(growLight);
  } else if (mt === 'nuclear' || mt === 'smr_nuclear') {
    const coreGeo = new THREE.CylinderGeometry(1.25, 1.45, 2.4, 12);
    const mainHull = new THREE.Mesh(coreGeo, hullDark);
    mainHull.position.y = 2.05;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const coreRingGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.35, 16);
    const coreRingMat = isGhost
      ? ghostMat('#eab308')
      : new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.75,
        });
    const coreRing = new THREE.Mesh(coreRingGeo, coreRingMat);
    coreRing.position.y = 2.1;
    group.add(coreRing);

    const torusGeo = new THREE.TorusGeometry(1.55, 0.25, 8, 16);
    const torus = new THREE.Mesh(torusGeo, goldThermalMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 2.7;
    group.add(torus);

    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      const finGeo = new THREE.BoxGeometry(0.08, 1.8, 1.0);
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.position.set(Math.cos(angle) * 1.6, 2.4, Math.sin(angle) * 1.6);
      fin.rotation.y = angle;
      group.add(fin);
    }
  } else if (mt === 'solar_array') {
    const hubGeo = new THREE.CylinderGeometry(1.15, 1.35, 1.3, 8);
    const mainHull = new THREE.Mesh(hubGeo, hullWhite);
    mainHull.position.y = 1.7;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const wingGeo = new THREE.BoxGeometry(4.2, 0.08, 1.35);
    const wing = new THREE.Mesh(wingGeo, solarPanelMat);
    wing.position.set(0, 2.5, 0);
    wing.rotation.z = 0.15;
    group.add(wing);

    const mastGeo = new THREE.CylinderGeometry(0.14, 0.16, 1.4, 6);
    const mast = new THREE.Mesh(mastGeo, hullDark);
    mast.position.y = 2.0;
    group.add(mast);
  } else if (mt === 'garage' || mt === 'veh_service') {
    const garageGeo = new THREE.BoxGeometry(3.6, 2.0, 3.2);
    const mainHull = new THREE.Mesh(garageGeo, hullWhite);
    mainHull.position.y = 2.05;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const doorGeo = new THREE.PlaneGeometry(2.0, 1.5);
    const doorMat = isGhost
      ? ghostMat('#ffaa00')
      : new THREE.MeshStandardMaterial({
          color: 0x334155,
          metalness: 0.78,
          roughness: 0.3,
        });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.8, 1.62);
    group.add(door);

    const rampGeo = new THREE.BoxGeometry(2.2, 0.15, 1.4);
    const ramp = new THREE.Mesh(rampGeo, hullDark);
    ramp.position.set(0, 0.75, 2.25);
    ramp.rotation.x = 0.38;
    group.add(ramp);

    const hazardGeo = new THREE.BoxGeometry(2.1, 0.12, 0.05);
    const hazard = new THREE.Mesh(hazardGeo, accentMat);
    hazard.position.set(0, 2.6, 1.63);
    group.add(hazard);
  } else if (mt === 'oxygen') {
    const plantGeo = new THREE.CylinderGeometry(1.6, 1.8, 1.5, 8);
    const mainHull = new THREE.Mesh(plantGeo, hullWhite);
    mainHull.position.y = 1.8;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const sphereGeo = new THREE.SphereGeometry(0.65, 12, 8);
    const tank1 = new THREE.Mesh(sphereGeo, hullWhite);
    tank1.position.set(-0.7, 2.9, 0);
    group.add(tank1);

    const tank2 = new THREE.Mesh(sphereGeo, hullWhite);
    tank2.position.set(0.7, 2.9, 0);
    group.add(tank2);

    const bandGeo = new THREE.TorusGeometry(0.66, 0.06, 6, 16);
    const bandMat = isGhost ? ghostMat('#06b6d4') : accentMat;
    const band1 = new THREE.Mesh(bandGeo, bandMat);
    band1.position.set(-0.7, 2.9, 0);
    band1.rotation.x = Math.PI / 2;
    group.add(band1);

    const band2 = new THREE.Mesh(bandGeo, bandMat);
    band2.position.set(0.7, 2.9, 0);
    band2.rotation.x = Math.PI / 2;
    group.add(band2);
  } else if (mt === 'battery_bank') {
    const bankGeo = new THREE.BoxGeometry(3.2, 1.9, 3.2);
    const mainHull = new THREE.Mesh(bankGeo, hullDark);
    mainHull.position.y = 2.0;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    for (let b = 0; b < 3; b++) {
      const cellGeo = new THREE.BoxGeometry(0.6, 0.8, 2.6);
      const cell = new THREE.Mesh(cellGeo, goldThermalMat);
      cell.position.set((b - 1) * 0.9, 2.2, 0);
      group.add(cell);
    }
  } else if (mt === 'comm') {
    const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 1.4, 8);
    const mainHull = new THREE.Mesh(baseGeo, hullWhite);
    mainHull.position.y = 1.75;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const dishGeo = new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.35);
    const dish = new THREE.Mesh(dishGeo, goldThermalMat);
    dish.rotation.x = Math.PI * 0.75;
    dish.position.set(0, 3.3, 0.4);
    group.add(dish);

    const feedGeo = new THREE.ConeGeometry(0.16, 0.8, 6);
    const feed = new THREE.Mesh(feedGeo, accentMat);
    feed.position.set(0, 3.6, 0.9);
    feed.rotation.x = Math.PI * 0.75;
    group.add(feed);
  } else {
    const cylGeo = new THREE.CylinderGeometry(1.75, 1.95, 1.7, 8);
    const mainHull = new THREE.Mesh(cylGeo, hullWhite);
    mainHull.position.y = 1.9;
    mainHull.castShadow = !isGhost;
    group.add(mainHull);

    const roofCapGeo = new THREE.CylinderGeometry(1.2, 1.75, 0.45, 8);
    const roofCap = new THREE.Mesh(roofCapGeo, hullDark);
    roofCap.position.y = 2.95;
    group.add(roofCap);

    const equipBoxGeo = new THREE.BoxGeometry(0.9, 0.5, 0.9);
    const equipBox = new THREE.Mesh(equipBoxGeo, accentMat);
    equipBox.position.set(0, 3.35, 0);
    group.add(equipBox);
  }

  // 4. Mission Accent Band
  const bandGeo = new THREE.CylinderGeometry(1.85, 1.95, 0.28, 8);
  const bandMesh = new THREE.Mesh(bandGeo, accentMat);
  bandMesh.position.y = 1.7;
  group.add(bandMesh);

  // 5. Four Airtight Connection Collars
  const portGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.52, 8);
  const portPositions = [
    { x: 0, z: 2.0, ry: 0 },
    { x: 0, z: -2.0, ry: Math.PI },
    { x: 2.0, z: 0, ry: Math.PI / 2 },
    { x: -2.0, z: 0, ry: -Math.PI / 2 },
  ];

  for (const pos of portPositions) {
    const port = new THREE.Mesh(portGeo, hullDark);
    port.rotation.x = Math.PI / 2;
    port.rotation.z = pos.ry;
    port.position.set(pos.x, 1.35, pos.z);
    group.add(port);

    const ringGeo = new THREE.RingGeometry(0.35, 0.48, 8);
    const ring = new THREE.Mesh(ringGeo, accentMat);
    ring.position.set(pos.x * 1.05, 1.35, pos.z * 1.05);
    ring.rotation.y = pos.ry;
    group.add(ring);
  }

  // 6. Roof Status Light
  const beaconGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const beaconMat = isGhost
    ? new THREE.MeshStandardMaterial({
        color: pod.colorAccent,
        emissive: pod.colorAccent,
        emissiveIntensity: 0.3,
      })
    : (getOrCreateMaterial(`beacon_${pod.colorAccent}`, () => {
        const mat = new THREE.MeshStandardMaterial({
          color: pod.colorAccent,
          emissive: pod.colorAccent,
          emissiveIntensity: 0.8,
        });
        dynamicBeacons.add(mat);
        return mat;
      }) as THREE.MeshStandardMaterial);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 3.5;
  group.add(beacon);

  return group;
}

// Procedural Connection Tunnel between adjacent pods
export function createConnectionTunnelMesh(
  x1: number,
  z1: number,
  x2: number,
  z2: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tunnel_connector';

  const midX = (x1 + x2) / 2;
  const midZ = (z1 + z2) / 2;
  const length = Math.hypot(x2 - x1, z2 - z1);
  const angle = Math.atan2(x2 - x1, z2 - z1);

  const hullMat = getOrCreateMaterial('tunnelHull', () =>
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.65,
      roughness: 0.35,
    })
  );

  const ringMat = getOrCreateMaterial('tunnelRing', () =>
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    })
  );

  const stripMat = getOrCreateMaterial('tunnelStrip', () =>
    new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x5b2c98,
      emissiveIntensity: 0.6,
    })
  );

  const tubeGeo = new THREE.CylinderGeometry(0.46, 0.46, length - 1.2, 12);
  const tube = new THREE.Mesh(tubeGeo, hullMat);
  tube.rotation.x = Math.PI / 2;
  group.add(tube);

  const ribCount = 3;
  for (let i = 0; i < ribCount; i++) {
    const offset = ((i - (ribCount - 1) / 2) * (length - 1.8)) / ribCount;
    const ribGeo = new THREE.TorusGeometry(0.52, 0.08, 6, 12);
    const rib = new THREE.Mesh(ribGeo, ringMat);
    rib.position.z = offset;
    group.add(rib);
  }

  const stripGeo = new THREE.BoxGeometry(0.08, 0.04, length - 1.4);
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.y = 0.49;
  group.add(strip);

  group.position.set(midX, 1.35, midZ);
  group.rotation.y = angle;

  return group;
}

// Perseverance-Style 6-Wheel NASA Mars Rover with Rotating Wheels, Mastcam, RTG Tail & Science Arm
export function createRoverMesh(): THREE.Group {
  const rover = new THREE.Group();
  rover.name = 'mars_rover';

  const bodyMat = getOrCreateMaterial('roverWhiteBody', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.35,
      roughness: 0.38,
    })
  );

  const goldFoilMat = getOrCreateMaterial('roverGoldFoil', () =>
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.2,
    })
  );

  const chassisMat = getOrCreateMaterial('roverChassis', () =>
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.28,
    })
  );

  const wheelMat = getOrCreateMaterial('roverWheel', () =>
    new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.55,
      roughness: 0.65,
    })
  );

  const lensMat = getOrCreateMaterial('roverLens', () =>
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.1,
    })
  );

  // 1. Warm Electronics Box ("WEB" body)
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.48, 1.55), bodyMat);
  body.position.y = 0.66;
  body.castShadow = true;
  rover.add(body);

  // Side gold thermal foil panels
  const foil = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 1.05), goldFoilMat);
  foil.position.set(0, 0.62, 0.05);
  rover.add(foil);

  // 2. Top Avionics Deck + High-Gain Dish Antenna
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 1.62), chassisMat);
  deck.position.y = 0.92;
  rover.add(deck);

  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.08, 0.08, 12), bodyMat);
  dish.position.set(-0.35, 1.08, -0.45);
  dish.rotation.x = -0.35;
  rover.add(dish);

  // 3. Rear Finned Nuclear Power Tail (MMRTG)
  const rtgCore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.65, 8), chassisMat);
  rtgCore.position.set(0, 0.86, -0.95);
  rtgCore.rotation.x = -Math.PI * 0.35;
  rover.add(rtgCore);

  for (let f = 0; f < 4; f++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.42), goldFoilMat);
    fin.position.set(0, 0.86, -0.95);
    fin.rotation.y = (f * Math.PI) / 4;
    fin.rotation.x = -Math.PI * 0.35;
    rover.add(fin);
  }

  // 4. Camera Mast + Pivoted Stereo Mastcam Head
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.8, 8), bodyMat);
  mast.position.set(0.28, 1.32, 0.48);
  rover.add(mast);

  const mastHead = new THREE.Group();
  mastHead.position.set(0.28, 1.74, 0.48);
  const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), bodyMat);
  mastHead.add(headBox);

  const leftEye = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), lensMat);
  leftEye.rotation.x = Math.PI / 2;
  leftEye.position.set(-0.08, 0.01, 0.1);
  mastHead.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), lensMat);
  rightEye.rotation.x = Math.PI / 2;
  rightEye.position.set(0.08, 0.01, 0.1);
  mastHead.add(rightEye);

  const laserCyclops = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), lensMat);
  laserCyclops.rotation.x = Math.PI / 2;
  laserCyclops.position.set(0, 0.02, 0.11);
  mastHead.add(laserCyclops);
  rover.add(mastHead);

  // 5. Six Cleated Rocker-Bogie Wheels & Suspension Struts
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.22, 12);
  const hubGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.24, 8);
  const wheelOffsets: [number, number, number][] = [
    [-0.76, 0.24, 0.62],
    [0.76, 0.24, 0.62],
    [-0.82, 0.24, 0.0],
    [0.82, 0.24, 0.0],
    [-0.76, 0.24, -0.62],
    [0.76, 0.24, -0.62],
  ];

  const wheels: THREE.Group[] = [];
  for (const [wx, wy, wz] of wheelOffsets) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);

    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const hub = new THREE.Mesh(hubGeo, goldFoilMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    rover.add(wheelGroup);
    wheels.push(wheelGroup);

    // Suspension strut connecting wheel to chassis
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.06), chassisMat);
    strut.position.set(wx * 0.82, 0.44, wz * 0.88);
    strut.rotation.z = wx > 0 ? 0.35 : -0.35;
    rover.add(strut);
  }

  // 6. Articulated Front Robotic Science Arm + Sample Drill Turret
  const armShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), chassisMat);
  armShoulder.position.set(-0.26, 0.56, 0.88);
  armShoulder.rotation.x = 0.22;
  rover.add(armShoulder);

  const armFore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.36), bodyMat);
  armFore.position.set(-0.18, 0.44, 1.15);
  armFore.rotation.x = 0.55;
  rover.add(armFore);

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 8), goldFoilMat);
  turret.position.set(-0.15, 0.32, 1.32);
  turret.rotation.x = Math.PI / 2;
  rover.add(turret);

  rover.userData = { wheels, mastHead };
  rover.scale.set(0.85, 0.85, 0.85);
  return rover;
}

// Articulated Multi-Joint NASA Mars EVA Astronaut (Pivoted Hips, Shoulders & Elbows/Hands)
export interface AstronautLimbs {
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
}

export function createAstronautMesh(suitAccentColor: number | string = '#8B5CF6'): THREE.Group {
  const astronaut = new THREE.Group();
  astronaut.name = 'astronaut_eva';

  const suitMat = getOrCreateMaterial('astroSuit', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.55,
      metalness: 0.12,
    })
  );

  const jointMat = getOrCreateMaterial('astroJoint', () =>
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.65,
      metalness: 0.25,
    })
  );

  const visorMat = getOrCreateMaterial('astroVisor', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.08,
      emissive: 0xd97706,
      emissiveIntensity: 0.18,
    })
  );

  const packMat = getOrCreateMaterial('astroPack', () =>
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.5,
    })
  );

  const accentMat = new THREE.MeshStandardMaterial({
    color: suitAccentColor,
    roughness: 0.45,
  });

  // 1. Torso & Waist Belt
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.52, 10), suitMat);
  torso.position.y = 0.72;
  torso.castShadow = true;
  astronaut.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), accentMat);
  belt.position.y = 0.5;
  astronaut.add(belt);

  const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.1), accentMat);
  chestPack.position.set(0, 0.78, 0.21);
  astronaut.add(chestPack);

  // 2. Helmet & Reflective Gold Sun Visor
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), suitMat);
  helmet.position.y = 1.13;
  helmet.castShadow = true;
  astronaut.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    visorMat
  );
  visor.position.set(0, 1.13, 0.07);
  visor.rotation.x = Math.PI * 0.36;
  astronaut.add(visor);

  // 3. Life Support Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.2), packMat);
  pack.position.set(0, 0.78, -0.22);
  astronaut.add(pack);

  const packAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6), jointMat);
  packAntenna.position.set(0.1, 1.1, -0.25);
  astronaut.add(packAntenna);

  // 4. Articulated Arms (Shoulder Pivot -> Upper Arm -> Elbow Pivot -> Forearm -> Glove Hand)
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29, 0.91, 0);

    const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), jointMat);
    shoulder.add(shoulderJoint);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.22, 8), suitMat);
    upperArm.position.set(side * 0.02, -0.11, 0);
    upperArm.rotation.z = -side * 0.12;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(side * 0.03, -0.22, 0);

    const elbowRing = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), accentMat);
    elbow.add(elbowRing);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.056, 0.21, 8), suitMat);
    forearm.position.set(0, -0.11, 0.02);
    elbow.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.11), packMat);
    glove.position.set(0, -0.24, 0.03);
    elbow.add(glove);

    shoulder.add(elbow);
    astronaut.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // 5. Articulated Legs (Hip Pivot -> Thigh -> Knee -> Shin -> Heavy Mars Boot)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.46, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.22, 8), suitMat);
    thigh.position.y = -0.11;
    hip.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 8), jointMat);
    knee.position.y = -0.22;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.18, 8), suitMat);
    shin.position.y = -0.32;
    hip.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.23), packMat);
    boot.position.set(0, -0.41, 0.04);
    hip.add(boot);

    astronaut.add(hip);
    return hip;
  };

  const leftHip = buildLeg(-1);
  const rightHip = buildLeg(1);

  astronaut.userData.limbs = {
    leftHip,
    rightHip,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
  } satisfies AstronautLimbs;

  astronaut.scale.set(0.85, 0.85, 0.85);
  return astronaut;
}

// Ingenuity-Style Mars Mini-Helicopter Model
export function createMarsHelicopterMesh(): THREE.Group {
  const heli = new THREE.Group();
  heli.name = 'mars_helicopter';

  const bodyMat = getOrCreateMaterial('heliBody', () =>
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.75,
      roughness: 0.25,
    })
  );

  const solarMat = getOrCreateMaterial('heliSolar', () =>
    new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      metalness: 0.9,
      roughness: 0.12,
    })
  );

  const rotorMat = getOrCreateMaterial('heliRotor', () =>
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.22,
    })
  );

  const legMat = getOrCreateMaterial('heliLeg', () =>
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.25,
    })
  );

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.38), bodyMat);
  body.position.y = 0.48;
  body.castShadow = true;
  heli.add(body);

  const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const angle of legAngles) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.55, 6), legMat);
    const lx = Math.cos(angle) * 0.28;
    const lz = Math.sin(angle) * 0.28;
    leg.position.set(lx, 0.24, lz);
    leg.rotation.z = Math.cos(angle) * 0.5;
    leg.rotation.x = -Math.sin(angle) * 0.5;
    heli.add(leg);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8), legMat);
    pad.position.set(lx * 1.5, 0.01, lz * 1.5);
    heli.add(pad);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8), legMat);
  mast.position.y = 0.92;
  heli.add(mast);

  const solar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.46), solarMat);
  solar.position.y = 1.26;
  heli.add(solar);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), legMat);
  antenna.position.y = 1.4;
  heli.add(antenna);

  const lowerRotorGroup = new THREE.Group();
  lowerRotorGroup.position.y = 0.8;
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.015, 0.09), rotorMat);
  lowerRotorGroup.add(blade1);
  heli.add(lowerRotorGroup);

  const upperRotorGroup = new THREE.Group();
  upperRotorGroup.position.y = 1.06;
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.015, 0.09), rotorMat);
  upperRotorGroup.add(blade2);
  heli.add(upperRotorGroup);

  heli.userData = {
    lowerRotor: lowerRotorGroup,
    upperRotor: upperRotorGroup,
  };

  heli.scale.set(0.92, 0.92, 0.92);
  return heli;
}

// Painted Helicopter Landing Pad on Martian Surface (offset to avoid Z-fighting)
export function createLandingPadMesh(): THREE.Group {
  const pad = new THREE.Group();
  pad.name = 'helicopter_landing_pad';

  const baseMat = getOrCreateMaterial('heliPadBase', () =>
    new THREE.MeshStandardMaterial({
      color: 0x1e1b2e,
      metalness: 0.45,
      roughness: 0.65,
    })
  );

  const ringMat = getOrCreateMaterial('heliPadRing', () =>
    new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.35,
      roughness: 0.4,
    })
  );

  const markMat = getOrCreateMaterial('heliPadH', () =>
    new THREE.MeshStandardMaterial({
      color: 0xe9d5ff,
      metalness: 0.2,
      roughness: 0.5,
    })
  );

  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.8, 0.08, 24), baseMat);
  slab.position.y = 0.04;
  slab.receiveShadow = true;
  pad.add(slab);

  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.42, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.086;
  pad.add(ring);

  // "H" landing marking
  const leftBar = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.0), markMat);
  leftBar.rotation.x = -Math.PI / 2;
  leftBar.position.set(-0.34, 0.088, 0);
  pad.add(leftBar);

  const rightBar = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.0), markMat);
  rightBar.rotation.x = -Math.PI / 2;
  rightBar.position.set(0.34, 0.088, 0);
  pad.add(rightBar);

  const crossBar = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.18), markMat);
  crossBar.rotation.x = -Math.PI / 2;
  crossBar.position.set(0, 0.089, 0);
  pad.add(crossBar);

  return pad;
}

// NASA Orion-Style Deep Space Exploration Spacecraft (Capsule + Service Module + 4 Solar Wings + Engine Plume)
export function createSpacecraftMesh(): THREE.Group {
  const craft = new THREE.Group();
  craft.name = 'orion_spacecraft';

  const hullMat = getOrCreateMaterial('orionHull', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.42,
    })
  );

  const darkMat = getOrCreateMaterial('orionDark', () =>
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.65,
    })
  );

  const goldHeatMat = getOrCreateMaterial('orionHeat', () =>
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.22,
    })
  );

  const solarMat = getOrCreateMaterial('orionSolar', () =>
    new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      metalness: 0.88,
      roughness: 0.12,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.18,
    })
  );

  const plumeMat = getOrCreateMaterial('orionPlume', () =>
    new THREE.MeshStandardMaterial({
      color: 0xc4b5fd,
      emissive: 0x8b5cf6,
      emissiveIntensity: 1.25,
      transparent: true,
      opacity: 0.48,
    })
  );

  // 1. Conical Crew Module (Apollo / Orion profile)
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.85, 2.0, 20), hullMat);
  capsule.position.y = 1.4;
  craft.add(capsule);

  // Docking Adapter Nose
  const dockingCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.45, 16), darkMat);
  dockingCollar.position.y = 2.6;
  craft.add(dockingCollar);

  const dockingRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 16), goldHeatMat);
  dockingRing.rotation.x = Math.PI / 2;
  dockingRing.position.y = 2.83;
  craft.add(dockingRing);

  // Crew Windows
  for (let w = -1; w <= 1; w += 2) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.06), darkMat);
    win.position.set(w * 0.42, 1.75, 1.15);
    win.rotation.x = -Math.PI * 0.17;
    win.rotation.y = w * 0.25;
    craft.add(win);
  }

  // Heat Shield Rim
  const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.82, 0.3, 20), goldHeatMat);
  heatShield.position.y = 0.25;
  craft.add(heatShield);

  // 2. Service Module Cylinder
  const serviceModule = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 2.2, 20), hullMat);
  serviceModule.position.y = -1.0;
  craft.add(serviceModule);

  const radiatorBand = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.75, 20), darkMat);
  radiatorBand.position.y = -1.35;
  craft.add(radiatorBand);

  // 3. Four X-Configuration Orion Solar Array Wings
  const wingAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const angle of wingAngles) {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(Math.cos(angle) * 1.65, -0.8, Math.sin(angle) * 1.65);
    wingPivot.rotation.y = -angle;

    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.12), darkMat);
    strut.position.x = 0.45;
    wingPivot.add(strut);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.48, 0.04, 0.92), darkMat);
    frame.position.x = 2.45;
    frame.rotation.x = 0.28;
    wingPivot.add(frame);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.34, 0.06, 0.8), solarMat);
    panel.position.x = 2.45;
    panel.rotation.x = 0.28;
    wingPivot.add(panel);

    craft.add(wingPivot);
  }

  // 4. High-Gain Dish Antenna
  const hga = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), goldHeatMat);
  hga.position.set(0, -0.35, 1.85);
  hga.rotation.x = Math.PI * 0.65;
  craft.add(hga);

  // 5. Main Engine Nozzle & Violet Plasma Plume
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.78, 0.9, 16, 1, true), darkMat);
  nozzle.position.y = -2.55;
  craft.add(nozzle);

  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 12, 1, true), plumeMat);
  plume.position.y = -4.05;
  plume.rotation.x = Math.PI;
  craft.add(plume);

  craft.scale.set(0.62, 0.62, 0.62);
  return craft;
}
