import { BEATS, COLORS, CONFIG } from "./config.js";
import {
  CollisionDetector,
  EatDetector,
  GameStateMachine,
  OrbSpawner,
  ScoreManager,
  SnakeController
} from "./logic.js";
import {
  extractForward,
  extractPosition,
  flattenForward,
  mat4LookAt,
  mat4Perspective,
  quatLookAt,
  quatSlerp,
  vecAdd,
  vecDistance,
  vecLerp,
  vecNormalize,
  vecScaleAndAdd,
  vecSub
} from "./math.js";
import {
  createPlaneGeometry,
  createSphereGeometry,
  MATERIAL_KIND,
  WebGLSceneRenderer
} from "./renderer.js";
import {
  BodySegment,
  FoodOrb,
  GameOverOverlay,
  HeadSphere,
  HintDisplay,
  makePresetFaceCanvas,
  ScoreDisplay,
  updateTextSprite
} from "./visuals.js";

class MRSnakeApp {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.mode = this.params.get("mode") === CONFIG.mode.custom ? CONFIG.mode.custom : CONFIG.mode.preset;
    this.renderer = new WebGLSceneRenderer(document.querySelector("#xr-canvas"));
    this.sphereGeometry = createSphereGeometry(CONFIG.visual.sphereWidthSegments, CONFIG.visual.sphereHeightSegments);
    this.planeGeometry = createPlaneGeometry();
    this.machine = new GameStateMachine({ mode: this.mode });
    this.score = new ScoreManager();
    this.snake = new SnakeController();
    this.spawner = new OrbSpawner();
    this.eatDetector = new EatDetector();
    this.collisionDetector = new CollisionDetector();
    this.audioContext = null;
    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.xrMode = null;
    this.previewActive = false;
    this.previewYaw = 0;
    this.previewPlayerPos = [...CONFIG.preview.startPosition];
    this.lastFrameTime = 0;
    this.gameStartTime = null;
    this.remainingSeconds = CONFIG.game.durationSeconds;
    this.headBounceStart = 0;
    this.headBounceUntil = 0;
    this.slowUntil = 0;
    this.tailPenaltyCooldownUntil = 0;
    this.controllerStates = new Map();
    this.keys = new Set();
    this.dom = this.getDom();
    this.visuals = {
      head: null,
      body: [],
      links: [],
      orbs: new Map(),
      score: null,
      hint: null,
      gameOver: null
    };
    this.currentPose = {
      position: [...CONFIG.preview.startPosition],
      forward: [0, 0, -1]
    };

