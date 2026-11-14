import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PlacedPod, PodDefinition, CameraState, RoverState, LandingSite, DailySimulationLog, ResourceTelemetry } from '../types';
import { POD_MAP } from '../utils/podCatalog';
import { DEFAULT_LANDING_SITE } from '../utils/landingSites';
import {
  createMarsRegolithTexture,
  createMarsBumpTexture,
  createPodMesh,
  createConnectionTunnelMesh,
  createRoverMesh,
  createAstronautMesh,
  createMarsHelicopterMesh,
  createLandingPadMesh,
  createSoftParticleTexture,
  setColonyPowerLighting,
  AstronautLimbs,
} from '../utils/podGeometries';
import { detectSoftwareWebGL, createAfterDrawScheduler } from '../utils/webglDetect';
import { computeHelipadPlacements } from '../utils/marsSimulation';
import { audioManager } from '../utils/audioManager';
import { RotateCw, X, Eye, MapPin } from 'lucide-react';

// Pre-allocated scratch colors to avoid per-frame GC in renderLoop
const _daySky = new THREE.Color();
const _twilightSky = new THREE.Color('#5a2623');
const _nightSky = new THREE.Color('#04040a');
const _dustSky = new THREE.Color('#7c3419');
const _flareSky = new THREE.Color('#5c1020');
const _frostSky = new THREE.Color('#13355c');
const _targetSky = new THREE.Color();

const _dayFog = new THREE.Color();
const _twilightFog = new THREE.Color('#3b181b');
const _nightFog = new THREE.Color('#05050d');
const _dustFog = new THREE.Color('#8c3c1c');
const _flareFog = new THREE.Color('#6b1322');
const _frostFog = new THREE.Color('#18426e');
const _targetFog = new THREE.Color();

const _daySunColor = new THREE.Color(0xfff1e2);
const _twilightSunColor = new THREE.Color(0xff8c52);
const _nightSunColor = new THREE.Color(0x6b7db3);
const _flareSunColor = new THREE.Color(0xff384c);
const _frostSunColor = new THREE.Color(0x9bd3ff);
const _targetSunColor = new THREE.Color();

const _dayHemiSky = new THREE.Color(0xe9d5ff);
const _nightHemiSky = new THREE.Color(0x1b1736);
const _dustHemiSky = new THREE.Color(0xd97745);
const _flareHemiSky = new THREE.Color(0xff4d6d);
const _frostHemiSky = new THREE.Color(0x7cc4ff);
const _targetHemiSky = new THREE.Color();

const _dayHemiGround = new THREE.Color(0x2b1218);
const _nightHemiGround = new THREE.Color(0x07050c);
const _targetHemiGround = new THREE.Color();

const _dustColor = new THREE.Color(0xd9733b);
const _frostColor = new THREE.Color(0xbce7ff);
const _flareColor = new THREE.Color(0xff3b4e);

interface ThreeCanvasProps {
  placedPods: PlacedPod[];
  selectedCatalogPod: PodDefinition | null;
  selectedPlacedPod: PlacedPod | null;
  onPlacePod: (gridX: number, gridZ: number, rotation: number) => void;
  onSelectPlacedPod: (pod: PlacedPod | null) => void;
  onCancelPlacement?: () => void;
  isSimulating: boolean;
  simulationProgress: number;
  currentSimulationDay: number;
  currentSimulationLog?: DailySimulationLog | null;
  telemetry?: ResourceTelemetry;
  crewSize?: number;
  landingSite?: LandingSite;
  onCameraUpdate?: (state: CameraState) => void;
  onRoversUpdate?: (rovers: RoverState[]) => void;
  targetFocusCoord?: { gridX: number; gridZ: number } | null;
  externalRotation?: number;
  onRotateGhost?: () => void;
}

const GRID_SIZE = 24;
const GRID_STEP = 6.0;

interface ObstacleCircle {
  x: number;
  z: number;
  radius: number;
}

type RoverPhase = 'docked' | 'exiting' | 'patrol' | 'scanning' | 'returning' | 'docking';
interface RoverSimAgent {
  id: string;
  mesh: THREE.Group;
  wheels: THREE.Group[];
  mastHead?: THREE.Group;
  phase: RoverPhase;
  phaseTimer: number;
  x: number;
  z: number;
  yaw: number;
  dockX: number;
  dockZ: number;
  exitX: number;
  exitZ: number;
  dockYaw: number;
  waypoints: Array<{ x: number; z: number }>;
  waypointIdx: number;
  hasGarage: boolean;
}

interface AstroSimAgent {
  mesh: THREE.Group;
  limbs?: AstronautLimbs;
  x: number;
  z: number;
  yaw: number;
  walkPhase: number;
  pauseTimer: number;
  hopTimer: number;
  hopDuration: number;
  hopCooldown: number;
  waypoints: Array<{ x: number; z: number }>;
  waypointIdx: number;
}

type HeliPhase = 'docked' | 'spooling' | 'takeoff' | 'flying' | 'returning' | 'landing';

interface HeliSimAgent {
  mesh: THREE.Group;
  phase: HeliPhase;
  phaseTimer: number;
  rotorSpeed: number;
  baseX: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  orbitAngle: number;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  placedPods,
  selectedCatalogPod,
  selectedPlacedPod,
  onPlacePod,
  onSelectPlacedPod,
  onCancelPlacement,
  isSimulating,
  simulationProgress,
  currentSimulationLog = null,
  telemetry,
  crewSize = 4,
  landingSite = DEFAULT_LANDING_SITE,
  onCameraUpdate,
  onRoversUpdate,
  targetFocusCoord,
  externalRotation,
  onRotateGhost,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const podsGroupRef = useRef<THREE.Group | null>(null);
  const tunnelsGroupRef = useRef<THREE.Group | null>(null);
  const roversGroupRef = useRef<THREE.Group | null>(null);
  const astronautsGroupRef = useRef<THREE.Group | null>(null);
  const helicoptersGroupRef = useRef<THREE.Group | null>(null);
  const heliPadsGroupRef = useRef<THREE.Group | null>(null);
  const ghostGroupRef = useRef<THREE.Group | null>(null);
  const terrainPlaneRef = useRef<THREE.Mesh | null>(null);
  const mountainRingRef = useRef<THREE.Mesh | null>(null);

  const ghostRotationRef = useRef<number>(0);
  const hoveredGridTileRef = useRef<{ x: number; z: number } | null>(null);
  const [hoverBlockedReason, setHoverBlockedReason] = React.useState<string | null>(null);

  const obstaclesRef = useRef<ObstacleCircle[]>([]);
  const roversStateRef = useRef<RoverSimAgent[]>([]);
  const astronautsStateRef = useRef<AstroSimAgent[]>([]);
  const helicoptersStateRef = useRef<HeliSimAgent[]>([]);
  const helipadsRef = useRef<ReturnType<typeof computeHelipadPlacements>>([]);

  // Immediately clear & hide ghost placement halo whenever catalog selection is cleared
  useEffect(() => {
    if (!selectedCatalogPod) {
      hoveredGridTileRef.current = null;
      setHoverBlockedReason(null);
      const ghost = ghostGroupRef.current;
      if (ghost) {
        ghost.visible = false;
        while (ghost.children.length > 0) {
          ghost.remove(ghost.children[0]);
        }
      }
    }
  }, [selectedCatalogPod]);

