import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const DEBUG = new URLSearchParams(window.location.search).has("debug");

const CONFIG = {
  duration: 30,
  floorEyeHeight: 0.15,
  splatUrl: "./godeokdong.ply",
  // The PLY's dense floor band is around y=0.13. Pull it down so
  // the scripted camera can live at y=0.15 in scene space.
  splatOffset: new THREE.Vector3(0, -0.13, 0),
  route: [
    {
      t: 0,
      pos: [-2.25, 0.15, 3.1],
      look: [-1.55, 0.24, 2.3],
      label: "floor crawl",
    },
    {
      t: 3.5,
      pos: [-1.75, 0.15, 2.35],
      look: [-1.05, 0.2, 1.6],
      label: "aisle",
    },
    {
      t: 7.5,
      pos: [-1.05, 0.15, 1.42],
      look: [-0.42, 0.18, 0.76],
      label: "approach desk",
    },
    {
      t: 10.5,
      pos: [-0.52, 0.15, 0.86],
      look: [-0.15, 0.16, 0.24],
      label: "under desk",
    },
    {
      t: 13.5,
      pos: [-0.33, 0.15, 0.52],
      look: [-1.95, 0.42, 2.58],
      label: "door sound",
    },
    {
      t: 19.8,
      pos: [-0.3, 0.15, 0.5],
      look: [-1.82, 0.44, 2.48],
      label: "shadow",
    },
    {
      t: 23,
      pos: [-0.29, 0.15, 0.47],
      look: [-0.1, 0.13, -0.24],
      label: "dark turn",
    },
    {
      t: 30,
      pos: [-0.27, 0.15, 0.44],
      look: [0.18, 0.12, -0.55],
      label: "eye contact",
    },
  ],
  events: {
    doorCreak: 12,
    shadowStart: 13.1,
    shadowEnd: 20.2,
    doorClose: 20.75,
    blackoutStart: 21.1,
    eyesAppear: 24.6,
    eyeSting: 25.05,
  },
  door: {
    pos: new THREE.Vector3(-2.08, 0.78, 2.68),
    lookAt: new THREE.Vector3(-0.32, 0.15, 0.52),
  },
  eyes: {
    pos: new THREE.Vector3(0.18, 0.12, -0.55),
  },
};

