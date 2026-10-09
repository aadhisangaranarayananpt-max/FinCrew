import './home3d.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { fetchState, askCrew, startSimulation, nextEvent, approveAction } from './api.js';
import { HomeUi } from './ui.js';

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('No app root was found.');
}

const ui = new HomeUi();
const state = {
  data: null,
  drive: {
    started: false,
    active: false,
    gameOver: false,
    lane: 1,
    score: 0,
    distance: 0,
    speed: 0,
    shield: 100,
    soundEnabled: true
  }
};
const canvas = ui.canvas;

let camera;
let renderer;
let scene;
let animationFrame = null;
let gameAudio = null;
let crewRecognition = null;
let crewVoiceEnabled = false;
let crewAwaitingQuestion = false;
let crewSpeechInProgress = false;
let crewRestartTimer = null;
let crewFollowupTimer = null;
const roadMarks = [];
const roadsideBuildings = [];
const raceObjects = [];
const carWheels = [];
const lanePositions = [-2.35, 0, 2.35];
let previousFrameTime = 0;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#cce7ff');
  scene.fog = new THREE.Fog('#cce7ff', 42, 118);

  const ambient = new THREE.HemisphereLight('#ffffff', '#a8bad2', 1.7);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight('#fff4d8', 2.2);
  keyLight.position.set(-5, 13, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1536, 1536);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 65;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#ffffff', 0.8);
  fillLight.position.set(8, 5, -8);
  scene.add(fillLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 150),
    new THREE.MeshStandardMaterial({ color: '#a7cf9a', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.28, -35);
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.24, 115),
    new THREE.MeshStandardMaterial({ color: '#344052', roughness: 0.92 })
  );
  road.position.set(0, -0.08, -39);
  road.receiveShadow = true;
  scene.add(road);

  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: '#f1b94f', roughness: 0.75 });
  for (const x of [-4.65, 4.65]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 115), shoulderMaterial);
    shoulder.position.set(x, 0.06, -39);
    scene.add(shoulder);
  }

  const markMaterial = new THREE.MeshStandardMaterial({ color: '#f7f8fd', roughness: 0.7 });
  for (let index = 0; index < 24; index += 1) {
    for (const x of [-1.58, 1.58]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 2.2), markMaterial);
      mark.position.set(x, 0.06, 8 - index * 5);
      scene.add(mark);
      roadMarks.push(mark);
    }
  }

  const buildingColors = ['#f5c77e', '#d5e4ff', '#c6d8cb', '#f2b5a7', '#d6c8f2'];
  for (let index = 0; index < 30; index += 1) {
    const side = index % 2 ? 1 : -1;
    const height = 2.8 + Math.random() * 7;
    const width = 2.4 + Math.random() * 2.5;
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 3 + Math.random() * 3),
      new THREE.MeshStandardMaterial({ color: buildingColors[index % buildingColors.length], roughness: 0.88 })
    );
    building.position.set(side * (7.5 + Math.random() * 5), height / 2 - 0.2, 12 - index * 4.2);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    roadsideBuildings.push({ mesh: building, side });
  }

  const car = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: '#e73d3d',
    roughness: 0.24,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.12
  });
  const bodyStations = [
    { z: -1.65, width: 0.56, topWidth: 0.43, topY: 0.62 },
    { z: -1.15, width: 0.86, topWidth: 0.7, topY: 0.75 },
    { z: -0.2, width: 0.97, topWidth: 0.79, topY: 0.87 },
    { z: 0.75, width: 0.91, topWidth: 0.77, topY: 0.83 },
    { z: 1.52, width: 0.69, topWidth: 0.62, topY: 0.68 }
  ];
  const bodyVertices = [];
  const bodyIndices = [];
  bodyStations.forEach(({ z, width, topWidth, topY }, index) => {
    const baseY = 0.36;
    bodyVertices.push(
      -width, baseY, z,
      width, baseY, z,
      topWidth, topY, z,
      -topWidth, topY, z
    );
    if (index > 0) {
      const previous = (index - 1) * 4;
      const current = index * 4;
      for (let edge = 0; edge < 4; edge += 1) {
        const next = (edge + 1) % 4;
        bodyIndices.push(previous + edge, current + edge, current + next);
        bodyIndices.push(previous + edge, current + next, previous + next);
      }
    }
  });
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bodyVertices, 3));
  bodyGeometry.setIndex(bodyIndices);
  bodyGeometry.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: '#a9e5ff', roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.9, clearcoat: 0.9 })
  );
  cabin.scale.set(0.78, 0.43, 0.74);
  cabin.position.set(0, 0.91, 0.02);
  cabin.castShadow = true;
  car.add(cabin);

  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#202938', roughness: 0.38, metalness: 0.55 });
  const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.15, 0.28), trimMaterial);
  rearDiffuser.position.set(0, 0.38, 1.49);
  car.add(rearDiffuser);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.26), trimMaterial);
    fin.position.set(x, 0.29, 1.48);
    car.add(fin);
  }

  const spoilerSupportMaterial = new THREE.MeshStandardMaterial({ color: '#252a33', metalness: 0.5, roughness: 0.35 });
  for (const x of [-0.52, 0.52]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.1), spoilerSupportMaterial);
    support.position.set(x, 0.86, 1.35);
    car.add(support);
  }
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 0.34), spoilerSupportMaterial);
  spoiler.position.set(0, 1.02, 1.4);
  car.add(spoiler);

  const tailLightMaterial = new THREE.MeshStandardMaterial({ color: '#ff5b54', emissive: '#ed1d24', emissiveIntensity: 1.1, roughness: 0.22 });
  const tailLightBar = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 0.07), tailLightMaterial);
  tailLightBar.position.set(0, 0.7, 1.49);
  car.add(tailLightBar);

  const headlightMaterial = new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffd34f', emissiveIntensity: 1 });
  for (const x of [-0.53, 0.53]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.07), headlightMaterial);
    light.position.set(x, 0.59, -1.58);
    car.add(light);
  }
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#171c24', roughness: 0.75 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: '#cbd4e1', roughness: 0.28, metalness: 0.85 });
  for (const x of [-0.86, 0.86]) {
    for (const z of [-0.88, 0.88]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 24), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.35, z);
      wheel.castShadow = true;
      car.add(wheel);
      carWheels.push(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.255, 16), rimMaterial);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x * 1.03, 0.35, z);
      car.add(rim);
    }
  }
  car.position.set(0, 0, 1.8);
  scene.add(car);
  state.car = car;

  for (let index = 0; index < 8; index += 1) {
    const group = new THREE.Group();
    const isCoin = index % 3 !== 0;
    if (isCoin) {
      const coin = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.13, 12, 28),
        new THREE.MeshStandardMaterial({ color: '#ffcb3d', emissive: '#bb7600', emissiveIntensity: 0.45, metalness: 0.72, roughness: 0.22 })
      );
      coin.rotation.y = Math.PI / 2;
      coin.position.y = 0.9;
      group.add(coin);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.12, 20),
        new THREE.MeshStandardMaterial({ color: '#fff2a6', metalness: 0.58, roughness: 0.26 })
      );
      core.rotation.z = Math.PI / 2;
      core.position.y = 0.9;
      group.add(core);
    } else {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 1.05, 1.05),
        new THREE.MeshStandardMaterial({ color: '#ef725f', roughness: 0.72 })
      );
      crate.position.y = 0.55;
      crate.castShadow = true;
      group.add(crate);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.28, 0.16, 1.08),
        new THREE.MeshStandardMaterial({ color: '#fff0d0', roughness: 0.65 })
      );
      stripe.position.y = 0.56;
      group.add(stripe);
    }
    group.position.set(lanePositions[(index + 1) % lanePositions.length], 0, -22 - index * 10);
    group.userData.kind = isCoin ? 'coin' : 'hazard';
    scene.add(group);
    raceObjects.push(group);
  }
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 1200, canvas.clientHeight || 760, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