  useEffect(() => {
    if (externalRotation !== undefined) {
      ghostRotationRef.current = externalRotation;
      if (ghostGroupRef.current) {
        ghostGroupRef.current.rotation.y = THREE.MathUtils.degToRad(externalRotation);
      }
    }
  }, [externalRotation]);

  const rotateGhost = useCallback(() => {
    ghostRotationRef.current = (ghostRotationRef.current + 90) % 360;
    if (ghostGroupRef.current) {
      ghostGroupRef.current.rotation.y = THREE.MathUtils.degToRad(ghostRotationRef.current);
    }
    if (onRotateGhost) {
      onRotateGhost();
    }
    audioManager.playRotate();
  }, [onRotateGhost]);

  const propsRef = useRef({
    placedPods,
    selectedCatalogPod,
    selectedPlacedPod,
    onPlacePod,
    onSelectPlacedPod,
    isSimulating,
    simulationProgress,
    currentSimulationLog,
    telemetry,
    crewSize,
    landingSite,
    onCameraUpdate,
    onRoversUpdate,
    targetFocusCoord,
  });
  propsRef.current = {
    placedPods,
    selectedCatalogPod,
    selectedPlacedPod,
    onPlacePod,
    onSelectPlacedPod,
    isSimulating,
    simulationProgress,
    currentSimulationLog,
    telemetry,
    crewSize,
    landingSite,
    onCameraUpdate,
    onRoversUpdate,
    targetFocusCoord,
  };

  useEffect(() => {
    if (targetFocusCoord && controlsRef.current) {
      controlsRef.current.target.set(
        targetFocusCoord.gridX * GRID_STEP,
        1.5,
        targetFocusCoord.gridZ * GRID_STEP
      );
    }
  }, [targetFocusCoord]);

  // Apply landing site visual theme dynamically
  useEffect(() => {
    if (sceneRef.current && !propsRef.current.isSimulating) {
      sceneRef.current.background = new THREE.Color(landingSite.skyHex);
      sceneRef.current.fog = new THREE.FogExp2(landingSite.fogHex, 0.006);
    }
    if (terrainPlaneRef.current) {
      const mat = terrainPlaneRef.current.material as THREE.MeshStandardMaterial;
      const newTex = createMarsRegolithTexture(
        landingSite.terrainColorHex,
        landingSite.terrainAccentHex
      );
      mat.map?.dispose();
      mat.map = newTex;
      mat.needsUpdate = true;
    }
    if (mountainRingRef.current) {
      const mat = mountainRingRef.current.material as THREE.MeshStandardMaterial;
      mat.color.set(landingSite.terrainAccentHex);
    }
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [landingSite]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const initialSite = propsRef.current.landingSite;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(initialSite.skyHex);
    scene.fog = new THREE.FogExp2(initialSite.fogHex, 0.006);

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1200);
    camera.position.set(0, 46, 62);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 8;
    controls.maxDistance = 175;
    controls.target.set(0, 0, 0);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    const hemiLight = new THREE.HemisphereLight(0xe9d5ff, 0x2b1218, 0.9);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfff1e2, 2.25);
    sunLight.position.set(65, 75, 45);
    sunLight.castShadow = !isSoftwareGl;
    if (sunLight.castShadow) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 240;
      const d = 80;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const ambientLight = new THREE.AmbientLight(0x3a2042, 0.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Colony warm illumination lights (active during nightfall, dim during power shortages)
    const colonyLight1 = new THREE.PointLight(0xffd28a, 0, 52, 1.4);
    colonyLight1.position.set(0, 6.5, 0);
    scene.add(colonyLight1);

    const colonyLight2 = new THREE.PointLight(0xa78bfa, 0, 42, 1.5);
    colonyLight2.position.set(-10, 5.5, 8);
    scene.add(colonyLight2);

    // Martian Regolith Terrain
    const groundGeo = new THREE.PlaneGeometry(360, 360, 64, 64);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const distFromCenter = Math.hypot(vx, vy);
      let zElevation = 0;
      if (distFromCenter > 76) {
        zElevation = Math.sin(vx * 0.04) * Math.cos(vy * 0.04) * 4.5 + (distFromCenter - 76) * 0.12;
      }
      posAttr.setZ(i, zElevation);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: createMarsRegolithTexture(initialSite.terrainColorHex, initialSite.terrainAccentHex),
      bumpMap: createMarsBumpTexture(),
      bumpScale: 0.18,
      roughness: 0.88,
      metalness: 0.12,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = !isSoftwareGl;
    scene.add(groundMesh);
    terrainPlaneRef.current = groundMesh;

    const mountainRing = new THREE.Mesh(
      new THREE.CylinderGeometry(150, 175, 32, 32, 1, true),
      new THREE.MeshStandardMaterial({
        color: initialSite.terrainAccentHex,
        roughness: 0.95,
        metalness: 0.05,
        side: THREE.BackSide,
      })
    );
    mountainRing.position.y = 10;
    scene.add(mountainRing);
    mountainRingRef.current = mountainRing;

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = Math.acos(Math.max(0.05, ((i * 73) % 100) / 115));
      const rad = 280;
      starPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = rad * Math.cos(phi);
      starPositions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe9d5ff,
      size: 1.35,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.45,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);

    // Reusable Weather & Disaster 3D Particle Systems
    const softSpriteTex = createSoftParticleTexture();
    const DUST_COUNT = 420;
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPositions[i * 3] = (((i * 79) % 140) - 70);
      dustPositions[i * 3 + 1] = 0.6 + ((i * 23) % 18);
      dustPositions[i * 3 + 2] = (((i * 113) % 140) - 70);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: _dustColor,
      map: softSpriteTex,
      size: 2.8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    dustParticles.visible = false;
    dustParticles.frustumCulled = false;
    scene.add(dustParticles);

    const ATMO_COUNT = 280;
    const atmoPositions = new Float32Array(ATMO_COUNT * 3);
    for (let i = 0; i < ATMO_COUNT; i++) {
      atmoPositions[i * 3] = (((i * 97) % 110) - 55);
      atmoPositions[i * 3 + 1] = 1.0 + ((i * 37) % 28);
      atmoPositions[i * 3 + 2] = (((i * 131) % 110) - 55);
    }
    const atmoGeo = new THREE.BufferGeometry();
    atmoGeo.setAttribute('position', new THREE.BufferAttribute(atmoPositions, 3));
    const atmoMat = new THREE.PointsMaterial({
      color: _frostColor,
      map: softSpriteTex,
      size: 1.65,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const atmoParticles = new THREE.Points(atmoGeo, atmoMat);
    atmoParticles.visible = false;
    atmoParticles.frustumCulled = false;
    scene.add(atmoParticles);

    const phobos = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.5, 1),
      new THREE.MeshStandardMaterial({ color: 0x94827d, roughness: 0.9, metalness: 0.1 })
    );
    phobos.position.set(-90, 85, -120);
    scene.add(phobos);

