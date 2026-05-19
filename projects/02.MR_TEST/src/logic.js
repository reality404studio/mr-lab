import { BEATS, CONFIG } from "./config.js";
import {
  flattenForward,
  horizontalRightFromForward,
  vecAdd,
  vecCopy,
  vecDistance,
  vecLerp,
  vecNormalize,
  vecScale,
  vecScaleAndAdd,
  vecSub
} from "./math.js";

export class ScoreManager {
  constructor() {
    this.value = 0;
  }

  reset() {
    this.value = 0;
  }

  increment() {
    this.value += 1;
    return this.value;
  }

  get() {
    return this.value;
  }
}

export class CollisionDetector {
  check(playerPos, tailPos, radius = CONFIG.collision.threshold) {
    if (!tailPos) {
      return false;
    }
    return vecDistance(playerPos, tailPos) <= radius;
  }
}

export class EatDetector {
  check(orbPos, headPos, threshold = CONFIG.eat.threshold) {
    return vecDistance(orbPos, headPos) <= threshold;
  }
}

export class SnakeController {
  constructor(config = CONFIG) {
    this.config = config;
    this.headPosition = [0, 1.55, -config.head.followDistance];
    this.trailDirection = [0, 0, 1];
    this.segments = [];
    this.history = [];
    this.frozen = false;
  }

  reset(playerPos = CONFIG.preview.startPosition, playerForward = [0, 0, -1]) {
    this.segments = [];
    this.history = [];
    this.frozen = false;
    this.headPosition = this.computeHeadPosition(playerPos, playerForward);
    this.trailDirection = this.computeTrailDirection(playerForward);
    this.seedHistory();
  }

  freeze() {
    this.frozen = true;
  }

  unfreeze() {
    this.frozen = false;
  }

  computeHeadPosition(playerPos, playerForward) {
    const flatForward = flattenForward(playerForward);
    return vecScaleAndAdd(playerPos, flatForward, -this.config.head.followDistance);
  }

  computeTrailDirection(playerForward) {
    return vecScale(flattenForward(playerForward), -1);
  }

  tick(playerPos, playerForward) {
    if (this.frozen) {
      return;
    }

    this.headPosition = this.computeHeadPosition(playerPos, playerForward);
    this.trailDirection = this.computeTrailDirection(playerForward);
    this.history.push([...this.headPosition]);

    while (this.history.length > this.config.snake.historyLimit) {
      this.history.shift();
    }

    if (this.history.length < this.segments.length + 2) {
      this.seedHistory();
    }

    this.segments.forEach((segment, index) => {
      const distance = this.config.snake.segmentSpacing * (index + 1);
      segment.position = this.sampleHistory(distance);
    });
  }

  addSegment(color) {
    const position = this.sampleHistory(this.config.snake.segmentSpacing * (this.segments.length + 1));
    this.segments.push({ color, position });
    return this.segments[this.segments.length - 1];
  }

  getSegmentPositions() {
    return this.segments.map((segment) => ({
      pos: [...segment.position],
      color: segment.color
    }));
  }

  getTailPosition() {
    if (this.segments.length < this.config.collision.minSegments) {
      return null;
    }
    return this.segments[this.segments.length - 1].position;
  }

  seedHistory() {
    if (this.history.length === 0) {
      this.history.push([...this.headPosition]);
    }

    const seedLimit = this.config.snake.historyLimit / 4;
    while (this.history.length < seedLimit) {
      const distance = this.config.snake.historySampleSpacing * this.history.length;
      this.history.unshift(vecScaleAndAdd(this.headPosition, this.trailDirection, distance));
    }
  }

  sampleHistory(targetDistance) {
    if (this.history.length === 0) {
      return [...this.headPosition];
    }

    let remaining = targetDistance;
    for (let index = this.history.length - 1; index > 0; index -= 1) {
      const current = this.history[index];
      const previous = this.history[index - 1];
      const segmentDistance = vecDistance(current, previous);

      if (remaining <= segmentDistance) {
        const t = segmentDistance === 0 ? 0 : remaining / segmentDistance;
        return vecLerp(current, previous, t);
      }

      remaining -= segmentDistance;
    }

    return vecScaleAndAdd(this.history[0], this.trailDirection, remaining);
  }
}

export class OrbSpawner {
  constructor(config = CONFIG) {
    this.config = config;
    this.active = new Map();
    this.nextId = 1;
  }

  reset(playerPos, playerForward) {
    this.active.clear();
    this.nextId = 1;
    this.ensureSet(playerPos, playerForward);
  }

