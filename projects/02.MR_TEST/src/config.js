export const BEATS = Object.freeze({
  BOOT: "BOOT",
  READY: "READY",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER",
  WAITING: "WAITING",
  ERROR: "ERROR"
});

export const COLORS = Object.freeze({
  red: Object.freeze([1.0, 0.18, 0.16, 1.0]),
  yellow: Object.freeze([1.0, 0.82, 0.12, 1.0]),
  blue: Object.freeze([0.18, 0.48, 1.0, 1.0]),
  white: Object.freeze([1.0, 1.0, 1.0, 1.0]),
  panel: Object.freeze([0.03, 0.05, 0.06, 0.82]),
  text: Object.freeze([0.96, 0.98, 0.95, 1.0])
});

export const CONFIG = Object.freeze({
  mode: Object.freeze({
    preset: "preset",
    custom: "custom"
  }),
  xr: Object.freeze({
    preferredMode: "immersive-ar",
    fallbackMode: "immersive-vr",
    referenceSpaces: Object.freeze(["local-floor", "local"]),
    optionalFeatures: Object.freeze(["local-floor", "bounded-floor", "hand-tracking", "dom-overlay"])
  }),
  head: Object.freeze({
    radius: 0.15,
    followDistance: 0.42,
    followLerp: 0.18,
    waistYOffset: -0.55,
    faceSlerp: 0.1,
    gameOverIdleAmplitude: 0.025,
    gameOverIdleSpeed: 1.8
  }),
  body: Object.freeze({
    radius: 0.1
  }),
  orb: Object.freeze({
    radius: 0.04,
    glowScale: 2.75
  }),
  snake: Object.freeze({
    segmentSpacing: 0.22,
    historySampleSpacing: 0.04,
    historyLimit: 420
  }),
  grab: Object.freeze({
    threshold: 0.14,
    controllerHoldOffset: Object.freeze([0, 0, -0.03])
  }),
  eat: Object.freeze({
    threshold: 0.18,
    mouthForwardOffset: 0.14,
    mouthYOffset: -0.12
  }),
  collision: Object.freeze({
    threshold: 0.1,
    minSegments: 6
  }),
  link: Object.freeze({
    radius: 0.014,
    beadSpacing: 0.11,
    maxBeads: 28,
    color: "blue"
  }),
  spawn: Object.freeze({
    minDistFromPlayer: 0.8,
    radiusMin: 0.85,
    radiusMax: 1.35,
    heightMin: -0.18,
    heightMax: 0.22,
    attempts: 24
  }),
  input: Object.freeze({
    triggerButtonIndex: 0,
    gripButtonIndex: 1
  }),
  visual: Object.freeze({
    sphereWidthSegments: 32,
    sphereHeightSegments: 18,
    textCanvasWidth: 1024,
    textCanvasHeight: 256,
    textFontPx: 82,
    textLineHeight: 96,
    panelWidth: 1.3,
    panelHeight: 0.42,
    scoreWidth: 0.54,
    scoreHeight: 0.14,
    scoreFontPx: 94,
    scoreLineHeight: 100,
    hintWidth: 1.15,
    hintHeight: 0.2,
    hintFontPx: 58,
    hintLineHeight: 72,
    overlayTitleWidth: 1.1,
    overlayTextWidth: 1.05,
    overlayLineHeight: 0.14,
    overlayBodyHeightScale: 1.75,
    overlayTitleYOffset: 0.09,
    overlayBodyYOffset: -0.08,
    overlayTitleFontPx: 82,
    overlayTitleLineHeight: 92,
    overlayBodyFontPx: 46,
    overlayBodyLineHeight: 66
  }),
  ui: Object.freeze({
    scoreOffset: Object.freeze([0, 0.42, -1.05]),
    hintOffset: Object.freeze([0, -0.05, -1.05]),
    overlayOffset: Object.freeze([0, 0, -1.15])
  }),
  preview: Object.freeze({
    startPosition: Object.freeze([0, 1.55, 0]),
    cameraPosition: Object.freeze([0, 1.62, 2.15]),
    cameraTarget: Object.freeze([0, 1.42, 0]),
    cameraBackDistance: 1.9,
    cameraSideOffset: 0.95,
    cameraForwardOffset: 0.55,
    cameraHeight: 0.32,
    cameraTargetYOffset: -0.1,
    fieldOfView: 60,
    near: 0.05,
    far: 60,
    moveSpeed: 0.05,
    turnSpeed: 0.055,
    controllerReach: 0.92
  }),
  audio: Object.freeze({
    eatFrequency: 620,
    eatDuration: 0.08,
    volume: 0.025
  }),
  shader: Object.freeze({
    lightDirection: Object.freeze([-0.38, 0.82, 0.42]),
    lightStrength: 0.45,
    ambientStrength: 0.55,
    headFrontFadeStart: 0.04,
    headFrontFadeEnd: 0.22,
    glowAlpha: 0.72,
    glowPulseFrequency: 5.2,
    glowPulseBase: 0.76,
    glowPulseAmplitude: 0.24,
    foodPulseFrequency: 4.8,
    foodPulseBase: 0.86,
    foodPulseAmplitude: 0.14,
    tailPulseFrequency: 6.0,
    tailPulseBase: 0.42,
    tailPulseAmplitude: 0.34
  }),
  presetFace: Object.freeze({
    canvasSize: 512,
    radiusRatio: 0.47,
    fadeInnerRatio: 0.62,
    leftEye: Object.freeze([0.36, 0.42]),
    rightEye: Object.freeze([0.64, 0.42]),
    eyeRadiusRatio: 0.045,
    mouthCenterYRatio: 0.53,
    mouthRadiusRatio: 0.18,
    mouthStartPi: 0.1,
    mouthEndPi: 0.9,
    mouthLineWidthRatio: 0.04,
    browLineWidthRatio: 0.035,
    leftBrowStart: Object.freeze([0.27, 0.31]),
    leftBrowControl: Object.freeze([0.36, 0.25]),
    leftBrowEnd: Object.freeze([0.45, 0.31]),
    rightBrowStart: Object.freeze([0.55, 0.31]),
    rightBrowControl: Object.freeze([0.64, 0.25]),
    rightBrowEnd: Object.freeze([0.73, 0.31])
  })
});