function setupCamera() {
  camera = new THREE.PerspectiveCamera(48, (canvas.clientWidth || 1200) / (canvas.clientHeight || 760), 0.1, 150);
  camera.position.set(0, 8.2, 15.2);
  camera.lookAt(0, 0.65, -1.8);
}

function updateUiFromState() {
  if (state.data) {
    ui.update(state.data);
  }
  ui.updateDrive(state.drive);
}

function applyFallback(message) {
  const fallback = document.createElement('div');
  fallback.className = 'fallback-banner';
  fallback.innerHTML = `<strong>FinCrew 3D home is unavailable.</strong><p>${message}</p><p><a href="legacy-dashboard.html">Open the existing 2D dashboard</a></p>`;
  appRoot.innerHTML = '';
  appRoot.appendChild(fallback);
}

function startDrive() {
  if (state.drive.soundEnabled && !resumeGameAudio()) {
    state.drive.soundEnabled = false;
    ui.updateDrive(state.drive);
    ui.showStatus('Game audio is not available in this browser. You can still play with sound off.', 'error');
  }
  state.drive.started = true;
  state.drive.active = true;
  state.drive.gameOver = false;
  state.drive.score = 0;
  state.drive.distance = 0;
  state.drive.speed = 12;
  state.drive.shield = 100;
  state.drive.lane = 1;
  state.drive.elapsed = 0;
  state.car.position.x = 0;
  raceObjects.forEach((object, index) => {
    object.position.set(lanePositions[(index + 1) % lanePositions.length], 0, -22 - index * 10);
  });
  updateUiFromState();
  if (state.drive.soundEnabled) {
    playGameTone([523.25, 659.25, 783.99], { duration: 0.13, volume: 0.1, spacing: 0.09 });
  }
  ui.showStatus('Drive started. Collect the gold cash tokens and dodge expense crates.', 'info');
}

function createGameAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return false;
  }
  let context;
  try {
    context = new AudioContextClass();
  } catch (error) {
    ui.showStatus(`Could not initialize game audio: ${error.message}`, 'error');
    return false;
  }
  const master = context.createGain();
  master.gain.value = state.drive.soundEnabled ? 0.48 : 0;
  master.connect(context.destination);

  const engineFilter = context.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 520;
  engineFilter.Q.value = 0.65;
  const engineGain = context.createGain();
  engineGain.gain.value = 0.0001;
  engineFilter.connect(engineGain);
  engineGain.connect(master);

  const engineOscillators = [context.createOscillator(), context.createOscillator()];
  engineOscillators[0].type = 'sawtooth';
  engineOscillators[1].type = 'triangle';
  engineOscillators[1].detune.value = 7;
  engineOscillators.forEach((oscillator) => {
    oscillator.frequency.value = 55;
    oscillator.connect(engineFilter);
    oscillator.start();
  });

  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const noiseData = buffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = Math.random() * 2 - 1;
  }
  gameAudio = { context, master, engineFilter, engineGain, engineOscillators, noiseBuffer: buffer };
  return true;
}

function resumeGameAudio() {
  if (!gameAudio && !createGameAudio()) {
    return false;
  }
  const { context, master } = gameAudio;
  if (context.state === 'suspended') {
    context.resume().catch(() => {
      ui.showStatus('The browser blocked game audio. Tap the sound button to enable it.', 'error');
    });
  }
  master.gain.setTargetAtTime(state.drive.soundEnabled ? 0.48 : 0, context.currentTime, 0.04);
  return true;
}

function playGameTone(frequencies, { duration = 0.12, volume = 0.12, spacing = 0.06 } = {}) {
  if (!state.drive.soundEnabled || !gameAudio || gameAudio.context.state === 'closed') {
    return;
  }
  const { context, master } = gameAudio;
  frequencies.forEach((frequency, index) => {
    const startAt = context.currentTime + index * spacing;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  });
}

