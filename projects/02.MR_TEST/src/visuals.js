import { COLORS, CONFIG } from "./config.js";
import { Group, MATERIAL_KIND, Mesh } from "./renderer.js";

export function makePresetFaceCanvas(size = CONFIG.presetFace.canvasSize) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const center = size / 2;
  const face = CONFIG.presetFace;
  const radius = size * face.radiusRatio;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.fillStyle = "#fff8f1";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = "#263238";
  ctx.beginPath();
  ctx.arc(size * face.leftEye[0], size * face.leftEye[1], size * face.eyeRadiusRatio, 0, Math.PI * 2);
  ctx.arc(size * face.rightEye[0], size * face.rightEye[1], size * face.eyeRadiusRatio, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#e64040";
  ctx.lineWidth = size * face.mouthLineWidthRatio;
  ctx.beginPath();
  ctx.arc(center, size * face.mouthCenterYRatio, size * face.mouthRadiusRatio, face.mouthStartPi * Math.PI, face.mouthEndPi * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = "#316dca";
  ctx.lineWidth = size * face.browLineWidthRatio;
  ctx.beginPath();
  ctx.moveTo(size * face.leftBrowStart[0], size * face.leftBrowStart[1]);
  ctx.quadraticCurveTo(size * face.leftBrowControl[0], size * face.leftBrowControl[1], size * face.leftBrowEnd[0], size * face.leftBrowEnd[1]);
  ctx.moveTo(size * face.rightBrowStart[0], size * face.rightBrowStart[1]);
  ctx.quadraticCurveTo(size * face.rightBrowControl[0], size * face.rightBrowControl[1], size * face.rightBrowEnd[0], size * face.rightBrowEnd[1]);
  ctx.stroke();

  const fade = ctx.createRadialGradient(center, center, radius * face.fadeInnerRatio, center, center, radius);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  return canvas;
}

export function makeTextCanvas(text, {
  width = CONFIG.visual.textCanvasWidth,
  height = CONFIG.visual.textCanvasHeight,
  fontPx = CONFIG.visual.textFontPx,
  lineHeight = CONFIG.visual.textLineHeight,
  align = "center",
  color = "#f6f7f2"
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontPx}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  const lines = String(text).split("\n");
  const blockHeight = (lines.length - 1) * lineHeight;
  const x = align === "left" ? width * 0.08 : width / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, height / 2 - blockHeight / 2 + index * lineHeight);
  });
  return canvas;
}

export function HeadSphere({ geometry, texture, radius = CONFIG.head.radius }) {
  return new Mesh({
    geometry,
    material: {
      kind: MATERIAL_KIND.HEAD,
      color: COLORS.white,
      texture
    },
    scale: [radius, radius, radius]
  });
}

export function BodySegment({ geometry, color, radius = CONFIG.body.radius, isLast = false }) {
  return new Mesh({
    geometry,
    material: {
      kind: isLast ? MATERIAL_KIND.TAIL : MATERIAL_KIND.SOLID,
      color: COLORS[color] || COLORS.white
    },
    scale: [radius, radius, radius]
  });
}

export function FoodOrb({ sphereGeometry, color, radius = CONFIG.orb.radius }) {
  const core = new Mesh({
    geometry: sphereGeometry,
    material: {
      kind: MATERIAL_KIND.FOOD,
      color: COLORS[color] || COLORS.white
    },
    scale: [radius, radius, radius]
  });

  const glowRadius = radius * CONFIG.orb.glowScale;
  const glow = new Mesh({
    geometry: sphereGeometry,
    material: {
      kind: MATERIAL_KIND.GLOW,
      color: COLORS[color] || COLORS.white
    },
    scale: [glowRadius, glowRadius, glowRadius]
  });

  const group = new Group([glow, core]);
  group.color = color;
  group.setPosition = (position) => {
    core.position = [...position];
    glow.position = [...position];
  };
  group.setHeld = (held) => {
    const scale = held ? CONFIG.orb.glowScale * 1.18 : CONFIG.orb.glowScale;
    glow.scale = [radius * scale, radius * scale, radius * scale];
  };
  return group;
}

export function TextSprite({ planeGeometry, renderer, text, width, height, color = COLORS.text, fontPx, lineHeight }) {
  const canvas = makeTextCanvas(text, { fontPx, lineHeight });
  return new Mesh({
    geometry: planeGeometry,
    material: {
      kind: MATERIAL_KIND.TEXT,
      color,
      texture: renderer.createTextureFromCanvas(canvas)
    },
    scale: [width, height, 1],
    billboard: true
  });
}

export function updateTextSprite(mesh, renderer, text, options = {}) {
  const canvas = makeTextCanvas(text, options);
  mesh.material.texture = renderer.createTextureFromCanvas(canvas);
}

export function ScoreDisplay({ planeGeometry, renderer, score = 0 }) {
  return TextSprite({
    planeGeometry,
    renderer,
    text: `Length ${score}`,
    width: CONFIG.visual.scoreWidth,
    height: CONFIG.visual.scoreHeight,
    fontPx: CONFIG.visual.scoreFontPx,
    lineHeight: CONFIG.visual.scoreLineHeight
  });
}

export function HintDisplay({ planeGeometry, renderer, text }) {
  return TextSprite({
    planeGeometry,
    renderer,
    text,
    width: CONFIG.visual.hintWidth,
    height: CONFIG.visual.hintHeight,
    fontPx: CONFIG.visual.hintFontPx,
    lineHeight: CONFIG.visual.hintLineHeight
  });
}

export function GameOverOverlay({ planeGeometry, renderer, score }) {
  const panel = new Mesh({
    geometry: planeGeometry,
    material: {
      kind: MATERIAL_KIND.PANEL,
      color: COLORS.panel
    },
    scale: [CONFIG.visual.panelWidth, CONFIG.visual.panelHeight, 1],
    billboard: true
  });

  const title = TextSprite({
    planeGeometry,
    renderer,
    text: "TIME UP",
    width: CONFIG.visual.overlayTitleWidth,
    height: CONFIG.visual.overlayLineHeight,
    fontPx: CONFIG.visual.overlayTitleFontPx,
    lineHeight: CONFIG.visual.overlayTitleLineHeight
  });

  const body = TextSprite({
    planeGeometry,
    renderer,
    text: `내 얼굴 친구 길이 ${score}\nTrigger 다시하기  Grip 다음 학생`,
    width: CONFIG.visual.overlayTextWidth,
    height: CONFIG.visual.overlayLineHeight * CONFIG.visual.overlayBodyHeightScale,
    fontPx: CONFIG.visual.overlayBodyFontPx,
    lineHeight: CONFIG.visual.overlayBodyLineHeight
  });

  const group = new Group([panel, title, body]);
  group.setPosition = (position) => {
    panel.position = [...position];
    title.position = [position[0], position[1] + CONFIG.visual.overlayTitleYOffset, position[2]];
    body.position = [position[0], position[1] + CONFIG.visual.overlayBodyYOffset, position[2]];
  };
  return group;
}
