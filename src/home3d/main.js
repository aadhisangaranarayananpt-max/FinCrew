import './home3d.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { fetchState, startSimulation, nextEvent, actOnCurrent, approveAction } from './api.js';
import { HomeUi } from './ui.js';

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('No app root was found.');
}

const ui = new HomeUi();
const state = { data: null, activeEvent: null, hoverTarget: null };
const canvas = ui.canvas;

let camera;
let renderer;
let scene;
let controls;
let animationFrame = null;
let currentPointer = null;
const towerMeshes = [];
const eventBeacons = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const towerMeta = [
  { key: 'cash', name: 'Cash', color: '#2457f5', valueKey: 'cash', icon: '💰' },
  { key: 'revenue', name: 'Revenue', color: '#0f9d58', valueKey: 'revenue', icon: '📈' },
  { key: 'expenses', name: 'Expenses', color: '#d9780a', valueKey: 'expenses', icon: '💸' },
  { key: 'receivables', name: 'Receivables', color: '#2457f5', valueKey: 'receivables', icon: '🧾' },
  { key: 'obligations', name: 'Obligations', color: '#d93a3a', valueKey: 'obligations', icon: '📅' }
];

const toneColors = {
  green: '#0f9d58',
  amber: '#d9780a',
  yellow: '#d2ab00',
  red: '#d93a3a',
  blue: '#2457f5'
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function getTowerValue(metricKey) {
  const metrics = state.data?.metrics || {};
  const raw = metrics[metricKey];
  return Number(raw || 0);
}

function getTowerHeight(metricKey) {
  const val = getTowerValue(metricKey);
  return clamp(Math.log10(Math.max(val, 1000)) * 1.75, 0.8, 12.5);
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f7fb');
  scene.fog = new THREE.Fog('#f4f7fb', 10, 30);

  const ambient = new THREE.HemisphereLight('#ffffff', '#dfeaf6', 1.25);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight('#ffffff', 1.4);
  keyLight.position.set(6, 10, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 40;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#dfe9ff', 0.6);
  fillLight.position.set(-8, 6, -4);
  scene.add(fillLight);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 5.1, 0.6, 64),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, metalness: 0.18 })
  );
  platform.position.y = -0.6;
  platform.receiveShadow = true;
  scene.add(platform);

  const ringGlow = new THREE.Mesh(
    new THREE.TorusGeometry(3.25, 0.22, 24, 120),
    new THREE.MeshStandardMaterial({ color: '#2457f5', emissive: '#2457f5', emissiveIntensity: 0.5 })
  );
  ringGlow.rotation.x = Math.PI / 2;
  ringGlow.position.y = 4.8;
  scene.add(ringGlow);

  const ringHalo = new THREE.Mesh(
    new THREE.TorusGeometry(3.5, 0.08, 16, 120),
    new THREE.MeshBasicMaterial({ color: '#bfd4ff', transparent: true, opacity: 0.8 })
  );
  ringHalo.rotation.x = Math.PI / 2;
  ringHalo.position.y = 4.8;
  scene.add(ringHalo);

  const healthText = document.createElement('div');
  healthText.className = 'health-sprite';
  healthText.textContent = '82 / 100';
  document.body.appendChild(healthText);

  const campusGroup = new THREE.Group();
  scene.add(campusGroup);

  towerMeta.forEach((tower, index) => {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.12, 0.8),
      new THREE.MeshStandardMaterial({ color: '#dfeafc', roughness: 0.85 })
    );
    base.position.set(-2.5 + index * 1.25, -0.05, 0.8);
    campusGroup.add(base);

    const towerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 1, 0.72),
      new THREE.MeshStandardMaterial({ color: tower.color, emissive: tower.color, emissiveIntensity: 0.2, roughness: 0.5, metalness: 0.18 })
    );
    towerMesh.position.set(-2.5 + index * 1.25, 0.5, 0.8);
    towerMesh.userData = { label: tower.name, key: tower.key, metric: tower.valueKey, towerIndex: index };
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    campusGroup.add(towerMesh);
    towerMeshes.push(towerMesh);
  });

  const centerOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 32, 32),
    new THREE.MeshPhysicalMaterial({ color: '#dfeaff', roughness: 0.28, metalness: 0.25, clearcoat: 0.8, transmission: 0.06 })
  );
  centerOrb.position.set(0, 0.9, -0.2);
  centerOrb.castShadow = true;
  scene.add(centerOrb);

  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 120;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * 18;
    particlePositions[i + 1] = Math.random() * 10;
    particlePositions[i + 2] = (Math.random() - 0.5) * 16;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: '#a8b9f8', size: 0.06, transparent: true, opacity: 0.7 })
  );
  scene.add(particles);

  state.ambientParticles = particles;
  state.healthText = healthText;
  state.ringGlow = ringGlow;
  state.ringHalo = ringHalo;
  state.centerOrb = centerOrb;
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 1200, canvas.clientHeight || 760, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