function playCrashSound() {
  if (!state.drive.soundEnabled || !gameAudio || gameAudio.context.state === 'closed') {
    return;
  }
  const { context, master, noiseBuffer } = gameAudio;
  const startAt = context.currentTime;
  const noise = context.createBufferSource();
  const hitFilter = context.createBiquadFilter();
  const envelope = context.createGain();
  noise.buffer = noiseBuffer;
  hitFilter.type = 'lowpass';
  hitFilter.frequency.value = 360;
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(0.23, startAt + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);
  noise.connect(hitFilter);
  hitFilter.connect(envelope);
  envelope.connect(master);
  noise.start(startAt);
  noise.stop(startAt + 0.25);
  playGameTone([115, 72], { duration: 0.2, volume: 0.14, spacing: 0.025 });
}

function toggleGameSound() {
  state.drive.soundEnabled = !state.drive.soundEnabled;
  if (state.drive.soundEnabled && !resumeGameAudio()) {
    state.drive.soundEnabled = false;
    ui.updateDrive(state.drive);
    ui.showStatus('This browser does not support game audio.', 'error');
    return;
  }
  if (gameAudio) {
    gameAudio.master.gain.setTargetAtTime(
      state.drive.soundEnabled ? 0.48 : 0,
      gameAudio.context.currentTime,
      0.04
    );
  }
  ui.updateDrive(state.drive);
  ui.showStatus(state.drive.soundEnabled ? 'Game sound on.' : 'Game sound off.', 'info');
}

function shiftLane(direction) {
  if (state.drive.gameOver) {
    return;
  }
  state.drive.lane = clamp(state.drive.lane + direction, 0, lanePositions.length - 1);
}

function toggleDrivePause() {
  if (state.drive.gameOver || !state.drive.started) {
    startDrive();
    return;
  }
  state.drive.active = !state.drive.active;
  if (state.drive.active) {
    ui.showStatus('Back on the road. Keep your cash shield safe.', 'info');
  }
  updateUiFromState();
}

function onDriveKeyDown(event) {
  if (event.target instanceof HTMLElement
    && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) {
    return;
  }
  if (['ArrowLeft', 'a', 'A'].includes(event.key)) {
    event.preventDefault();
    shiftLane(-1);
  } else if (['ArrowRight', 'd', 'D'].includes(event.key)) {
    event.preventDefault();
    shiftLane(1);
  } else if (event.code === 'Space') {
    event.preventDefault();
    toggleDrivePause();
  }
}

