import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  MapPin,
  Sun,
  Droplets,
  Thermometer,
  Mountain,
  ArrowRight,
  ArrowLeft,
  Compass,
  Search,
  AlertTriangle,
  X,
} from 'lucide-react';
import { LandingSite, SiteDifficulty } from '../types';
import { MARS_LANDING_SITES } from '../utils/landingSites';
import { POD_MAP } from '../utils/podCatalog';
import { createMarsGlobeTexture, createMarsGlobeBumpTexture } from '../utils/transitCosmos';
import { detectSoftwareWebGL, createAfterDrawScheduler } from '../utils/webglDetect';
import { audioManager } from '../utils/audioManager';

interface MarsLandingSelectorProps {
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  onConfirmSite: (siteId: string) => void;
  onBack?: () => void;
}

const GLOBE_RADIUS = 3.2;

const DIFFICULTY_STYLES: Record<SiteDifficulty, string> = {
  Easy: 'bg-emerald-950 text-emerald-300 border-emerald-700/60',
  Moderate: 'bg-sky-950 text-sky-300 border-sky-700/60',
  Hard: 'bg-amber-950 text-amber-300 border-amber-700/60',
  Extreme: 'bg-orange-950 text-orange-300 border-orange-700/60',
  Impossible: 'bg-rose-950 text-rose-300 border-rose-600/80',
};

