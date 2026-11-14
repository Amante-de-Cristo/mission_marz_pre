import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Rocket, Wrench, FastForward } from 'lucide-react';
import { PlacedPod, LandingSite } from '../types';
import { POD_MAP, getStarterBaseForSite, CATEGORY_COLORS } from '../utils/podCatalog';
import { DEFAULT_LANDING_SITE } from '../utils/landingSites';
import { audioManager } from '../utils/audioManager';
import {
  createSpacecraftMesh,
  createPodMesh,
  createConnectionTunnelMesh,
  createMarsRegolithTexture,
  createMarsBumpTexture,
} from '../utils/podGeometries';
import {
  createEarthTexture,
  createMarsGlobeTexture,
  createMercuryTexture,
  createVenusTexture,
  createMoonTexture,
  createSunFlareTexture,
  createParticleTexture,
  getPodActionText,
} from '../utils/transitCosmos';
import { detectSoftwareWebGL, createAfterDrawScheduler } from '../utils/webglDetect';

interface PreSimulationSequenceProps {
  onComplete: () => void;
  onSkip: () => void;
  constructionDays?: number;
  transitDays?: number;
  placedPods?: PlacedPod[];
  landingSite?: LandingSite;
  crewSize?: number;
}

export const PreSimulationSequence: React.FC<PreSimulationSequenceProps> = ({
  onComplete,
  onSkip,
  constructionDays = 14,
  transitDays = 210,
  placedPods = [],
  landingSite = DEFAULT_LANDING_SITE,
  crewSize = 4,
}) => {
  const [phase, setPhase] = useState<'transit' | 'construction'>('transit');
  const [currentDay, setCurrentDay] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentPodIndex, setCurrentPodIndex] = useState(0);
  const [activePodActionText, setActivePodActionText] = useState(
    'Preparing landing pad and anchoring foundation...'
  );

  const threeMountRef = useRef<HTMLDivElement | null>(null);

  const targetPods =
    placedPods.length > 0
      ? placedPods
      : getStarterBaseForSite(landingSite.id, crewSize).map((p, idx) => ({
          instanceId: `preset_${p.podId}_${idx}`,
          podId: p.podId,
          gridX: p.gridX,
          gridZ: p.gridZ,
          rotation: p.rotation,
          placedAt: Date.now() + idx,
        }));

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;

  const animStateRef = useRef<{
    progress: number;
    phase: 'transit' | 'construction';
    podIndex: number;
  }>({
    progress: 0,
    phase: 'transit',
    podIndex: 0,
  });

  // Smooth wall-clock progression across Stage 1 (Transit) and Stage 2 (Base Construction)
  useEffect(() => {
    const transitMs = 6500;
    const constructionMs = 7500;
    const totalMs = transitMs + constructionMs;
    const startTime = performance.now();

    let switchedToConstruction = false;
    let lastReportedPodIdx = -1;
    let lastTickSoundTime = startTime;
    let rafId = 0;

    const updateProgress = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < transitMs) {
        const p = Math.max(0, Math.min(1, elapsed / transitMs));
        setProgress(p);
        setCurrentDay(Math.min(transitDays, Math.floor(p * (transitDays - 1)) + 1));
        animStateRef.current = { progress: p, phase: 'transit', podIndex: 0 };

        if (now - lastTickSoundTime > 950) {
          lastTickSoundTime = now;
          audioManager.playClick();
        }
      } else {
        if (!switchedToConstruction) {
          switchedToConstruction = true;
          setPhase('construction');
          audioManager.playPlacePod();
        }

        const constElapsed = elapsed - transitMs;
        const p = Math.max(0, Math.min(1, constElapsed / constructionMs));
        setProgress(p);
        setCurrentDay(Math.min(constructionDays, Math.floor(p * (constructionDays - 1)) + 1));

        const numPods = Math.max(1, targetPods.length);
        const podIdx = Math.min(numPods - 1, Math.floor(p * numPods));
        setCurrentPodIndex(podIdx);
        animStateRef.current = { progress: p, phase: 'construction', podIndex: podIdx };

        if (podIdx !== lastReportedPodIdx) {
          lastReportedPodIdx = podIdx;
          const currentPod = targetPods[podIdx];
          const def = POD_MAP.get(currentPod.podId);
          setActivePodActionText(getPodActionText(currentPod.podId, def?.name || 'Base Module'));
          audioManager.playPlacePod();
        }
      }

      if (elapsed >= totalMs) {
        audioManager.playVictory();
        onCompleteRef.current();
        return;
      }

      rafId = requestAnimationFrame(updateProgress);
    };

    rafId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(rafId);
  }, [transitDays, constructionDays, targetPods]);

  // Three.js Solar System Transit + Mars Surface Construction Scene
  useEffect(() => {
    const container = threeMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090f);

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 1000);
    camera.position.set(0, 12, 34);

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

    const ambLight = new THREE.AmbientLight(0xe9d5ff, 0.45);
    scene.add(ambLight);

    const sunPointLight = new THREE.PointLight(0xfff5d6, 3.0, 280);
    sunPointLight.position.set(-8, 2, -40);
    scene.add(sunPointLight);

    const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    dirLight.position.set(25, 35, 30);
    scene.add(dirLight);

    // Distant Starfield
    const starCount = 1000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (((i * 313) % 360) - 180) * 1.1;
      starPositions[i * 3 + 1] = (((i * 197) % 360) - 180) * 1.1;
      starPositions[i * 3 + 2] = (((i * 421) % 360) - 180) * 1.1;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starfield = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xe9d5ff, size: 1.25, sizeAttenuation: false, opacity: 0.85, transparent: true })
    );
    scene.add(starfield);

    // ==========================================
    // STAGE 1: FULL SOLAR SYSTEM TRANSIT
    // ==========================================
    const transitGroup = new THREE.Group();
    scene.add(transitGroup);

    const solarCenter = new THREE.Vector3(-6, 1.5, -42);

    // Radiant Sun Sphere & Corona Sprite
    const sunSphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sunSphere.position.copy(solarCenter);
    transitGroup.add(sunSphere);

    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSunFlareTexture(),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      })
    );
    sunSprite.position.copy(solarCenter);
    sunSprite.scale.set(16, 16, 1);
    transitGroup.add(sunSprite);

    // Orbital Rings around the Sun
    const buildOrbitRing = (radius: number, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            solarCenter.x + Math.cos(a) * radius,
            solarCenter.y,
            solarCenter.z + Math.sin(a) * radius
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.LineLoop(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      );
    };

    const mercuryRadius = 9.5;
    const venusRadius = 15.5;
    const earthOrbitRadius = 24;
    const marsOrbitRadius = 35;

    transitGroup.add(buildOrbitRing(mercuryRadius, 0x9ca3af, 0.25));
    transitGroup.add(buildOrbitRing(venusRadius, 0xfbbf24, 0.25));
    transitGroup.add(buildOrbitRing(earthOrbitRadius, 0x38bdf8, 0.35));
    transitGroup.add(buildOrbitRing(marsOrbitRadius, 0xa78bfa, 0.35));

    // Mercury
    const mercuryMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 20),
      new THREE.MeshStandardMaterial({ map: createMercuryTexture(), roughness: 0.9 })
    );
    transitGroup.add(mercuryMesh);

    // Venus
    const venusMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 24, 24),
      new THREE.MeshStandardMaterial({ map: createVenusTexture(), roughness: 0.75 })
    );
    transitGroup.add(venusMesh);

    // Earth & Orbiting Moon
    const earthPos = new THREE.Vector3(-21, 0, -12);
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.7, 32, 32),
      new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 0.65, metalness: 0.1 })
    );
    earthMesh.position.copy(earthPos);
    transitGroup.add(earthMesh);

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 20, 20),
      new THREE.MeshStandardMaterial({ map: createMoonTexture(), roughness: 0.85 })
    );
    moonMesh.position.set(4.5, 1.0, 0);
    earthMesh.add(moonMesh);

    // Mars Target Planet
    const marsPos = new THREE.Vector3(24, 1.5, -4);
    const marsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 32, 32),
      new THREE.MeshStandardMaterial({ map: createMarsGlobeTexture(), roughness: 0.8, metalness: 0.1 })
    );
    marsMesh.position.copy(marsPos);
    transitGroup.add(marsMesh);

    // Asteroid Belt beyond Mars
    const beltGeo = new THREE.BufferGeometry();
    const beltPositions = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      const angle = (i / 260) * Math.PI * 2;
      const r = 42 + (i % 7) * 1.1;
      beltPositions[i * 3] = solarCenter.x + Math.cos(angle) * r;
      beltPositions[i * 3 + 1] = solarCenter.y + Math.sin(i * 2.1) * 1.2;
      beltPositions[i * 3 + 2] = solarCenter.z + Math.sin(angle) * r;
    }
    beltGeo.setAttribute('position', new THREE.BufferAttribute(beltPositions, 3));
    transitGroup.add(
      new THREE.Points(beltGeo, new THREE.PointsMaterial({ color: 0xa78bfa, size: 1.4, sizeAttenuation: false, opacity: 0.45, transparent: true }))
    );

    // Curved Transfer Path (Earth -> Mars)
    const transferCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(earthPos.x + 3.1, earthPos.y, earthPos.z),
      new THREE.Vector3((earthPos.x + marsPos.x) * 0.42, 7.5, -14),
      new THREE.Vector3((earthPos.x + marsPos.x) * 0.58, 9.0, -8),
      new THREE.Vector3(marsPos.x - 2.6, marsPos.y, marsPos.z)
    );
    const orbitPoints = transferCurve.getPoints(64);
    const transferLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      new THREE.LineDashedMaterial({ color: 0xa78bfa, dashSize: 1.0, gapSize: 0.7, opacity: 0.8, transparent: true })
    );
    transferLine.computeLineDistances();
    transitGroup.add(transferLine);

    // Orion-Style NASA Spacecraft
    const spacecraft = createSpacecraftMesh();
    spacecraft.scale.set(0.85, 0.85, 0.85);
    transitGroup.add(spacecraft);

    const plumeCount = 64;
    const plumeGeo = new THREE.BufferGeometry();
    const plumePositions = new Float32Array(plumeCount * 3);
    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePositions, 3));
    const plumePoints = new THREE.Points(
      plumeGeo,
      new THREE.PointsMaterial({
        size: 2.0,
        map: createParticleTexture(),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    transitGroup.add(plumePoints);

    // ==========================================
    // STAGE 2: SURFACE BASE ASSEMBLY
    // ==========================================
    const surfaceGroup = new THREE.Group();
    surfaceGroup.visible = false;
    scene.add(surfaceGroup);

    const regolithTex = createMarsRegolithTexture(
      landingSite.terrainColorHex,
      landingSite.terrainAccentHex
    );
    const bumpTex = createMarsBumpTexture();
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160, 32, 32),
      new THREE.MeshStandardMaterial({
        map: regolithTex,
        bumpMap: bumpTex,
        bumpScale: 0.16,
        roughness: 0.88,
        metalness: 0.12,
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    surfaceGroup.add(groundMesh);

    const gridLines = new THREE.GridHelper(80, 20, 0x2b2345, 0x1d1730);
    const gridMat = gridLines.material as THREE.Material | THREE.Material[];
    if (Array.isArray(gridMat)) {
      gridMat.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.35;
      });
    } else {
      gridMat.transparent = true;
      gridMat.opacity = 0.35;
    }
    gridLines.position.y = 0.04;
    surfaceGroup.add(gridLines);

    const mountainMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(75, 85, 18, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: landingSite.terrainAccentHex,
        roughness: 0.95,
        side: THREE.BackSide,
      })
    );
    mountainMesh.position.y = 7;
    surfaceGroup.add(mountainMesh);

    const constructedPodMeshes: THREE.Group[] = [];
    const podCoordMap = new Map<string, PlacedPod>();

    for (const p of targetPods) {
      const def = POD_MAP.get(p.podId);
      if (!def) continue;
      const podMesh = createPodMesh(def, false, true);
      podMesh.position.set(p.gridX * 6.0, 0, p.gridZ * 6.0);
      podMesh.rotation.y = THREE.MathUtils.degToRad(p.rotation);
      podMesh.scale.set(0, 0, 0);
      surfaceGroup.add(podMesh);
      constructedPodMeshes.push(podMesh);
      podCoordMap.set(`${p.gridX},${p.gridZ}`, p);
    }

    const tunnelsGroup = new THREE.Group();
    surfaceGroup.add(tunnelsGroup);
    let lastBuiltTunnelIdx = -1;

    // Assembly Drone with Twin Laser Beams
    const drone = new THREE.Group();
    drone.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.35, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 })
      )
    );
    const laserMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9 });
    const laserLine1 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(0, -3.2, 0)]),
      laserMat
    );
    const laserLine2 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0, -3.2, 0)]),
      laserMat
    );
    drone.add(laserLine1, laserLine2);
    drone.position.set(0, 4.5, 0);
    surfaceGroup.add(drone);

    const sparkCount = 75;
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkCount * 3), 3));
    const sparkPoints = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ color: 0xe9d5ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9 })
    );
    surfaceGroup.add(sparkPoints);

    const { scheduleNext, cancel } = createAfterDrawScheduler(renderer);
    const startClock = performance.now();

    const tick = () => {
      const elapsed = (performance.now() - startClock) * 0.001;
      const { progress: animProg, phase: animPhase, podIndex: animPodIdx } = animStateRef.current;

      starfield.rotation.y = elapsed * 0.0015;

      if (animPhase === 'transit') {
        transitGroup.visible = true;
        surfaceGroup.visible = false;
        scene.fog = null;
        scene.background = new THREE.Color(0x09090f);

        // Inner planet orbits
        mercuryMesh.position.set(
          solarCenter.x + Math.cos(elapsed * 0.9) * mercuryRadius,
          solarCenter.y,
          solarCenter.z + Math.sin(elapsed * 0.9) * mercuryRadius
        );
        venusMesh.position.set(
          solarCenter.x + Math.cos(elapsed * 0.55 + 1.4) * venusRadius,
          solarCenter.y,
          solarCenter.z + Math.sin(elapsed * 0.55 + 1.4) * venusRadius
        );

        earthMesh.rotation.y = elapsed * 0.06;
        moonMesh.position.x = Math.sin(elapsed * 0.45) * 4.5;
        moonMesh.position.z = Math.cos(elapsed * 0.45) * 4.5;
        marsMesh.rotation.y = elapsed * 0.05;

        const t = Math.max(0, Math.min(1, animProg));
        const shipPos = transferCurve.getPoint(t);
        const tangent = transferCurve.getTangent(t).normalize();
        spacecraft.position.copy(shipPos);

        const lookTarget = shipPos.clone().add(tangent);
        spacecraft.lookAt(lookTarget);
        spacecraft.rotateX(Math.PI / 2);
        spacecraft.rotateZ(Math.sin(elapsed * 1.8) * 0.05);

        const plumeAttr = plumePoints.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < plumeCount; i++) {
          const dist = (i / plumeCount) * 4.2;
          const jitter = Math.sin(i * 1.7 + elapsed * 12) * 0.14;
          plumeAttr.setXYZ(
            i,
            shipPos.x - tangent.x * dist + jitter,
            shipPos.y - tangent.y * dist + jitter,
            shipPos.z - tangent.z * dist + jitter
          );
        }
        plumeAttr.needsUpdate = true;

        // Cinematic 3/4 tracking orbit framing Orion spacecraft with Earth, Sun, inner planets & Mars
        const orbitAngle = t * Math.PI * 0.65 + 0.35;
        const camDist = 23 - Math.sin(t * Math.PI) * 3.5;
        camera.position.set(
          shipPos.x + Math.sin(orbitAngle) * camDist * 0.65,
          shipPos.y + 7.5 + Math.cos(t * Math.PI * 2) * 1.5,
          shipPos.z + Math.cos(orbitAngle) * camDist + 8.0
        );
        camera.lookAt(shipPos.x * 0.45, shipPos.y * 0.5, -14);
      } else {
        transitGroup.visible = false;
        surfaceGroup.visible = true;
        if (!scene.fog) {
          scene.fog = new THREE.FogExp2(landingSite.fogHex, 0.007);
          scene.background = new THREE.Color(landingSite.skyHex);
        }

        const constProg = Math.max(0, Math.min(1, animProg));
        const activeIdx = animPodIdx;
        const numPods = constructedPodMeshes.length;

        const camOrbit = elapsed * 0.25;
        camera.position.set(Math.sin(camOrbit) * 26, 14, Math.cos(camOrbit) * 26);
        camera.lookAt(0, 1.5, 0);

        for (let i = 0; i < numPods; i++) {
          const mesh = constructedPodMeshes[i];
          if (i < activeIdx) {
            mesh.scale.set(1, 1, 1);
          } else if (i === activeIdx) {
            const podFraction = constProg * numPods - activeIdx;
            const popScale = Math.min(1, Math.max(0, podFraction * 1.3));
            const spring = popScale > 0.85 ? 1.0 + (1 - popScale) * 0.3 : popScale * 1.12;
            mesh.scale.set(spring, spring, spring);

            drone.position.x = THREE.MathUtils.lerp(drone.position.x, mesh.position.x, 0.16);
            drone.position.z = THREE.MathUtils.lerp(drone.position.z, mesh.position.z, 0.16);
            drone.position.y = 4.2 + Math.sin(elapsed * 4) * 0.28;

            const l1 = laserLine1.geometry.attributes.position as THREE.BufferAttribute;
            l1.setXYZ(
              1,
              mesh.position.x - drone.position.x + Math.sin(elapsed * 6) * 0.8,
              -drone.position.y + 0.5,
              mesh.position.z - drone.position.z + Math.cos(elapsed * 6) * 0.8
            );
            l1.needsUpdate = true;

            const l2 = laserLine2.geometry.attributes.position as THREE.BufferAttribute;
            l2.setXYZ(
              1,
              mesh.position.x - drone.position.x - Math.sin(elapsed * 6) * 0.8,
              -drone.position.y + 0.5,
              mesh.position.z - drone.position.z - Math.cos(elapsed * 6) * 0.8
            );
            l2.needsUpdate = true;

            const sparkAttr = sparkPoints.geometry.attributes.position as THREE.BufferAttribute;
            for (let s = 0; s < sparkCount; s++) {
              sparkAttr.setXYZ(
                s,
                mesh.position.x + Math.sin(s * 2.3 + elapsed * 18) * 1.2,
                0.3 + ((s * 0.2 + elapsed * 4) % 1.6),
                mesh.position.z + Math.cos(s * 1.9 + elapsed * 15) * 1.2
              );
            }
            sparkAttr.needsUpdate = true;
          } else {
            mesh.scale.set(0, 0, 0);
          }
        }

        if (activeIdx !== lastBuiltTunnelIdx) {
          lastBuiltTunnelIdx = activeIdx;
          while (tunnelsGroup.children.length > 0) {
            tunnelsGroup.remove(tunnelsGroup.children[0]);
          }
          for (let i = 0; i <= activeIdx; i++) {
            const currentP = targetPods[i];
            if (!currentP) continue;
            const east = podCoordMap.get(`${currentP.gridX + 1},${currentP.gridZ}`);
            if (east) {
              const eastIdx = targetPods.findIndex((p) => p.instanceId === east.instanceId);
              if (eastIdx !== -1 && eastIdx <= activeIdx) {
                tunnelsGroup.add(
                  createConnectionTunnelMesh(
                    currentP.gridX * 6,
                    currentP.gridZ * 6,
                    (currentP.gridX + 1) * 6,
                    currentP.gridZ * 6
                  )
                );
              }
            }
            const south = podCoordMap.get(`${currentP.gridX},${currentP.gridZ + 1}`);
            if (south) {
              const southIdx = targetPods.findIndex((p) => p.instanceId === south.instanceId);
              if (southIdx !== -1 && southIdx <= activeIdx) {
                tunnelsGroup.add(
                  createConnectionTunnelMesh(
                    currentP.gridX * 6,
                    currentP.gridZ * 6,
                    currentP.gridX * 6,
                    (currentP.gridZ + 1) * 6
                  )
                );
              }
            }
          }
        }
      }

      renderer.render(scene, camera);
      scheduleNext(isSoftwareGl, tick);
    };

    tick();

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
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [targetPods, landingSite]);

  const distanceTraveledMkm = (progress * 225.3).toFixed(1);
  const flightVelocity = (21.4 + Math.sin(progress * Math.PI) * 4.2).toFixed(1);
  const commDelayMin = (3.2 + progress * 15.6).toFixed(1);

  const activePod = targetPods[currentPodIndex];
  const activePodDef = activePod ? POD_MAP.get(activePod.podId) : null;
  const activeCategoryTheme = activePodDef ? CATEGORY_COLORS[activePodDef.category] : null;
  const clampedScale = Math.max(0, Math.min(1, progress));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#09090F]/95"
      data-testid="pre-simulation-sequence"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#10101A] border border-[#35285C] overflow-hidden flex flex-col text-left">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#2A2442] flex items-center justify-between bg-[#151324]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#5B2C98] text-white shrink-0">
              {phase === 'transit' ? <Rocket className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#A78BFA] font-semibold block">
                {phase === 'transit'
                  ? `Stage 1 • Spacecraft Flight to ${landingSite.name}`
                  : `Stage 2 • Building Your Base at ${landingSite.name}`}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#E9D5FF]">
                {phase === 'transit'
                  ? `Flight to Mars: Day ${currentDay} of ${transitDays}`
                  : `Base Assembly: Day ${currentDay} of ${constructionDays}`}
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              audioManager.playClick();
              onSkipRef.current();
            }}
            data-testid="skip-presim-btn"
            className="px-3.5 py-2 rounded-lg bg-[#1E1A33] hover:bg-[#2A2347] border border-[#35285C] text-[#E9D5FF] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FastForward className="w-4 h-4 text-[#A78BFA]" />
            <span>Skip Sequence</span>
          </button>
        </div>

        {/* 3D WebGL Viewport */}
        <div className="relative w-full h-80 sm:h-96 bg-[#09090F] overflow-hidden border-b border-[#2A2442]">
          <div ref={threeMountRef} className="w-full h-full block" />

          {phase === 'transit' && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#E9D5FF] bg-[#10101A] px-4 py-2 rounded-xl border border-[#2A2442]">
              <span>Speed: {flightVelocity} km/s</span>
              <span>Distance: {distanceTraveledMkm}M / 225.3M km</span>
              <span className="hidden sm:inline">Radio Delay: {commDelayMin} min</span>
              <span className="text-[#A78BFA]">Solar System Transfer Orbit</span>
            </div>
          )}

          {phase === 'construction' && (
            <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-md pointer-events-none">
              <div className="p-3.5 rounded-xl bg-[#10101A] border border-[#5B2C98] text-left">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" className="stroke-[#2A2442] fill-none" strokeWidth="3.5" />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        className="stroke-[#8B5CF6] fill-none"
                        strokeWidth="3.5"
                        strokeDasharray={125.6}
                        strokeDashoffset={125.6 * (1 - Math.max(0, Math.min(1, progress * targetPods.length - currentPodIndex)))}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#E9D5FF]">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: activeCategoryTheme?.hex || '#8B5CF6' }}
                      />
                      <h4 className="text-xs font-bold text-[#E9D5FF] truncate">
                        {activePodDef?.name || 'Base Module'}
                      </h4>
                    </div>
                    <p className="text-[11px] text-[#C4B5FD] leading-snug line-clamp-2">
                      {activePodActionText}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[#2A2442] flex items-center justify-between text-[11px] text-[#9F8FC7]">
                  <span>
                    Module {currentPodIndex + 1} of {targetPods.length}
                  </span>
                  <span className="text-emerald-400">Assembly Active</span>
                  <span>
                    Day {currentDay} / {constructionDays}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Progress Bar */}
        <div className="p-4 sm:p-5 bg-[#151324] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#C4B5FD]">
              {phase === 'transit'
                ? 'Interplanetary Cruise Progress'
                : `Building Base (${currentPodIndex + 1}/${targetPods.length} Modules)`}
            </span>
            <span className="font-bold text-[#E9D5FF] text-sm">
              {Math.round(clampedScale * 100)}%
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#09090F] border border-[#2A2442] overflow-hidden">
            <div
              className="h-full w-full bg-[#8B5CF6] origin-left will-change-transform"
              style={{ transform: `scaleX(${clampedScale})` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#9F8FC7] pt-0.5">
            <span>
              {phase === 'transit'
                ? 'Navigating inner planets toward Mars orbit'
                : 'Sealing airlocks and linking power & air tunnels'}
            </span>
            <span className="text-[#A78BFA] font-semibold">Destination: {landingSite.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