function resizeRenderer() {
  if (!renderer || !camera) {
    return;
  }
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  camera.fov = width <= 760 ? 52 : 35;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  if (!renderer || !scene || !camera) {
    return;
  }

  const now = performance.now();
  const delta = previousFrameTime ? Math.min((now - previousFrameTime) / 1000, 0.05) : 0;
  previousFrameTime = now;
  const drive = state.drive;
  const speed = drive.active ? Math.min(320, 150 + drive.distance * 0.32) : 0;
  drive.speed = speed;
  const movement = speed * 0.06 * delta;

  if (drive.active) {
    drive.distance += movement * 0.8;
    drive.score += movement * 2;
    drive.elapsed += delta;
  }
  if (gameAudio) {
    const targetGain = drive.active && drive.soundEnabled ? 0.055 : 0.0001;
    gameAudio.engineGain.gain.setTargetAtTime(targetGain, gameAudio.context.currentTime, 0.1);
    if (gameAudio.engineOscillators.length) {
      const rpm = drive.active ? 48 + (drive.speed / 320) * 95 : 38;
      gameAudio.engineOscillators[0].frequency.setTargetAtTime(rpm, gameAudio.context.currentTime, 0.08);
      gameAudio.engineOscillators[1].frequency.setTargetAtTime(rpm * 1.48, gameAudio.context.currentTime, 0.08);
      gameAudio.engineFilter.frequency.setTargetAtTime(300 + (drive.speed / 320) * 1250, gameAudio.context.currentTime, 0.1);
    }
  }

  roadMarks.forEach((mark) => {
    mark.position.z += movement;
    if (mark.position.z > 12) {
      mark.position.z -= 120;
    }
  });
  roadsideBuildings.forEach(({ mesh }) => {
    mesh.position.z += movement * 0.72;
    if (mesh.position.z > 18) {
      mesh.position.z -= 126;
    }
  });

  const targetX = lanePositions[drive.lane];
  state.car.position.x += (targetX - state.car.position.x) * Math.min(delta * 9, 1);
  state.car.rotation.z = (targetX - state.car.position.x) * 0.055;
  if (drive.active) {
    carWheels.forEach((wheel) => {
      wheel.rotation.x += movement * 1.4;
    });
    raceObjects.forEach((object) => {
      object.position.z += movement;
      if (Math.abs(object.position.z - state.car.position.z) < 1.15
        && Math.abs(object.position.x - state.car.position.x) < 0.92) {
        if (object.userData.kind === 'coin') {
          drive.score += 100;
          drive.shield = Math.min(100, drive.shield + 4);
          playGameTone([880, 1174.66, 1567.98], { duration: 0.19, volume: 0.14, spacing: 0.055 });
          ui.showStatus('Cash token secured: +100 points and +4 shield.', 'info');
        } else {
          drive.shield = Math.max(0, drive.shield - 35);
          playCrashSound();
          ui.showStatus(`Expense crate hit. Cash shield: ${drive.shield}%.`, 'error');
          if (!drive.shield) {
            drive.active = false;
            drive.gameOver = true;
            ui.showStatus('Cash shield depleted. Restart the drive to try again.', 'error');
          }
        }
        object.position.set(
          lanePositions[Math.floor(Math.random() * lanePositions.length)],
          0,
          -74 - Math.random() * 28
        );
      } else if (object.position.z > 9) {
        object.position.set(
          lanePositions[Math.floor(Math.random() * lanePositions.length)],
          0,
          -74 - Math.random() * 28
        );
      }
      if (object.userData.kind === 'coin') {
        object.rotation.y += delta * 1.8;
        object.position.y = Math.sin(performance.now() * 0.003 + object.position.z) * 0.08;
      }
    });
    if (drive.elapsed > 0.12) {
      drive.elapsed = 0;
      ui.updateDrive(drive);
    }
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
    onDriveStart: startDrive,
    onDriveLeft: () => shiftLane(-1),
    onDriveRight: () => shiftLane(1),
    onDrivePause: toggleDrivePause,
    onDriveSound: toggleGameSound,
    onStart: async () => {
      if (state.data?.started && !window.confirm('Restart the finance rescue run? Your current mission progress will be cleared.')) {
        return;
      }
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
      window.location.href = 'legacy-dashboard.html';
    },
    onCrewQuestion: (question) => handleCrewQuestion(question),
    onCrewVoiceQuestion: (question) => handleCrewQuestion(question, true),
    onCrewVoice: startCrewVoice,
    onCrewVoiceToggle: toggleCrewVoice,
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

function handleCrewQuestion(question, spoken = false) {
  clearTimeout(crewFollowupTimer);
  if (spoken) {
    crewAwaitingQuestion = false;
    crewSpeechInProgress = true;
    suspendCrewRecognition();
    ui.setCrewVoiceStatus('Crews AI is checking your business…');
  }

  const userMessage = ui.addCrewMessage(question, 'user');
  const pendingMessage = ui.addCrewMessage('Let me check your business numbers…');
  askCrew(question).then((answer) => {
    pendingMessage.textContent = answer.text;
    if (spoken || crewVoiceEnabled) {
      speakCrewAnswer(answer.text);
    }
  }).catch((error) => {
    const message = error.message || "I couldn't reach Crews AI right now. Please try again.";
    pendingMessage.textContent = message;
    if (spoken || crewVoiceEnabled) {
      speakCrewAnswer(message);
    }
  });
  userMessage.scrollIntoView({ block: 'nearest' });
}

function startCrewFollowupTimeout() {
  clearTimeout(crewFollowupTimer);
  crewFollowupTimer = window.setTimeout(() => {
    crewAwaitingQuestion = false;
    if (crewVoiceEnabled && !crewSpeechInProgress) {
      ui.setCrewVoiceStatus('I didn’t hear a question. Say “Crews” to try again.');
    }
  }, 12000);
}

function speakCrewAnswer(text, { awaitingQuestion = false } = {}) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    crewSpeechInProgress = false;
    if (awaitingQuestion && crewVoiceEnabled) {
      ui.setCrewVoiceStatus('I’m listening. Ask your question now.');
      startCrewFollowupTimeout();
    } else {
      ui.setCrewVoiceStatus('Reply is ready to read. Spoken replies are not supported in this browser.');
    }
    resumeCrewListening();
    return;
  }
  if (crewVoiceEnabled) {
    crewSpeechInProgress = true;
    suspendCrewRecognition();
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN';
  utterance.onstart = () => ui.setCrewVoiceStatus(awaitingQuestion ? 'Crews AI is replying…' : 'Crews AI is speaking…');
  utterance.onend = () => {
    crewSpeechInProgress = false;
    if (awaitingQuestion && crewAwaitingQuestion && crewVoiceEnabled) {
      ui.setCrewVoiceStatus('I’m listening. Ask your question now.');
      startCrewFollowupTimeout();
      resumeCrewListening();
    } else if (crewVoiceEnabled) {
      ui.setCrewVoiceStatus('Microphone is on. Say “Crews” to ask another question.');
      resumeCrewListening();
    } else {
      ui.setCrewVoiceStatus('Voice is off. Tap CALL CREWS AI once to start hands-free listening.');
    }
  };
  utterance.onerror = () => {
    crewSpeechInProgress = false;
    if (awaitingQuestion && crewAwaitingQuestion && crewVoiceEnabled) {
      ui.setCrewVoiceStatus('I’m listening. Ask your question now.');
      startCrewFollowupTimeout();
    } else {
      ui.setCrewVoiceStatus('Reply is ready to read.');
    }
    resumeCrewListening();
  };
  window.speechSynthesis.speak(utterance);
}

function startCrewVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    crewVoiceEnabled = false;
    ui.setCrewVoiceActive(false);
    ui.setCrewVoiceStatus('Voice input is not supported in this browser. Type your question instead.');
    return;
  }
  if (!window.isSecureContext) {
    crewVoiceEnabled = false;
    ui.setCrewVoiceActive(false);
    ui.setCrewVoiceStatus('Microphone access needs HTTPS or localhost. Open FinCrew through a secure connection.');
    return;
  }
  if (crewSpeechInProgress) {
    ui.setCrewVoiceStatus('Crews AI is speaking. I’ll listen again after the reply.');
    return;
  }
  if (crewRecognition) {
    crewVoiceEnabled = true;
    ui.setCrewVoiceActive(true);
    ui.setCrewVoiceStatus('Microphone is on. Say “Crews” to ask a question.');
    return;
  }

  crewVoiceEnabled = true;
  ui.setCrewVoiceActive(true);
  ui.setCrewVoiceStatus('Starting microphone… allow access, then say “Crews”.');
  const recognition = new Recognition();
  crewRecognition = recognition;
  recognition.lang = 'en-IN';
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;
  recognition.onstart = () => {
    if (crewRecognition === recognition && crewVoiceEnabled) {
      ui.setCrewVoiceStatus(crewAwaitingQuestion
        ? 'I’m listening. Ask your question now.'
        : 'Microphone is on. Say “Crews” to ask a question.');
    }
  };
  recognition.onresult = (event) => {
    if (!crewVoiceEnabled || crewSpeechInProgress) {
      return;
    }
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result.isFinal) {
        continue;
      }
      const alternatives = Array.from(result, (alternative) => alternative.transcript?.trim()).filter(Boolean);
      const transcript = alternatives.find((alternative) => /^\s*(?:(?:hey|okay)\s+)?(?:crews?|crues?|cruz|cruises?|crew'?s?|cruse)(?:\s+ai)?\b/i.test(alternative))
        || alternatives[0];
      if (!transcript) {
        continue;
      }

      const wakeMatch = transcript.match(/^\s*(?:(?:hey|okay)\s+)?(?:crews?|crues?|cruz|cruises?|crew'?s?|cruse)(?:\s+ai)?\b[\s,.:;!?-]*/i);
      if (wakeMatch) {
        const question = transcript.slice(wakeMatch[0].length).trim();
        if (question) {
          ui.onCrewVoiceQuestion?.(question);
        } else {
          crewAwaitingQuestion = true;
          clearTimeout(crewFollowupTimer);
          ui.addCrewMessage('Yes, I’m here. What would you like help with?');
          speakCrewAnswer('Yes, I’m here. What would you like help with?', { awaitingQuestion: true });
        }
        continue;
      }

      if (crewAwaitingQuestion) {
        ui.onCrewVoiceQuestion?.(transcript);
      } else {
        ui.setCrewVoiceStatus('Say “Crews” first, then ask your question.');
      }
    }
  };
  recognition.onerror = (event) => {
    const messages = {
      'not-allowed': 'Microphone access is blocked. Allow microphone access in browser settings, then tap CALL CREWS AI again.',
      'service-not-allowed': 'Voice recognition is unavailable for this site. Use HTTPS or localhost, allow microphone access, or type your question.',
      'audio-capture': 'No microphone was found. Connect or enable a microphone, then try again.',
      network: 'Voice recognition needs an internet connection in this browser. You can still type to Crews AI.',
      'no-speech': 'I’m still listening. Say “Crews” when you’re ready.',
      aborted: 'Voice listening stopped.'
    };
    if (event.error !== 'aborted') {
      ui.setCrewVoiceStatus(messages[event.error] || 'Voice input failed. You can type your question.');
    }
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(event.error)) {
      clearTimeout(crewFollowupTimer);
      crewAwaitingQuestion = false;
      crewVoiceEnabled = false;
      ui.setCrewVoiceActive(false);
    }
  };
  recognition.onend = () => {
    if (crewRecognition === recognition) {
      crewRecognition = null;
    }
    if (crewVoiceEnabled && !crewSpeechInProgress) {
      clearTimeout(crewRestartTimer);
      crewRestartTimer = window.setTimeout(resumeCrewListening, 350);
    }
  };
  try {
    recognition.start();
  } catch (error) {
    crewRecognition = null;
    crewVoiceEnabled = false;
    ui.setCrewVoiceActive(false);
    const status = error?.name === 'NotAllowedError'
      ? 'Microphone access is blocked. Allow it in browser settings, then tap CALL CREWS AI again.'
      : 'Could not start the microphone. Check that it is enabled and not being used by another app, then try again.';
    ui.setCrewVoiceStatus(status);
  }
}