const dom = {
  host: document.querySelector("#canvasHost"),
  intro: document.querySelector("#intro"),
  startDesktop: document.querySelector("#startDesktop"),
  vrButtonHost: document.querySelector("#vrButtonHost"),
  phase: document.querySelector("#phase"),
  clock: document.querySelector("#clock"),
  meterFill: document.querySelector("#meterFill"),
  debugPanel: document.querySelector("#debugPanel"),
  debugMode: document.querySelector("#debugMode"),
  debugReadout: document.querySelector("#debugReadout"),
  copyPose: document.querySelector("#copyPose"),
  restart: document.querySelector("#restart"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.01,
  200
);
camera.rotation.order = "YXZ";

const rig = new THREE.Group();
rig.name = "scripted-camera-rig";
rig.add(camera);
scene.add(rig);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
dom.host.appendChild(renderer.domElement);

const spark = new SparkRenderer({
  renderer,
  focalAdjustment: 1.65,
  maxPixelRadius: 384,
});
scene.add(spark);

const state = {
  ready: false,
  running: false,
  paused: DEBUG,
  manual: false,
  startMs: 0,
  demoTime: 0,
  lastDemoTime: 0,
  fired: new Set(),
  manualPose: {
    position: new THREE.Vector3(...CONFIG.route[0].pos),
    yaw: -0.75,
    pitch: -0.05,
  },
};

const route = CONFIG.route.map((key) => ({
  ...key,
  posVec: new THREE.Vector3(...key.pos),
  lookVec: new THREE.Vector3(...key.look),
}));

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const tmpCameraWorld = new THREE.Vector3();

const splat = new SplatMesh({
  url: CONFIG.splatUrl,
  onProgress: updateLoadProgress,
});
splat.name = "godeokdong-splat";
splat.position.copy(CONFIG.splatOffset);
scene.add(splat);

const effects = createEventObjects();
scene.add(effects.root);

if (DEBUG) {
  dom.debugPanel.hidden = false;
  scene.add(createDebugMarkers());
}

let audio;

dom.startDesktop.addEventListener("click", () => startDemo());
dom.restart.addEventListener("click", () => restartDemo());
dom.copyPose.addEventListener("click", copyCurrentPose);
window.addEventListener("resize", resize);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointermove", onPointerMove);

const vrButton = VRButton.createButton(renderer);
vrButton.addEventListener("click", () => audio?.ensure(), { capture: true });
dom.vrButtonHost.appendChild(vrButton);

renderer.xr.addEventListener("sessionstart", () => {
  if (state.ready) {
    startDemo();
  } else {
    setPhase("entering vr after load");
  }
});

renderer.xr.addEventListener("sessionend", () => {
  state.running = false;
  state.paused = DEBUG;
  dom.intro.hidden = false;
});

splat.initialized
  .then(() => {
    state.ready = true;
    dom.startDesktop.disabled = false;
    setPhase(DEBUG ? "debug ready" : "ready");
    if (renderer.xr.isPresenting) {
      startDemo();
    }
  })
  .catch((error) => {
    console.error(error);
    setPhase("splat load failed");
  });

renderer.setAnimationLoop(animate);

function startDemo() {
  audio.ensure();
  state.running = true;
  state.paused = false;
  state.manual = false;
  state.startMs = performance.now();
  state.lastDemoTime = 0;
  state.fired.clear();
  state.demoTime = 0;
  dom.intro.hidden = true;
  setPhase("floor crawl");
}

function restartDemo() {
  state.demoTime = 0;
  state.lastDemoTime = 0;
  state.fired.clear();
  state.running = true;
  state.paused = DEBUG;
  state.manual = false;
  state.startMs = performance.now();
  dom.intro.hidden = !DEBUG;
  setPhase(DEBUG ? "debug paused" : "floor crawl");
}

function animate(nowMs) {
  updateTime(nowMs);
  updateCameraRig();
  updateTimeline();
  updateHud();
  if (DEBUG) {
    updateScoutControls();
    updateDebugPanel();
  }
  renderer.render(scene, camera);
}

function updateTime(nowMs) {
  if (!state.running) {
    state.demoTime = 0;
    return;
  }
  if (!state.paused) {
    state.demoTime = Math.min(
      CONFIG.duration,
      Math.max(0, (nowMs - state.startMs) / 1000)
    );
  } else {
    state.startMs = nowMs - state.demoTime * 1000;
  }
}

function updateCameraRig() {
  if (DEBUG && state.manual) {
    rig.position.copy(state.manualPose.position);
    rig.rotation.set(state.manualPose.pitch, state.manualPose.yaw, 0, "YXZ");
    return;
  }

  getRoutePose(state.demoTime, tmpPos, tmpLook);
  rig.position.copy(tmpPos);
  rig.lookAt(tmpLook);
}

function updateTimeline() {
  const t = state.demoTime;
  const e = CONFIG.events;

  triggerCue("doorCreak", e.doorCreak, () => audio.doorCreak());
  triggerCue("doorClose", e.doorClose, () => audio.doorClose());
  triggerCue("eyeSting", e.eyeSting, () => audio.eyeSting());
  audio.update(t, state.running && !state.paused);

  const doorOpen = pulseWindow(t, e.doorCreak, e.doorClose, 0.8, 0.7);
  const shadowWindow = pulseWindow(t, e.shadowStart, e.shadowEnd, 1.2, 1.0);
  const blackout = smoothstep(e.blackoutStart, e.eyesAppear, t);
  const eyes = smoothstep(e.eyesAppear, e.eyesAppear + 1.4, t);

  const baseDim = THREE.MathUtils.lerp(0.54, 0.36, smoothstep(0, 10, t));
  const dim = THREE.MathUtils.lerp(baseDim, 0.075, blackout);
  const warmLift = 0.14 * doorOpen * (1 - blackout);
  splat.recolor.setRGB(dim + warmLift, dim * 0.92 + warmLift * 0.72, dim * 0.82);

  effects.doorGlow.material.opacity = 0.36 * doorOpen * (1 - blackout);
  effects.doorBeam.material.opacity = 0.2 * doorOpen * (1 - blackout);
  effects.shadowBand.material.opacity = 0.34 * shadowWindow * (1 - blackout);
  effects.shadowBand.position.x = -0.52 + Math.sin(t * 1.1) * 0.26;
  effects.shadowBand.rotation.z = 0.36 + Math.sin(t * 0.7) * 0.18;

  const figureOpacity = 0.5 * shadowWindow * (1 - blackout);
  effects.shadowFigure.position.x = -2.08 + Math.sin(t * 0.85) * 0.16;
  effects.shadowFigure.position.z = 2.55 + Math.sin(t * 1.25) * 0.08;
  setGroupOpacity(effects.shadowFigure, figureOpacity);

  const eyePulse = eyes * (0.78 + Math.sin(t * 11) * 0.08);
  setGroupOpacity(effects.eyes, eyePulse);
  effects.eyes.position.y = CONFIG.eyes.pos.y + Math.sin(t * 3.2) * 0.006;
  camera.getWorldPosition(tmpCameraWorld);
  effects.eyes.lookAt(tmpCameraWorld);
  effects.eyesLight.intensity = 0.15 + eyePulse * 1.9;
  effects.eyesLight.distance = 0.8 + eyePulse * 0.4;

  if (t >= CONFIG.duration && !renderer.xr.isPresenting) {
    state.running = false;
    dom.intro.hidden = false;
    setPhase("ended");
  }

  state.lastDemoTime = t;
}

function getRoutePose(t, outPos, outLook) {
  const last = route[route.length - 1];
  if (t <= route[0].t) {
    outPos.copy(route[0].posVec);
    outLook.copy(route[0].lookVec);
    return route[0];
  }
  if (t >= last.t) {
    outPos.copy(last.posVec);
    outLook.copy(last.lookVec);
    return last;
  }
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = smoothstep(a.t, b.t, t);
      outPos.lerpVectors(a.posVec, b.posVec, u);
      outLook.lerpVectors(a.lookVec, b.lookVec, u);
      return a;
    }
  }
  outPos.copy(last.posVec);
  outLook.copy(last.lookVec);
  return last;
}