const DIFFICULTY_FILTERS: Array<'All' | SiteDifficulty> = [
  'All',
  'Easy',
  'Moderate',
  'Hard',
  'Extreme',
  'Impossible',
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const u = (((lon % 360) + 360) % 360) / 360;
  const phi = u * Math.PI * 2;
  const theta = ((90 - lat) * Math.PI) / 180;
  const x = -radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

export const MarsLandingSelector: React.FC<MarsLandingSelectorProps> = ({
  selectedSiteId,
  onSelectSite,
  onConfirmSite,
  onBack,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | SiteDifficulty>('All');

  const selectedSiteIdRef = useRef(selectedSiteId);
  selectedSiteIdRef.current = selectedSiteId;

  const hoveredSiteIdRef = useRef<string | null>(null);
  hoveredSiteIdRef.current = hoveredSiteId;

  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;

  const targetCameraGoalRef = useRef<THREE.Vector3 | null>(null);
  const isUserOrbitingRef = useRef(false);

  const activeSite: LandingSite =
    MARS_LANDING_SITES.find((s) => s.id === selectedSiteId) || MARS_LANDING_SITES[0];

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MARS_LANDING_SITES.filter((site) => {
      if (difficultyFilter !== 'All' && site.difficulty !== difficultyFilter) {
        return false;
      }
      if (!q) return true;
      return (
        site.name.toLowerCase().includes(q) ||
        site.region.toLowerCase().includes(q) ||
        site.description.toLowerCase().includes(q) ||
        site.iceAccessLabel.toLowerCase().includes(q) ||
        site.sunlightLabel.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, difficultyFilter]);

  useEffect(() => {
    const site = MARS_LANDING_SITES.find((s) => s.id === selectedSiteId);
    if (!site) return;
    const normal = latLonToVector3(site.lat, site.lon, 1).normalize();
    targetCameraGoalRef.current = normal.multiplyScalar(10.8);
    isUserOrbitingRef.current = false;
  }, [selectedSiteId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090f);

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);

    const initialSite =
      MARS_LANDING_SITES.find((s) => s.id === selectedSiteIdRef.current) || MARS_LANDING_SITES[0];
    const startPos = latLonToVector3(initialSite.lat, initialSite.lon, 1)
      .normalize()
      .multiplyScalar(10.8);
    camera.position.copy(startPos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6.2;
    controls.maxDistance = 16;
    controls.target.set(0, 0, 0);

    const onControlStart = () => {
      isUserOrbitingRef.current = true;
      targetCameraGoalRef.current = null;
    };
    controls.addEventListener('start', onControlStart);

    const hemi = new THREE.HemisphereLight(0xe9d5ff, 0x1e1326, 0.65);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff1e6, 2.3);
    sunLight.position.set(12, 6, 10);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.7);
    rimLight.position.set(-10, -4, -10);
    scene.add(rimLight);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = Math.acos(1 - 2 * ((i + 0.5) / 700));
      const r = 45 + (i % 7) * 5;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xe9d5ff,
        size: 1.1,
        sizeAttenuation: false,
        opacity: 0.75,
        transparent: true,
      })
    );
    scene.add(stars);

    const marsGroup = new THREE.Group();
    scene.add(marsGroup);

    const marsTex = createMarsGlobeTexture();
    const bumpTex = createMarsGlobeBumpTexture();
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 48, 36);
    const globeMat = new THREE.MeshStandardMaterial({
      map: marsTex,
      bumpMap: bumpTex,
      bumpScale: 0.08,
      roughness: 0.82,
      metalness: 0.08,
    });
    marsGroup.add(new THREE.Mesh(globeGeo, globeMat));

    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.03, 36, 24);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
    });
    marsGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Compact 3D Pins with Hover Enlargement Animation for all 18 NASA Landing Sites
    const markerEntries: Array<{
      siteId: string;
      isImpossible: boolean;
      pinGroup: THREE.Group;
      beacon: THREE.Mesh;
      ring: THREE.Mesh;
      hitMesh: THREE.Mesh;
    }> = [];

    for (const site of MARS_LANDING_SITES) {
      const surfacePos = latLonToVector3(site.lat, site.lon, GLOBE_RADIUS + 0.015);
      const normal = surfacePos.clone().normalize();

      const pinGroup = new THREE.Group();
      pinGroup.position.copy(surfacePos);
      pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      pinGroup.scale.setScalar(0.58);

      const ringGeo = new THREE.RingGeometry(0.1, 0.15, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: site.isImpossible ? 0xf43f5e : 0xa78bfa,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      pinGroup.add(ring);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.22, 8),
        new THREE.MeshStandardMaterial({ color: 0xe9d5ff, metalness: 0.4, roughness: 0.3 })
      );
      stem.position.y = 0.12;
      pinGroup.add(stem);

      const beaconMat = new THREE.MeshStandardMaterial({
        color: site.isImpossible ? 0xf43f5e : 0x8b5cf6,
        emissive: site.isImpossible ? 0x9f1239 : 0x5b2c98,
        emissiveIntensity: 0.55,
        roughness: 0.25,
      });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), beaconMat);
      beacon.position.y = 0.25;
      pinGroup.add(beacon);

      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.y = 0.16;
      hitMesh.userData = { siteId: site.id };
      pinGroup.add(hitMesh);

      marsGroup.add(pinGroup);
      markerEntries.push({
        siteId: site.id,
        isImpossible: site.isImpossible,
        pinGroup,
        beacon,
        ring,
        hitMesh,
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(markerEntries.map((m) => m.hitMesh), false);
      if (hits.length > 0) {
        const hitSiteId = hits[0].object.userData.siteId as string;
        setHoveredSiteId(hitSiteId);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredSiteId(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dragDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dragDist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(markerEntries.map((m) => m.hitMesh), false);
      if (hits.length > 0) {
        const hitSiteId = hits[0].object.userData.siteId as string;
        audioManager.playClick();
        onSelectSiteRef.current(hitSiteId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const { scheduleNext, cancel } = createAfterDrawScheduler(renderer);
    let lastNow = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;

      if (targetCameraGoalRef.current && !isUserOrbitingRef.current) {
        const goal = targetCameraGoalRef.current;
        const nextPos = new THREE.Vector3(
          THREE.MathUtils.damp(camera.position.x, goal.x, 5.5, dt),
          THREE.MathUtils.damp(camera.position.y, goal.y, 5.5, dt),
          THREE.MathUtils.damp(camera.position.z, goal.z, 5.5, dt)
        );
        const targetDist = camera.position.length();
        nextPos.normalize().multiplyScalar(THREE.MathUtils.damp(targetDist, 10.8, 5.5, dt));
        camera.position.copy(nextPos);
        if (camera.position.distanceTo(goal) < 0.08) {
          targetCameraGoalRef.current = null;
        }
      }

      // Pin hover enlargement (1.55x) + selected (1.35x) + compact default (0.58x)
      const activeId = selectedSiteIdRef.current;
      const hoveredId = hoveredSiteIdRef.current;
      for (const entry of markerEntries) {
        const isActive = entry.siteId === activeId;
        const isHovered = entry.siteId === hoveredId;
        const targetScale = isHovered ? 1.55 : isActive ? 1.32 : 0.58;
        entry.pinGroup.scale.setScalar(
          THREE.MathUtils.damp(entry.pinGroup.scale.x, targetScale, 12, dt)
        );
        const beaconMat = entry.beacon.material as THREE.MeshStandardMaterial;
        const ringMat = entry.ring.material as THREE.MeshBasicMaterial;
        if (isHovered) {
          beaconMat.color.setHex(0xe9d5ff);
          beaconMat.emissive.setHex(0xa78bfa);
          ringMat.color.setHex(0xe9d5ff);
        } else if (isActive) {
          beaconMat.color.setHex(0xf59e0b);
          beaconMat.emissive.setHex(0xd97706);
          ringMat.color.setHex(0xfbbf24);
        } else if (entry.isImpossible) {
          beaconMat.color.setHex(0xf43f5e);
          beaconMat.emissive.setHex(0x9f1239);
          ringMat.color.setHex(0xfb7185);
        } else {
          beaconMat.color.setHex(0x8b5cf6);
          beaconMat.emissive.setHex(0x5b2c98);
          ringMat.color.setHex(0xa78bfa);
        }
      }

      controls.update();
      renderer.render(scene, camera);
      scheduleNext(isSoftwareGl, tick);
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(320, container.clientHeight);
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
      controls.removeEventListener('start', onControlStart);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const hoveredSite = hoveredSiteId
    ? MARS_LANDING_SITES.find((s) => s.id === hoveredSiteId)
    : null;

  return (
    <div
      className="flex-1 min-h-0 bg-[#09090F] text-[#E9D5FF] flex flex-col overflow-hidden select-none"
      data-testid="mars-landing-selector"
    >
      {/* Top Bar */}
      <div className="h-14 shrink-0 px-4 sm:px-6 bg-[#10101A] border-b border-[#2A2442] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/assets/aistudio/logo_new_f57edc92.png"
            alt="Cosmic Cupcake"
            className="w-8 h-8 rounded-full object-cover border border-[#8B5CF6] shrink-0"
          />
          <div className="min-w-0 flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold tracking-wide text-[#E9D5FF] truncate">
              Choose Your Mars Landing Site
            </h2>
            <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded bg-[#151324] border border-[#2A2442] text-[#A78BFA]">
              18 NASA Sites
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onBack && (
            <button
              onClick={() => {
                audioManager.playClick();
                onBack();
              }}
              data-testid="site-selector-back-btn"
              className="px-3 py-1.5 rounded-lg bg-[#1A162D] hover:bg-[#251F3E] text-[#E9D5FF] border border-[#35285C] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <button
            onClick={() => {
              audioManager.playClick();
              onConfirmSite(activeSite.id);
            }}
            data-testid="confirm-landing-site-btn"
            className="px-4 py-1.5 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Land at {activeSite.name}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Left Interactive 3D Mars Globe */}
        <div className="relative flex-1 min-h-[260px] bg-[#09090F]">
          <div ref={mountRef} className="w-full h-full" />

          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-[#10101A] border border-[#2A2442] text-xs text-[#C4B5FD] flex items-center gap-2 pointer-events-none">
            <Compass className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Drag to rotate Mars • Scroll to zoom • Hover &amp; click pins to explore</span>
          </div>

          {hoveredSite && (
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-[#151324] border border-[#8B5CF6] text-xs font-semibold text-[#E9D5FF] pointer-events-none flex items-center gap-2">
              <span>{hoveredSite.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${DIFFICULTY_STYLES[hoveredSite.difficulty]}`}
              >
                {hoveredSite.difficulty}
              </span>
            </div>
          )}
        </div>

        {/* Right Site List & Active Site Details */}
        <div className="w-full lg:w-[460px] shrink-0 bg-[#10101A] border-t lg:border-t-0 lg:border-l border-[#2A2442] flex flex-col min-h-0">
          {/* Active Site Summary Header */}
          <div className="p-4 border-b border-[#2A2442] bg-[#151324] shrink-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <div className="text-[11px] font-semibold text-[#A78BFA] uppercase tracking-wide">
                  {activeSite.region}
                </div>
                <h3 className="text-lg font-bold text-[#E9D5FF] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#A78BFA]" />
                  <span>{activeSite.name}</span>
                </h3>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${DIFFICULTY_STYLES[activeSite.difficulty]}`}
              >
                {activeSite.difficulty}
              </span>
            </div>

            <p className="text-xs text-[#C4B5FD] leading-relaxed mb-2.5">
              {activeSite.description}
            </p>

            {/* Impossible or Unsuitable Pod Site Alert */}
            {(activeSite.isImpossible || activeSite.unsuitablePods.length > 0) && (
              <div
                className={`mb-2.5 p-2.5 rounded-lg border text-[11px] space-y-1 ${
                  activeSite.isImpossible
                    ? 'bg-[#1F101A] border-rose-500/60 text-rose-200'
                    : 'bg-[#191426] border-amber-500/50 text-amber-200'
                }`}
              >
                {activeSite.isImpossible && activeSite.impossibleReason && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-rose-300">Impossible Rating:</strong>{' '}
                      {activeSite.impossibleReason}
                    </span>
                  </div>
                )}
                {activeSite.unsuitablePods.map((rule) => (
                  <div key={rule.podId} className="text-[10px] leading-snug text-[#E9D5FF]">
                    <span className="font-bold text-amber-300">
                      Limited: {POD_MAP.get(rule.podId)?.name || rule.podId}
                    </span>{' '}
                    — Use{' '}
                    {rule.alternativePodIds
                      .map((id) => POD_MAP.get(id)?.name || id)
                      .join(' or ')}{' '}
                    instead.
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-[#09090F] border border-[#2A2442] flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-[#9F8FC7]">Sunlight</div>
                  <div className="font-semibold text-[#E9D5FF]">
                    {Math.round(activeSite.solarEfficiency * 100)}% ({activeSite.sunlightLabel})
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#09090F] border border-[#2A2442] flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-[#9F8FC7]">Ground Water</div>
                  <div className="font-semibold text-[#E9D5FF]">
                    {activeSite.waterBonusL > 0 ? `+${activeSite.waterBonusL} L/day ice` : 'None (Dry)'}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#09090F] border border-[#2A2442] flex items-center gap-2">
                <Thermometer className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-[#9F8FC7]">Average Temp</div>
                  <div className="font-semibold text-[#E9D5FF]">{activeSite.avgTempC}°C</div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#09090F] border border-[#2A2442] flex items-center gap-2">
                <Mountain className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                <div>
                  <div className="text-[10px] text-[#9F8FC7]">Elevation</div>
                  <div className="font-semibold text-[#E9D5FF]">{activeSite.elevationLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Difficulty Filter Bar */}
          <div className="p-3 border-b border-[#2A2442] bg-[#0D0D16] space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9F8FC7] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 18 Mars sites (e.g. Olympus, Ice, Crater)..."
                data-testid="site-search-input"
                className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-[#09090F] border border-[#2A2442] text-xs text-[#E9D5FF] placeholder-[#6D5B97] focus:outline-none focus:border-[#8B5CF6]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9F8FC7] hover:text-white cursor-pointer"
                  aria-label="Clear site search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_FILTERS.map((diff) => {
                const isActive = difficultyFilter === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => {
                      setDifficultyFilter(diff);
                      audioManager.playClick();
                    }}
                    data-testid={`filter-difficulty-${diff.toLowerCase()}`}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#5B2C98] border-[#8B5CF6] text-white'
                        : 'bg-[#151324] border-[#2A2442] text-[#9F8FC7] hover:text-[#E9D5FF]'
                    }`}
                  >
                    {diff}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable 18-Site List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredSites.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9F8FC7]">
                No Mars landing sites match your search or difficulty filter.
              </div>
            ) : (
              filteredSites.map((site) => {
                const isSelected = site.id === activeSite.id;
                return (
                  <button
                    key={site.id}
                    onClick={() => {
                      audioManager.playClick();
                      onSelectSite(site.id);
                    }}
                    data-testid={`landing-site-${site.id}`}
                    className={`w-full p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1D1736] border-[#8B5CF6]'
                        : 'bg-[#151324] border-[#2A2442] hover:border-[#5B2C98]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1.5 min-w-0">
                        <MapPin
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected
                              ? 'text-amber-400'
                              : site.isImpossible
                              ? 'text-rose-400'
                              : 'text-[#A78BFA]'
                          }`}
                        />
                        <span className="truncate">{site.name}</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${DIFFICULTY_STYLES[site.difficulty]}`}
                      >
                        {site.difficulty}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#C4B5FD] line-clamp-2 leading-snug mb-1.5">
                      {site.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-[#9F8FC7]">
                      <span>{site.iceAccessLabel}</span>
                      <span>
                        {site.avgTempC}°C • {Math.round(site.solarEfficiency * 100)}% Sun
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-[#2A2442] bg-[#09090F] shrink-0">
            <button
              onClick={() => {
                audioManager.playClick();
                onConfirmSite(activeSite.id);
              }}
              className="w-full py-2.5 rounded-xl bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue to Base Builder</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