function toggleCrewVoice() {
  if (crewVoiceEnabled) {
    stopCrewVoice();
  } else {
    startCrewVoice();
  }
}

function suspendCrewRecognition() {
  clearTimeout(crewRestartTimer);
  if (crewRecognition) {
    const recognition = crewRecognition;
    crewRecognition = null;
    recognition.abort();
  }
}

function resumeCrewListening() {
  if (crewVoiceEnabled && !crewRecognition && !crewSpeechInProgress) {
    clearTimeout(crewRestartTimer);
    crewRestartTimer = window.setTimeout(startCrewVoice, 350);
  }
}

function stopCrewVoice() {
  crewVoiceEnabled = false;
  crewAwaitingQuestion = false;
  crewSpeechInProgress = false;
  clearTimeout(crewRestartTimer);
  clearTimeout(crewFollowupTimer);
  suspendCrewRecognition();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  ui.setCrewVoiceActive(false);
  ui.setCrewVoiceStatus('Voice is off. Tap CALL CREWS AI once to start hands-free listening.');
}

function boot() {
  buildScene();
  setupRenderer();
  setupCamera();
  attachActions();
  window.addEventListener('keydown', onDriveKeyDown);
  window.addEventListener('resize', resizeRenderer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
      if (gameAudio) {
        gameAudio.engineGain.gain.setTargetAtTime(0.0001, gameAudio.context.currentTime, 0.04);
      }
      return;
    }
    if (gameAudio && state.drive.active) {
      resumeGameAudio();
    }
    animationFrame = requestAnimationFrame(animate);
  });

  resizeRenderer();
  loadState();

  gsap.fromTo(camera.position, { z: 21, y: 10 }, { z: 15.2, y: 8.2, duration: 1.5, ease: 'power3.out' });
  updateUiFromState();
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