function createEventObjects() {
  const root = new THREE.Group();
  root.name = "horror-event-effects";

  const warm = new THREE.MeshBasicMaterial({
    color: 0xf2b55e,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.55), warm);
  doorGlow.name = "door-glow";
  doorGlow.position.copy(CONFIG.door.pos);
  doorGlow.lookAt(CONFIG.door.lookAt);
  doorGlow.renderOrder = 5;
  root.add(doorGlow);

  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -2.48, 0.026, 2.42, -1.74, 0.026, 2.92, -0.72, 0.026, 0.42,
        0.36, 0.026, 0.04,
      ],
      3
    )
  );
  beamGeo.setIndex([0, 1, 2, 1, 3, 2]);
  beamGeo.computeVertexNormals();
  const doorBeam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: 0xf3c477,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  doorBeam.name = "door-light-beam";
  doorBeam.renderOrder = 6;
  root.add(doorBeam);

  const shadowBand = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 3.65),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
  );
  shadowBand.name = "moving-shadow";
  shadowBand.position.set(-0.45, 0.031, 1.08);
  shadowBand.rotation.x = -Math.PI / 2;
  shadowBand.rotation.z = 0.36;
  shadowBand.renderOrder = 7;
  root.add(shadowBand);

  const shadowFigure = new THREE.Group();
  shadowFigure.name = "doorway-peeking-shadow";
  shadowFigure.position.set(-2.08, 0.56, 2.55);
  shadowFigure.lookAt(CONFIG.door.lookAt);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 0.74, 12),
    shadowMat.clone()
  );
  body.position.y = 0.02;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 18, 10),
    shadowMat.clone()
  );
  head.position.y = 0.47;
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.13, 0.1),
    shadowMat.clone()
  );
  shoulder.position.y = 0.21;
  shadowFigure.add(body, head, shoulder);
  shadowFigure.traverse((child) => {
    if (child.isMesh) child.renderOrder = 8;
  });
  root.add(shadowFigure);

  const eyes = new THREE.Group();
  eyes.name = "under-desk-eyes";
  eyes.position.copy(CONFIG.eyes.pos);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0xff2d18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const pupilMat = new THREE.MeshBasicMaterial({
    color: 0x160403,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.2),
    new THREE.MeshBasicMaterial({
      color: 0xff2d18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  glow.renderOrder = 19;
  eyes.add(glow);
  const eyeGeo = new THREE.SphereGeometry(0.07, 24, 12);
  const pupilGeo = new THREE.SphereGeometry(0.022, 16, 8);
  [-0.09, 0.09].forEach((x) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat.clone());
    eye.scale.set(1.65, 0.55, 0.42);
    eye.position.x = x;
    eye.renderOrder = 20;
    const pupil = new THREE.Mesh(pupilGeo, pupilMat.clone());
    pupil.position.set(x, 0, -0.036);
    pupil.scale.set(1, 0.8, 0.65);
    pupil.renderOrder = 21;
    eyes.add(eye, pupil);
  });
  const eyesLight = new THREE.PointLight(0xff5a36, 0, 1.2);
  eyes.add(eyesLight);
  root.add(eyes);

  return { root, doorGlow, doorBeam, shadowBand, shadowFigure, eyes, eyesLight };
}