function setupCamera() {
  camera = new THREE.PerspectiveCamera(35, (canvas.clientWidth || 1200) / (canvas.clientHeight || 760), 0.1, 100);
  camera.position.set(0, 4.5, 11);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.9;
  controls.maxPolarAngle = 1.55;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;
  controls.enableZoom = true;
}

function updateTowerHeights() {
  towerMeshes.forEach((mesh, index) => {
    const tower = towerMeta[index];
    const height = getTowerHeight(tower.valueKey);
    const targetY = height / 2 + 0.15;
    const targetScale = new THREE.Vector3(1, height, 1);
    gsap.to(mesh.scale, {
      y: targetScale.y,
      duration: 1.2,
      ease: 'power2.out'
    });
    gsap.to(mesh.position, {
      y: targetY,
      duration: 1.2,
      ease: 'power2.out'
    });
  });
}

function updateRing(score, tone) {
  const color = toneColors[tone] || '#2457f5';
  if (state.ringGlow) {
    state.ringGlow.material.color.set(color);
    state.ringGlow.material.emissive.set(color);
  }
  if (state.ringHalo) {
    state.ringHalo.material.color.set(color);
  }

  const percent = clamp(score / 100, 0, 1);
  state.ringGlow.scale.setScalar(0.8 + percent * 0.6);
  gsap.to(state.ringGlow.rotation, { z: -Math.PI * (1 + percent * 0.7), duration: 1.3, ease: 'power2.out' });

  const labelText = `${score} / 100`;
  if (state.healthText) {
    state.healthText.textContent = labelText;
    state.healthText.style.color = color;
  }
}

function renderBeacons() {
  eventBeacons.forEach((item) => item.group.remove());
  eventBeacons.length = 0;

  const current = state.data?.current;
  if (!current) {
    return;
  }

  const eventTone = current.tone || 'amber';
  const beaconColor = toneColors[eventTone] || '#d9780a';

  towerMeta.forEach((tower, index) => {
    if (!tower.key || (state.data?.businessType || '').toLowerCase().includes('retail') && index === 0) {
      const beaconGroup = new THREE.Group();
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 18, 18),
        new THREE.MeshStandardMaterial({ color: beaconColor, emissive: beaconColor, emissiveIntensity: 0.7 })
      );
      orb.position.set(-2.5 + index * 1.25, getTowerHeight(tower.valueKey) + 0.9, 0.8);
      beaconGroup.add(orb);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.04, 12, 32),
        new THREE.MeshBasicMaterial({ color: beaconColor, transparent: true, opacity: 0.8 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(orb.position);
      beaconGroup.add(ring);
      scene.add(beaconGroup);
      eventBeacons.push({ group: beaconGroup, orb, ring });
    }
  });
}

function updateUiFromState() {
  if (!state.data) {
    return;
  }

  const score = Number(state.data.score ?? 80);
  const tone = state.data.level_tone || 'green';
  ui.update(state.data);
  updateRing(score, tone);
  updateTowerHeights();
  renderBeacons();
}

function applyFallback(message) {
  const fallback = document.createElement('div');
  fallback.className = 'fallback-banner';
  fallback.innerHTML = `<strong>FinCrew 3D home is unavailable.</strong><p>${message}</p><p><a href="index.html">Open the existing 2D dashboard</a></p>`;
  appRoot.innerHTML = '';
  appRoot.appendChild(fallback);
}

function onPointerMove(event) {
  if (!canvas || !state.data) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersections = raycaster.intersectObjects(towerMeshes, false);
  const hovered = intersections[0]?.object ?? null;
  if (hovered) {
    const info = towerMeta[hovered.userData?.towerIndex ?? 0];
    const value = getTowerValue(info?.valueKey || 'cash');
    const text = `${info.name}: ${money(value)}<br><span>Keep this metric aligned with your cash plan.</span>`;
    currentPointer = { x: event.clientX, y: event.clientY };
    ui.setTooltip(text, event.clientX - rect.left + 18, event.clientY - rect.top + 18);
    state.hoverTarget = hovered;
  } else {
    state.hoverTarget = null;
    ui.hideTooltip();
  }
}