    // Clean 24x24 Base Grid (subtle dark obsidian-violet lines, no bright floor pylons or yellow markers)
    const gridGroup = new THREE.Group();
    const baseGridLines = new THREE.GridHelper(GRID_SIZE * GRID_STEP, GRID_SIZE, 0x2b2345, 0x1d1730);
    baseGridLines.position.y = 0.04;
    if (Array.isArray(baseGridLines.material)) {
      baseGridLines.material.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.4;
      });
    } else {
      baseGridLines.material.transparent = true;
      baseGridLines.material.opacity = 0.4;
    }
    gridGroup.add(baseGridLines);
    scene.add(gridGroup);

    const podsGroup = new THREE.Group();
    scene.add(podsGroup);
    podsGroupRef.current = podsGroup;

    const tunnelsGroup = new THREE.Group();
    scene.add(tunnelsGroup);
    tunnelsGroupRef.current = tunnelsGroup;

    const roversGroup = new THREE.Group();
    scene.add(roversGroup);
    roversGroupRef.current = roversGroup;

    const astronautsGroup = new THREE.Group();
    scene.add(astronautsGroup);
    astronautsGroupRef.current = astronautsGroup;

    const heliPadsGroup = new THREE.Group();
    scene.add(heliPadsGroup);
    heliPadsGroupRef.current = heliPadsGroup;

    const helicoptersGroup = new THREE.Group();
    scene.add(helicoptersGroup);
    helicoptersGroupRef.current = helicoptersGroup;

    const ghostGroup = new THREE.Group();
    ghostGroup.visible = false;
    scene.add(ghostGroup);
    ghostGroupRef.current = ghostGroup;

    // Helper: Steering away from placed buildings so rovers & crew never walk through pods
    const steerTowards = (
      curX: number,
      curZ: number,
      targetX: number,
      targetZ: number,
      obstacles: ObstacleCircle[],
      clearanceRadius: number
    ) => {
      let dirX = targetX - curX;
      let dirZ = targetZ - curZ;
      const distToTarget = Math.hypot(dirX, dirZ);
      if (distToTarget > 0.001) {
        dirX /= distToTarget;
        dirZ /= distToTarget;
      }

      for (const obs of obstacles) {
        const dx = curX - obs.x;
        const dz = curZ - obs.z;
        const d = Math.hypot(dx, dz);
        const minSafe = obs.radius + clearanceRadius;
        if (d < minSafe && d > 0.01) {
          const push = ((minSafe - d) / minSafe) * 2.4;
          dirX += (dx / d) * push;
          dirZ += (dz / d) * push;
        }
      }

      const norm = Math.hypot(dirX, dirZ) || 1;
      return { vx: dirX / norm, vz: dirZ / norm, distToTarget };
    };

    const normalizeAngleDelta = (target: number, current: number) => {
      let diff = target - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff;
    };

    const { scheduleNext, cancel } = createAfterDrawScheduler(renderer);
    let lastTime = performance.now();
    let lastCameraReportTime = 0;
    let lastReportedX = -9999;
    let lastReportedZ = -9999;
    let lastReportedYaw = -9999;
    let currentDustLevel = 0;
    let currentRadiationLevel = 0;
    let currentFrostLevel = 0;
    let currentPowerLevel = 1;
    let currentDayFactor = 1;

    const renderLoop = () => {
      const now = performance.now();
      const delta = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      const elapsedTime = now * 0.001;

      starfield.rotation.y = elapsedTime * 0.002;
      const obstacles = obstaclesRef.current;

      // 1. Rovers State Machine (Docking inside Garage <-> Surveying Perimeter)
      const activeRovers = roversStateRef.current;
      const roverReportData: RoverState[] = [];

      for (const r of activeRovers) {
        r.phaseTimer += delta;
        let moveSpeed = 0;
        let destX = r.x;
        let destZ = r.z;

        if (r.phase === 'docked') {
          r.x = r.dockX;
          r.z = r.dockZ;
          r.yaw = r.dockYaw;
          if (r.phaseTimer > 2.2) {
            r.phase = r.hasGarage ? 'exiting' : 'patrol';
            r.phaseTimer = 0;
          }
        } else if (r.phase === 'exiting') {
          destX = r.exitX;
          destZ = r.exitZ;
          moveSpeed = 2.6;
          const d = Math.hypot(destX - r.x, destZ - r.z);
          if (d < 0.4) {
            r.phase = 'patrol';
            r.phaseTimer = 0;
          }
        } else if (r.phase === 'patrol') {
          const wp = r.waypoints[r.waypointIdx % r.waypoints.length];
          destX = wp.x;
          destZ = wp.z;
          moveSpeed = 3.8;
          const { vx, vz, distToTarget } = steerTowards(r.x, r.z, destX, destZ, obstacles, 0.85);
          const stepDist = Math.min(distToTarget, moveSpeed * delta);
          r.x += vx * stepDist;
          r.z += vz * stepDist;
          const desiredYaw = Math.atan2(vx, vz);
          r.yaw += normalizeAngleDelta(desiredYaw, r.yaw) * Math.min(1, delta * 5.5);

          for (const w of r.wheels) {
            w.rotation.x += stepDist / 0.24;
          }

          if (distToTarget < 0.8) {
            r.waypointIdx = (r.waypointIdx + 1) % r.waypoints.length;
            if (r.waypointIdx === 0 && r.hasGarage) {
              r.phase = 'returning';
              r.phaseTimer = 0;
            } else if (r.waypointIdx % 2 === 1) {
              r.phase = 'scanning';
              r.phaseTimer = 0;
            }
          }
        } else if (r.phase === 'scanning') {
          if (r.mastHead) {
            r.mastHead.rotation.y = Math.sin(r.phaseTimer * 2.4) * 0.65;
          }
          if (r.phaseTimer > 2.4) {
            if (r.mastHead) r.mastHead.rotation.y = 0;
            r.phase = 'patrol';
            r.phaseTimer = 0;
          }
        } else if (r.phase === 'returning') {
          destX = r.exitX;
          destZ = r.exitZ;
          moveSpeed = 3.4;
          const { vx, vz, distToTarget } = steerTowards(r.x, r.z, destX, destZ, obstacles, 0.85);
          const stepDist = Math.min(distToTarget, moveSpeed * delta);
          r.x += vx * stepDist;
          r.z += vz * stepDist;
          const desiredYaw = Math.atan2(vx, vz);
          r.yaw += normalizeAngleDelta(desiredYaw, r.yaw) * Math.min(1, delta * 5.5);
          for (const w of r.wheels) w.rotation.x += stepDist / 0.24;

          if (distToTarget < 0.6) {
            r.phase = 'docking';
            r.phaseTimer = 0;
          }
        } else if (r.phase === 'docking') {
          destX = r.dockX;
          destZ = r.dockZ;
          moveSpeed = 2.0;
          const dx = destX - r.x;
          const dz = destZ - r.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.25) {
            r.x = r.dockX;
            r.z = r.dockZ;
            r.phase = 'docked';
            r.phaseTimer = 0;
          } else {
            const step = Math.min(d, moveSpeed * delta);
            r.x += (dx / d) * step;
            r.z += (dz / d) * step;
            r.yaw += normalizeAngleDelta(r.dockYaw, r.yaw) * Math.min(1, delta * 5.5);
            for (const w of r.wheels) w.rotation.x -= step / 0.24;
          }
        }

        if (r.phase === 'exiting') {
          const dx = destX - r.x;
          const dz = destZ - r.z;
          const d = Math.hypot(dx, dz) || 1;
          const step = Math.min(d, moveSpeed * delta);
          r.x += (dx / d) * step;
          r.z += (dz / d) * step;
          const desiredYaw = Math.atan2(dx, dz);
          r.yaw += normalizeAngleDelta(desiredYaw, r.yaw) * Math.min(1, delta * 5.5);
          for (const w of r.wheels) w.rotation.x += step / 0.24;
        }

        r.mesh.position.set(r.x, 0, r.z);
        r.mesh.rotation.y = r.yaw;

        roverReportData.push({
          id: r.id,
          x: r.x,
          z: r.z,
          angle: r.yaw,
          targetX: destX,
          targetZ: destZ,
        });
      }

      // 2. Spatially-Aware Articulated Astronauts with 0.38g Mars Low-Gravity Hops
      const activeAstronauts = astronautsStateRef.current;
      for (const ast of activeAstronauts) {
        let verticalY = 0;
        const isHopping = ast.hopTimer > 0;

        if (isHopping) {
          ast.hopTimer = Math.max(0, ast.hopTimer - delta);
          const hopFrac = 1 - ast.hopTimer / ast.hopDuration;
          verticalY = Math.sin(hopFrac * Math.PI) * 0.72;
        } else if (ast.pauseTimer > 0) {
          ast.pauseTimer -= delta;
        } else {
          ast.hopCooldown -= delta;
          if (ast.hopCooldown <= 0) {
            ast.hopTimer = ast.hopDuration;
            ast.hopCooldown = 5.5 + Math.random() * 5.0;
          }
        }

        let speed = 0;
        if (ast.pauseTimer <= 0) {
          const wp = ast.waypoints[ast.waypointIdx % ast.waypoints.length];
          const { vx, vz, distToTarget } = steerTowards(ast.x, ast.z, wp.x, wp.z, obstacles, 0.55);
          speed = isHopping ? 2.6 : 1.9;
          const step = Math.min(distToTarget, speed * delta);
          ast.x += vx * step;
          ast.z += vz * step;
          const desiredYaw = Math.atan2(vx, vz);
          ast.yaw += normalizeAngleDelta(desiredYaw, ast.yaw) * Math.min(1, delta * 6.5);
          ast.walkPhase += step * 2.8;

          if (distToTarget < 0.7) {
            ast.waypointIdx = (ast.waypointIdx + 1) % ast.waypoints.length;
            ast.pauseTimer = 1.1;
          }
        }

        ast.mesh.position.set(ast.x, verticalY, ast.z);
        ast.mesh.rotation.y = ast.yaw;

        if (ast.limbs) {
          if (isHopping) {
            const hopFrac = 1 - ast.hopTimer / ast.hopDuration;
            const tuck = Math.sin(hopFrac * Math.PI);
            ast.limbs.leftHip.rotation.x = -0.35 * tuck;
            ast.limbs.rightHip.rotation.x = 0.25 * tuck;
            ast.limbs.leftShoulder.rotation.x = -0.45 * tuck;
            ast.limbs.rightShoulder.rotation.x = -0.45 * tuck;
            ast.limbs.leftElbow.rotation.x = -0.65 * tuck;
            ast.limbs.rightElbow.rotation.x = -0.65 * tuck;
          } else if (ast.pauseTimer > 0) {
            // Natural breathing idle
            ast.limbs.leftHip.rotation.x = THREE.MathUtils.damp(ast.limbs.leftHip.rotation.x, 0, 8, delta);
            ast.limbs.rightHip.rotation.x = THREE.MathUtils.damp(ast.limbs.rightHip.rotation.x, 0, 8, delta);
            ast.limbs.leftShoulder.rotation.x = THREE.MathUtils.damp(ast.limbs.leftShoulder.rotation.x, 0, 8, delta);
            ast.limbs.rightShoulder.rotation.x = THREE.MathUtils.damp(ast.limbs.rightShoulder.rotation.x, 0, 8, delta);
            ast.limbs.leftElbow.rotation.x = -0.22;
            ast.limbs.rightElbow.rotation.x = -0.22;
          } else {
            const swing = Math.sin(ast.walkPhase);
            ast.limbs.leftHip.rotation.x = swing * 0.42;
            ast.limbs.rightHip.rotation.x = -swing * 0.42;
            ast.limbs.leftShoulder.rotation.x = -swing * 0.36;
            ast.limbs.rightShoulder.rotation.x = swing * 0.36;
            ast.limbs.leftElbow.rotation.x = -0.35 - Math.max(0, -swing) * 0.35;
            ast.limbs.rightElbow.rotation.x = -0.35 - Math.max(0, swing) * 0.35;
          }
        }
      }

      // 3. Ingenuity Mini-Helicopters State Machine (1 autonomous flyer per Rover Garage Pad)
      const activeHelis = helicoptersStateRef.current;
      for (const hs of activeHelis) {
        const heli = hs.mesh;
        hs.phaseTimer += delta;
        const lowerRotor = heli.userData.lowerRotor as THREE.Group | undefined;
        const upperRotor = heli.userData.upperRotor as THREE.Group | undefined;

        if (hs.phase === 'docked') {
          hs.rotorSpeed = 0;
          hs.x = hs.baseX;
          hs.y = 0.09;
          hs.z = hs.baseZ;
          heli.rotation.set(0, hs.yaw, 0);
          if (hs.phaseTimer > 2.0) {
            hs.phase = 'spooling';
            hs.phaseTimer = 0;
          }
        } else if (hs.phase === 'spooling') {
          hs.rotorSpeed = Math.min(0.62, (hs.phaseTimer / 2.2) * 0.62);
          if (hs.phaseTimer > 2.2) {
            hs.phase = 'takeoff';
            hs.phaseTimer = 0;
          }
        } else if (hs.phase === 'takeoff') {
          hs.rotorSpeed = 0.65;
          const p = Math.min(1, hs.phaseTimer / 2.8);
          hs.y = 0.09 + (1 - Math.pow(1 - p, 2)) * 7.8;
          if (p >= 1) {
            hs.phase = 'flying';
            hs.phaseTimer = 0;
            hs.orbitAngle = 0;
          }
        } else if (hs.phase === 'flying') {
          hs.rotorSpeed = 0.68;
          hs.orbitAngle += delta * 0.72;
          const radius = 15;
          const targetX = hs.baseX + Math.sin(hs.orbitAngle) * radius;
          const targetZ = hs.baseZ + (1 - Math.cos(hs.orbitAngle)) * radius * 0.75;
          const dx = targetX - hs.x;
          const dz = targetZ - hs.z;
          hs.x = targetX;
          hs.z = targetZ;
          hs.y = 7.9 + Math.sin(hs.orbitAngle * 2) * 0.85;
          hs.yaw = Math.atan2(dx, dz);
          heli.rotation.set(0.08, hs.yaw, -0.06);
          if (hs.orbitAngle >= Math.PI * 2) {
            hs.phase = 'returning';
            hs.phaseTimer = 0;
          }
        } else if (hs.phase === 'returning') {
          hs.rotorSpeed = 0.62;
          const dx = hs.baseX - hs.x;
          const dz = hs.baseZ - hs.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) {
            hs.x = hs.baseX;
            hs.z = hs.baseZ;
            hs.phase = 'landing';
            hs.phaseTimer = 0;
            heli.rotation.set(0, hs.yaw, 0);
          } else {
            const step = Math.min(d, delta * 5.5);
            hs.x += (dx / d) * step;
            hs.z += (dz / d) * step;
            hs.y = THREE.MathUtils.damp(hs.y, 6.2, 3.5, delta);
            heli.rotation.set(0.05, Math.atan2(dx, dz), 0);
          }
        } else if (hs.phase === 'landing') {
          hs.rotorSpeed = 0.45;
          const p = Math.min(1, hs.phaseTimer / 2.8);
          hs.y = 6.2 - p * (6.2 - 0.09);
          heli.rotation.set(0, hs.yaw, 0);
          if (p >= 1) {
            hs.y = 0.09;
            hs.phase = 'docked';
            hs.phaseTimer = 0;
          }
        }

        if (lowerRotor) lowerRotor.rotation.y += hs.rotorSpeed;
        if (upperRotor) upperRotor.rotation.y -= hs.rotorSpeed;
        heli.position.set(hs.x, hs.y, hs.z);
      }

      // 4. Smooth 3D Day-Night Cycle, Disaster Effects & Low-Power Dimming
      const activeSite = propsRef.current.landingSite;
      const simLog = propsRef.current.currentSimulationLog;
      const liveTel = propsRef.current.telemetry;

      let targetDayFactor = 1;
      let targetDust = 0;
      let targetRadiation = 0;
      let targetFrost = 0;
      let targetPower = 1;

      if (propsRef.current.isSimulating) {
        const prog = propsRef.current.simulationProgress;
        // 5 full Martian Sol cycles across the 30-day mission
        const sunAngle = prog * Math.PI * 10;
        const sunElevation = Math.sin(sunAngle); // +1 noon, 0 horizon, -1 midnight
        targetDayFactor = THREE.MathUtils.clamp((sunElevation + 0.25) / 0.6, 0, 1);
        const twilightFactor = Math.exp(-Math.pow(sunElevation * 4.2, 2));

        const sunRadius = 88;
        const sunX = Math.cos(sunAngle) * sunRadius;
        const sunY = Math.max(5, sunElevation * 72);

        // Detect active weather / disaster event from current simulation day log
        const logText = `${simLog?.title || ''} ${simLog?.description || ''}`.toLowerCase();
        if (logText.includes('peak dust') || logText.includes('dust storm arrives')) {
          targetDust = 1.0;
        } else if (logText.includes('dust') || logText.includes('whirlwind')) {
          targetDust = 0.55;
        }
        if (logText.includes('solar storm') || logText.includes('radiation') || logText.includes('flare')) {
          targetRadiation = 1.0;
        }
        if (
          logText.includes('thermal drop') ||
          logText.includes('cold front') ||
          logText.includes('freezing') ||
          (simLog !== null && simLog.temperatureC <= -76)
        ) {
          targetFrost = 1.0;
        }

        const rawPowerPct = simLog?.powerLevel ?? 100;
        targetPower = THREE.MathUtils.clamp(rawPowerPct / 100, 0, 1);

        currentDayFactor = THREE.MathUtils.damp(currentDayFactor, targetDayFactor, 6.0, delta);
        currentDustLevel = THREE.MathUtils.damp(
          currentDustLevel,
          targetDust,
          targetDust > currentDustLevel ? 9.0 : 3.5,
          delta
        );
        currentRadiationLevel = THREE.MathUtils.damp(
          currentRadiationLevel,
          targetRadiation,
          targetRadiation > currentRadiationLevel ? 11.0 : 3.8,
          delta
        );
        currentFrostLevel = THREE.MathUtils.damp(
          currentFrostLevel,
          targetFrost,
          targetFrost > currentFrostLevel ? 11.0 : 3.8,
          delta
        );
        currentPowerLevel = THREE.MathUtils.damp(currentPowerLevel, targetPower, 5.5, delta);

        const nightFactor = 1 - currentDayFactor;

        // Smooth Sky & Fog Color Blending (Day -> Sunset Twilight -> Dark Nightfall -> Weather Tint)
        _daySky.set(activeSite.skyHex);
        _targetSky.copy(_nightSky).lerp(_daySky, currentDayFactor);
        _targetSky.lerp(_twilightSky, twilightFactor * 0.55);
        if (currentDustLevel > 0.01) _targetSky.lerp(_dustSky, currentDustLevel * 0.75);
        if (currentFrostLevel > 0.01) _targetSky.lerp(_frostSky, currentFrostLevel * 0.8);
        if (currentRadiationLevel > 0.01) _targetSky.lerp(_flareSky, currentRadiationLevel * 0.82);

        _dayFog.set(activeSite.fogHex);
        _targetFog.copy(_nightFog).lerp(_dayFog, currentDayFactor);
        _targetFog.lerp(_twilightFog, twilightFactor * 0.55);
        if (currentDustLevel > 0.01) _targetFog.lerp(_dustFog, currentDustLevel * 0.82);
        if (currentFrostLevel > 0.01) _targetFog.lerp(_frostFog, currentFrostLevel * 0.82);
        if (currentRadiationLevel > 0.01) _targetFog.lerp(_flareFog, currentRadiationLevel * 0.85);

        if (sceneRef.current) {
          sceneRef.current.background = _targetSky;
          const targetFogDensity = 0.0058 + currentDustLevel * 0.014 + currentFrostLevel * 0.004;
          if (sceneRef.current.fog instanceof THREE.FogExp2) {
            sceneRef.current.fog.color.copy(_targetFog);
            sceneRef.current.fog.density = targetFogDensity;
          } else {
            sceneRef.current.fog = new THREE.FogExp2(_targetFog.getHex(), targetFogDensity);
          }
          if ('environmentIntensity' in sceneRef.current) {
            (sceneRef.current as THREE.Scene & { environmentIntensity: number }).environmentIntensity =
              0.08 + currentDayFactor * 0.92;
          }
        }

        if (sunLightRef.current) {
          sunLightRef.current.position.set(sunX, sunY, 42);
          _targetSunColor.copy(_nightSunColor).lerp(_daySunColor, currentDayFactor);
          _targetSunColor.lerp(_twilightSunColor, twilightFactor * 0.75);
          if (currentFrostLevel > 0.01) _targetSunColor.lerp(_frostSunColor, currentFrostLevel * 0.78);
          if (currentRadiationLevel > 0.01) _targetSunColor.lerp(_flareSunColor, currentRadiationLevel * 0.88);
          sunLightRef.current.color.copy(_targetSunColor);

          const baseSunIntensity =
            0.02 + currentDayFactor * (2.38 * Math.max(0.18, (sunElevation + 0.15) / 1.15));
          const dustAttenuation = 1 - currentDustLevel * 0.68;
          sunLightRef.current.intensity =
            baseSunIntensity * dustAttenuation + currentRadiationLevel * 0.85;
        }

        if (hemiLightRef.current) {
          _targetHemiSky.copy(_nightHemiSky).lerp(_dayHemiSky, currentDayFactor);
          if (currentDustLevel > 0.01) _targetHemiSky.lerp(_dustHemiSky, currentDustLevel * 0.68);
          if (currentFrostLevel > 0.01) _targetHemiSky.lerp(_frostHemiSky, currentFrostLevel * 0.8);
          if (currentRadiationLevel > 0.01) _targetHemiSky.lerp(_flareHemiSky, currentRadiationLevel * 0.85);
          _targetHemiGround.copy(_nightHemiGround).lerp(_dayHemiGround, currentDayFactor);

          hemiLightRef.current.color.copy(_targetHemiSky);
          hemiLightRef.current.groundColor.copy(_targetHemiGround);
          hemiLightRef.current.intensity =
            0.07 + currentDayFactor * 0.85 + currentFrostLevel * 0.28 + currentRadiationLevel * 0.28;
        }

        if (ambientLightRef.current) {
          ambientLightRef.current.intensity = 0.03 + currentDayFactor * 0.39;
        }

        starMat.opacity = 0.16 + nightFactor * 0.84;

        // Low-Power Dimming on Colony Lights & Flicker Warning
        const flicker =
          currentPowerLevel < 0.35 && currentPowerLevel > 0.03
            ? 0.55 + 0.45 * Math.sin(elapsedTime * 19.0)
            : 1.0;
        const effectivePower = currentPowerLevel * flicker;
        setColonyPowerLighting(effectivePower, nightFactor);

        const nightLightPower = (0.15 + nightFactor * 3.0) * effectivePower;
        colonyLight1.intensity = nightLightPower * 14;
        colonyLight2.intensity = nightLightPower * 9;

        // Dust Storm Blowing Particle Animation
        if (currentDustLevel > 0.02) {
          dustParticles.visible = true;
          dustMat.opacity = currentDustLevel * 0.72;
          const posArr = dustGeo.attributes.position.array as Float32Array;
          const windSpeed = (22 + currentDustLevel * 28) * delta;
          for (let i = 0; i < DUST_COUNT; i++) {
            let px = posArr[i * 3] + windSpeed;
            let py = posArr[i * 3 + 1] + Math.sin(elapsedTime * 2.5 + i) * 1.4 * delta;
            let pz = posArr[i * 3 + 2] + windSpeed * 0.35;
            if (px > 70) px = -70;
            if (pz > 70) pz = -70;
            if (py < 0.5) py = 16;
            if (py > 20) py = 1.0;
            posArr[i * 3] = px;
            posArr[i * 3 + 1] = py;
            posArr[i * 3 + 2] = pz;
          }
          dustGeo.attributes.position.needsUpdate = true;
        } else {
          dustParticles.visible = false;
        }

        // Solar Flare Radiation Sparks OR Thermal Drop Falling Frost Crystals
        const activeAtmo = Math.max(currentRadiationLevel, currentFrostLevel);
        if (activeAtmo > 0.02) {
          atmoParticles.visible = true;
          if (currentRadiationLevel >= currentFrostLevel) {
            atmoMat.color.copy(_flareColor);
            atmoMat.size = 2.0;
            atmoMat.opacity = currentRadiationLevel * (0.65 + 0.3 * Math.sin(elapsedTime * 10));
            const posArr = atmoGeo.attributes.position.array as Float32Array;
            for (let i = 0; i < ATMO_COUNT; i++) {
              let py = posArr[i * 3 + 1] - (12 + (i % 6)) * delta;
              if (py < 0.4) py = 28;
              posArr[i * 3 + 1] = py;
            }
            atmoGeo.attributes.position.needsUpdate = true;
          } else {
            atmoMat.color.copy(_frostColor);
            atmoMat.size = 1.5;
            atmoMat.opacity = currentFrostLevel * 0.78;
            const posArr = atmoGeo.attributes.position.array as Float32Array;
            for (let i = 0; i < ATMO_COUNT; i++) {
              let px = posArr[i * 3] + Math.sin(elapsedTime * 1.8 + i) * 2.2 * delta;
              let py = posArr[i * 3 + 1] - (5.5 + (i % 4)) * delta;
              if (py < 0.3) py = 28;
              if (px > 55) px = -55;
              if (px < -55) px = 55;
              posArr[i * 3] = px;
              posArr[i * 3 + 1] = py;
            }
            atmoGeo.attributes.position.needsUpdate = true;
          }
        } else {
          atmoParticles.visible = false;
        }

        const camDist = 52;
        const camAngle = prog * Math.PI * 2 + 0.5;
        camera.position.x = Math.sin(camAngle) * camDist;
        camera.position.z = Math.cos(camAngle) * camDist;
        camera.position.y = 26 + Math.sin(prog * Math.PI * 4) * 6;
        camera.lookAt(0, 3, 0);
      } else {
        // Restore daylight & clear atmosphere when not actively running 30-day sim
        currentDustLevel = 0;
        currentRadiationLevel = 0;
        currentFrostLevel = 0;
        currentDayFactor = 1;
        dustParticles.visible = false;
        atmoParticles.visible = false;
        starMat.opacity = 0.45;
        colonyLight1.intensity = 0;
        colonyLight2.intensity = 0;

        if (sunLightRef.current) {
          sunLightRef.current.position.set(65, 75, 45);
          sunLightRef.current.color.copy(_daySunColor);
          sunLightRef.current.intensity = 2.25;
        }
        if (hemiLightRef.current) {
          hemiLightRef.current.color.copy(_dayHemiSky);
          hemiLightRef.current.groundColor.copy(_dayHemiGround);
          hemiLightRef.current.intensity = 0.9;
        }
        if (ambientLightRef.current) {
          ambientLightRef.current.intensity = 0.4;
        }
        if (sceneRef.current && 'environmentIntensity' in sceneRef.current) {
          (sceneRef.current as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 1.0;
        }
        if (sceneRef.current && sceneRef.current.fog instanceof THREE.FogExp2) {
          sceneRef.current.fog.density = 0.006;
        }

        // Reflect real-time power surplus/shortage on pod lights even in Base Builder
        const builderPowerFactor = !liveTel
          ? 1.0
          : liveTel.powerSupplyKW <= 0
          ? 0.12
          : liveTel.netPowerKW < 0
          ? 0.22
          : liveTel.netPowerKW < 15
          ? 0.62
          : 1.0;
        currentPowerLevel = THREE.MathUtils.damp(currentPowerLevel, builderPowerFactor, 6.0, delta);
        setColonyPowerLighting(currentPowerLevel, 0.25);

        controls.update();
      }

      // Report Camera & Rovers for 2D Minimap
      if (!propsRef.current.isSimulating && now - lastCameraReportTime > 90) {
        lastCameraReportTime = now;
        const curYaw = controls.getAzimuthalAngle();
        const curX = camera.position.x;
        const curZ = camera.position.z;
        if (
          Math.abs(curX - lastReportedX) > 0.05 ||
          Math.abs(curZ - lastReportedZ) > 0.05 ||
          Math.abs(curYaw - lastReportedYaw) > 0.01
        ) {
          lastReportedX = curX;
          lastReportedZ = curZ;
          lastReportedYaw = curYaw;
          propsRef.current.onCameraUpdate?.({
            x: curX,
            z: curZ,
            rotationY: curYaw,
            zoom: camera.position.length(),
          });
        }
        if (propsRef.current.onRoversUpdate && roverReportData.length > 0) {
          propsRef.current.onRoversUpdate(roverReportData);
        }
      }

      renderer.render(scene, camera);
      scheduleNext(isSoftwareGl, renderLoop);
    };

    renderLoop();

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(240, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancel();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync Placed Pods, Tunnels, Obstacles, Multi-Rovers, Astronauts & Multi-Helipads
  useEffect(() => {
    const podsGroup = podsGroupRef.current;
    const tunnelsGroup = tunnelsGroupRef.current;
    const roversGroup = roversGroupRef.current;
    const astronautsGroup = astronautsGroupRef.current;
    const heliPadsGroup = heliPadsGroupRef.current;
    const helicoptersGroup = helicoptersGroupRef.current;
    const scene = sceneRef.current;
    if (
      !podsGroup ||
      !tunnelsGroup ||
      !roversGroup ||
      !astronautsGroup ||
      !heliPadsGroup ||
      !helicoptersGroup ||
      !scene
    ) {
      return;
    }

    while (podsGroup.children.length > 0) podsGroup.remove(podsGroup.children[0]);
    while (tunnelsGroup.children.length > 0) tunnelsGroup.remove(tunnelsGroup.children[0]);
    while (roversGroup.children.length > 0) roversGroup.remove(roversGroup.children[0]);
    while (astronautsGroup.children.length > 0) astronautsGroup.remove(astronautsGroup.children[0]);
    while (heliPadsGroup.children.length > 0) heliPadsGroup.remove(heliPadsGroup.children[0]);
    while (helicoptersGroup.children.length > 0) helicoptersGroup.remove(helicoptersGroup.children[0]);

    roversStateRef.current = [];
    astronautsStateRef.current = [];
    helicoptersStateRef.current = [];
    obstaclesRef.current = [];

    const placedCoordMap = new Map<string, PlacedPod>();
    const garagePods: Array<{ x: number; z: number; rotRad: number; instanceId: string }> = [];

    for (const placed of placedPods) {
      const def = POD_MAP.get(placed.podId);
      if (!def) continue;

      const wx = placed.gridX * GRID_STEP;
      const wz = placed.gridZ * GRID_STEP;
      obstaclesRef.current.push({ x: wx, z: wz, radius: 3.15 });

      if (placed.podId === 'rover_garage_pod' || def.modelType === 'garage') {
        garagePods.push({
          x: wx,
          z: wz,
          rotRad: THREE.MathUtils.degToRad(placed.rotation),
          instanceId: placed.instanceId,
        });
      }

      const podMesh = createPodMesh(def, false, true);
      podMesh.position.set(wx, 0, wz);
      podMesh.rotation.y = THREE.MathUtils.degToRad(placed.rotation);
      podMesh.userData = { instanceId: placed.instanceId, placed };

      if (selectedPlacedPod?.instanceId === placed.instanceId) {
        const ringGeo = new THREE.RingGeometry(2.45, 2.78, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xa78bfa,
          side: THREE.DoubleSide,
        });
        const selectRing = new THREE.Mesh(ringGeo, ringMat);
        selectRing.rotation.x = -Math.PI / 2;
        selectRing.position.y = 0.12;
        podMesh.add(selectRing);
      }

      podsGroup.add(podMesh);
      placedCoordMap.set(`${placed.gridX},${placed.gridZ}`, placed);
    }

    // Automatic Tunnels
    for (const placed of placedPods) {
      const px = placed.gridX * GRID_STEP;
      const pz = placed.gridZ * GRID_STEP;
      if (placedCoordMap.has(`${placed.gridX + 1},${placed.gridZ}`)) {
        tunnelsGroup.add(createConnectionTunnelMesh(px, pz, (placed.gridX + 1) * GRID_STEP, pz));
      }
      if (placedCoordMap.has(`${placed.gridX},${placed.gridZ + 1}`)) {
        tunnelsGroup.add(createConnectionTunnelMesh(px, pz, px, (placed.gridZ + 1) * GRID_STEP));
      }
    }

    // Compute exact deterministic Helipad tile placements (1 pad + 1 helicopter per Rover Garage Pod)
    const helipadAssignments = computeHelipadPlacements(placedPods, GRID_SIZE / 2);
    helipadsRef.current = helipadAssignments;

    for (let idx = 0; idx < helipadAssignments.length; idx++) {
      const padInfo = helipadAssignments[idx];
      const padX = padInfo.gridX * GRID_STEP;
      const padZ = padInfo.gridZ * GRID_STEP;
      obstaclesRef.current.push({ x: padX, z: padZ, radius: 2.2 });

      const landingPad = createLandingPadMesh();
      landingPad.position.set(padX, 0, padZ);
      heliPadsGroup.add(landingPad);

      const heli = createMarsHelicopterMesh();
      heli.position.set(padX, 0.09, padZ);
      helicoptersGroup.add(heli);

      helicoptersStateRef.current.push({
        mesh: heli,
        phase: 'docked',
        phaseTimer: (idx * 1.4) % 2.0,
        rotorSpeed: 0,
        baseX: padX,
        baseZ: padZ,
        x: padX,
        y: 0.09,
        z: padZ,
        yaw: 0,
        orbitAngle: 0,
      });
    }

    const isSpotClear = (wx: number, wz: number) =>
      obstaclesRef.current.every((o) => Math.hypot(wx - o.x, wz - o.z) > 4.2);

    // Spawn 1 Autonomous Mars Rover per Rover Garage Pod (or 1 perimeter rover if no garage yet during sim)
    if (garagePods.length > 0) {
      garagePods.forEach((garage, i) => {
        const roverMesh = createRoverMesh();
        roversGroup.add(roverMesh);

        const fwdX = Math.sin(garage.rotRad);
        const fwdZ = Math.cos(garage.rotRad);
        const dockX = garage.x + fwdX * 0.5;
        const dockZ = garage.z + fwdZ * 0.5;
        const exitX = garage.x + fwdX * 4.6;
        const exitZ = garage.z + fwdZ * 4.6;

        const rScale = 22 + (i % 4) * 6;
        const dirSign = i % 2 === 0 ? 1 : -1;
        const waypoints = [
          { x: dirSign * rScale, z: -rScale * 0.6 },
          { x: dirSign * rScale, z: rScale * 0.8 },
          { x: -dirSign * rScale * 0.7, z: rScale },
          { x: -dirSign * rScale, z: -rScale * 0.5 },
        ];

        roversStateRef.current.push({
          id: `rover_${i + 1}`,
          mesh: roverMesh,
          wheels: (roverMesh.userData.wheels as THREE.Group[]) || [],
          mastHead: roverMesh.userData.mastHead as THREE.Group | undefined,
          phase: 'docked',
          phaseTimer: (i * 0.9) % 2.2,
          x: dockX,
          z: dockZ,
          yaw: garage.rotRad,
          dockX,
          dockZ,
          exitX,
          exitZ,
          dockYaw: garage.rotRad,
          waypoints,
          waypointIdx: i % waypoints.length,
          hasGarage: true,
        });
      });
    } else if (isSimulating || placedPods.length >= 3) {
      const roverMesh = createRoverMesh();
      roversGroup.add(roverMesh);
      const waypoints = [
        { x: 22, z: -13 },
        { x: 22, z: 18 },
        { x: -16, z: 22 },
        { x: -22, z: -11 },
      ];
      roversStateRef.current.push({
        id: 'rover_scout',
        mesh: roverMesh,
        wheels: (roverMesh.userData.wheels as THREE.Group[]) || [],
        mastHead: roverMesh.userData.mastHead as THREE.Group | undefined,
        phase: 'patrol',
        phaseTimer: 0,
        x: waypoints[0].x,
        z: waypoints[0].z,
        yaw: 0,
        dockX: -15,
        dockZ: -15,
        exitX: -15,
        exitZ: -12,
        dockYaw: 0,
        waypoints,
        waypointIdx: 1,
        hasGarage: false,
      });
    }

    // Spawn Spatially-Aware EVA Crew with Multi-Joint Articulation
    if (placedPods.length > 0 || isSimulating) {
      const activeCrew = Math.max(1, Math.min(7, crewSize));
      const suitColors = ['#e9d5ff', '#a78bfa', '#38bdf8', '#fbbf24', '#34d399', '#f472b6', '#fb923c'];

      const safeWalkPoints: Array<{ x: number; z: number }> = [];
      for (const p of placedPods.slice(0, 6)) {
        const px = p.gridX * GRID_STEP;
        const pz = p.gridZ * GRID_STEP;
        const candidates = [
          { x: px + 4.2, z: pz + 4.2 },
          { x: px - 4.2, z: pz + 4.2 },
          { x: px + 4.2, z: pz - 4.2 },
          { x: px - 4.2, z: pz - 4.2 },
        ];
        for (const c of candidates) {
          if (isSpotClear(c.x, c.z)) safeWalkPoints.push(c);
        }
      }
      if (safeWalkPoints.length < 4) {
        safeWalkPoints.push({ x: 9, z: 9 }, { x: -9, z: 9 }, { x: -9, z: -9 }, { x: 9, z: -9 });
      }

      for (let c = 0; c < activeCrew; c++) {
        const astronautMesh = createAstronautMesh(suitColors[c % suitColors.length]);
        astronautsGroup.add(astronautMesh);
        const startWp = safeWalkPoints[c % safeWalkPoints.length];

        astronautsStateRef.current.push({
          mesh: astronautMesh,
          limbs: astronautMesh.userData.limbs as AstronautLimbs | undefined,
          x: startWp.x,
          z: startWp.z,
          yaw: c * 0.8,
          walkPhase: c * 1.4,
          pauseTimer: c * 0.6,
          hopTimer: 0,
          hopDuration: 1.05,
          hopCooldown: 3.0 + c * 1.8,
          waypoints: safeWalkPoints,
          waypointIdx: (c + 1) % safeWalkPoints.length,
        });
      }
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [placedPods, selectedPlacedPod, isSimulating, crewSize]);

  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const handlePointerLeave = () => {
    hoveredGridTileRef.current = null;
    setHoverBlockedReason(null);
    if (ghostGroupRef.current) {
      ghostGroupRef.current.visible = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !terrainPlaneRef.current) return;

    if (!selectedCatalogPod) {
      if (ghostGroupRef.current) ghostGroupRef.current.visible = false;
      setHoverBlockedReason(null);
      return;
    }

    const rect = container.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, cameraRef.current);
    const intersects = raycaster.current.intersectObject(terrainPlaneRef.current);

    if (intersects.length > 0) {
      const pt = intersects[0].point;
      const gx = Math.round(pt.x / GRID_STEP);
      const gz = Math.round(pt.z / GRID_STEP);

      const maxG = GRID_SIZE / 2;
      if (Math.abs(gx) <= maxG && Math.abs(gz) <= maxG) {
        hoveredGridTileRef.current = { x: gx, z: gz };

        const isPodOccupied = placedPods.some((p) => p.gridX === gx && p.gridZ === gz);
        const isHelipadTile = helipadsRef.current.some((h) => h.gridX === gx && h.gridZ === gz);
        const isBlocked = isPodOccupied || isHelipadTile;

        setHoverBlockedReason(
          isHelipadTile
            ? 'Tile reserved for Helicopter Landing Pad'
            : isPodOccupied
            ? 'Tile already occupied'
            : null
        );

        if (ghostGroupRef.current) {
          const ghost = ghostGroupRef.current;
          ghost.visible = true;
          ghost.position.set(gx * GRID_STEP, 0, gz * GRID_STEP);
          ghost.rotation.y = THREE.MathUtils.degToRad(ghostRotationRef.current);

          while (ghost.children.length > 0) {
            ghost.remove(ghost.children[0]);
          }
          ghost.add(createPodMesh(selectedCatalogPod, true, !isBlocked));
        }
      } else {
        hoveredGridTileRef.current = null;
        setHoverBlockedReason(null);
        if (ghostGroupRef.current) ghostGroupRef.current.visible = false;
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, cameraRef.current);

    if (selectedCatalogPod && hoveredGridTileRef.current) {
      const { x, z } = hoveredGridTileRef.current;
      const isOccupied = placedPods.some((p) => p.gridX === x && p.gridZ === z);
      const isHelipadTile = helipadsRef.current.some((h) => h.gridX === x && h.gridZ === z);
      if (!isOccupied && !isHelipadTile) {
        onPlacePod(x, z, ghostRotationRef.current);
      } else {
        audioManager.playError();
      }
      return;
    }

    if (podsGroupRef.current) {
      const intersects = raycaster.current.intersectObjects(podsGroupRef.current.children, true);
      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current && !current.userData.placed) {
          current = current.parent;
        }
        if (current && current.userData.placed) {
          onSelectPlacedPod(current.userData.placed);
          audioManager.playClick();
          return;
        }
      }
    }

    onSelectPlacedPod(null);
  };

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative cursor-crosshair select-none overflow-hidden rounded-2xl border border-[#2A2442] bg-[#09090F]"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      data-testid="three-canvas-container"
    >
      {/* Clean Viewport Site & Stats Badge */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10101A] border border-[#2A2442]">
        <MapPin className="w-3.5 h-3.5 text-[#A78BFA]" />
        <span className="text-xs font-semibold text-[#E9D5FF]">
          {landingSite.name}
        </span>
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1D1736] text-[#C4B5FD]">
          {placedPods.length} Buildings
        </span>
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#5B2C98] text-white">
          {crewSize} Crew
        </span>
      </div>

      {/* Placement Toolbar when a building is selected */}
      {selectedCatalogPod && (
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#151324] border ${
            hoverBlockedReason ? 'border-rose-500' : 'border-[#8B5CF6]'
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: selectedCatalogPod.colorAccent }}
          />
          <div className="text-left">
            <div className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5">
              <span>Placing: {selectedCatalogPod.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#09090F] text-[#A78BFA]">
                {ghostRotationRef.current}°
              </span>
            </div>
            <div className={`text-[10px] ${hoverBlockedReason ? 'text-rose-300 font-semibold' : 'text-[#9F8FC7]'}`}>
              {hoverBlockedReason || 'Click the ground grid to place'}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              rotateGhost();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancelPlacement?.();
              audioManager.playClick();
            }}
            data-testid="cancel-placement-btn"
            className="p-1.5 rounded-lg bg-[#09090F] hover:bg-[#2A2442] text-[#C4B5FD] hover:text-white transition-colors cursor-pointer"
            title="Cancel Placement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected Building Bar */}
      {selectedPlacedPod && !selectedCatalogPod && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#151324] border border-[#8B5CF6]">
          <div className="text-left">
            <div className="text-xs font-bold text-[#E9D5FF]">
              Building at Grid [{selectedPlacedPod.gridX}, {selectedPlacedPod.gridZ}]
            </div>
            <div className="text-[10px] text-[#9F8FC7]">Click Inspect to view or remove</div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlacedPod(selectedPlacedPod);
              audioManager.playClick();
            }}
            className="px-2.5 py-1 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Inspect</span>
          </button>
        </div>
      )}
    </div>
  );
};