function createDebugMarkers() {
  const root = new THREE.Group();
  root.name = "debug-route-markers";

  const pathPoints = route.map((key) => key.posVec);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pathPoints),
    new THREE.LineBasicMaterial({ color: 0x5da8ff })
  );
  root.add(line);

  const markerGeo = new THREE.SphereGeometry(0.045, 10, 8);
  const pathMat = new THREE.MeshBasicMaterial({ color: 0x5da8ff });
  const lookMat = new THREE.MeshBasicMaterial({ color: 0xf4c46e });
  route.forEach((key) => {
    const point = new THREE.Mesh(markerGeo, pathMat);
    point.position.copy(key.posVec);
    const target = new THREE.Mesh(markerGeo, lookMat);
    target.position.copy(key.lookVec);
    root.add(point, target);
  });

  const eyes = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a36 })
  );
  eyes.position.copy(CONFIG.eyes.pos);
  root.add(eyes);

  return root;
}

function updateLoadProgress(progress) {
  let amount = 0;
  if (typeof progress === "number") {
    amount = progress;
  } else if (progress?.total && progress?.loaded) {
    amount = progress.loaded / progress.total;
  } else if (typeof progress?.progress === "number") {
    amount = progress.progress;
  }
  if (Number.isFinite(amount) && amount > 0) {
    dom.meterFill.style.transform = `scaleX(${Math.min(1, amount)})`;
    setPhase(`loading ${Math.round(Math.min(1, amount) * 100)}%`);
  }
}

function updateHud() {
  dom.clock.textContent = state.demoTime.toFixed(1).padStart(4, "0");
  dom.meterFill.style.transform = `scaleX(${
    state.ready
      ? Math.min(1, state.demoTime / CONFIG.duration)
      : dom.meterFill.style.transform.replace(/[^0-9.]/g, "") || 0
  })`;

  if (!state.running) return;

  if (state.demoTime < 10.5) setPhase("floor crawl");
  else if (state.demoTime < CONFIG.events.doorCreak) setPhase("under desk");
  else if (state.demoTime < CONFIG.events.shadowStart) setPhase("door sound");
  else if (state.demoTime < CONFIG.events.doorClose) setPhase("shadow");
  else if (state.demoTime < CONFIG.events.eyesAppear) setPhase("blackout");
  else setPhase("eye contact");
}

function updateDebugPanel() {
  getRoutePose(state.demoTime, tmpPos, tmpLook);
  const pos = DEBUG && state.manual ? state.manualPose.position : tmpPos;
  const look = DEBUG && state.manual ? forwardLookFromManual() : tmpLook;
  dom.debugMode.textContent = state.manual ? "scout" : state.paused ? "paused" : "path";
  dom.debugReadout.textContent = [
    `t: ${state.demoTime.toFixed(2)} / ${CONFIG.duration}`,
    `pos: [${fmt(pos.x)}, ${fmt(pos.y)}, ${fmt(pos.z)}]`,
    `look: [${fmt(look.x)}, ${fmt(look.y)}, ${fmt(look.z)}]`,
  ].join("\n");
}

function setPhase(text) {
  dom.phase.textContent = text;
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function pulseWindow(t, start, end, fadeIn, fadeOut) {
  return smoothstep(start, start + fadeIn, t) * (1 - smoothstep(end - fadeOut, end, t));
}

function triggerCue(name, eventTime, handler) {
  if (
    state.running &&
    !state.paused &&
    !state.fired.has(name) &&
    state.lastDemoTime <= eventTime &&
    state.demoTime >= eventTime
  ) {
    state.fired.add(name);
    handler();
  }
}

function setGroupOpacity(group, opacity) {
  group.traverse((child) => {
    if (child.material) {
      child.material.opacity = opacity;
    }
  });
}

function fmt(value) {
  return Number(value).toFixed(3);
}

const keys = new Set();
let dragging = false;
let pointer = { x: 0, y: 0 };

function onKeyDown(event) {
  if (!DEBUG) return;
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    state.running = true;
    state.paused = !state.paused;
  }
  if (event.code === "KeyR") {
    restartDemo();
  }
  if (event.code === "KeyM") {
    state.manual = !state.manual;
    if (state.manual) {
      getRoutePose(state.demoTime, tmpPos, tmpLook);
      state.manualPose.position.copy(tmpPos);
      const dir = tmpLook.clone().sub(tmpPos).normalize();
      state.manualPose.yaw = Math.atan2(-dir.x, -dir.z);
      state.manualPose.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    }
  }
  if (event.code === "ArrowRight") scrub(0.5);
  if (event.code === "ArrowLeft") scrub(-0.5);
}