    this.onXRFrame = this.onXRFrame.bind(this);
    this.onPreviewFrame = this.onPreviewFrame.bind(this);
  }

  async init() {
    this.dom.modeLabel.textContent = this.mode;
    this.wireDom();
    this.machine.on("beat", (event) => this.onBeat(event));
    this.machine.on("queue", ({ size }) => this.updateQueue(size));
    this.machine.boot();
    const shouldConnectSse = this.mode === CONFIG.mode.custom || this.params.has("sse");

    if (this.mode === CONFIG.mode.preset) {
      const texture = this.renderer.createTextureFromCanvas(makePresetFaceCanvas());
      this.machine.setTexture({ texture, label: "preset-face" });
      this.setStatus("Quest에서 XR 시작을 누르면 READY로 전환됩니다.");
    } else {
      this.setStatus("custom 모드입니다. XR 시작 후 서버 텍스처를 기다립니다.");
    }

    if (shouldConnectSse) {
      this.connectSse();
    }
    this.checkXrAvailability();
    if (this.params.get("preview") === "1") {
      window.setTimeout(() => this.startPreview(), 0);
    }
    requestAnimationFrame(this.onPreviewFrame);
  }

  getDom() {
    return {
      overlay: document.querySelector("#overlay"),
      bootPanel: document.querySelector("#boot-panel"),
      gameOverPanel: document.querySelector("#game-over-panel"),
      hud: document.querySelector("#hud"),
      statusText: document.querySelector("#status-text"),
      modeLabel: document.querySelector("#mode-label"),
      queueLabel: document.querySelector("#queue-label"),
      scoreLabel: document.querySelector("#score-label"),
      beatLabel: document.querySelector("#beat-label"),
      finalScoreLabel: document.querySelector("#final-score-label"),
      startXr: document.querySelector("#start-xr"),
      startPreview: document.querySelector("#start-preview"),
      restart: document.querySelector("#restart"),
      nextStudent: document.querySelector("#next-student")
    };
  }

  wireDom() {
    this.dom.startXr.addEventListener("click", () => this.startXR());
    this.dom.startPreview.addEventListener("click", () => this.startPreview());
    this.dom.restart.addEventListener("click", () => this.machine.restart());
    this.dom.nextStudent.addEventListener("click", () => this.machine.nextStudent());
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "KeyR") {
        this.machine.restart();
      }
      if (event.code === "KeyN") {
        this.machine.nextStudent();
      }
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }

  async checkXrAvailability() {
    if (!("xr" in navigator)) {
      this.dom.startXr.disabled = true;
      this.setStatus("이 브라우저는 WebXR을 지원하지 않습니다. Quest Browser에서 열어 주세요.");
      return;
    }

    if (!window.isSecureContext) {
      this.setStatus("WebXR은 HTTPS 또는 localhost 보안 컨텍스트가 필요합니다.");
    }
  }

  async startXR() {
    try {
      await this.ensureAudio();
      const sessionMode = await this.pickSessionMode();
      if (!sessionMode) {
        this.machine.setError("Quest Browser에서 immersive-ar 또는 immersive-vr 세션을 시작할 수 없습니다.");
        return;
      }

      const gl = this.renderer.gl;
      await gl.makeXRCompatible();
      const sessionInit = {
        optionalFeatures: [...CONFIG.xr.optionalFeatures],
        domOverlay: { root: this.dom.overlay }
      };
      const session = await navigator.xr.requestSession(sessionMode, sessionInit);
      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      this.xrReferenceSpace = await this.requestReferenceSpace(session);
      this.xrSession = session;
      this.xrMode = sessionMode;
      this.previewActive = false;
      this.dom.bootPanel.hidden = true;
      this.dom.hud.hidden = false;
      this.setStatus(`${sessionMode} 세션 실행 중`);
      this.machine.setXrReady();
      session.addEventListener("end", () => this.onXREnd());
      session.requestAnimationFrame(this.onXRFrame);
    } catch (error) {
      this.machine.setError(error.message || "XR 세션 시작 실패");
    }
  }

  async pickSessionMode() {
    const forced = this.params.get("xr");
    const modes = forced === "vr"
      ? [CONFIG.xr.fallbackMode]
      : forced === "ar"
        ? [CONFIG.xr.preferredMode]
        : [CONFIG.xr.preferredMode, CONFIG.xr.fallbackMode];

    for (const mode of modes) {
      try {
        if (await navigator.xr.isSessionSupported(mode)) {
          return mode;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async requestReferenceSpace(session) {
    for (const type of CONFIG.xr.referenceSpaces) {
      try {
        return await session.requestReferenceSpace(type);
      } catch {
        continue;
      }
    }
    throw new Error("XR reference space를 만들 수 없습니다.");
  }

  onXREnd() {
    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.xrMode = null;
    this.dom.bootPanel.hidden = false;
    this.dom.hud.hidden = true;
    this.setStatus("XR 세션이 종료되었습니다.");
  }

  startPreview() {
    this.ensureAudio();
    this.previewActive = true;
    this.xrSession = null;
    this.dom.bootPanel.hidden = true;
    this.dom.hud.hidden = false;
    this.machine.setXrReady();
  }

  async ensureAudio() {
    if (!this.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) {
        this.audioContext = new Context();
      }
    }
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  playEatSound() {
    if (!this.audioContext) {
      return;
    }
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.frequency.value = CONFIG.audio.eatFrequency;
    gain.gain.setValueAtTime(CONFIG.audio.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + CONFIG.audio.eatDuration);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + CONFIG.audio.eatDuration);
  }

  connectSse() {
    if (!("EventSource" in window)) {
      this.setStatus("이 브라우저는 EventSource(SSE)를 지원하지 않습니다.");
      return;
    }

    const sseUrl = this.params.get("sse") || "/events";
    const source = new EventSource(sseUrl);
    source.addEventListener("message", async (event) => {
      try {
        const payload = await this.parseTextureEvent(event.data);
        this.machine.receiveTexture(payload);
      } catch (error) {
        this.setStatus(`SSE 텍스처 처리 실패: ${error.message}`);
      }
    });
    source.addEventListener("open", () => this.setStatus(`SSE 연결됨: ${sseUrl}`));
    source.addEventListener("error", () => {
      if (this.mode === CONFIG.mode.custom) {
        this.setStatus(`SSE 대기 중: ${sseUrl}`);
      }
    });
    this.sse = source;
  }

  async parseTextureEvent(data) {
    let payload = data;
    try {
      payload = JSON.parse(data);
    } catch {
      payload = data;
    }

    const src = typeof payload === "string"
      ? payload
      : payload.texture || payload.image || payload.dataUrl || payload.url;

    if (!src) {
      throw new Error("texture, image, dataUrl 또는 url 필드가 필요합니다.");
    }

    const image = await this.loadImage(src);
    return {
      texture: this.renderer.createTextureFromImage(image),
      label: typeof payload === "object" && payload.id ? payload.id : "custom-texture"
    };
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 로드할 수 없습니다."));
      image.src = src;
    });
  }

  onBeat({ beat, message, score }) {
    this.updateTimerLabel();

    if (beat === BEATS.READY) {
      this.enterReady();
      this.setStatus("READY: 먹이 근처로 이동하면 얼굴 친구가 먹이를 흡수합니다.");
      return;
    }

    if (beat === BEATS.PLAYING) {
      this.gameStartTime = performance.now() / 1000;
      this.remainingSeconds = CONFIG.game.durationSeconds;
      this.updateTimerLabel();
      this.setStatus("PLAYING: 2분 안에 얼굴 친구를 최대한 길게 키우세요.");
      if (this.visuals.hint) {
        this.visuals.hint.visible = false;
      }
      return;
    }

    if (beat === BEATS.GAME_OVER) {
      this.enterGameOver(score ?? this.score.get());
      return;
    }

    if (beat === BEATS.WAITING) {
      this.enterWaiting();
      return;
    }

    if (beat === BEATS.ERROR) {
      this.setStatus(`ERROR: ${message}`);
      this.dom.bootPanel.hidden = false;
      this.dom.hud.hidden = true;
    }
  }

  enterReady() {
    this.score.reset();
    this.gameStartTime = null;
    this.remainingSeconds = CONFIG.game.durationSeconds;
    this.headBounceStart = 0;
    this.headBounceUntil = 0;
    this.slowUntil = 0;
    this.tailPenaltyCooldownUntil = 0;
    this.updateScore(0);
    this.updateTimerLabel();
    this.hideGameOver();
    this.snake.reset(this.currentPose.position, this.currentPose.forward);
    this.spawner.reset(this.currentPose.position, this.currentPose.forward);
    this.visuals.body = [];
    this.visuals.links = [];
    this.visuals.orbs.clear();
    this.visuals.head = HeadSphere({
      geometry: this.sphereGeometry,
      texture: this.machine.currentTexture.texture
    });
    this.visuals.score = ScoreDisplay({
      planeGeometry: this.planeGeometry,
      renderer: this.renderer,
      score: this.score.get()
    });
    this.visuals.hint = HintDisplay({
      planeGeometry: this.planeGeometry,
      renderer: this.renderer,
      text: "먹이 근처로 이동하세요"
    });
    this.syncVisuals(performance.now() / 1000);
  }

  enterWaiting() {
    this.score.reset();
    this.gameStartTime = null;
    this.remainingSeconds = CONFIG.game.durationSeconds;
    this.updateScore(0);
    this.updateTimerLabel();
    this.visuals.body = [];
    this.visuals.links = [];
    this.visuals.orbs.clear();
    this.visuals.head = null;
    this.visuals.score = null;
    this.visuals.hint = HintDisplay({
      planeGeometry: this.planeGeometry,
      renderer: this.renderer,
      text: "텍스처 수신 대기 중"
    });
    this.hideGameOver();
    this.setStatus("WAITING: custom 텍스처가 SSE로 들어오면 자동 READY로 전환됩니다.");
  }

  enterGameOver(score) {
    this.snake.freeze();
    this.dom.gameOverPanel.hidden = false;
    this.dom.finalScoreLabel.textContent = String(score);
    this.dom.beatLabel.textContent = "TIME UP";
    this.visuals.gameOver = GameOverOverlay({
      planeGeometry: this.planeGeometry,
      renderer: this.renderer,
      score
    });
    this.setStatus(`TIME UP: 내가 키운 얼굴 친구 길이 ${score}`);
  }

  hideGameOver() {
    this.dom.gameOverPanel.hidden = true;
    this.visuals.gameOver = null;
  }

  updateScore(value) {
    this.dom.scoreLabel.textContent = String(value);
    if (this.visuals.score) {
      updateTextSprite(this.visuals.score, this.renderer, `Length ${value}`, {
        fontPx: CONFIG.visual.scoreFontPx,
        lineHeight: CONFIG.visual.scoreLineHeight
      });
    }
  }

  updateTimerLabel() {
    const total = Math.max(0, Math.ceil(this.remainingSeconds));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, "0");
    this.dom.beatLabel.textContent = `${minutes}:${seconds}`;
  }

  updateQueue(size) {
    this.dom.queueLabel.textContent = String(size);
  }

  setStatus(message) {
    this.dom.statusText.textContent = message;
  }

  onXRFrame(time, frame) {
    const session = frame.session;
    session.requestAnimationFrame(this.onXRFrame);

    const pose = frame.getViewerPose(this.xrReferenceSpace);
    if (!pose) {
      return;
    }

    const viewerTransform = pose.views[0].transform.matrix;
    const playerPose = {
      position: extractPosition(viewerTransform),
      forward: flattenForward(extractForward(viewerTransform))
    };

    const controllers = this.readXRControllers(frame);
    this.step(time, playerPose, controllers);

    const baseLayer = session.renderState.baseLayer;
    const gl = this.renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);

    for (const view of pose.views) {
      const viewport = baseLayer.getViewport(view);
      this.renderer.render(this.collectMeshes(), {
        projectionMatrix: view.projectionMatrix,
        viewMatrix: view.transform.inverse.matrix,
        cameraPosition: extractPosition(view.transform.matrix)
      }, {
        time: time / 1000,
        transparent: this.xrMode === CONFIG.xr.preferredMode,
        viewport
      });
    }
  }

  onPreviewFrame(time) {
    requestAnimationFrame(this.onPreviewFrame);
    if (!this.previewActive || this.xrSession) {
      return;
    }

    const timeSeconds = time / 1000;
    const pose = this.updatePreviewPose(timeSeconds);
    const controllers = [this.readPreviewController(pose)];
    this.step(time, pose, controllers);

    const aspect = this.renderer.canvas.clientWidth / Math.max(1, this.renderer.canvas.clientHeight);
    const cameraForward = pose.forward;
    const cameraRight = [cameraForward[2] * -1, 0, cameraForward[0]];
    let cameraPosition = vecScaleAndAdd(pose.position, cameraRight, CONFIG.preview.cameraSideOffset);
    cameraPosition = vecScaleAndAdd(cameraPosition, cameraForward, CONFIG.preview.cameraForwardOffset);
    cameraPosition = vecAdd(cameraPosition, [0, CONFIG.preview.cameraHeight, 0]);
    const cameraTarget = this.snake.headPosition
      ? vecAdd(this.snake.headPosition, [0, CONFIG.preview.cameraTargetYOffset, 0])
      : vecAdd(pose.position, [0, CONFIG.preview.cameraTargetYOffset, 0]);
    this.renderer.render(this.collectMeshes(), {
      projectionMatrix: mat4Perspective(CONFIG.preview.fieldOfView, aspect, CONFIG.preview.near, CONFIG.preview.far),
      viewMatrix: mat4LookAt(cameraPosition, cameraTarget),
      cameraPosition
    }, {
      time: timeSeconds
    });
  }

  updatePreviewPose(timeSeconds = performance.now() / 1000) {
    if (this.keys.has("KeyQ")) {
      this.previewYaw += CONFIG.preview.turnSpeed;
    }
    if (this.keys.has("KeyE")) {
      this.previewYaw -= CONFIG.preview.turnSpeed;
    }

    const forward = [Math.sin(this.previewYaw), 0, -Math.cos(this.previewYaw)];
    const right = [Math.cos(this.previewYaw), 0, Math.sin(this.previewYaw)];

    const moveSpeed = CONFIG.preview.moveSpeed * this.getSlowFactor(timeSeconds);

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
      this.previewPlayerPos = vecScaleAndAdd(this.previewPlayerPos, forward, moveSpeed);
    }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
      this.previewPlayerPos = vecScaleAndAdd(this.previewPlayerPos, forward, -moveSpeed);
    }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      this.previewPlayerPos = vecScaleAndAdd(this.previewPlayerPos, right, -moveSpeed);
    }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      this.previewPlayerPos = vecScaleAndAdd(this.previewPlayerPos, right, moveSpeed);
    }

    return {
      position: [...this.previewPlayerPos],
      forward
    };
  }

  readPreviewController(pose) {
    const id = "preview";
    const previous = this.controllerStates.get(id) || {};
    const gripPressed = this.keys.has("Space");
    const triggerPressed = this.keys.has("Enter");
    const position = this.isControllerHolding(id)
      ? this.getMouthPosition(pose)
      : vecScaleAndAdd(pose.position, pose.forward, CONFIG.preview.controllerReach);
    const state = {
      id,
      position,
      gripPressed,
      triggerPressed,
      justGrip: gripPressed && !previous.gripPressed,
      justTrigger: triggerPressed && !previous.triggerPressed
    };
    this.controllerStates.set(id, state);
    return state;
  }

  isControllerHolding(controllerId) {
    return this.spawner.getAll().some((orb) => orb.heldBy === controllerId);
  }

  readXRControllers(frame) {
    const controllers = [];
    let index = 0;

    for (const source of this.xrSession.inputSources) {
      const id = `${source.handedness || "hand"}-${index}`;
      index += 1;
      const previous = this.controllerStates.get(id) || {};
      const pose = source.gripSpace
        ? frame.getPose(source.gripSpace, this.xrReferenceSpace)
        : source.targetRaySpace
          ? frame.getPose(source.targetRaySpace, this.xrReferenceSpace)
          : null;

      if (!pose) {
        continue;
      }

      const gamepad = source.gamepad;
      const gripPressed = Boolean(gamepad?.buttons?.[CONFIG.input.gripButtonIndex]?.pressed);
      const triggerPressed = Boolean(gamepad?.buttons?.[CONFIG.input.triggerButtonIndex]?.pressed);
      const position = extractPosition(pose.transform.matrix);
      const holdOffset = CONFIG.grab.controllerHoldOffset;
      const state = {
        id,
        position: vecAdd(position, holdOffset),
        gripPressed,
        triggerPressed,
        justGrip: gripPressed && !previous.gripPressed,
        justTrigger: triggerPressed && !previous.triggerPressed
      };
      this.controllerStates.set(id, state);
      controllers.push(state);
    }

    return controllers;
  }

  step(time, pose, controllers) {
    const timeSeconds = time / 1000;
    this.currentPose = {
      position: [...pose.position],
      forward: flattenForward(pose.forward)
    };

    if (this.machine.beat === BEATS.READY || this.machine.beat === BEATS.PLAYING) {
      this.snake.tick(this.currentPose.position, this.currentPose.forward, this.getSlowFactor(timeSeconds));
      this.spawner.ensureSet(this.currentPose.position, this.currentPose.forward);
      this.handleFoodPickup(timeSeconds);

      if (this.machine.beat === BEATS.PLAYING) {
        this.updateTimer(timeSeconds);
        if (this.machine.beat === BEATS.PLAYING) {
          this.handleTailContact(timeSeconds);
        }
      }
    } else if (this.machine.beat === BEATS.GAME_OVER) {
      this.handleGameOverInput(controllers);
    }

    this.syncVisuals(timeSeconds);
  }

  handleGameOverInput(controllers) {
    for (const controller of controllers) {
      if (controller.justTrigger) {
        this.machine.restart();
      }
      if (controller.justGrip) {
        this.machine.nextStudent();
      }
    }
  }

  handleFoodPickup(timeSeconds) {
    const pickupPoint = this.getFoodPickupPosition();

    for (const orb of this.spawner.getAll()) {
      if (!orb.delivering && vecDistance(pickupPoint, orb.position) <= CONFIG.pickup.threshold) {
        this.machine.startPlaying();
        orb.delivering = true;
        orb.heldBy = null;
        this.setStatus("먹이가 얼굴 친구에게 전달됩니다.");
      }

      if (orb.delivering) {
        orb.position = vecLerp(orb.position, this.snake.headPosition, CONFIG.pickup.deliveryLerp);
        if (this.eatDetector.check(orb.position, this.snake.headPosition, CONFIG.pickup.absorbThreshold)) {
          this.eatOrb(orb, timeSeconds);
        }
      }
    }
  }

  eatOrb(orb, timeSeconds) {
    const color = orb.color;
    this.spawner.remove(orb.id);
    this.snake.addSegment(color);
    this.updateScore(this.score.increment());
    this.triggerHeadBounce(timeSeconds);
    this.playEatSound();
    this.spawner.spawn(color, this.currentPose.position, this.currentPose.forward);
  }

  triggerHeadBounce(timeSeconds) {
    this.headBounceStart = timeSeconds;
    this.headBounceUntil = timeSeconds + CONFIG.head.bounceDurationSeconds;
  }

  updateTimer(timeSeconds) {
    if (this.gameStartTime === null) {
      this.gameStartTime = timeSeconds;
    }

    const elapsed = Math.max(0, timeSeconds - this.gameStartTime);
    this.remainingSeconds = Math.max(0, CONFIG.game.durationSeconds - elapsed);
    this.updateTimerLabel();

    if (this.remainingSeconds <= 0) {
      this.machine.gameOver(this.score.get());
    }
  }

  handleTailContact(timeSeconds) {
    if (timeSeconds < this.tailPenaltyCooldownUntil) {
      return;
    }

    const tailPosition = this.snake.getTailPosition();
    if (!tailPosition || !this.collisionDetector.check(this.getSnakeCollisionPosition(), tailPosition)) {
      return;
    }

    const penalty = this.randomTailPenalty();
    const removed = this.snake.trimSegments(penalty);
    if (removed === 0) {
      return;
    }

    this.updateScore(this.score.decrement(removed));
    this.tailPenaltyCooldownUntil = timeSeconds + CONFIG.collision.penaltyCooldownSeconds;
    this.slowUntil = Math.max(this.slowUntil, timeSeconds + CONFIG.collision.slowDurationSeconds);
    this.setStatus(`꼬리에 닿아 몸통 ${removed}개 감소. 잠깐 느려집니다.`);
  }

  randomTailPenalty() {
    const min = CONFIG.collision.penaltyMin;
    const max = CONFIG.collision.penaltyMax;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  getSlowFactor(timeSeconds) {
    return timeSeconds < this.slowUntil ? CONFIG.collision.slowFactor : 1;
  }

  syncVisuals(timeSeconds) {
    if (this.visuals.head) {
      const nearbyFood = this.findNearestFoodToHead(CONFIG.head.foodLeanRange);
      this.visuals.head.position = this.getHeadDisplayPosition(timeSeconds, nearbyFood);
      const lookTarget = nearbyFood
        ? vecLerp(this.currentPose.position, nearbyFood.position, CONFIG.head.foodLookBlend)
        : this.currentPose.position;
      const target = quatLookAt(this.visuals.head.position, lookTarget);
      this.visuals.head.quaternion = quatSlerp(this.visuals.head.quaternion, target, CONFIG.head.faceSlerp);
      this.visuals.head.scale = this.getHeadDisplayScale(timeSeconds);

      if (this.machine.beat === BEATS.GAME_OVER) {
        const wiggle = Math.sin(timeSeconds * CONFIG.head.gameOverIdleSpeed) * CONFIG.head.gameOverIdleAmplitude;
        this.visuals.head.position[1] += wiggle;
      }
    }

    this.syncBodyVisuals();
    this.syncLinkVisuals();
    this.syncOrbVisuals();
    this.placeTextVisuals();
  }

  syncBodyVisuals() {
    while (this.visuals.body.length > this.snake.segments.length) {
      this.visuals.body.pop();
    }

    while (this.visuals.body.length < this.snake.segments.length) {
      const segment = this.snake.segments[this.visuals.body.length];
      this.visuals.body.push(BodySegment({
        geometry: this.sphereGeometry,
        color: segment.color
      }));
    }

    this.snake.segments.forEach((segment, index) => {
      const mesh = this.visuals.body[index];
      mesh.position = [...segment.position];
      mesh.material.color = this.colorFor(segment.color);
      mesh.material.kind = index === this.snake.segments.length - 1
        ? MATERIAL_KIND.TAIL
        : MATERIAL_KIND.SOLID;
    });
  }

  syncLinkVisuals() {
    const chain = [
      this.getSnakeCollisionPosition(),
      this.snake.headPosition,
      ...this.snake.segments.map((segment) => segment.position)
    ];
    const points = this.computeLinkPoints(chain);

    while (this.visuals.links.length < points.length) {
      const bead = BodySegment({
        geometry: this.sphereGeometry,
        color: CONFIG.link.color,
        radius: CONFIG.link.radius
      });
      bead.material.kind = MATERIAL_KIND.GLOW;
      this.visuals.links.push(bead);
    }

    this.visuals.links.forEach((bead, index) => {
      if (index >= points.length) {
        bead.visible = false;
        return;
      }

      bead.visible = true;
      bead.position = points[index];
      bead.material.color = this.colorFor(CONFIG.link.color);
      bead.material.kind = MATERIAL_KIND.GLOW;
    });
  }

  computeLinkPoints(chain) {
    const points = [];
    const maxBeads = CONFIG.link.maxBeads;

    for (let index = 0; index < chain.length - 1 && points.length < maxBeads; index += 1) {
      const start = chain[index];
      const end = chain[index + 1];
      const distance = vecDistance(start, end);
      const count = Math.max(1, Math.floor(distance / CONFIG.link.beadSpacing));

      for (let beadIndex = 1; beadIndex <= count && points.length < maxBeads; beadIndex += 1) {
        points.push(vecLerp(start, end, beadIndex / (count + 1)));
      }
    }

    return points;
  }

  syncOrbVisuals() {
    const activeIds = new Set();
    for (const orb of this.spawner.getAll()) {
      activeIds.add(orb.id);
      if (!this.visuals.orbs.has(orb.id)) {
        this.visuals.orbs.set(orb.id, FoodOrb({
          sphereGeometry: this.sphereGeometry,
          color: orb.color
        }));
      }
      const visual = this.visuals.orbs.get(orb.id);
      visual.setPosition(orb.position);
      visual.setHeld(Boolean(orb.heldBy || orb.delivering));
    }

    for (const id of this.visuals.orbs.keys()) {
      if (!activeIds.has(id)) {
        this.visuals.orbs.delete(id);
      }
    }
  }

  getHeadDisplayPosition(timeSeconds, nearbyFood) {
    let position = [...this.snake.headPosition];

    if (nearbyFood) {
      const leanDirection = vecNormalize(vecSub(nearbyFood.position, position));
      position = vecScaleAndAdd(position, leanDirection, CONFIG.head.foodLeanOffset);
    }

    const bounceProgress = this.getHeadBounceProgress(timeSeconds);
    if (bounceProgress > 0) {
      position[1] += Math.sin(bounceProgress * Math.PI) * CONFIG.head.bounceHeight;
    }

    return position;
  }

  getHeadDisplayScale(timeSeconds) {
    const bounceProgress = this.getHeadBounceProgress(timeSeconds);
    const pop = bounceProgress > 0
      ? Math.sin(bounceProgress * Math.PI) * CONFIG.head.bounceScale
      : 0;
    const radius = CONFIG.head.radius * (1 + pop);
    return [radius, radius, radius];
  }

  getHeadBounceProgress(timeSeconds) {
    if (timeSeconds < this.headBounceStart || timeSeconds > this.headBounceUntil) {
      return 0;
    }

    return (timeSeconds - this.headBounceStart) / CONFIG.head.bounceDurationSeconds;
  }

  findNearestFoodToHead(maxDistance) {
    let nearest = null;
    let nearestDistance = maxDistance;

    for (const orb of this.spawner.getAll()) {
      const distance = vecDistance(this.snake.headPosition, orb.position);
      if (distance <= nearestDistance) {
        nearest = orb;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  placeTextVisuals() {
    if (this.visuals.score) {
      this.visuals.score.position = this.worldFromPlayerOffset(CONFIG.ui.scoreOffset);
    }
    if (this.visuals.hint) {
      this.visuals.hint.position = this.worldFromPlayerOffset(CONFIG.ui.hintOffset);
      this.visuals.hint.visible = this.machine.beat === BEATS.READY || this.machine.beat === BEATS.WAITING;
    }
    if (this.visuals.gameOver) {
      this.visuals.gameOver.setPosition(this.worldFromPlayerOffset(CONFIG.ui.overlayOffset));
    }
  }

  worldFromPlayerOffset(offset) {
    const forward = flattenForward(this.currentPose.forward);
    const right = [forward[2] * -1, 0, forward[0]];
    let position = [...this.currentPose.position];
    position = vecScaleAndAdd(position, right, offset[0]);
    position = vecScaleAndAdd(position, [0, 1, 0], offset[1]);
    position = vecScaleAndAdd(position, forward, -offset[2]);
    return position;
  }

  getMouthPosition(pose = this.currentPose) {
    const forward = flattenForward(pose.forward);
    let position = vecScaleAndAdd(pose.position, forward, CONFIG.eat.mouthForwardOffset);
    position = vecScaleAndAdd(position, [0, 1, 0], CONFIG.eat.mouthYOffset);
    return position;
  }

  getFoodPickupPosition(pose = this.currentPose) {
    return vecScaleAndAdd(pose.position, [0, 1, 0], CONFIG.head.waistYOffset * 0.65);
  }

  getSnakeCollisionPosition(pose = this.currentPose) {
    return vecScaleAndAdd(pose.position, [0, 1, 0], CONFIG.head.waistYOffset);
  }

  colorFor(color) {
    return COLORS[color] || COLORS.white;
  }

  collectMeshes() {
    const meshes = [];
    if (this.visuals.head) {
      meshes.push(this.visuals.head);
    }
    meshes.push(...this.visuals.body);
    meshes.push(...this.visuals.links);
    for (const orb of this.visuals.orbs.values()) {
      meshes.push(...orb.children);
    }
    if (this.visuals.score) {
      meshes.push(this.visuals.score);
    }
    if (this.visuals.hint) {
      meshes.push(this.visuals.hint);
    }
    if (this.visuals.gameOver) {
      meshes.push(...this.visuals.gameOver.children);
    }
    return meshes.filter((mesh) => mesh.visible);
  }
}

const app = new MRSnakeApp();
app.init();
