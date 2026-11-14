import * as THREE from 'three';

// Procedural Earth Texture (Continents, Oceans, Swirling Clouds)
export function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
  oceanGrad.addColorStop(0, '#0c2340');
  oceanGrad.addColorStop(0.5, '#0284c7');
  oceanGrad.addColorStop(1, '#0c2340');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#16a34a';
  const continents = [
    { x: 90, y: 70, r: 35 },
    { x: 130, y: 55, r: 25 },
    { x: 105, y: 95, r: 20 },
    { x: 145, y: 160, r: 32 },
    { x: 155, y: 195, r: 24 },
    { x: 280, y: 65, r: 48 },
    { x: 330, y: 75, r: 40 },
    { x: 380, y: 85, r: 38 },
    { x: 250, y: 80, r: 28 },
    { x: 260, y: 135, r: 36 },
    { x: 275, y: 175, r: 26 },
    { x: 410, y: 180, r: 25 },
    { x: 256, y: 245, r: 28 },
  ];

  for (const c of continents) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(c.x + 8, c.y - 4, c.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
  }

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 240, 512, 16);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let i = 0; i < 26; i++) {
    const cy = 30 + ((i * 73) % 190);
    const cx = (i * 119) % 512;
    const w = 36 + (i % 5) * 14;
    const h = 10 + (i % 3) * 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, (i % 4 - 2) * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Mars Globe Texture (Realistic multi-toned basalt/ochre terrain, shaded craters, canyon & polar caps)
export function createMarsGlobeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const marsGrad = ctx.createLinearGradient(0, 0, 0, 512);
  marsGrad.addColorStop(0, '#8c3b1e');
  marsGrad.addColorStop(0.2, '#b84f26');
  marsGrad.addColorStop(0.5, '#cf6234');
  marsGrad.addColorStop(0.8, '#ae4621');
  marsGrad.addColorStop(1, '#7c3219');
  ctx.fillStyle = marsGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft regional dust & dark basaltic albedo plains (no hard borders)
  const regions = [
    { x: 240, y: 210, r: 120, c0: 'rgba(62, 22, 12, 0.55)', c1: 'rgba(62, 22, 12, 0)' },
    { x: 520, y: 265, r: 150, c0: 'rgba(56, 20, 10, 0.6)', c1: 'rgba(56, 20, 10, 0)' },
    { x: 760, y: 205, r: 140, c0: 'rgba(68, 25, 13, 0.5)', c1: 'rgba(68, 25, 13, 0)' },
    { x: 630, y: 345, r: 110, c0: 'rgba(72, 26, 14, 0.45)', c1: 'rgba(72, 26, 14, 0)' },
    { x: 160, y: 320, r: 105, c0: 'rgba(78, 29, 15, 0.45)', c1: 'rgba(78, 29, 15, 0)' },
    { x: 395, y: 155, r: 95, c0: 'rgba(70, 24, 12, 0.42)', c1: 'rgba(70, 24, 12, 0)' },
    // Bright dusty highlands (Tharsis & Elysium)
    { x: 615, y: 230, r: 130, c0: 'rgba(235, 138, 86, 0.42)', c1: 'rgba(235, 138, 86, 0)' },
    { x: 345, y: 240, r: 115, c0: 'rgba(228, 125, 76, 0.36)', c1: 'rgba(228, 125, 76, 0)' },
  ];
  for (const reg of regions) {
    const g = ctx.createRadialGradient(reg.x, reg.y, reg.r * 0.12, reg.x, reg.y, reg.r);
    g.addColorStop(0, reg.c0);
    g.addColorStop(1, reg.c1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(reg.x, reg.y, reg.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine mineral mottling across planet surface
  for (let i = 0; i < 2400; i++) {
    const mx = (i * 193 + 17) % 1024;
    const my = 22 + ((i * 137 + 11) % 468);
    const mr = 1.5 + (i % 6) * 1.4;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(74, 25, 12, 0.16)'
        : i % 3 === 1
          ? 'rgba(235, 148, 96, 0.14)'
          : 'rgba(155, 58, 26, 0.16)';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Valles Marineris canyon scar
  ctx.save();
  ctx.strokeStyle = 'rgba(42, 13, 7, 0.72)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(775, 290);
  ctx.bezierCurveTo(825, 302, 875, 290, 932, 304);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(224, 128, 78, 0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(775, 284);
  ctx.bezierCurveTo(825, 296, 875, 284, 932, 298);
  ctx.stroke();
  ctx.restore();

  // Olympus Mons volcanic shield & caldera
  const olympusGrad = ctx.createRadialGradient(643, 203, 3, 643, 203, 40);
  olympusGrad.addColorStop(0, 'rgba(90, 28, 12, 0.85)');
  olympusGrad.addColorStop(0.25, 'rgba(232, 134, 82, 0.7)');
  olympusGrad.addColorStop(0.6, 'rgba(154, 52, 18, 0.4)');
  olympusGrad.addColorStop(1, 'rgba(154, 52, 18, 0)');
  ctx.fillStyle = olympusGrad;
  ctx.beginPath();
  ctx.arc(643, 203, 40, 0, Math.PI * 2);
  ctx.fill();

  // Realistic directional-lit impact craters (soft basin + sunlit/shadowed rim arcs)
  for (let i = 0; i < 85; i++) {
    const cx = ((i * 197 + 41) % 970) + 26;
    const cy = ((i * 131 + 29) % 390) + 60;
    const cr = 4 + (i % 6) * 2.1;

    const craterGrad = ctx.createRadialGradient(cx, cy, cr * 0.1, cx, cy, cr);
    craterGrad.addColorStop(0, 'rgba(66, 22, 10, 0.36)');
    craterGrad.addColorStop(0.75, 'rgba(92, 32, 14, 0.22)');
    craterGrad.addColorStop(1, 'rgba(92, 32, 14, 0)');
    ctx.fillStyle = craterGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();

    // Subtle sunlit crescent on upper-left rim only
    ctx.strokeStyle = 'rgba(246, 176, 132, 0.26)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 0.88, Math.PI * 0.85, Math.PI * 1.65);
    ctx.stroke();
  }

  // Feathered Polar Ice Caps
  const northCap = ctx.createLinearGradient(0, 0, 0, 34);
  northCap.addColorStop(0, '#f8fafc');
  northCap.addColorStop(0.55, 'rgba(241, 245, 249, 0.72)');
  northCap.addColorStop(1, 'rgba(241, 245, 249, 0)');
  ctx.fillStyle = northCap;
  ctx.fillRect(0, 0, 1024, 34);

  const southCap = ctx.createLinearGradient(0, 478, 0, 512);
  southCap.addColorStop(0, 'rgba(241, 245, 249, 0)');
  southCap.addColorStop(0.45, 'rgba(241, 245, 249, 0.7)');
  southCap.addColorStop(1, '#f8fafc');
  ctx.fillStyle = southCap;
  ctx.fillRect(0, 478, 1024, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Mars elevation bump texture for 3D globe relief
export function createMarsGlobeBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 650; i++) {
    const x = (i * 97 + 13) % 512;
    const y = 16 + ((i * 67 + 7) % 224);
    const r = 2 + (i % 7) * 2.2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const val = i % 2 === 0 ? 'rgba(205,205,205,0.22)' : 'rgba(65,65,65,0.24)';
    g.addColorStop(0, val);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Mercury Texture
export function createMercuryTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 45; i++) {
    const x = (i * 53) % 256;
    const y = (i * 37) % 128;
    const r = 2 + (i % 5) * 1.5;
    ctx.fillStyle = i % 2 === 0 ? '#6b7280' : '#d1d5db';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural Venus Cloud Texture
export function createVenusTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#d97706');
  grad.addColorStop(0.5, '#fcd34d');
  grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = 'rgba(254, 243, 199, 0.35)';
  for (let y = 12; y < 120; y += 16) {
    ctx.fillRect(0, y, 256, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural Moon Texture
export function createMoonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(80, 50, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(140, 65, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(180, 45, 18, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Sun Radiant Flare Texture
export function createSunFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const cx = 128;
  const cy = 128;

  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, '#fef08a');
  grad.addColorStop(0.4, '#f59e0b');
  grad.addColorStop(0.7, '#ea580c');
  grad.addColorStop(1, 'rgba(124, 45, 18, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Particle Texture for Ion Engine Plume Stream
export function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#A78BFA');
  grad.addColorStop(0.7, '#5B2C98');
  grad.addColorStop(1, 'rgba(91, 44, 152, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Plain-English descriptive building actions for each pod type
export const POD_CONSTRUCTION_ACTIONS: Record<string, string> = {
  living_pod: 'Sealing main living quarters and pressuring crew sleeping cabins...',
  oxygen_pod: 'Installing oxygen generators and testing clean air supply lines...',
  water_pod: 'Setting up water recycling tanks and clean drinking water filters...',
  airlock_pod: 'Testing double-door airlock seals and dust-clearing jets...',
  emergency_shelter_pod: 'Packing thick Mars soil shielding over the storm shelter walls...',
  power_generation_pod: 'Connecting nuclear power core and testing steady electrical output...',
  nuclear_power_pod: 'Installing backup modular reactor and cooling radiators...',
  solar_power_pod: 'Unfolding sun-tracking solar wings and dust-shaking panels...',
  greenhouse_pod: 'Planting greenhouse crop beds and turning on warm grow lights...',
  rover_garage_pod: 'Building rover garage doors and leveling the helicopter landing pad...',
  comm_pod: 'Aiming the Earth radio dish and laser link antenna...',
  medical_pod: 'Stocking trauma bay, scanners, and crew health monitors...',
  waste_mgmt_pod: 'Connecting waste processing and water recovery pipes...',
  storage_pod: 'Locking storage racks and loading spare parts inventory...',
  battery_storage_pod: 'Charging insulated backup battery banks for overnight power...',
  research_lab_pod: 'Calibrating microscopes and science lab sample chambers...',
  geology_lab_pod: 'Setting up rock drills and Mars soil analyzers...',
  observatory_pod: 'Mounting the deep-space telescope inside the clear dome...',
};

export function getPodActionText(podId: string, podName: string): string {
  if (POD_CONSTRUCTION_ACTIONS[podId]) {
    return POD_CONSTRUCTION_ACTIONS[podId];
  }
  return `Anchoring frame and connecting air and power lines for ${podName}...`;
}