function onKeyUp(event) {
  keys.delete(event.code);
}

function onPointerDown(event) {
  if (!DEBUG || !state.manual) return;
  dragging = true;
  pointer = { x: event.clientX, y: event.clientY };
}

function onPointerUp() {
  dragging = false;
}

function onPointerMove(event) {
  if (!DEBUG || !state.manual || !dragging) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer = { x: event.clientX, y: event.clientY };
  state.manualPose.yaw -= dx * 0.004;
  state.manualPose.pitch = THREE.MathUtils.clamp(
    state.manualPose.pitch - dy * 0.003,
    -1.2,
    1.2
  );
}

function scrub(delta) {
  state.running = true;
  state.paused = true;
  state.demoTime = THREE.MathUtils.clamp(state.demoTime + delta, 0, CONFIG.duration);
}

function updateScoutControls() {
  if (!state.manual) return;
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 0.048 : 0.018;
  const forward = new THREE.Vector3(
    -Math.sin(state.manualPose.yaw),
    0,
    -Math.cos(state.manualPose.yaw)
  );
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  if (keys.has("KeyW")) state.manualPose.position.addScaledVector(forward, speed);
  if (keys.has("KeyS")) state.manualPose.position.addScaledVector(forward, -speed);
  if (keys.has("KeyA")) state.manualPose.position.addScaledVector(right, -speed);
  if (keys.has("KeyD")) state.manualPose.position.addScaledVector(right, speed);
  if (keys.has("KeyQ")) state.manualPose.position.y -= speed;
  if (keys.has("KeyE")) state.manualPose.position.y += speed;
}

function forwardLookFromManual() {
  const dir = new THREE.Vector3(
    -Math.sin(state.manualPose.yaw) * Math.cos(state.manualPose.pitch),
    Math.sin(state.manualPose.pitch),
    -Math.cos(state.manualPose.yaw) * Math.cos(state.manualPose.pitch)
  );
  return state.manualPose.position.clone().addScaledVector(dir, 1);
}

function copyCurrentPose() {
  const pos = state.manual ? state.manualPose.position : tmpPos;
  const look = state.manual ? forwardLookFromManual() : tmpLook;
  const text = JSON.stringify(
    {
      t: Number(state.demoTime.toFixed(2)),
      pos: [Number(fmt(pos.x)), Number(fmt(pos.y)), Number(fmt(pos.z))],
      look: [Number(fmt(look.x)), Number(fmt(look.y)), Number(fmt(look.z))],
    },
    null,
    2
  );
  navigator.clipboard?.writeText(text);
}

class AudioDirector {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.rumble = null;
    this.rumbleGain = null;
  }

  ensure() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.62;
    this.master.connect(this.ctx.destination);

    this.rumble = this.ctx.createOscillator();
    this.rumble.type = "sine";
    this.rumble.frequency.value = 38;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;
    this.rumble.connect(this.rumbleGain).connect(this.master);
    this.rumble.start();
  }

  update(t, active) {
    if (!this.ctx) return;
    const target = active
      ? THREE.MathUtils.clamp(0.018 + t / CONFIG.duration * 0.04, 0.018, 0.058)
      : 0;
    this.rumbleGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  doorCreak() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "sawtooth";
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 1.35);
    filter.Q.value = 10;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 1.35);
    osc.frequency.setValueAtTime(84, now);
    osc.frequency.exponentialRampToValueAtTime(47, now + 1.35);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 1.45);
    this.noiseBurst(now + 0.08, 1.1, 0.045, 900, "bandpass");
  }

  doorClose() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.noiseBurst(now, 0.18, 0.24, 140, "lowpass");
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(78, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.42);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  eyeSting() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [211, 233, 421].forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = index === 2 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 0.65);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.85);
    });
    this.noiseBurst(now, 0.08, 0.055, 2500, "highpass");
  }

  noiseBurst(start, duration, volume, frequency, type) {
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
  }
}

audio = new AudioDirector();
