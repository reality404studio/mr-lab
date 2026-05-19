import {
  mat4FromBillboard,
  mat4FromRotationTranslationScale,
  quatIdentity
} from "./math.js";
import { CONFIG } from "./config.js";

export const MATERIAL_KIND = Object.freeze({
  SOLID: 0,
  HEAD: 1,
  TEXT: 2,
  PANEL: 3,
  GLOW: 4,
  TAIL: 5,
  FOOD: 6
});

const glslFloat = (value) => Number.isInteger(value) ? `${value}.0` : `${value}`;
const glslVec3 = (values) => values.map(glslFloat).join(", ");

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

varying vec3 vWorldNormal;
varying vec3 vLocalNormal;
varying vec2 vUv;

void main() {
  vec4 worldPosition = uModel * vec4(aPosition, 1.0);
  vWorldNormal = normalize(mat3(uModel) * aNormal);
  vLocalNormal = normalize(aNormal);
  vUv = aUv;
  gl_Position = uProjection * uView * worldPosition;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec4 uColor;
uniform sampler2D uTexture;
uniform int uKind;
uniform float uTime;

varying vec3 vWorldNormal;
varying vec3 vLocalNormal;
varying vec2 vUv;

void main() {
  vec4 color = uColor;
  float light = max(dot(normalize(vWorldNormal), normalize(vec3(${glslVec3(CONFIG.shader.lightDirection)}))), 0.0) * ${glslFloat(CONFIG.shader.lightStrength)} + ${glslFloat(CONFIG.shader.ambientStrength)};

  if (uKind == 1) {
    vec2 faceUv = vLocalNormal.xy * 0.5 + 0.5;
    vec4 face = texture2D(uTexture, faceUv);
    float front = smoothstep(${glslFloat(CONFIG.shader.headFrontFadeStart)}, ${glslFloat(CONFIG.shader.headFrontFadeEnd)}, vLocalNormal.z);
    float faceAlpha = face.a * front;
    color = vec4(mix(vec3(1.0), face.rgb, faceAlpha), 1.0);
  } else if (uKind == 2) {
    color = texture2D(uTexture, vUv) * uColor;
    light = 1.0;
    if (color.a < 0.05) {
      discard;
    }
  } else if (uKind == 3) {
    light = 1.0;
  } else if (uKind == 4) {
    float glowPulse = ${glslFloat(CONFIG.shader.glowPulseBase)} + ${glslFloat(CONFIG.shader.glowPulseAmplitude)} * sin(uTime * ${glslFloat(CONFIG.shader.glowPulseFrequency)});
    color.rgb = mix(color.rgb, vec3(1.0), 0.28) * glowPulse;
    color.a *= ${glslFloat(CONFIG.shader.glowAlpha)} * glowPulse;
    light = 1.0;
  } else if (uKind == 5) {
    float pulse = ${glslFloat(CONFIG.shader.tailPulseBase)} + ${glslFloat(CONFIG.shader.tailPulseAmplitude)} * sin(uTime * ${glslFloat(CONFIG.shader.tailPulseFrequency)});
    color.rgb = mix(color.rgb, vec3(1.0), pulse);
  } else if (uKind == 6) {
    float foodPulse = ${glslFloat(CONFIG.shader.foodPulseBase)} + ${glslFloat(CONFIG.shader.foodPulseAmplitude)} * sin(uTime * ${glslFloat(CONFIG.shader.foodPulseFrequency)});
    color.rgb = mix(color.rgb, vec3(1.0), 0.22) * foodPulse;
    light = 1.0;
  }

  color.rgb *= light;
  gl_FragColor = color;
}
`;

export class Mesh {
  constructor({ geometry, material, position = [0, 0, 0], scale = [1, 1, 1], quaternion = quatIdentity(), billboard = false }) {
    this.geometry = geometry;
    this.material = material;
    this.position = [...position];
    this.scale = [...scale];
    this.quaternion = [...quaternion];
    this.billboard = billboard;
    this.visible = true;
  }

  getModelMatrix(cameraPosition) {
    if (this.billboard && cameraPosition) {
      return mat4FromBillboard(this.position, cameraPosition, this.scale);
    }
    return mat4FromRotationTranslationScale(this.quaternion, this.position, this.scale);
  }
}

export class Group {
  constructor(children = []) {
    this.children = children;
    this.visible = true;
  }

  add(child) {
    this.children.push(child);
    return child;
  }

  setVisible(visible) {
    this.visible = visible;
    for (const child of this.children) {
      child.visible = visible;
    }
  }
}

export class WebGLSceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      xrCompatible: true,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false
    });

    if (!this.gl) {
      throw new Error("WebGL을 초기화할 수 없습니다.");
    }

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    this.locations = this.getLocations();
    this.bufferCache = new WeakMap();
    this.whiteTexture = this.createSolidTexture([255, 255, 255, 255]);

    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resizeToDisplaySize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "WebGL 프로그램 링크 실패");
    }

    return program;
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "WebGL 셰이더 컴파일 실패");
    }

    return shader;
  }

  getLocations() {
    const gl = this.gl;
    return {
      aPosition: gl.getAttribLocation(this.program, "aPosition"),
      aNormal: gl.getAttribLocation(this.program, "aNormal"),
      aUv: gl.getAttribLocation(this.program, "aUv"),
      uProjection: gl.getUniformLocation(this.program, "uProjection"),
      uView: gl.getUniformLocation(this.program, "uView"),
      uModel: gl.getUniformLocation(this.program, "uModel"),
      uColor: gl.getUniformLocation(this.program, "uColor"),
      uTexture: gl.getUniformLocation(this.program, "uTexture"),
      uKind: gl.getUniformLocation(this.program, "uKind"),
      uTime: gl.getUniformLocation(this.program, "uTime")
    };
  }

  getBufferInfo(geometry) {
    if (this.bufferCache.has(geometry)) {
      return this.bufferCache.get(geometry);
    }

    const gl = this.gl;
    const info = {
      position: gl.createBuffer(),
      normal: gl.createBuffer(),
      uv: gl.createBuffer(),
      index: gl.createBuffer(),
      count: geometry.indices.length
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, info.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, info.normal);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, info.uv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.uvs), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, info.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

    this.bufferCache.set(geometry, info);
    return info;
  }

  createSolidTexture(rgba) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    this.configureTexture();
    return texture;
  }

  createTextureFromCanvas(canvas) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    this.configureTexture();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return texture;
  }

  createTextureFromImage(image) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.configureTexture();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return texture;
  }

  configureTexture() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  render(meshes, camera, { time = 0, transparent = false, viewport = null } = {}) {
    const gl = this.gl;
    gl.useProgram(this.program);

    if (viewport) {
      gl.enable(gl.SCISSOR_TEST);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      gl.scissor(viewport.x, viewport.y, viewport.width, viewport.height);
    } else {
      gl.disable(gl.SCISSOR_TEST);
      this.resizeToDisplaySize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    gl.clearColor(0.02, 0.025, 0.03, transparent ? 0 : 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(this.locations.uProjection, false, camera.projectionMatrix);
    gl.uniformMatrix4fv(this.locations.uView, false, camera.viewMatrix);
    gl.uniform1i(this.locations.uTexture, 0);
    gl.uniform1f(this.locations.uTime, time);

    for (const mesh of meshes) {
      if (!mesh.visible) {
        continue;
      }
      this.renderMesh(mesh, camera.cameraPosition);
    }
  }

  renderMesh(mesh, cameraPosition) {
    const gl = this.gl;
    const info = this.getBufferInfo(mesh.geometry);
    const material = mesh.material;
    const isGlow = material.kind === MATERIAL_KIND.GLOW;

    if (isGlow) {
      gl.depthMask(false);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.depthMask(true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, info.position);
    gl.enableVertexAttribArray(this.locations.aPosition);
    gl.vertexAttribPointer(this.locations.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, info.normal);
    gl.enableVertexAttribArray(this.locations.aNormal);
    gl.vertexAttribPointer(this.locations.aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, info.uv);
    gl.enableVertexAttribArray(this.locations.aUv);
    gl.vertexAttribPointer(this.locations.aUv, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, info.index);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, material.texture || this.whiteTexture);

    gl.uniformMatrix4fv(this.locations.uModel, false, mesh.getModelMatrix(cameraPosition));
    gl.uniform4fv(this.locations.uColor, material.color);
    gl.uniform1i(this.locations.uKind, material.kind);
    gl.drawElements(gl.TRIANGLES, info.count, gl.UNSIGNED_SHORT, 0);

    if (isGlow) {
      gl.depthMask(true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
  }
}

export function createSphereGeometry(widthSegments, heightSegments) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x <= widthSegments; x += 1) {
      const u = x / widthSegments;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const px = sinTheta * sinPhi;
      const py = cosTheta;
      const pz = sinTheta * cosPhi;

      positions.push(px, py, pz);
      normals.push(px, py, pz);
      uvs.push(u, 1 - v);
    }
  }

  for (let y = 0; y < heightSegments; y += 1) {
    for (let x = 0; x < widthSegments; x += 1) {
      const a = y * (widthSegments + 1) + x;
      const b = a + widthSegments + 1;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return { positions, normals, uvs, indices };
}

export function createPlaneGeometry() {
  return {
    positions: [
      -0.5, -0.5, 0,
      0.5, -0.5, 0,
      0.5, 0.5, 0,
      -0.5, 0.5, 0
    ],
    normals: [
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1
    ],
    uvs: [
      0, 1,
      1, 1,
      1, 0,
      0, 0
    ],
    indices: [0, 1, 2, 0, 2, 3]
  };
}