function onPointerDown(event) {
  if (!canvas || !state.data) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(towerMeshes, false);
  const hit = intersections[0]?.object;
  if (!hit) {
    return;
  }

  const index = hit.userData?.towerIndex ?? 0;
  const target = towerMeta[index];
  const pageMap = {
    cash: '#cashflow',
    revenue: '#overview',
    expenses: '#expenses',
    receivables: '#invoices',
    obligations: '#obligations'
  };
  if (pageMap[target.key]) {
    window.location.hash = pageMap[target.key];
    window.location.href = `index.html${pageMap[target.key]}`;
  }
}

function resizeRenderer() {
  if (!renderer || !camera) {
    return;
  }
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  if (!renderer || !scene || !camera) {
    return;
  }

  controls.update();
  state.ambientParticles.rotation.y += 0.0008;
  state.centerOrb.rotation.y += 0.01;

  const current = state.data?.current;
  if (current && eventBeacons.length) {
    eventBeacons.forEach((beacon, index) => {
      beacon.orb.position.y = beacon.orb.position.y + Math.sin((performance.now() * 0.0025) + index) * 0.003;
      beacon.ring.rotation.z += 0.012;
    });
  }

  renderer.render(scene, camera);
  animationFrame = requestAnimationFrame(animate);
}

async function loadState() {
  try {
    const data = await fetchState();
    state.data = data;
    updateUiFromState();
    return data;
  } catch (error) {
    ui.showStatus("Can't reach the FinCrew server. Run start-fincrew.cmd", 'error');
    return null;
  }
}

function attachActions() {
  ui.bind({
    onStart: async () => {
      try {
        const result = await startSimulation();
        state.data = result;
        updateUiFromState();
      } catch (error) {
        ui.showStatus(error.message || 'Unable to start simulation.', 'error');
      }
    },
    onNext: async () => {
      try {
        const result = await nextEvent();
        state.data = result;
        updateUiFromState();
      } catch (error) {
        ui.showStatus(error.message || 'Unable to advance the simulation.', 'error');
      }
    },
    onOpen2D: () => {
      window.location.href = 'index.html';
    },
    onOpenGame: () => {
      window.location.href = 'fincrew-game.html';
    },
    onOpenCopilot: () => {
      window.location.href = 'FinCrew.html';
    },
    onAct: async (actionId) => {
      try {
        const result = await approveAction(actionId);
        if (result) {
          state.data = result.state || state.data;
          updateUiFromState();
        }
      } catch (error) {
        ui.showStatus(error.message || 'The action could not be recorded.', 'error');
      }
    },
    onWhy: () => {
      const current = state.data?.current;
      if (!current) {
        ui.showStatus('No active event to explain.', 'info');
        return;
      }
      ui.showStatus(current.why?.[0] || current.recommendation || 'The reason is being reviewed.', 'info');
    }
  });
}

function boot() {
  buildScene();
  setupRenderer();
  setupCamera();
  attachActions();
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', resizeRenderer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
      return;
    }
    animationFrame = requestAnimationFrame(animate);
  });

  resizeRenderer();
  loadState();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    controls.autoRotate = false;
  }

  gsap.fromTo(camera.position, { z: 18, x: 2, y: 6 }, { z: 11, x: 0, y: 4.5, duration: 1.5, ease: 'power3.out' });
  gsap.fromTo(state.ringGlow.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 1.5, ease: 'power2.out' });
  animate();
}

const supportsWebGL = (() => {
  try {
    const canvasCheck = document.createElement('canvas');
    return !!window.WebGLRenderingContext && !!(canvasCheck.getContext('webgl') || canvasCheck.getContext('experimental-webgl'));
  } catch (error) {
    return false;
  }
})();

if (!supportsWebGL) {
  applyFallback('Your browser does not support WebGL. The existing 2D dashboard remains available.');
} else {
  try {
    boot();
  } catch (error) {
    console.error(error);
    applyFallback('The 3D scene failed to load. The previous 2D FinCrew experience is still available.');
  }
}