  ensureSet(playerPos, playerForward) {
    for (const color of ["red", "yellow", "blue"]) {
      const hasColor = [...this.active.values()].some((orb) => orb.color === color);
      if (!hasColor) {
        this.spawn(color, playerPos, playerForward);
      }
    }
  }

  spawn(color, playerPos, playerForward) {
    const flatForward = flattenForward(playerForward);
    const right = horizontalRightFromForward(flatForward);
    const config = this.config.spawn;
    let position = null;

    for (let attempt = 0; attempt < config.attempts; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin);
      const height = config.heightMin + Math.random() * (config.heightMax - config.heightMin);
      const lateral = vecScale(right, Math.sin(angle) * radius);
      const forward = vecScale(flatForward, Math.cos(angle) * radius);
      const candidate = vecAdd(vecAdd(playerPos, lateral), forward);
      candidate[1] = playerPos[1] + height;

      if (vecDistance(playerPos, candidate) >= config.minDistFromPlayer) {
        position = candidate;
        break;
      }
    }

    if (!position) {
      position = vecScaleAndAdd(playerPos, flatForward, -config.minDistFromPlayer);
    }

    const id = `orb-${this.nextId}`;
    this.nextId += 1;
    const orb = { id, color, position, heldBy: null };
    this.active.set(id, orb);
    return orb;
  }

  remove(orbId) {
    this.active.delete(orbId);
  }

  getAll() {
    return [...this.active.values()];
  }

  get(orbId) {
    return this.active.get(orbId);
  }

  setHeld(orbId, controllerId) {
    const orb = this.active.get(orbId);
    if (orb) {
      orb.heldBy = controllerId;
    }
  }

  releaseHeld(controllerId) {
    for (const orb of this.active.values()) {
      if (orb.heldBy === controllerId) {
        orb.heldBy = null;
      }
    }
  }

  updateHeldPosition(controllerId, position) {
    for (const orb of this.active.values()) {
      if (orb.heldBy === controllerId) {
        vecCopy(orb.position, position);
      }
    }
  }
}

export class GameStateMachine {
  constructor({ mode = CONFIG.mode.preset } = {}) {
    this.mode = mode;
    this.beat = BEATS.BOOT;
    this.xrReady = false;
    this.currentTexture = null;
    this.textureQueue = [];
    this.listeners = new Map();
  }

  on(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  emit(type, payload = {}) {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(payload);
    }
  }

  boot() {
    this.enter(BEATS.BOOT);
  }

  enter(beat, meta = {}) {
    const previous = this.beat;
    this.beat = beat;
    this.emit("beat", { beat, previous, ...meta });
  }

  setError(message) {
    this.enter(BEATS.ERROR, { message });
  }

  setXrReady() {
    this.xrReady = true;
    this.tryReady();
  }

  setTexture(texturePayload) {
    this.currentTexture = texturePayload;
    this.tryReady();
  }

  receiveTexture(texturePayload) {
    if (this.beat === BEATS.PLAYING || this.beat === BEATS.GAME_OVER || this.currentTexture) {
      this.textureQueue.push(texturePayload);
      this.emit("queue", { size: this.textureQueue.length });
      return;
    }

    this.setTexture(texturePayload);
  }

  tryReady() {
    if (!this.xrReady) {
      return;
    }

    if (!this.currentTexture && this.mode === CONFIG.mode.custom) {
      this.enter(BEATS.WAITING);
      return;
    }

    if (this.currentTexture) {
      this.enter(BEATS.READY);
    }
  }

  firstGrab() {
    if (this.beat === BEATS.READY) {
      this.enter(BEATS.PLAYING);
    }
  }

  gameOver(score) {
    if (this.beat === BEATS.PLAYING) {
      this.enter(BEATS.GAME_OVER, { score });
    }
  }

  restart() {
    if (this.beat === BEATS.GAME_OVER) {
      this.enter(BEATS.READY);
    }
  }

  nextStudent() {
    if (this.beat !== BEATS.GAME_OVER && this.beat !== BEATS.WAITING) {
      return;
    }

    const next = this.textureQueue.shift();
    this.emit("queue", { size: this.textureQueue.length });

    if (next) {
      this.currentTexture = next;
      this.enter(BEATS.READY, { textureChanged: true });
      return;
    }

    if (this.mode === CONFIG.mode.custom) {
      this.currentTexture = null;
      this.enter(BEATS.WAITING);
    }
  }
}
